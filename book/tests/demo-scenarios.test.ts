/**
 * Every demo is checked two ways:
 *  1. structural invariants (lines in range, ids unique, console only grows…)
 *  2. the real program is executed with Node and its output must equal the
 *     console shown on the demo's final step.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SCENARIOS } from '../src/demos/catalog';
import { RUNTIMES } from '../src/demos/runtimes';

const dir = mkdtempSync(join(tmpdir(), 'book-demos-'));

function run(source: string, module: 'esm' | 'cjs') {
  const file = join(dir, `s-${Math.random().toString(36).slice(2)}.${module === 'esm' ? 'mjs' : 'cjs'}`);
  writeFileSync(file, source);
  try {
    const out = execFileSync(process.execPath, [file], { encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] });
    return { stdout: out, code: 0 };
  } catch (e: any) {
    return { stdout: String(e.stdout ?? ''), code: e.status ?? 1 };
  }
}

const lines = (s: string) => s.split('\n').filter((l) => l.length > 0);

it('has scenarios', () => {
  expect(SCENARIOS.length).toBeGreaterThan(0);
});

describe.each(SCENARIOS.map((s) => [s.id, s] as const))('%s', (_id, s) => {
  const rt = RUNTIMES[s.runtime];
  const codeLines = s.code.split('\n').length;
  const phases = new Set([...rt.ring.map((p) => p.k), ...Object.keys(rt.centre)]);

  it('has a sensible shape', () => {
    expect(s.steps.length).toBeGreaterThanOrEqual(4);
    expect(s.title.length).toBeGreaterThan(5);
    expect(s.takeaway.length).toBeGreaterThan(20);
  });

  it('every step is well-formed', () => {
    s.steps.forEach((st, k) => {
      const where = `step ${k + 1}`;
      expect(st.line, where).toBeGreaterThanOrEqual(0);
      expect(st.line, where).toBeLessThanOrEqual(codeLines);
      expect(st.note.trim().length, where).toBeGreaterThan(10);
      expect(phases.has(st.phase), `${where}: unknown phase ${st.phase}`).toBe(true);
      for (const lane of Object.keys(st.lanes)) {
        expect(rt.lanes.some((l) => l.k === lane), `${where}: unknown lane ${lane}`).toBe(true);
      }
      const ids = Object.values(st.lanes).flat().map((i) => i.id);
      expect(new Set(ids).size, `${where}: duplicate item ids ${ids}`).toBe(ids.length);
    });
  });

  it('console output only ever grows', () => {
    for (let k = 1; k < s.steps.length; k++) {
      const prev = s.steps[k - 1].console.map((c) => c.text);
      const cur = s.steps[k].console.map((c) => c.text);
      expect(cur.slice(0, prev.length), `step ${k + 1}`).toEqual(prev);
    }
  });

  it('nothing runs from a queue while the stack is busy with other code', () => {
    // a callback may only leave the microtask queue when the stack below it is empty
    for (let k = 1; k < s.steps.length; k++) {
      const before = s.steps[k - 1].lanes, after = s.steps[k].lanes;
      const movedToStack = (after.stack ?? []).filter(
        (it) => (before.micro ?? []).some((m) => m.id === it.id) || (before.macro ?? []).some((m) => m.id === it.id),
      );
      for (const it of movedToStack) {
        const below = (after.stack ?? []).slice(0, (after.stack ?? []).findIndex((x) => x.id === it.id));
        expect(below, `step ${k + 1}: ${it.label} entered a busy stack`).toEqual([]);
      }
      // a task may not start while microtasks are still waiting
      const taskStarted = (after.stack ?? []).some((it) => (before.macro ?? []).some((m) => m.id === it.id));
      if (taskStarted && s.runtime === 'js') {
        expect(before.micro ?? [], `step ${k + 1}: task ran before microtasks drained`).toEqual([]);
      }
    }
  });

  const v = s.verify;
  if (v.kind === 'none') {
    it.skip(`execution check skipped: ${v.reason ?? 'no reason given'}`, () => {});
  } else {
    it('real Node output matches the demo', () => {
      const expected = s.steps[s.steps.length - 1].console.filter((c) => c.kind !== 'error' && c.kind !== 'warn').map((c) => c.text);
      const { stdout } = run(v.source ?? s.code, v.module ?? 'esm');
      const actual = lines(stdout);
      if (v.kind === 'exact') expect(actual).toEqual(expected);
      else {
        expect(v.outputs?.length).toBeGreaterThan(0);
        expect(v.outputs!.map((o) => JSON.stringify(o))).toContain(JSON.stringify(actual));
        expect(v.outputs!.map((o) => JSON.stringify(o)), 'demo shows one of the possible outputs').toContain(JSON.stringify(expected));
      }
    });
  }
});
