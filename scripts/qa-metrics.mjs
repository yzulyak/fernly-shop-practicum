#!/usr/bin/env node
/**
 * Read-only QA pipeline metrics. Lists and reads with `gh`; never writes to GitHub.
 *
 *   node scripts/qa-metrics.mjs
 *
 * Writes docs/QA-METRICS.md for every pull request labelled plan-approved.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const OUT = join(ROOT, 'docs', 'QA-METRICS.md');
const QA_MARKER = '<!-- fernly-qa-report -->';
const PLAN_REVIEW_RE = /^Plan review:\s*(\d+)\s*\/\s*(\d+)\b/;
const WORKFLOW = 'pr-triage.yml';

function ghJson(args) {
  const result = spawnSync('gh', args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || `gh exited ${result.status}`).trim();
    throw new Error(err);
  }
  const text = (result.stdout || '').trim();
  if (!text) return null;
  return JSON.parse(text);
}

function ghText(args) {
  const result = spawnSync('gh', args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || `gh exited ${result.status}`).trim();
    throw new Error(err);
  }
  return (result.stdout || '').trim();
}

function parseGithubRepo(url) {
  const m = String(url)
    .trim()
    .replace(/\.git$/, '')
    .match(/github\.com[:/]([^/]+)\/([^/]+)$/i);
  if (!m) return null;
  return `${m[1]}/${m[2]}`;
}

function resolveRepo() {
  const fromEnv = process.env.GH_REPO || process.env.GITHUB_REPOSITORY;
  if (fromEnv) return fromEnv;
  // Prefer origin so a fork with `gh-resolved=base` still measures this checkout.
  const git = spawnSync('git', ['remote', 'get-url', 'origin'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (git.status === 0) {
    const parsed = parseGithubRepo(git.stdout);
    if (parsed) return parsed;
  }
  return ghText(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']);
}

function isBot(user) {
  if (!user) return true;
  if (user.type === 'Bot') return true;
  const login = String(user.login || '');
  return login.endsWith('[bot]') || login === 'github-actions[bot]';
}

function isPerson(user) {
  return !isBot(user);
}

function minutesBetween(startIso, endIso) {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return (end - start) / 60_000;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function fmtMinutes(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return String(round1(n));
}

function fmtRatio(num, den) {
  if (den == null || den === 0) return `${num ?? 0}/${den ?? 0} (—)`;
  const pct = Math.round((1000 * num) / den) / 10;
  return `${num}/${den} (${pct}%)`;
}

function listPlanApprovedPrs(repo) {
  return (
    ghJson([
      'pr',
      'list',
      '--repo',
      repo,
      '--label',
      'plan-approved',
      '--state',
      'all',
      '--limit',
      '100',
      '--json',
      'number,title,createdAt,headRefName,url',
    ]) || []
  );
}

function listIssueComments(repo, number) {
  const path = `repos/${repo}/issues/${number}/comments`;
  const raw = ghText(['api', path, '--paginate']);
  if (!raw) return [];
  // --paginate may concatenate JSON arrays
  const chunks = raw.trim().startsWith('[')
    ? raw.trim().replace(/\]\s*\[/g, ',')
    : `[${raw}]`;
  try {
    return JSON.parse(chunks);
  } catch {
    // Fallback: page without concatenate edge cases
    return ghJson(['api', path, '--paginate']) || [];
  }
}

function parsePlanReview(comments) {
  let last = null;
  for (const c of comments) {
    if (!isPerson(c.user)) continue;
    const body = String(c.body || '').replace(/^\uFEFF/, '');
    const m = body.match(PLAN_REVIEW_RE);
    if (!m) continue;
    last = {
      right: Number(m[1]),
      reviewed: Number(m[2]),
      createdAt: c.created_at,
      author: c.user.login,
    };
  }
  return last;
}

function firstPlanComment(comments) {
  for (const c of comments) {
    if (c.user?.login !== 'github-actions[bot]') continue;
    const body = String(c.body || '');
    if (body.includes(QA_MARKER)) continue;
    return c;
  }
  return null;
}

function firstQaReportComment(comments) {
  for (const c of comments) {
    if (String(c.body || '').includes(QA_MARKER)) return c;
  }
  return null;
}

function listFinishedTriageRuns(repo, branch) {
  const runs =
    ghJson([
      'run',
      'list',
      '--repo',
      repo,
      '--workflow',
      WORKFLOW,
      '--branch',
      branch,
      '--limit',
      '100',
      '--json',
      'databaseId,status,conclusion,createdAt,updatedAt,headBranch',
    ]) || [];
  return runs.filter((r) => r.status === 'completed');
}

function runAgentMinutes(repo, runId) {
  const detail = ghJson([
    'run',
    'view',
    String(runId),
    '--repo',
    repo,
    '--json',
    'jobs',
  ]);
  const jobs = detail?.jobs || [];
  let total = 0;
  for (const job of jobs) {
    if (job.conclusion === 'skipped') continue;
    const mins = minutesBetween(job.startedAt, job.completedAt);
    if (mins != null) total += mins;
  }
  return total;
}

function issueLinksPr(issue, pr) {
  const text = `${issue.title || ''}\n${issue.body || ''}\n${issue.url || ''}`;
  const url = pr.url;
  if (url && text.includes(url)) return true;
  // Common markdown / shorthand references
  const patterns = [
    new RegExp(`\\b${pr.number}\\b.*\\bpull\\b`, 'i'),
    new RegExp(`/pull/${pr.number}(?:\\b|$)`),
    new RegExp(`\\bPR\\s*#${pr.number}\\b`, 'i'),
    new RegExp(`\\b#${pr.number}\\b`),
  ];
  return patterns.some((re) => re.test(text));
}

function listQaFindings(repo) {
  try {
    return (
      ghJson([
        'issue',
        'list',
        '--repo',
        repo,
        '--label',
        'qa-finding',
        '--state',
        'all',
        '--limit',
        '1000',
        '--json',
        'number,title,body,state,stateReason,url',
      ]) || []
    );
  } catch (err) {
    const msg = String(err.message || err);
    if (/disabled issues|Issues are disabled|HTTP 410/i.test(msg)) {
      console.warn(`[qa-metrics] issues disabled on ${repo}; treating findings as none`);
      return [];
    }
    throw err;
  }
}

function measurePr(repo, pr, findings) {
  const comments = listIssueComments(repo, pr.number);
  // API returns oldest-first; keep that order for "first"
  comments.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

  const planReview = parsePlanReview(comments);
  const planComment = firstPlanComment(comments);
  const qaComment = firstQaReportComment(comments);

  const runs = listFinishedTriageRuns(repo, pr.headRefName);
  let agentMinutes = 0;
  for (const run of runs) {
    agentMinutes += runAgentMinutes(repo, run.databaseId);
  }

  const linked = findings.filter((f) => issueLinksPr(f, pr));
  const falseAlarms = linked.filter(
    (f) => f.state === 'CLOSED' && String(f.stateReason || '').toUpperCase() === 'NOT_PLANNED',
  );

  return {
    number: pr.number,
    title: pr.title || '',
    url: pr.url,
    branch: pr.headRefName,
    rowsRight: planReview?.right ?? null,
    rowsReviewed: planReview?.reviewed ?? null,
    minutesToPlan: planComment
      ? minutesBetween(pr.createdAt, planComment.created_at)
      : null,
    minutesToQaReport: qaComment
      ? minutesBetween(pr.createdAt, qaComment.created_at)
      : null,
    agentMinutes,
    findings: linked.length,
    falseAlarms: falseAlarms.length,
  };
}

function renderMarkdown(repo, rows) {
  let right = 0;
  let reviewed = 0;
  let findings = 0;
  let falseAlarms = 0;
  let agentMinutes = 0;
  for (const r of rows) {
    if (r.rowsRight != null && r.rowsReviewed != null) {
      right += r.rowsRight;
      reviewed += r.rowsReviewed;
    }
    findings += r.findings;
    falseAlarms += r.falseAlarms;
    agentMinutes += r.agentMinutes;
  }

  const totals =
    `Routing accuracy: ${fmtRatio(right, reviewed)}. ` +
    `False-alarm rate: ${fmtRatio(falseAlarms, findings)}. ` +
    `Agent minutes (total): ${fmtMinutes(agentMinutes)}. ` +
    `Pull requests: ${rows.length}.`;

  const lines = [
    '# QA metrics',
    '',
    `Repository: \`${repo}\`. Generated by \`node scripts/qa-metrics.mjs\` (read-only \`gh\` lists/reads).`,
    '',
    totals,
    '',
    '| PR | Plan rows right | Minutes to plan | Minutes to QA report | Agent minutes | Findings | False alarms |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];

  const sorted = [...rows].sort((a, b) => a.number - b.number);
  for (const r of sorted) {
    const planRows =
      r.rowsRight != null && r.rowsReviewed != null
        ? `${r.rowsRight}/${r.rowsReviewed}`
        : '—';
    lines.push(
      `| [#${r.number}](${r.url}) ${escapeCells(r.title)} | ${planRows} | ${fmtMinutes(r.minutesToPlan)} | ${fmtMinutes(r.minutesToQaReport)} | ${fmtMinutes(r.agentMinutes)} | ${r.findings} | ${r.falseAlarms} |`,
    );
  }

  lines.push(
    '',
    '## How each number is measured',
    '',
    '- **Plan rows right / reviewed** — from the last human PR comment whose body starts with `Plan review: N/M` (`N` right, `M` reviewed). Bots are ignored.',
    '- **Minutes to plan** — minutes from PR open to the first `github-actions[bot]` comment that is not a QA report (`<!-- fernly-qa-report -->`).',
    '- **Minutes to QA report** — minutes from PR open to the first comment containing `<!-- fernly-qa-report -->`.',
    '- **Agent minutes** — sum of non-skipped job durations on finished (`status=completed`) `pr-triage.yml` workflow runs for the PR head branch.',
    '- **Findings** — issues labelled `qa-finding` whose title/body link this PR (URL, `/pull/N`, or `#N`).',
    '- **False alarms** — those findings closed with state reason `not planned`.',
    '- **Routing accuracy** — total rows right ÷ total rows reviewed across PRs that have a plan-review comment.',
    '- **False-alarm rate** — total false alarms ÷ total findings.',
    '',
    'Money (model / agent spend) is not available from GitHub. Use the [Cursor dashboard](https://cursor.com/dashboard) for cost.',
    '',
  );

  return lines.join('\n');
}

function escapeCells(text) {
  return String(text || '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function main() {
  const repo = resolveRepo();
  console.log(`[qa-metrics] repo ${repo}`);
  const prs = listPlanApprovedPrs(repo);
  console.log(`[qa-metrics] ${prs.length} plan-approved PR(s)`);
  const findings = listQaFindings(repo);
  console.log(`[qa-metrics] ${findings.length} qa-finding issue(s)`);

  const rows = [];
  for (const pr of prs) {
    console.log(`[qa-metrics] measuring #${pr.number} (${pr.headRefName})`);
    rows.push(measurePr(repo, pr, findings));
  }

  const md = renderMarkdown(repo, rows);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, md, 'utf8');
  console.log(`[qa-metrics] wrote ${OUT}`);
}

main();
