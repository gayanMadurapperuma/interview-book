import type { Scenario } from './engine/types';

const modules = import.meta.glob<{ default: Scenario }>('./scenarios/{js,node}/*.ts', { eager: true });

/** Display order inside each group follows this list; unknown ids go last. */
const ORDER = [
  // JavaScript
  'js-event-loop', 'js-micro-vs-macro', 'js-closures-loop', 'js-hoisting-tdz', 'js-this-binding', 'js-prototype-lookup',
  'js-promise-chain', 'js-async-await', 'js-await-in-loops', 'js-combinators', 'js-generators', 'js-closure-leak',
  'js-debounce', 'js-esm-live-bindings',
  // Node
  'node-six-phases', 'node-request-lifecycle', 'node-nexttick-starvation',
  'node-blocking-loop', 'node-worker-offload', 'node-threadpool-saturation',
  'node-emitter-sync', 'node-stream-backpressure', 'node-unhandled-rejection', 'node-graceful-shutdown',
];

export const SCENARIOS: Scenario[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => {
    const ia = ORDER.indexOf(a.id), ib = ORDER.indexOf(b.id);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });

export const scenarioById = (id: string) => SCENARIOS.find((s) => s.id === id);

export function scenarioMeta(id: string) {
  const s = scenarioById(id);
  return s && { id: s.id, title: s.title, blurb: s.blurb, runtime: s.runtime, group: s.group, level: s.level, steps: s.steps.length };
}
