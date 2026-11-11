import { AxeBuilder } from '@axe-core/playwright';
import type { AxeResults, Result } from 'axe-core';
import type { Page, TestInfo } from '@playwright/test';
import {
  blockingViolations,
  classifyViolations,
  type ClassifiedViolation,
} from '../baseline';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const;

export type ScanAttachment = {
  page: string;
  url: string;
  scannedAt: string;
  violations: Result[];
  passes: Result[];
  incomplete: Result[];
};

export type ScanResult = {
  classified: ClassifiedViolation[];
  blocking: ClassifiedViolation[];
  results: ScanAttachment;
};

function selectorFromTarget(target: ReadonlyArray<string | string[]>): string | undefined {
  const last = target[target.length - 1];
  if (typeof last === 'string') return last;
  if (Array.isArray(last) && last.length > 0) return last[last.length - 1];
  return undefined;
}

async function attachFailingShots(
  page: Page,
  testInfo: TestInfo,
  pageName: string,
  violations: Result[],
): Promise<void> {
  for (const violation of violations) {
    const nodes = violation.nodes.slice(0, 3);
    for (let index = 0; index < nodes.length; index += 1) {
      const selector = selectorFromTarget(nodes[index].target);
      if (!selector) continue;
      try {
        const shot = await page.locator(selector).first().screenshot({ timeout: 2000 });
        await testInfo.attach(`axe-shot:${pageName}:${violation.id}:${index}`, {
          body: shot,
          contentType: 'image/png',
        });
      } catch {
        // Element may be off-screen or detached; skip the shot.
      }
    }
  }
}

export async function scanPage(
  page: Page,
  testInfo: TestInfo,
  { name }: { name: string },
): Promise<ScanResult> {
  const axeResults: AxeResults = await new AxeBuilder({ page })
    .withTags([...WCAG_TAGS])
    .analyze();

  await attachFailingShots(page, testInfo, name, axeResults.violations);

  const results: ScanAttachment = {
    page: name,
    url: page.url(),
    scannedAt: new Date().toISOString(),
    violations: axeResults.violations,
    passes: axeResults.passes,
    incomplete: axeResults.incomplete,
  };

  await testInfo.attach('axe-results', {
    body: Buffer.from(JSON.stringify(results, null, 2)),
    contentType: 'application/json',
  });

  const classified = classifyViolations(name, axeResults.violations);
  const blocking = blockingViolations(classified);

  return { classified, blocking, results };
}
