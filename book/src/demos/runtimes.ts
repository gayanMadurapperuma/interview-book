import type { Runtime } from './engine/types';

export type LaneKind = 'stack' | 'queue' | 'heap' | 'list' | 'pool';

export interface LaneDef {
  k: string;
  label: string;
  kind: LaneKind;
  hint: string;
  tone: 'accent' | 'js' | 'node' | 'ts' | 'db' | 'sd' | 'pitfall' | 'tip';
  empty: string;
  slots?: number;
  /** only shown when a scenario actually uses it */
  optional?: boolean;
}

export interface PhaseDef { k: string; label: string; short?: string }

export interface RuntimeDef {
  lanes: LaneDef[];
  /** stations around the loop ring, in order */
  ring: PhaseDef[];
  /** phases that are not on the ring (shown in the ring centre) */
  centre: Record<string, string>;
  /** CSS grid-template-areas for the visual pane */
  areas: string;
  columns: string;
}

export const RUNTIMES: Record<Runtime, RuntimeDef> = {
  js: {
    lanes: [
      { k: 'stack', label: 'Call stack', kind: 'stack', hint: 'What is running right now. Last in, first out.', tone: 'accent', empty: 'empty — the engine is free' },
      { k: 'heap', label: 'Heap', kind: 'heap', hint: 'Where objects and closures live.', tone: 'node', empty: 'nothing allocated yet' },
      { k: 'webapis', label: 'Web APIs', kind: 'list', hint: 'Timers, fetch, DOM events — handled outside the JS thread.', tone: 'sd', empty: 'nothing pending' },
      { k: 'micro', label: 'Microtask queue', kind: 'queue', hint: 'Promise callbacks, queueMicrotask, await continuations. Drained completely.', tone: 'tip', empty: 'empty' },
      { k: 'macro', label: 'Task queue', kind: 'queue', hint: 'setTimeout, events, messages. One per loop turn.', tone: 'js', empty: 'empty' },
    ],
    ring: [
      { k: 'script', label: 'Run script', short: 'Script' },
      { k: 'micro', label: 'Drain microtasks', short: 'Micro' },
      { k: 'render', label: 'Render (maybe)', short: 'Render' },
      { k: 'macro', label: 'Run one task', short: 'Task' },
    ],
    centre: { idle: 'Waiting for work', done: 'Program finished' },
    areas: `"stack ring" "stack webapis" "heap heap" "micro macro"`,
    columns: 'minmax(0, 1fr) minmax(0, 1fr)',
  },
  node: {
    lanes: [
      { k: 'stack', label: 'Call stack', kind: 'stack', hint: 'The single JavaScript thread.', tone: 'accent', empty: 'empty — the loop may continue' },
      { k: 'tick', label: 'nextTick queue', kind: 'queue', hint: 'process.nextTick — runs before promises, after every callback.', tone: 'pitfall', empty: 'empty' },
      { k: 'micro', label: 'Promise microtasks', kind: 'queue', hint: 'then/catch/await continuations.', tone: 'tip', empty: 'empty' },
      { k: 'timers', label: 'Timers', kind: 'list', hint: 'setTimeout / setInterval waiting for their time.', tone: 'js', empty: 'no timers' },
      { k: 'pool', label: 'libuv thread pool', kind: 'pool', slots: 4, hint: 'fs, dns.lookup, crypto, zlib. 4 threads by default.', tone: 'db', empty: 'idle' },
      { k: 'kernel', label: 'OS kernel', kind: 'list', hint: 'Sockets are watched by epoll / kqueue / IOCP. No thread needed.', tone: 'sd', empty: 'nothing watched' },
      { k: 'poll', label: 'I/O callbacks ready', kind: 'queue', hint: 'Completed I/O waiting to run in the poll phase.', tone: 'node', empty: 'empty' },
      { k: 'check', label: 'Check queue', kind: 'queue', hint: 'setImmediate callbacks.', tone: 'ts', empty: 'empty' },
      { k: 'heap', label: 'Heap', kind: 'heap', hint: 'Objects your code is holding on to.', tone: 'node', empty: 'nothing of interest', optional: true },
      { k: 'workers', label: 'Worker threads', kind: 'list', hint: 'Separate JS threads with their own event loop.', tone: 'sd', empty: 'none', optional: true },
    ],
    ring: [
      { k: 'timers', label: 'Timers', short: 'Timers' },
      { k: 'pending', label: 'Pending callbacks', short: 'Pending' },
      { k: 'prepare', label: 'Idle / prepare', short: 'Prepare' },
      { k: 'poll', label: 'Poll (I/O)', short: 'Poll' },
      { k: 'check', label: 'Check', short: 'Check' },
      { k: 'close', label: 'Close callbacks', short: 'Close' },
    ],
    centre: { main: 'Main script', micro: 'Draining nextTick → promises', idle: 'Blocked in poll, waiting', done: 'Loop empty — process exits' },
    areas: `"stack ring pool" "tick micro check" "timers kernel poll"`,
    columns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
  },
};
