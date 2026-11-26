#!/usr/bin/env node
/**
 * Merge helper-results/tier-{a,b,c}/*.json into helper-results/report.md.
 * One row per (scenario, example, Then); mark where tiers disagree; list failures.
 * Node built-ins only.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RESULTS = join(ROOT, 'helper-results');
const OUT = join(RESULTS, 'report.md');
const TIERS = ['A', 'B', 'C'];

/** @typedef {{ result: string, passRate?: string, evidence: string }} Cell */
/** @typedef {{ scenario: string, example: string, then: string, cells: Record<string, Cell | undefined> }} Row */

function loadTier(tier) {
  const dir = join(RESULTS, `tier-${tier.toLowerCase()}`);
  if (!existsSync(dir)) return [];
  /** @type {Array<Record<string, unknown>>} */
  const entries = [];
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) continue;
    const raw = readFileSync(join(dir, name), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`${dir}/${name}: expected a JSON array`);
    }
    for (const entry of parsed) entries.push(entry);
  }
  return entries;
}

/** @param {unknown} result */
function outcome(result) {
  if (result === 'passed' || result === 'pass') return 'pass';
  if (result === 'failed' || result === 'fail') return 'fail';
  return null; // missing, needs judge, or unknown → not a check
}

/** @param {Cell | undefined} cell @param {string} tier */
function formatCell(cell, tier) {
  if (!cell) return '—';
  const o = outcome(cell.result);
  if (!o) return '—';
  if (tier === 'B' && cell.passRate) return `${o} (${cell.passRate})`;
  return o;
}

/** @param {Row} row */
function disagrees(row) {
  const outcomes = TIERS.map((t) => outcome(row.cells[t]?.result)).filter(
    (o) => o === 'pass' || o === 'fail',
  );
  return outcomes.length >= 2 && new Set(outcomes).size > 1;
}

/** @param {string} text */
function mdCell(text) {
  return String(text).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function buildRows() {
  /** @type {Map<string, Row>} */
  const byKey = new Map();

  for (const tier of TIERS) {
    for (const entry of loadTier(tier)) {
      const scenario = String(entry.scenario ?? '');
      const example = String(entry.example ?? '');
      const then = String(entry.then ?? '');
      const key = `${scenario}\0${example}\0${then}`;
      let row = byKey.get(key);
      if (!row) {
        row = { scenario, example, then, cells: {} };
        byKey.set(key, row);
      }
      row.cells[tier] = {
        result: String(entry.result ?? ''),
        passRate: entry.passRate != null ? String(entry.passRate) : undefined,
        evidence: String(entry.evidence ?? ''),
      };
    }
  }

  return [...byKey.values()].sort((a, b) => {
    const parts = [
      a.scenario.localeCompare(b.scenario),
      a.example.localeCompare(b.example),
      a.then.localeCompare(b.then),
    ];
    return parts.find((n) => n !== 0) ?? 0;
  });
}

/** @param {Row[]} rows */
function renderReport(rows) {
  const lines = [
    '# Helper results',
    '',
    'One row per scenario, example, and Then. Tier cells are `pass`, `fail` (B includes the pass rate), or `—` when that tier did not check it. Rows where checked tiers disagree are marked.',
    '',
    '| Scenario | Example | Then | A | B | C | Disagree? |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const row of rows) {
    const flag = disagrees(row) ? 'yes' : '';
    lines.push(
      `| ${mdCell(row.scenario)} | ${mdCell(row.example)} | ${mdCell(row.then)} | ${formatCell(row.cells.A, 'A')} | ${formatCell(row.cells.B, 'B')} | ${formatCell(row.cells.C, 'C')} | ${flag} |`,
    );
  }

  lines.push('', '## Failures', '');

  const failures = rows.filter((row) =>
    TIERS.some((t) => outcome(row.cells[t]?.result) === 'fail'),
  );

  if (failures.length === 0) {
    lines.push('None.', '');
  } else {
    for (const row of failures) {
      lines.push(`### ${row.scenario} — ${row.example}`);
      lines.push('');
      lines.push(`Then: ${row.then}`);
      lines.push('');
      for (const tier of TIERS) {
        const cell = row.cells[tier];
        if (!cell || outcome(cell.result) !== 'fail') continue;
        const label = formatCell(cell, tier);
        const evidence = cell.evidence.trim() || '(no evidence)';
        lines.push(`- **${tier}** (${label}): ${evidence}`);
      }
      lines.push('');
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

const rows = buildRows();
mkdirSync(RESULTS, { recursive: true });
writeFileSync(OUT, renderReport(rows));

const disagreeRows = rows.filter(disagrees);
const failCount = rows.filter((row) =>
  TIERS.some((t) => outcome(row.cells[t]?.result) === 'fail'),
).length;

console.log(`Wrote ${OUT}`);
console.log(`${rows.length} rows, ${disagreeRows.length} disagree, ${failCount} with a failure`);
if (disagreeRows.length > 0) {
  console.log('\nDisagreements:');
  for (const row of disagreeRows) {
    console.log(
      `- ${row.scenario} / ${row.example} / ${row.then} → A=${formatCell(row.cells.A, 'A')} B=${formatCell(row.cells.B, 'B')} C=${formatCell(row.cells.C, 'C')}`,
    );
  }
}
