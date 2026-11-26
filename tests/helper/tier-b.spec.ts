import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { readFeature } from './feature';
import { freshCustomer, HelperPage } from './helper-page';
import { writeEntries, type Entry } from './manifest';
import {
  callOutcome,
  expectedCall,
  inRunOrder,
  runCheck,
  uiCheck,
  type CheckOutcome,
  type ExpectedCall,
} from './thens';

/**
 * Tier B: language is in play. Each Examples row whose Thens name a tool call is
 * typed into the real helper several times; a Then passes only when it holds in
 * at least 9 of 10 runs (scaled with HELPER_RUNS).
 */

const RUNS = Math.max(1, Number.parseInt(process.env.HELPER_RUNS ?? '10', 10) || 10);
/** Doc bar: at least 9 times out of 10. */
const PASS_BAR = Math.ceil((RUNS * 9) / 10);

const examples = readFeature(join(dirname(fileURLToPath(import.meta.url)), 'helper.feature')).filter(
  (example) => example.thens.some((then) => expectedCall(then) !== undefined),
);

const JUDGE: CheckOutcome & { result: 'needs judge' } = {
  result: 'needs judge',
  evidence: 'only a judge can decide this from a reply',
};

function callLabel(call: ExpectedCall | undefined): string {
  if (!call) return '(none)';
  return `${call.name} ${JSON.stringify(call.args)}`;
}

for (const example of examples) {
  const phrase = example.row.phrase ?? example.when;
  const call = example.thens.map(expectedCall).find((c) => c !== undefined)!;

  test(`Tier B ${phrase}`, { tag: '@helper' }, async ({ page, request }) => {
    test.setTimeout(RUNS * 15_000);

    const passCounts = new Map<string, number>();
    const lastEvidence = new Map<string, string>();
    const distinctCalls = new Set<string>();

    for (let run = 0; run < RUNS; run++) {
      await freshCustomer(page, request);
      const helper = new HelperPage(page);
      await helper.open();
      await helper.ask(phrase);

      const recorded = await helper.lastModelCall();
      distinctCalls.add(callLabel(recorded));
      const called = callOutcome(call, recorded);

      const uiThens = inRunOrder(
        example.thens.flatMap((then) => {
          if (expectedCall(then)) return [];
          const check = uiCheck(then);
          return check ? [{ then, check }] : [];
        }),
      );
      const outcomes = new Map<string, CheckOutcome>();
      for (const { then, check } of uiThens) {
        outcomes.set(then, await runCheck(check, { page, helper, request }));
      }

      for (const then of example.thens) {
        const outcome: CheckOutcome | typeof JUDGE = expectedCall(then)
          ? called
          : (outcomes.get(then) ?? JUDGE);
        lastEvidence.set(then, outcome.evidence);
        if (outcome.result === 'passed') {
          passCounts.set(then, (passCounts.get(then) ?? 0) + 1);
        }
      }
    }

    const entries: Entry[] = example.thens.map((then) => {
      if (!expectedCall(then) && !uiCheck(then)) {
        return {
          tier: 'B',
          scenario: example.scenario,
          example: phrase,
          then,
          result: 'needs judge',
          evidence: JUDGE.evidence,
        };
      }
      const passes = passCounts.get(then) ?? 0;
      const passRate = `${passes}/${RUNS}`;
      const passed = passes >= PASS_BAR;
      const evidence = expectedCall(then)
        ? `distinct calls: ${[...distinctCalls].join('; ')}`
        : (lastEvidence.get(then) ?? '');
      return {
        tier: 'B',
        scenario: example.scenario,
        example: phrase,
        then,
        result: passed ? 'passed' : 'failed',
        passRate,
        evidence,
      };
    });
    writeEntries('B', test.info().title, entries);

    const failed = entries
      .filter((entry) => entry.result === 'failed')
      .map((entry) => `${entry.then} — ${entry.passRate}${entry.evidence ? `; ${entry.evidence}` : ''}`);
    expect(failed, 'Thens below the 9/10 bar').toEqual([]);
  });
}
