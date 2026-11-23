export type Runtime = 'js' | 'node';

/** Something that sits in a lane: a stack frame, a queued callback, a heap object… */
export interface Item {
  /** Stable identity. The same id in two snapshots animates as the same thing moving. */
  id: string;
  label: string;
  /** Small secondary text, e.g. a value or "← u" reference. */
  sub?: string;
  /** Visual emphasis. */
  tone?: 'default' | 'hot' | 'muted' | 'bad' | 'good';
}

export type Lanes = Record<string, Item[]>;

export interface Snapshot {
  /** 1-based line in the scenario code, or 0 when no line is running. */
  line: number;
  /** Runtime phase key (see runtimes.ts). */
  phase: string;
  lanes: Lanes;
  console: ConsoleLine[];
  /** Plain-English narration. Supports `code` and **bold**. */
  note: string;
  /** Optional deeper explanation behind a "Why?" toggle. */
  detail?: string;
  /** Short label shown on the timeline as a milestone. */
  mark?: string;
  /** Free-form gauges for scenarios that need them (e.g. event-loop lag). */
  meters?: Record<string, { value: number; max: number; label: string; unit?: string }>;
}

export interface ConsoleLine { text: string; kind?: 'log' | 'error' | 'warn' | 'info' }

export interface Verify {
  /** 'exact': real output must equal final console. 'oneOf': must equal one of `outputs`. */
  kind: 'exact' | 'oneOf' | 'none';
  /** Source to execute instead of the displayed code (for browser-only APIs etc.). */
  source?: string;
  module?: 'esm' | 'cjs';
  outputs?: string[][];
  /** Why this scenario cannot be verified by execution. */
  reason?: string;
}

export interface Scenario {
  id: string;
  runtime: Runtime;
  title: string;
  blurb: string;
  group: string;
  level: 'foundation' | 'core' | 'advanced';
  /** chapter link: "<subject>/<slug>" */
  chapter?: string;
  code: string;
  takeaway: string;
  steps: Snapshot[];
  verify: Verify;
}
