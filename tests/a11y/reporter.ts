import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import type { ImpactValue } from 'axe-core';
import {
  blockingViolations,
  classifyViolations,
  findBaseline,
  unusedBaselineEntries,
  type BaselineEntry,
  type Classification,
  type ClassifiedViolation,
} from './baseline';
import type { ScanAttachment } from './helpers/scan';

type ReporterOptions = {
  outputFolder?: string;
  baseline?: string;
  title?: string;
};

type ShotKey = string;

type ReportElement = {
  target: string;
  html: string;
  impact: ImpactValue | undefined;
  failureSummary: string;
  classification: Classification;
  owner?: string;
  expires?: string;
  reason?: string;
  screenshotDataUrl?: string;
};

type ReportRule = {
  id: string;
  help: string;
  helpUrl: string;
  impact: ImpactValue | undefined;
  tags: string[];
  page: string;
  url: string;
  elements: ReportElement[];
};

type PageSummary = {
  page: string;
  url: string;
  scannedAt: string;
  elementCount: number;
  passes: number;
  byImpact: Record<ImpactKey, number>;
  classified: ClassifiedViolation[];
};

type ImpactKey = 'critical' | 'serious' | 'moderate' | 'minor';

type ReportData = {
  title: string;
  generatedAt: string;
  totals: {
    pagesScanned: number;
    rulesViolated: number;
    elementsAffected: number;
    blocking: number;
  };
  impactCounts: Record<ImpactKey, number>;
  statusCounts: Record<Classification, number>;
  pages: PageSummary[];
  rules: ReportRule[];
  blocking: ClassifiedViolation[];
  unusedBaseline: BaselineEntry[];
  baselinePath: string;
};

const IMPACT_ORDER: ImpactKey[] = ['critical', 'serious', 'moderate', 'minor'];

function impactRank(impact: ImpactValue | undefined): number {
  const key = (impact ?? 'minor') as ImpactKey;
  const index = IMPACT_ORDER.indexOf(key);
  return index === -1 ? IMPACT_ORDER.length : index;
}

