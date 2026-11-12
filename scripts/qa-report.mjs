#!/usr/bin/env node
/**
 * Deterministic QA report builder/publisher. No AI, no dependencies.
 *
 *   node scripts/qa-report.mjs build
 *   node scripts/qa-report.mjs publish [--dry-run]
 *
 * FINDINGS.md entries look like:
 *   ### F-NN: <one-line title>
 *   - **Where:** ...
 *   - **Category:** ...
 *   - **Impact:** ...
 *   - **Evidence:** ...
 *   - **Contradicts:** ...
 *   - **Suggested fix (optional):** ...
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const MARKER = '<!-- fernly-qa-report -->';
const FINDING_KEY_RE = /<!--\s*qa-finding-key:\s*([^\s]+)\s*-->/;
const ANSI_RE = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const FINDING_HEADING_RE = /^### (F-\d+):\s*(.+)\s*$/gm;
const FINDING_ID_IN_TEXT_RE = /\bF-\d+\b/;

const PATHS = {
  playwrightJson: join(ROOT, 'reports', 'playwright.json'),
  cypressResults: join(ROOT, 'web', 'cypress', 'results'),
  a11ySummary: join(ROOT, 'a11y-report', 'summary.md'),
  findings: join(ROOT, 'FINDINGS.md'),
  outDir: join(ROOT, 'qa-report'),
};

function env(name, fallback = '') {
  return process.env[name] ?? fallback;
}

function stripAnsi(text) {
  return String(text ?? '').replace(ANSI_RE, '');
}

function firstLine(text) {
  return stripAnsi(text).split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? '';
}

function slugify(title) {
  return String(title)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function emptySuite(name, status = 'not run') {
  return {
    name,
    status,
    passed: 0,
    failed: 0,
    knownBugs: 0,
    skipped: 0,
  };
}

function parseFindings(markdown) {
  if (!markdown) return [];
  const findings = [];
  const matches = [...markdown.matchAll(FINDING_HEADING_RE)];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const start = match.index;
    const end = i + 1 < matches.length ? matches[i + 1].index : markdown.length;
    const block = markdown.slice(start, end).trimEnd();
    // Stop before Suspicions / Questions sections if a heading slipped in.
    const cut = block.search(/\n## /);
    const body = cut === -1 ? block : block.slice(0, cut).trimEnd();
    const id = match[1];
    const title = match[2].trim();
    findings.push({
      id,
      title,
      slug: slugify(title),
      heading: `${id}: ${title}`,
      body,
    });
  }
  return findings;
}

function readText(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}

function gitShowFindings(baseRef) {
  if (!baseRef) return null;
  const result = spawnSync(
    'git',
    ['show', `origin/${baseRef}:FINDINGS.md`],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    // Fall back without origin/ prefix (shallow or local-only base).
    const local = spawnSync('git', ['show', `${baseRef}:FINDINGS.md`], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    if (local.status !== 0) return null;
    return local.stdout;
  }
  return result.stdout;
}

function runUrl() {
  const server = env('GITHUB_SERVER_URL', 'https://github.com').replace(/\/$/, '');
  const repo = env('GITHUB_REPOSITORY');
  const runId = env('GITHUB_RUN_ID');
  if (!repo || !runId) return '';
  return `${server}/${repo}/actions/runs/${runId}`;
}

function prUrl() {
  const server = env('GITHUB_SERVER_URL', 'https://github.com').replace(/\/$/, '');
  const repo = env('GITHUB_REPOSITORY');
  const pr = env('PR_NUMBER');
  if (!repo || !pr) return '';
  return `${server}/${repo}/pull/${pr}`;
}

function namesFinding(text, findings) {
  const raw = String(text ?? '');
  if (FINDING_ID_IN_TEXT_RE.test(raw)) return true;
  const lower = raw.toLowerCase();
  return findings.some((f) => lower.includes(f.title.toLowerCase()));
}

function extractFindingRefs(text, findings) {
  const raw = String(text ?? '');
  const refs = new Set();
  for (const m of raw.matchAll(/\bF-\d+\b/g)) refs.add(m[0]);
  for (const f of findings) {
    if (raw.toLowerCase().includes(f.title.toLowerCase())) refs.add(f.id);
  }
  return [...refs];
}

/** Walk Playwright JSON and collect leaf tests with projectName. */
function collectPlaywrightTests(report) {
  const tests = [];

  function walkSuite(suite, inheritedProject = '') {
    const project =
      suite.projectName ||
      (suite.suites || suite.specs ? inheritedProject : inheritedProject);

    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const results = test.results ?? [];
        const last = results[results.length - 1] ?? {};
        const annotationKey = (a) => `${a.type ?? ''}\0${a.description ?? ''}`;
        const annotationMap = new Map();
        for (const a of [...(test.annotations ?? []), ...(last.annotations ?? [])]) {
          annotationMap.set(annotationKey(a), a);
        }
        const annotations = [...annotationMap.values()];
        const status = last.status ?? test.status ?? 'skipped';
        const expectedStatus = last.expectedStatus ?? test.expectedStatus ?? 'passed';
        const errors = [
          ...(last.errors ?? []).map((e) => e.message || e.value || String(e)),
          last.error?.message,
        ].filter(Boolean);
        const location = spec.file
          ? `${spec.file}${spec.line != null ? `:${spec.line}` : ''}`
          : '';
        tests.push({
          title: [...(spec.titlePath ?? []), spec.title].filter(Boolean).join(' › ') || spec.title,
          projectName: test.projectName || project || inheritedProject || 'playwright',
          status,
          expectedStatus,
          annotations,
          errors,
          location,
          attachments: last.attachments ?? [],
        });
      }
    }

    for (const child of suite.suites ?? []) {
      // Top-level Playwright project suites often use the project as title when
      // nested under an empty root; prefer explicit projectName when present.
      const nextProject =
        child.projectName ||
        (!inheritedProject && child.title && !(child.specs?.length) ? child.title : inheritedProject) ||
        inheritedProject;
      walkSuite(child, nextProject);
    }
  }

  for (const suite of report.suites ?? []) walkSuite(suite, '');
  return tests;
}

