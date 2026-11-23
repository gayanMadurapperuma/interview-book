import { scenario } from '../../engine/builder';
import { NODE_LANES } from '../shared';

const code = `
const { Worker } = require('node:worker_threads');

let beats = 0;
const heartbeat = setInterval(() => beats++, 10);

const worker = new Worker(\`
  const { parentPort } = require('node:worker_threads');
  let sum = 0;
  for (let i = 0; i < 3e8; i++) sum += i % 7;
  parentPort.postMessage(sum);
\`, { eval: true });

worker.on('message', (sum) => {
  clearInterval(heartbeat);
  console.log('worker result:', sum);
  console.log('main thread stayed responsive:', beats > 5);
});
`;

const m = (b: number) => ({ beats: { value: b, max: 30, label: 'Heartbeats on main thread' } });

export default scenario({
  id: 'node-worker-offload', runtime: 'node', group: 'Performance', level: 'advanced', chapter: 'node/scaling-cluster-workers',
  title: 'Offloading CPU work to a worker thread',
  blurb: 'The same heavy loop, moved off the main thread, leaves the event loop free.',
  code,
  takeaway: 'A <code>worker_threads</code> Worker is a separate JavaScript thread with its <b>own</b> event loop and heap. Heavy CPU work there does not block the main thread. They talk by passing messages (data is copied, or transferred for ArrayBuffers).',
}, NODE_LANES, 'main')
  .push('stack', { id: 'main', label: 'main module' })
  .push('timers', { id: 'hb', label: 'heartbeat', sub: 'every 10 ms' })
  .step('const heartbeat', 'A heartbeat timer ticks every 10 ms. If the main thread gets blocked, it will stop counting — a cheap way to *see* responsiveness.', { mark: 'Start', meters: m(0) })
  .push('workers', { id: 'w', label: 'Worker thread', sub: 'own V8 isolate + event loop', tone: 'hot' })
  .step('const worker = new Worker', '`new Worker` starts a **second JavaScript thread**, with its own memory and event loop. The heavy loop goes there.',
    { meters: m(0), detail: 'Workers are real OS threads, unlike the async illusion of the event loop. Starting one costs a few milliseconds and some memory, so for many small jobs use a pool of workers (e.g. the piscina library).' })
  .step("worker.on('message'", 'We subscribe to the worker’s result and the main module ends.', { meters: m(0) })
  .pop('stack')
  .step(0, 'The main event loop is **free**. Meanwhile the worker is crunching 300 million iterations on another CPU core.', { phase: 'timers', meters: m(0), mark: 'Parallel' })
  .push('stack', { id: 'b1', label: 'heartbeat()' })
  .step('setInterval(() => beats++', 'The heartbeat keeps firing on time: 10 ms, 20 ms, 30 ms…', { phase: 'timers', meters: m(8) })
  .pop('stack')
  .step(0, 'Between heartbeats the main loop could serve HTTP requests normally.', { phase: 'poll', meters: m(15) })
  .update('w', { sub: 'done — posting result', tone: 'good' }).push('poll', { id: 'msg', label: "'message' from worker", sub: 'sum' })
  .step('parentPort.postMessage(sum);', 'The worker finishes and posts its result. The message arrives on the main thread like any other I/O event.', { phase: 'idle', meters: m(25) })
  .move('msg', 'stack', { label: 'message handler' }).remove('hb')
  .step('clearInterval(heartbeat);', 'The handler stops the heartbeat…', { phase: 'poll', meters: m(25), mark: 'Result' })
  .log('worker result: 899999997')
  .step("console.log('worker result:'", '…prints the result…', { phase: 'poll', meters: m(25) })
  .log('main thread stayed responsive: true')
  .step("console.log('main thread stayed", '…and confirms the heartbeat kept beating the whole time. Compare with the *Blocking the event loop* demo, where the timer was 190 ms late.', { phase: 'poll', meters: m(25) })
  .pop('stack').update('w', { sub: 'exits when idle', tone: 'muted' })
  .step(0, 'With no more work, the worker exits and so does the process.', { phase: 'done', meters: m(25) })
  .build({ kind: 'exact', module: 'cjs' });