function emptyImpactCounts(): Record<ImpactKey, number> {
  return { critical: 0, serious: 0, moderate: 0, minor: 0 };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readAttachmentBody(attachment: TestResult['attachments'][number]): Buffer | undefined {
  if (attachment.body) return Buffer.from(attachment.body);
  if (attachment.path) return readFileSync(attachment.path);
  return undefined;
}

function shotKey(page: string, rule: string, index: number): ShotKey {
  return `${page}:${rule}:${index}`;
}

function wcagTags(tags: readonly string[]): string[] {
  return tags.filter((tag) => /wcag|best-practice|section508|cat\./i.test(tag));
}

class A11yReporter implements Reporter {
  private readonly outputFolder: string;
  private readonly baselinePath: string;
  private readonly title: string;
  private readonly scans: ScanAttachment[] = [];
  private readonly shots = new Map<ShotKey, string>();

  constructor(options: ReporterOptions = {}) {
    this.outputFolder = options.outputFolder ?? 'a11y-report';
    this.baselinePath = options.baseline ?? 'a11y-baseline.json';
    this.title = options.title ?? 'Accessibility report';
  }

  onTestEnd(_test: TestCase, result: TestResult): void {
    for (const attachment of result.attachments) {
      if (attachment.name === 'axe-results') {
        const body = readAttachmentBody(attachment);
        if (!body) continue;
        const parsed = JSON.parse(body.toString('utf8')) as ScanAttachment;
        this.scans.push(parsed);
        continue;
      }

      const shotMatch = /^axe-shot:(.+):([^:]+):(\d+)$/.exec(attachment.name);
      if (!shotMatch) continue;
      const body = readAttachmentBody(attachment);
      if (!body) continue;
      const [, page, rule, index] = shotMatch;
      this.shots.set(
        shotKey(page, rule, Number(index)),
        `data:image/png;base64,${body.toString('base64')}`,
      );
    }
  }

  async onEnd(_result: FullResult): Promise<void> {
    const report = this.buildReport();
    const outDir = path.resolve(process.cwd(), this.outputFolder);
    mkdirSync(outDir, { recursive: true });

    writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(report, null, 2));
    writeFileSync(path.join(outDir, 'summary.md'), renderSummaryMd(report));
    writeFileSync(path.join(outDir, 'index.html'), renderIndexHtml(report));

    const { totals } = report;
    console.log(
      `A11y: ${totals.pagesScanned} pages, ${totals.rulesViolated} rules, ${totals.elementsAffected} elements, ${totals.blocking} blocking → ${this.outputFolder}/`,
    );
  }

  private buildReport(): ReportData {
    const pages: PageSummary[] = [];
    const rules: ReportRule[] = [];
    const allClassified: ClassifiedViolation[] = [];
    const impactCounts = emptyImpactCounts();
    const statusCounts: Record<Classification, number> = {
      new: 0,
      baselined: 0,
      expired: 0,
    };

    for (const scan of this.scans) {
      const classified = classifyViolations(scan.page, scan.violations);
      allClassified.push(...classified);

      const byImpact = emptyImpactCounts();
      for (const item of classified) {
        const key = (item.impact ?? 'minor') as ImpactKey;
        if (key in byImpact) byImpact[key] += 1;
        if (key in impactCounts) impactCounts[key] += 1;
        statusCounts[item.classification] += 1;
      }

      pages.push({
        page: scan.page,
        url: scan.url,
        scannedAt: scan.scannedAt,
        elementCount: classified.length,
        passes: scan.passes.length,
        byImpact,
        classified,
      });

      for (const violation of scan.violations) {
        const elements: ReportElement[] = violation.nodes.map((node, index) => {
          const target = serializeTarget(node.target);
          const matched = classified.find(
            (item) => item.rule === violation.id && item.target === target,
          );
          const entry = findBaseline(violation.id, scan.page, target);
          const classification = matched?.classification ?? 'new';
          return {
            target,
            html: node.html,
            impact: node.impact ?? violation.impact,
            failureSummary: node.failureSummary ?? '',
            classification,
            owner: entry?.owner,
            expires: entry?.expires,
            reason: entry?.reason,
            screenshotDataUrl: this.shots.get(shotKey(scan.page, violation.id, index)),
          };
        });

        rules.push({
          id: violation.id,
          help: violation.help,
          helpUrl: violation.helpUrl,
          impact: violation.impact,
          tags: wcagTags(violation.tags),
          page: scan.page,
          url: scan.url,
          elements,
        });
      }
    }

    rules.sort((a, b) => {
      const rank = impactRank(a.impact) - impactRank(b.impact);
      if (rank !== 0) return rank;
      if (a.page !== b.page) return a.page.localeCompare(b.page);
      return a.id.localeCompare(b.id);
    });

    pages.sort((a, b) => a.page.localeCompare(b.page));

    const blocking = blockingViolations(allClassified);
    const unusedBaseline = unusedBaselineEntries(allClassified);
    const rulesViolated = new Set(allClassified.map((item) => item.rule)).size;

    return {
      title: this.title,
      generatedAt: new Date().toISOString(),
      totals: {
        pagesScanned: pages.length,
        rulesViolated,
        elementsAffected: allClassified.length,
        blocking: blocking.length,
      },
      impactCounts,
      statusCounts,
      pages,
      rules,
      blocking,
      unusedBaseline,
      baselinePath: this.baselinePath,
    };
  }
}

function serializeTarget(target: ReadonlyArray<string | string[]>): string {
  return target
    .map((part) => (Array.isArray(part) ? part.join(' ') : part))
    .join(' ');
}