function summarizePlaywright(tests, findings) {
  const byProject = new Map();
  const failed = [];
  const knownBugs = [];
  const visualChanges = [];

  for (const t of tests) {
    const project = t.projectName || 'playwright';
    if (!byProject.has(project)) byProject.set(project, emptySuite(project, 'ok'));
    const suite = byProject.get(project);

    const failAnnotations = t.annotations.filter((a) => a.type === 'fail');
    const isKnownBug = failAnnotations.some((a) => namesFinding(a.description, findings));

    if (isKnownBug) {
      suite.knownBugs += 1;
      const refs = failAnnotations.flatMap((a) => extractFindingRefs(a.description, findings));
      knownBugs.push({
        project,
        title: t.title,
        location: t.location,
        annotation: failAnnotations.map((a) => a.description).filter(Boolean).join('; '),
        findings: refs,
      });
    } else if (t.status === 'skipped' || t.status === 'interrupted') {
      suite.skipped += 1;
    } else if (t.status === 'failed' || t.status === 'timedOut') {
      suite.failed += 1;
      const errorLine = firstLine(t.errors[0] ?? 'failed');
      const entry = {
        project,
        title: t.title,
        location: t.location,
        error: errorLine,
      };
      failed.push(entry);
      if (project === 'visual') {
        visualChanges.push({
          ...entry,
          note: 'Images are in the playwright-report artifact.',
        });
      }
    } else {
      suite.passed += 1;
    }
  }

  return { byProject, failed, knownBugs, visualChanges };
}

