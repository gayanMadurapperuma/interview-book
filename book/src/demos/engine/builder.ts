import type { ConsoleLine, Item, Lanes, Runtime, Scenario, Snapshot, Verify } from './types';

type ItemInput = Item | string;

const toItem = (x: ItemInput, fallbackId: () => string): Item =>
  typeof x === 'string' ? { id: fallbackId(), label: x } : { ...x };

/**
 * Builds a scenario as a sequence of immutable snapshots.
 * Each call to `step()` records the state after applying that step's operations,
 * so the player can jump to any step without re-simulating anything.
 */
export class ScenarioBuilder {
  private lanes: Lanes = {};
  private out: ConsoleLine[] = [];
  private phase: string;
  private steps: Snapshot[] = [];
  private auto = 0;

  constructor(private meta: Omit<Scenario, 'steps' | 'verify' | 'code'> & { code: string }, laneKeys: string[], initialPhase: string) {
    for (const k of laneKeys) this.lanes[k] = [];
    this.phase = initialPhase;
  }

  private nextId = () => `auto-${++this.auto}`;

  private lane(k: string) {
    if (!(k in this.lanes)) throw new Error(`[${this.meta.id}] unknown lane "${k}"`);
    return this.lanes[k];
  }

  /** push to the end of a lane (top of a stack, back of a queue) */
  push(lane: string, ...items: ItemInput[]) {
    this.lane(lane).push(...items.map((i) => toItem(i, this.nextId)));
    return this;
  }
  /** remove from the end (pop a stack frame) */
  pop(lane: string) {
    const l = this.lane(lane);
    if (!l.length) throw new Error(`[${this.meta.id}] pop from empty lane "${lane}"`);
    l.pop();
    return this;
  }
  /** remove from the front (dequeue) */
  shift(lane: string) {
    const l = this.lane(lane);
    if (!l.length) throw new Error(`[${this.meta.id}] shift from empty lane "${lane}"`);
    l.shift();
    return this;
  }
  /** move an item (by id) from one lane to the end of another, keeping its identity */
  move(id: string, to: string, patch?: Partial<Item>) {
    for (const k of Object.keys(this.lanes)) {
      const idx = this.lanes[k].findIndex((i) => i.id === id);
      if (idx >= 0) {
        const [it] = this.lanes[k].splice(idx, 1);
        this.lane(to).push({ ...it, ...patch });
        return this;
      }
    }
    throw new Error(`[${this.meta.id}] move: no item "${id}"`);
  }
  remove(id: string) {
    for (const k of Object.keys(this.lanes)) {
      const idx = this.lanes[k].findIndex((i) => i.id === id);
      if (idx >= 0) { this.lanes[k].splice(idx, 1); return this; }
    }
    throw new Error(`[${this.meta.id}] remove: no item "${id}"`);
  }
  update(id: string, patch: Partial<Item>) {
    for (const k of Object.keys(this.lanes)) {
      const it = this.lanes[k].find((i) => i.id === id);
      if (it) { Object.assign(it, patch); return this; }
    }
    throw new Error(`[${this.meta.id}] update: no item "${id}"`);
  }
  clear(lane: string) { this.lane(lane).length = 0; return this; }
  log(text: string, kind: ConsoleLine['kind'] = 'log') { this.out.push({ text, kind }); return this; }
  setPhase(p: string) { this.phase = p; return this; }

  /** Resolve a line by a unique snippet of its text, so line numbers can't drift. */
  private resolveLine(line: number | string) {
    if (typeof line === 'number') return line;
    const rows = this.meta.code.split('\n');
    const hits = rows.flatMap((r, k) => (r.includes(line) ? [k + 1] : []));
    if (hits.length !== 1) throw new Error(`[${this.meta.id}] line snippet "${line}" matched ${hits.length} lines`);
    return hits[0];
  }

  /** record a snapshot. `line` is a 1-based number, 0 for "no line", or a unique snippet of the line. */
  step(lineRef: number | string, note: string, opts: { detail?: string; mark?: string; phase?: string; meters?: Snapshot['meters'] } = {}) {
    if (opts.phase) this.phase = opts.phase;
    const line = this.resolveLine(lineRef);
    this.steps.push({
      line,
      phase: this.phase,
      lanes: structuredClone(this.lanes),
      console: this.out.map((c) => ({ ...c })),
      note,
      detail: opts.detail,
      mark: opts.mark,
      meters: opts.meters ? structuredClone(opts.meters) : undefined,
    });
    return this;
  }

  build(verify: Verify): Scenario {
    return { ...this.meta, steps: this.steps, verify };
  }
}

export function scenario(
  meta: {
    id: string; runtime: Runtime; title: string; blurb: string; group: string;
    level: Scenario['level']; chapter?: string; code: string; takeaway: string;
  },
  lanes: string[],
  phase: string,
) {
  return new ScenarioBuilder({ ...meta, code: meta.code.replace(/^\n/, '').replace(/\s+$/, '') }, lanes, phase);
}