function renderSummaryMd(report: ReportData): string {
  const { totals, impactCounts, statusCounts, blocking, pages } = report;
  const lines: string[] = [];

  lines.push(`# ${report.title}`);
  lines.push('');
  lines.push(
    `**${totals.pagesScanned}** pages scanned · **${totals.rulesViolated}** rules violated · **${totals.elementsAffected}** elements affected · **${totals.blocking}** blocking`,
  );
  lines.push('');
  lines.push('## By impact');
  lines.push('');
  lines.push('| Impact | New | Baselined | Expired | Total |');
  lines.push('| --- | ---: | ---: | ---: | ---: |');

  for (const impact of IMPACT_ORDER) {
    let neu = 0;
    let baselined = 0;
    let expired = 0;
    for (const page of pages) {
      for (const item of page.classified) {
        if ((item.impact ?? 'minor') !== impact) continue;
        if (item.classification === 'new') neu += 1;
        else if (item.classification === 'baselined') baselined += 1;
        else expired += 1;
      }
    }
    const total = neu + baselined + expired;
    if (total === 0 && impactCounts[impact] === 0) {
      lines.push(`| ${impact} | 0 | 0 | 0 | 0 |`);
    } else {
      lines.push(`| ${impact} | ${neu} | ${baselined} | ${expired} | ${total} |`);
    }
  }

  lines.push('');
  lines.push(
    `Status totals: new **${statusCounts.new}**, baselined **${statusCounts.baselined}**, expired **${statusCounts.expired}**.`,
  );
  lines.push('');
  lines.push('## Blocking violations');
  lines.push('');

  if (blocking.length === 0) {
    lines.push('_None._');
  } else {
    lines.push('| Rule | Page | Count | Example selector |');
    lines.push('| --- | --- | ---: | --- |');
    const groups = new Map<string, { rule: string; page: string; count: number; example: string }>();
    for (const item of blocking) {
      const key = `${item.rule}::${item.page}`;
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        groups.set(key, {
          rule: item.rule,
          page: item.page,
          count: 1,
          example: item.target,
        });
      }
    }
    for (const group of [...groups.values()]) {
      lines.push(
        `| \`${group.rule}\` | ${group.page} | ${group.count} | \`${group.example}\` |`,
      );
    }
  }

  lines.push('');
  return lines.join('\n');
}