function parseJunitXml(xml, sourceLabel) {
  const tests = [];
  // mocha-junit-reporter emits <testcase ...> with optional <failure>/<skipped>/<error>
  const caseRe =
    /<testcase\b([^>]*)>([\s\S]*?)<\/testcase>|<testcase\b([^>]*)\/>/g;
  let m;
  while ((m = caseRe.exec(xml))) {
    const attrs = m[1] ?? m[3] ?? '';
    const body = m[2] ?? '';
    const name = attr(attrs, 'name') || 'test';
    const classname = attr(attrs, 'classname') || '';
    const file = attr(attrs, 'file') || '';
    const line = attr(attrs, 'line') || '';
    const location = file ? `${file}${line ? `:${line}` : ''}` : classname;

    if (/<skipped\b/i.test(body)) {
      tests.push({ name, location, status: 'skipped', error: '' });
    } else if (/<failure\b/i.test(body) || /<error\b/i.test(body)) {
      const failMatch =
        body.match(/<(?:failure|error)\b[^>]*>([\s\S]*?)<\/(?:failure|error)>/i) ||
        body.match(/<(?:failure|error)\b[^>]*message="([^"]*)"/i);
      let error = '';
      if (failMatch) {
        error = decodeXml(failMatch[1] || '');
      }
      tests.push({ name, location, status: 'failed', error: firstLine(error) });
    } else {
      tests.push({ name, location, status: 'passed', error: '' });
    }
  }

  // Also count tests from tests= attributes if no testcase nodes (empty file).
  if (tests.length === 0 && /<testsuite\b/i.test(xml)) {
    return { tests, sourceLabel, empty: true };
  }
  return { tests, sourceLabel, empty: false };
}

function attr(attrs, name) {
  const m = attrs.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'));
  return m ? decodeXml(m[1]) : '';
}

