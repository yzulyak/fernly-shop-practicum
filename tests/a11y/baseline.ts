import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ImpactValue } from 'axe-core';

export type BaselineEntry = {
  rule: string;
  page: string;
  /** CSS selector, or "*" for every element of this rule on the page. */
  target: string;
  owner: string;
  /** YYYY-MM-DD — after this date the entry is expired and blocking. */
  expires: string;
  reason: string;
};

export type Classification = 'new' | 'baselined' | 'expired';

export type ClassifiedViolation = {
  rule: string;
  page: string;
  target: string;
  impact: ImpactValue | undefined;
  classification: Classification;
  help: string;
  html: string;
};

function loadBaseline(): BaselineEntry[] {
  const filePath = path.resolve(process.cwd(), 'a11y-baseline.json');
  const raw: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
  if (!Array.isArray(raw)) {
    throw new Error('a11y-baseline.json must be a JSON array');
  }
  return raw as BaselineEntry[];
}

const baseline = loadBaseline();

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isExpired(expires: string, today: string): boolean {
  return expires < today;
}

function targetMatches(baselineTarget: string, elementTarget: string): boolean {
  return baselineTarget === '*' || baselineTarget === elementTarget;
}

export function getBaselineEntries(): BaselineEntry[] {
  return baseline;
}

export function findBaseline(
  rule: string,
  page: string,
  elementTarget: string,
): BaselineEntry | undefined {
  return baseline.find(
    (entry) =>
      entry.rule === rule &&
      entry.page === page &&
      targetMatches(entry.target, elementTarget),
  );
}

/** Baseline rows that no scanned element matched — safe to delete. */
export function unusedBaselineEntries(
  classified: ReadonlyArray<Pick<ClassifiedViolation, 'rule' | 'page' | 'target'>>,
): BaselineEntry[] {
  return baseline.filter(
    (entry) =>
      !classified.some(
        (item) =>
          item.rule === entry.rule &&
          item.page === entry.page &&
          targetMatches(entry.target, item.target),
      ),
  );
}

/** Flatten axe violation nodes and classify each against the baseline. */
export function classifyViolations(
  page: string,
  violations: ReadonlyArray<{
    id: string;
    impact?: ImpactValue;
    help: string;
    nodes: ReadonlyArray<{ target: ReadonlyArray<string | string[]>; html: string; impact?: ImpactValue }>;
  }>,
): ClassifiedViolation[] {
  const today = todayIsoDate();
  const classified: ClassifiedViolation[] = [];

  for (const violation of violations) {
    for (const node of violation.nodes) {
      const target = serializeTarget(node.target);
      const entry = findBaseline(violation.id, page, target);
      let classification: Classification = 'new';
      if (entry) {
        classification = isExpired(entry.expires, today) ? 'expired' : 'baselined';
      }
      classified.push({
        rule: violation.id,
        page,
        target,
        impact: node.impact ?? violation.impact,
        classification,
        help: violation.help,
        html: node.html,
      });
    }
  }

  return classified;
}

/** Blocking = new serious/critical, plus anything expired. */
export function blockingViolations(
  classified: ReadonlyArray<ClassifiedViolation>,
): ClassifiedViolation[] {
  return classified.filter((item) => {
    if (item.classification === 'expired') return true;
    if (item.classification === 'new') {
      return item.impact === 'serious' || item.impact === 'critical';
    }
    return false;
  });
}

export function formatBlockingMessage(
  blocking: ReadonlyArray<ClassifiedViolation>,
): string {
  if (blocking.length === 0) return 'no blocking accessibility violations';
  return blocking
    .map(
      (item) =>
        `[${item.classification}] ${item.rule} (${item.impact ?? 'unknown'}) on ${item.page} → ${item.target}: ${item.help}`,
    )
    .join('\n');
}

function serializeTarget(target: ReadonlyArray<string | string[]>): string {
  return target
    .map((part) => (Array.isArray(part) ? part.join(' ') : part))
    .join(' ');
}