function renderIndexHtml(report: ReportData): string {
  const { totals, impactCounts, statusCounts, pages, rules, unusedBaseline } = report;
  const pageRows = pages
    .map((page) => {
      const bar = IMPACT_ORDER.map((impact) => {
        const count = page.byImpact[impact];
        const width = page.elementCount === 0 ? 0 : Math.max(4, (count / Math.max(page.elementCount, 1)) * 100);
        return `<span class="bar-seg ${impact}" style="width:${count ? width : 0}%" title="${impact}: ${count}"></span>`;
      }).join('');
      return `<tr data-page="${escapeHtml(page.page)}">
  <td><strong>${escapeHtml(page.page)}</strong><div class="muted">${escapeHtml(page.url)}</div></td>
  <td class="num">${page.elementCount}</td>
  <td><div class="bar">${bar}</div><div class="bar-legend">${IMPACT_ORDER.map((i) => `${i[0]}:${page.byImpact[i]}`).join(' · ')}</div></td>
  <td class="num">${page.passes}</td>
</tr>`;
    })
    .join('\n');

  const ruleCards = rules
    .map((rule, ruleIndex) => {
      const elementsHtml = rule.elements
        .map((el) => {
          const shot = el.screenshotDataUrl
            ? `<img class="shot" src="${el.screenshotDataUrl}" alt="Screenshot of failing element" />`
            : `<div class="shot missing">No screenshot</div>`;
          const baselineMeta =
            el.classification === 'baselined' || el.classification === 'expired'
              ? `<div class="meta">Owner: ${escapeHtml(el.owner ?? '—')} · Expires: ${escapeHtml(el.expires ?? '—')}${el.reason ? ` · ${escapeHtml(el.reason)}` : ''}</div>`
              : '';
          return `<article class="element" data-impact="${escapeHtml(el.impact ?? '')}" data-status="${el.classification}" data-page="${escapeHtml(rule.page)}" data-search="${escapeHtml(`${rule.id} ${rule.help} ${el.target} ${el.html} ${el.failureSummary}`).toLowerCase()}">
  ${shot}
  <div class="element-body">
    <div class="element-top">
      <span class="badge status ${el.classification}">${labelStatus(el.classification)}</span>
      <code class="selector">${escapeHtml(el.target)}</code>
    </div>
    ${baselineMeta}
    <pre class="snippet">${escapeHtml(el.html)}</pre>
    <p class="summary">${escapeHtml(el.failureSummary || 'No failure summary')}</p>
  </div>
</article>`;
        })
        .join('\n');

      return `<section class="rule-card" data-rule-index="${ruleIndex}" data-impact="${escapeHtml(rule.impact ?? '')}" data-page="${escapeHtml(rule.page)}" data-statuses="${escapeHtml(rule.elements.map((e) => e.classification).join(' '))}">
  <header class="rule-head">
    <span class="badge impact ${escapeHtml(rule.impact ?? 'minor')}">${escapeHtml(rule.impact ?? 'unknown')}</span>
    <div>
      <h2>${escapeHtml(rule.help)}</h2>
      <div class="rule-meta">
        <code>${escapeHtml(rule.id)}</code>
        <span class="muted">${escapeHtml(rule.page)}</span>
        ${rule.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        <a href="${escapeHtml(rule.helpUrl)}" target="_blank" rel="noopener noreferrer">How to fix it</a>
      </div>
    </div>
  </header>
  <div class="elements">${elementsHtml}</div>
</section>`;
    })
    .join('\n');

  const unusedHtml =
    unusedBaseline.length === 0
      ? `<p class="muted">None — every baseline entry matched at least one finding.</p>`
      : `<ul class="unused">${unusedBaseline
          .map(
            (entry) =>
              `<li><code>${escapeHtml(entry.rule)}</code> on <strong>${escapeHtml(entry.page)}</strong> → <code>${escapeHtml(entry.target)}</code> <span class="muted">(${escapeHtml(entry.owner)}, expires ${escapeHtml(entry.expires)})</span></li>`,
          )
          .join('')}</ul>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(report.title)}</title>
<style>
:root {
  --bg: #f6f3ee;
  --panel: #fffdf9;
  --ink: #1c241c;
  --muted: #5f6b5f;
  --line: #d9d2c6;
  --critical: #9b1c1c;
  --serious: #b45309;
  --moderate: #a16207;
  --minor: #3f6212;
  --new: #9b1c1c;
  --baselined: #1d4ed8;
  --expired: #7c2d12;
  --accent: #2f5d3a;
  font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  color: var(--ink);
  background:
    radial-gradient(circle at top left, #e7efe4 0%, transparent 40%),
    linear-gradient(180deg, #fbf8f2 0%, var(--bg) 100%);
}
header.app {
  padding: 28px 28px 12px;
  border-bottom: 1px solid var(--line);
}
header.app h1 { margin: 0 0 6px; font-size: 1.6rem; letter-spacing: -0.02em; }
header.app .sub { color: var(--muted); margin: 0 0 18px; }
.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.stat {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 14px 16px;
}
.stat .n { font-size: 1.8rem; font-weight: 650; line-height: 1; }
.stat .l { color: var(--muted); font-size: 0.85rem; margin-top: 6px; }
.stat.blocking .n { color: var(--critical); }
main { padding: 20px 28px 48px; display: grid; gap: 22px; }
section.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 16px;
}
section.panel h2 { margin: 0 0 12px; font-size: 1.05rem; }
table.pages { width: 100%; border-collapse: collapse; }
table.pages th, table.pages td {
  text-align: left;
  padding: 10px 8px;
  border-bottom: 1px solid var(--line);
  vertical-align: top;
}
table.pages th { color: var(--muted); font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.muted { color: var(--muted); font-size: 0.85rem; }
.bar {
  display: flex;
  height: 10px;
  background: #efeae1;
  border-radius: 999px;
  overflow: hidden;
  min-width: 140px;
}
.bar-seg { display: block; height: 100%; }
.bar-seg.critical { background: var(--critical); }
.bar-seg.serious { background: var(--serious); }
.bar-seg.moderate { background: var(--moderate); }
.bar-seg.minor { background: var(--minor); }
.bar-legend { margin-top: 4px; color: var(--muted); font-size: 0.75rem; }
.filters {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1.4fr;
  gap: 12px;
  align-items: end;
}
.filters label { display: grid; gap: 6px; font-size: 0.85rem; color: var(--muted); }
.filters .checks { display: flex; flex-wrap: wrap; gap: 8px 12px; }
.filters input[type="search"], .filters select {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 8px 10px;
  background: #fff;
  color: var(--ink);
}
.rule-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 14px;
}
.rule-card[hidden], .element[hidden], tr[hidden] { display: none !important; }
.rule-head { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
.rule-head h2 { margin: 0 0 6px; font-size: 1.05rem; }
.rule-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 3px 9px;
  font-size: 0.75rem;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.badge.impact.critical, .badge.status.new { background: #fee2e2; color: var(--critical); }
.badge.impact.serious { background: #ffedd5; color: var(--serious); }
.badge.impact.moderate { background: #fef3c7; color: var(--moderate); }
.badge.impact.minor { background: #ecfccb; color: var(--minor); }
.badge.status.baselined { background: #dbeafe; color: var(--baselined); }
.badge.status.expired { background: #ffedd5; color: var(--expired); }
.tag {
  background: #eef2e8;
  color: var(--accent);
  border-radius: 6px;
  padding: 2px 7px;
  font-size: 0.75rem;
}
.elements { display: grid; gap: 12px; }
.element {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 10px;
  background: #fff;
}
.shot {
  width: 100%;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: #f3f0ea;
  object-fit: contain;
  max-height: 140px;
}
.shot.missing {
  display: grid;
  place-items: center;
  min-height: 100px;
  color: var(--muted);
  font-size: 0.85rem;
}
.element-top { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 6px; }
.selector { font-size: 0.85rem; }
.snippet {
  margin: 8px 0;
  padding: 8px 10px;
  background: #f4f1ea;
  border-radius: 8px;
  overflow: auto;
  font-size: 0.78rem;
  white-space: pre-wrap;
}
.summary { margin: 0; color: var(--muted); font-size: 0.9rem; }
.meta { color: var(--muted); font-size: 0.82rem; margin-bottom: 4px; }
.unused { margin: 0; padding-left: 18px; }
.unused li { margin: 6px 0; }
@media (max-width: 900px) {
  .stats, .filters { grid-template-columns: 1fr 1fr; }
  .element { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .stats, .filters { grid-template-columns: 1fr; }
  main, header.app { padding-left: 16px; padding-right: 16px; }
}
</style>
</head>
<body>
<header class="app">
  <h1>${escapeHtml(report.title)}</h1>
  <p class="sub">Generated ${escapeHtml(report.generatedAt)} · baseline ${escapeHtml(report.baselinePath)}</p>
  <div class="stats">
    <div class="stat"><div class="n">${totals.pagesScanned}</div><div class="l">Pages scanned</div></div>
    <div class="stat"><div class="n">${totals.rulesViolated}</div><div class="l">Rules violated</div></div>
    <div class="stat"><div class="n">${totals.elementsAffected}</div><div class="l">Elements affected</div></div>
    <div class="stat blocking"><div class="n">${totals.blocking}</div><div class="l">Blocking</div></div>
  </div>
</header>
<main>
  <section class="panel">
    <h2>Pages</h2>
    <table class="pages">
      <thead>
        <tr><th>Page</th><th class="num">Elements</th><th>Impact</th><th class="num">Rules passed</th></tr>
      </thead>
      <tbody>
        ${pageRows}
      </tbody>
    </table>
  </section>

  <section class="panel">
    <h2>Filters</h2>
    <div class="filters">
      <div>
        <div class="muted" style="margin-bottom:6px">Impact</div>
        <div class="checks" id="impact-filters">
          ${IMPACT_ORDER.map(
            (impact) =>
              `<label><input type="checkbox" name="impact" value="${impact}" checked /> ${impact} (${impactCounts[impact]})</label>`,
          ).join('')}
        </div>
      </div>
      <label>Page
        <select id="page-filter">
          <option value="">All pages</option>
          ${pages.map((p) => `<option value="${escapeHtml(p.page)}">${escapeHtml(p.page)}</option>`).join('')}
        </select>
      </label>
      <label>Status
        <select id="status-filter">
          <option value="">All statuses</option>
          <option value="new">New (${statusCounts.new})</option>
          <option value="baselined">Baselined (${statusCounts.baselined})</option>
          <option value="expired">Expired (${statusCounts.expired})</option>
        </select>
      </label>
      <label>Search
        <input id="search-filter" type="search" placeholder="Rule, selector, HTML…" />
      </label>
    </div>
  </section>

  <section>
    <h2 style="margin:0 0 12px;font-size:1.05rem">Violations</h2>
    <div id="rules">${ruleCards || '<p class="muted">No violations.</p>'}</div>
  </section>

  <section class="panel">
    <h2>Unused baseline entries</h2>
    <p class="muted">These matched nothing in this run — delete them from the baseline.</p>
    ${unusedHtml}
  </section>
</main>
<script>
function applyFilters() {
  const impacts = new Set([...document.querySelectorAll('input[name="impact"]:checked')].map((el) => el.value));
  const page = document.getElementById('page-filter').value;
  const status = document.getElementById('status-filter').value;
  const q = document.getElementById('search-filter').value.trim().toLowerCase();

  document.querySelectorAll('table.pages tbody tr').forEach((row) => {
    row.hidden = Boolean(page) && row.getAttribute('data-page') !== page;
  });

  document.querySelectorAll('.rule-card').forEach((card) => {
    const cardImpact = card.getAttribute('data-impact') || '';
    const cardPage = card.getAttribute('data-page') || '';
    let visibleElements = 0;
    card.querySelectorAll('.element').forEach((el) => {
      const elImpact = el.getAttribute('data-impact') || '';
      const elStatus = el.getAttribute('data-status') || '';
      const elPage = el.getAttribute('data-page') || '';
      const hay = el.getAttribute('data-search') || '';
      const okImpact = impacts.has(elImpact || 'minor');
      const okPage = !page || elPage === page || cardPage === page;
      const okStatus = !status || elStatus === status;
      const okSearch = !q || hay.includes(q);
      const show = okImpact && okPage && okStatus && okSearch;
      el.hidden = !show;
      if (show) visibleElements += 1;
    });
    const okCardImpact = !cardImpact || impacts.has(cardImpact);
    const okCardPage = !page || cardPage === page;
    card.hidden = visibleElements === 0 || !okCardImpact || !okCardPage;
  });
}
document.getElementById('impact-filters').addEventListener('change', applyFilters);
document.getElementById('page-filter').addEventListener('change', applyFilters);
document.getElementById('status-filter').addEventListener('change', applyFilters);
document.getElementById('search-filter').addEventListener('input', applyFilters);
</script>
</body>
</html>`;
}

function labelStatus(status: Classification): string {
  if (status === 'new') return 'New';
  if (status === 'baselined') return 'Baselined';
  return 'Expired';
}

export default A11yReporter;