function decodeXml(text) {
  return String(text)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#10;/g, '\n')
    .replace(/&#13;/g, '\r')
    .replace(/&amp;/g, '&');
}

function summarizeCypress(kind) {
  const suite = emptySuite(
    kind === 'component' ? 'Cypress component' : 'Cypress UI',
    'not run',
  );
  const failed = [];
  if (!existsSync(PATHS.cypressResults)) return { suite, failed };

  const files = readdirSync(PATHS.cypressResults)
    .filter((f) => f.endsWith('.xml') && f.startsWith(`${kind}-`))
    .sort();
  if (files.length === 0) return { suite, failed };

  suite.status = 'ok';
  for (const file of files) {
    const xml = readFileSync(join(PATHS.cypressResults, file), 'utf8');
    const parsed = parseJunitXml(xml, file);
    for (const t of parsed.tests) {
      if (t.status === 'skipped') suite.skipped += 1;
      else if (t.status === 'failed') {
        suite.failed += 1;
        failed.push({
          project: suite.name,
          title: t.name,
          location: t.location || file,
          error: t.error || 'failed',
        });
      } else suite.passed += 1;
    }
    // mocha-junit-reporter often omits filtered/pending cases as <testcase>,
    // but still reports them on the root testsuites skipped= attribute.
    const rootSkipped = Number(
      (xml.match(/<testsuites\b[^>]*\bskipped="(\d+)"/i) || [])[1] || 0,
    );
    const already = parsed.tests.filter((t) => t.status === 'skipped').length;
    suite.skipped += Math.max(0, rootSkipped - already);
  }
  return { suite, failed };
}

function suiteRow(suite) {
  if (suite.status === 'not run') {
    return `| ${suite.name} | not run | not run | not run | not run |`;
  }
  return `| ${suite.name} | ${suite.passed} | ${suite.failed} | ${suite.knownBugs} | ${suite.skipped} |`;
}

function buildComment({
  suites,
  failed,
  knownBugs,
  visualChanges,
  findings,
  newFindings,
  a11ySummary,
  link,
}) {
  const lines = [
    MARKER,
    '## QA report',
    '',
    '| Suite | Passed | Failed | Known bugs | Skipped |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...suites.map(suiteRow),
    '',
  ];

  lines.push('### Failed tests', '');
  if (failed.length === 0) {
    lines.push('_None._', '');
  } else {
    for (const f of failed) {
      const loc = f.location || '(no location)';
      lines.push(`- **${f.project}** — ${f.title}`);
      lines.push(`  - \`${loc}\``);
      if (f.error) lines.push(`  - ${f.error}`);
    }
    lines.push('');
  }

  lines.push(
    '### Visual changes',
    '',
    'A person decides: defect, intended or noise. Diff images are in the `playwright-report` artifact.',
    '',
  );
  if (visualChanges.length === 0) {
    lines.push('_None._', '');
  } else {
    for (const v of visualChanges) {
      lines.push(`- **${v.title}** — \`${v.location || 'visual'}\``);
      if (v.error) lines.push(`  - ${v.error}`);
    }
    lines.push('');
  }

  lines.push('### Known bugs', '');
  if (knownBugs.length === 0) {
    lines.push('_None._', '');
  } else {
    for (const k of knownBugs) {
      const refs = k.findings?.length ? ` (${k.findings.join(', ')})` : '';
      lines.push(`- **${k.project}** — ${k.title}${refs}`);
      if (k.annotation) lines.push(`  - ${k.annotation}`);
    }
    lines.push('');
  }

  lines.push('### New findings', '');
  if (!findings) {
    lines.push('_FINDINGS.md not run / missing._', '');
  } else if (newFindings.length === 0) {
    lines.push('_None._', '');
  } else {
    for (const f of newFindings) {
      lines.push(`- **${f.id}: ${f.title}**`);
    }
    lines.push('');
  }

  lines.push('### Accessibility', '');
  if (a11ySummary == null) {
    lines.push('<details><summary>summary</summary>', '', '_not run_', '', '</details>', '');
  } else {
    lines.push('<details><summary>summary</summary>', '', a11ySummary.trim(), '', '</details>', '');
  }

  if (link) {
    lines.push(`Run: ${link}`, '');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function buildIssues(newFindings, pr, run) {
  return newFindings.map((f) => {
    const parts = [f.body, ''];
    if (pr) parts.push(`PR: ${pr}`);
    if (run) parts.push(`Run: ${run}`);
    parts.push(`<!-- qa-finding-key: ${f.slug} -->`);
    return {
      title: f.heading,
      body: parts.join('\n'),
      labels: ['qa-finding'],
      key: f.slug,
      findingId: f.id,
    };
  });
}

function commandBuild() {
  const baseRef = env('BASE_REF') || env('GITHUB_BASE_REF');
  const sha = env('GITHUB_SHA') || spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).stdout.trim();
  const prNumber = env('PR_NUMBER') || '';
  const link = runUrl();
  const pr = prUrl();
  const now = new Date().toISOString();

  const findingsMd = readText(PATHS.findings);
  const findings = findingsMd ? parseFindings(findingsMd) : null;
  const baseFindingsMd = gitShowFindings(baseRef);
  const baseTitles = new Set(
    (baseFindingsMd ? parseFindings(baseFindingsMd) : []).map((f) => f.title),
  );
  const newFindings =
    findings == null
      ? []
      : findings.filter((f) => !baseTitles.has(f.title));

  const a11ySummary = readText(PATHS.a11ySummary);

  const suites = [];
  const allFailed = [];
  let knownBugs = [];
  let visualChanges = [];
  const playwrightProjects = [];

  const cyComponent = summarizeCypress('component');
  const cyUi = summarizeCypress('ui');
  suites.push(cyComponent.suite, cyUi.suite);
  allFailed.push(...cyComponent.failed, ...cyUi.failed);

  const pwJson = readText(PATHS.playwrightJson);
  if (!pwJson) {
    for (const name of ['setup', 'api', 'e2e', 'a11y', 'visual']) {
      suites.push(emptySuite(name, 'not run'));
      playwrightProjects.push(emptySuite(name, 'not run'));
    }
  } else {
    const report = JSON.parse(pwJson);
    const tests = collectPlaywrightTests(report);
    const summary = summarizePlaywright(tests, findings ?? []);
    knownBugs = summary.knownBugs;
    visualChanges = summary.visualChanges;
    allFailed.push(...summary.failed.filter((f) => f.project !== 'visual'));
    // Visual failures stay in the visual section; still count in suite failed.
    // Keep them out of the generic failed list to avoid duplication? User asked
    // for failed tests AND a visual section — list visual only in visual section.
    const ordered = [...summary.byProject.keys()].sort((a, b) => {
      const order = ['setup', 'api', 'e2e', 'a11y', 'visual'];
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    if (ordered.length === 0) {
      suites.push(emptySuite('playwright', 'ok'));
      playwrightProjects.push(emptySuite('playwright', 'ok'));
    } else {
      for (const name of ordered) {
        const suite = summary.byProject.get(name);
        suites.push(suite);
        playwrightProjects.push(suite);
      }
    }
  }

  const comment = buildComment({
    suites,
    failed: allFailed,
    knownBugs,
    visualChanges,
    findings,
    newFindings,
    a11ySummary,
    link,
  });

  const issues = buildIssues(newFindings, pr, link);

  const totals = Object.fromEntries(
    suites.map((s) => [
      s.name,
      {
        status: s.status,
        passed: s.passed,
        failed: s.failed,
        knownBugs: s.knownBugs,
        skipped: s.skipped,
      },
    ]),
  );

  const run = {
    sha,
    pr: prNumber ? Number(prNumber) : null,
    runUrl: link || null,
    time: now,
    totals,
    failed: allFailed,
    knownBugs,
    visualChanges,
    findings: findings ? findings.map((f) => ({ id: f.id, title: f.title })) : null,
    newFindings: newFindings.map((f) => ({ id: f.id, title: f.title, key: f.slug })),
  };

  mkdirSync(PATHS.outDir, { recursive: true });
  writeFileSync(join(PATHS.outDir, 'comment.md'), comment);
  writeFileSync(join(PATHS.outDir, 'issues.json'), `${JSON.stringify(issues, null, 2)}\n`);
  writeFileSync(join(PATHS.outDir, 'run.json'), `${JSON.stringify(run, null, 2)}\n`);

  console.log(`Wrote ${relative(ROOT, PATHS.outDir)}/{comment.md,issues.json,run.json}`);
  console.log(
    `Suites: ${suites.map((s) => `${s.name}=${s.status === 'not run' ? 'not run' : `${s.passed}p/${s.failed}f/${s.knownBugs}k/${s.skipped}s`}`).join(', ')}`,
  );
  console.log(`New findings: ${newFindings.length}`);
}

function gh(args, { input, dryRun, label } = {}) {
  if (dryRun) {
    console.log(`[dry-run] gh ${args.map(shellQuote).join(' ')}`);
    if (input != null) {
      console.log(`[dry-run] stdin (${label || 'body'}, ${input.length} bytes):`);
      console.log(input);
    }
    return { status: 0, stdout: '', stderr: '' };
  }
  const result = spawnSync('gh', args, {
    cwd: ROOT,
    encoding: 'utf8',
    input: input ?? undefined,
    env: process.env,
  });
  if (result.status !== 0) {
    const err = result.stderr || result.stdout || `gh exited ${result.status}`;
    throw new Error(err.trim());
  }
  return result;
}

function shellQuote(value) {
  // Display-only for dry-run logs; never passed to a shell.
  if (/^[A-Za-z0-9_/@.=:,+-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

function commandPublish(dryRun) {
  const repo = env('GITHUB_REPOSITORY');
  const prNumber = env('PR_NUMBER');
  if (!repo) throw new Error('GITHUB_REPOSITORY is required');
  if (!prNumber) throw new Error('PR_NUMBER is required');

  const commentPath = join(PATHS.outDir, 'comment.md');
  const issuesPath = join(PATHS.outDir, 'issues.json');
  if (!existsSync(commentPath) || !existsSync(issuesPath)) {
    throw new Error('qa-report/ missing — run build first');
  }

  const commentBody = readFileSync(commentPath, 'utf8');
  const issues = JSON.parse(readFileSync(issuesPath, 'utf8'));

  // One sticky PR comment: update if marker exists, otherwise create.
  let existingId = null;
  const listComments = spawnSync(
    'gh',
    ['api', `repos/${repo}/issues/${prNumber}/comments`, '--paginate'],
    { cwd: ROOT, encoding: 'utf8', env: process.env },
  );
  if (listComments.status === 0) {
    try {
      const comments = JSON.parse(listComments.stdout || '[]');
      const found = comments.find((c) => String(c.body || '').startsWith(MARKER));
      if (found) existingId = found.id;
    } catch {
      /* treat as create */
    }
  } else if (dryRun) {
    console.log(
      '[dry-run] could not list PR comments; assuming create\n' +
        String(listComments.stderr || listComments.stdout || '').trim(),
    );
  } else {
    throw new Error(
      (listComments.stderr || listComments.stdout || 'gh api comments failed').trim(),
    );
  }

  if (existingId) {
    gh(
      [
        'api',
        '-X',
        'PATCH',
        `repos/${repo}/issues/comments/${existingId}`,
        '-F',
        'body=@-',
      ],
      { input: commentBody, dryRun, label: 'comment update' },
    );
    console.log(dryRun ? `[dry-run] would update comment ${existingId}` : `Updated comment ${existingId}`);
  } else {
    gh(
      [
        'api',
        '-X',
        'POST',
        `repos/${repo}/issues/${prNumber}/comments`,
        '-F',
        'body=@-',
      ],
      { input: commentBody, dryRun, label: 'comment create' },
    );
    console.log(dryRun ? '[dry-run] would create PR comment' : 'Created PR comment');
  }

  // Issues labelled qa-finding in every state; create only missing keys.
  const filedKeys = new Set();
  const issueSearch = spawnSync(
    'gh',
    [
      'issue',
      'list',
      '--repo',
      repo,
      '--label',
      'qa-finding',
      '--state',
      'all',
      '--json',
      'number,title,body,state',
      '--limit',
      '1000',
    ],
    { cwd: ROOT, encoding: 'utf8', env: process.env },
  );
  if (issueSearch.status === 0) {
    const existingIssues = JSON.parse(issueSearch.stdout || '[]');
    for (const issue of existingIssues) {
      const m = String(issue.body || '').match(FINDING_KEY_RE);
      if (m) filedKeys.add(m[1]);
    }
  } else if (!dryRun) {
    throw new Error((issueSearch.stderr || issueSearch.stdout || 'gh issue list failed').trim());
  } else {
    console.log('[dry-run] could not list existing qa-finding issues; assuming none filed');
  }

  for (const issue of issues) {
    if (filedKeys.has(issue.key)) {
      console.log(`Skip filed finding key: ${issue.key}`);
      continue;
    }
    gh(
      [
        'issue',
        'create',
        '--repo',
        repo,
        '--title',
        issue.title,
        '--label',
        'qa-finding',
        '--body-file',
        '-',
      ],
      { input: issue.body, dryRun, label: `issue ${issue.key}` },
    );
    console.log(
      dryRun
        ? `[dry-run] would create issue for ${issue.key}`
        : `Created issue for ${issue.key}`,
    );
  }
}

function usage() {
  console.error(`Usage:
  node scripts/qa-report.mjs build
  node scripts/qa-report.mjs publish [--dry-run]`);
  process.exit(2);
}

const [, , cmd, ...rest] = process.argv;
if (cmd === 'build') {
  commandBuild();
} else if (cmd === 'publish') {
  const dryRun = rest.includes('--dry-run');
  commandPublish(dryRun);
} else {
  usage();
}
