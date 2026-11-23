import { scenario } from '../../engine/builder';
import { NODE_LANES } from '../shared';

const code = `
const start = Date.now();

setTimeout(() => {
  const waited = Date.now() - start;
  console.log('timer asked for 10 ms, waited at least 200:', waited >= 200);
}, 10);

function hashPasswordsSync() {
  const end = Date.now() + 200;
  while (Date.now() < end) {}   // CPU-bound work: nothing else can run
}

hashPasswordsSync();
console.log('sync work done after', Math.round((Date.now() - start) / 100) * 100, 'ms');
`;

const lag = (ms: number) => ({ lag: { value: ms, max: 200, label: 'Event-loop delay', unit: ' ms' } });

export default scenario({
  id: 'node-blocking-loop', runtime: 'node', group: 'Performance', level: 'core', chapter: 'node/non-blocking-io',
  title: 'Blocking the event loop',
  blurb: '200 ms of synchronous work delays every timer, request and callback by 200 ms.',
  code,
  takeaway: 'Node has <b>one</b> JavaScript thread. While it runs synchronous code — a heavy loop, <code>JSON.parse</code> of a huge string, <code>readFileSync</code>, a sync crypto call — <b>nothing else can run</b>: no timers, no requests. Move heavy CPU work to worker threads, and keep request handlers short.',
}, NODE_LANES, 'main')
  .push('stack', { id: 'main', label: 'main module' })
  .step('const start', 'We note the start time.', { mark: 'Start', meters: lag(0) })
  .push('timers', { id: 't', label: 'timer callback', sub: 'due at 10 ms' })
  .step('setTimeout(() => {', 'A timer is set for 10 ms.', { meters: lag(0) })
  .push('stack', { id: 'h', label: 'hashPasswordsSync()', tone: 'hot' })
  .step('hashPasswordsSync();', 'Now a synchronous, CPU-heavy function is called — imagine hashing passwords or resizing an image in JavaScript.', { meters: lag(0) })
  .step('while (Date.now() < end) {}', 'It spins for 200 ms. At 10 ms the timer is due, but the loop **cannot** check timers — the stack is busy.', { meters: lag(10), mark: 'Blocked' })
  .update('t', { sub: 'due at 10 ms · OVERDUE', tone: 'bad' }).push('kernel', { id: 'r1', label: 'GET /health', sub: 'waiting…' }, { id: 'r2', label: 'GET /orders', sub: 'waiting…' })
  .step('while (Date.now() < end) {}', 'If this were a server, incoming requests would pile up in the kernel. Health checks fail; load balancers start removing the instance.', { meters: lag(120) })
  .pop('stack')
  .step('hashPasswordsSync();', 'At 200 ms the function finally returns.', { meters: lag(200) })
  .log('sync work done after 200 ms')
  .step("console.log('sync work done", 'The main module finishes.', { meters: lag(200) })
  .pop('stack').clear('kernel')
  .step(0, 'Only now does the loop start.', { phase: 'timers', meters: lag(200) })
  .move('t', 'stack', { sub: '190 ms late', tone: 'default' }).log('timer asked for 10 ms, waited at least 200: true')
  .step("console.log('timer asked", 'The timer runs — 190 ms late. Timers promise a **minimum** delay, never an exact one.', { phase: 'timers', meters: lag(200), mark: 'Late' })
  .pop('stack')
  .step(0, 'How to spot this in production: measure event-loop delay with `perf_hooks.monitorEventLoopDelay()`, and look for long synchronous frames in a CPU profile (`node --cpu-prof`).', { phase: 'done', meters: lag(0) })
  .build({ kind: 'exact', module: 'cjs' });
