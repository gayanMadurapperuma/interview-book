import { scenario } from '../../engine/builder';
import { NODE_LANES } from '../shared';

const code = `
const fs = require('node:fs');

setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
process.nextTick(() => console.log('nextTick'));
Promise.resolve().then(() => console.log('promise'));

fs.readFile(__filename, () => {
  console.log('readFile done');
  setTimeout(() => console.log('timeout (from I/O)'), 0);
  setImmediate(() => console.log('immediate (from I/O)'));
});

console.log('sync');
`;

const A = ['sync', 'nextTick', 'promise', 'timeout', 'immediate', 'readFile done', 'immediate (from I/O)', 'timeout (from I/O)'];
const B = ['sync', 'nextTick', 'promise', 'immediate', 'timeout', 'readFile done', 'immediate (from I/O)', 'timeout (from I/O)'];

export default scenario({
  id: 'node-six-phases', runtime: 'node', group: 'Event loop', level: 'core', chapter: 'node/event-loop-phases',
  title: 'A full tour of the six phases',
  blurb: 'nextTick, promises, timers, I/O and setImmediate — in the order Node really runs them.',
  code,
  takeaway: 'After the main script: <b>nextTick queue → promise microtasks</b>, then the loop: <b>timers → pending → poll (I/O) → check (setImmediate) → close</b>. Both micro-queues drain after every single callback. Inside an I/O callback, <code>setImmediate</code> always beats <code>setTimeout(0)</code>.',
}, NODE_LANES, 'main')
  .push('stack', { id: 'main', label: 'main module' })
  .step(0, 'Node runs the whole main module first, top to bottom. The event loop has not started yet.', { mark: 'Main script' })
  .push('timers', { id: 't1', label: "log('timeout')", sub: 'due in 1 ms' })
  .step("setTimeout(() => console.log('timeout')", '`setTimeout(fn, 0)` registers a timer. Node treats 0 as 1 ms.')
  .push('check', { id: 'i1', label: "log('immediate')" })
  .step("setImmediate(() => console.log('immediate'))", '`setImmediate` queues a callback for the **check** phase.')
  .push('tick', { id: 'nt', label: "log('nextTick')" })
  .step('process.nextTick', '`process.nextTick` goes into Node’s own **nextTick queue**, which runs before anything else once the current code finishes.')
  .push('micro', { id: 'pr', label: "log('promise')" })
  .step('Promise.resolve().then', 'The `.then` callback goes into the **promise microtask** queue.')
  .push('pool', { id: 'rf', label: 'fs.readFile', sub: 'open → stat → read → close' })
  .step('fs.readFile(__filename', 'File I/O is handed to the **libuv thread pool**. A worker thread does the blocking file calls; JavaScript carries on.')
  .log('sync')
  .step("console.log('sync')", '`sync` prints. The main module is done.')
  .pop('stack')
  .step(0, 'Before entering the loop, Node drains the micro-queues: **nextTick first**, then promises.', { phase: 'micro', mark: 'Microtasks' })
  .move('nt', 'stack').log('nextTick')
  .step('process.nextTick', '`nextTick` runs first…', { phase: 'micro' })
  .pop('stack').move('pr', 'stack').log('promise')
  .step('Promise.resolve().then', '…then the promise callback.', { phase: 'micro' })
  .pop('stack')
  .step(0, 'Now the event loop starts its first iteration.', { phase: 'timers', mark: 'Loop' })
  .move('t1', 'stack').log('timeout')
  .step("setTimeout(() => console.log('timeout')", '**Timers phase**: the 1 ms timer has (usually) expired, so it runs.',
    { phase: 'timers', detail: 'From the main module, timeout vs immediate is a race: if the loop starts in under 1 ms, the timer is not due yet and `immediate` prints first. The test for this demo accepts both orders.' })
  .pop('stack')
  .step(0, '**Pending callbacks** (some system errors) and **idle/prepare** (internal) have nothing to do.', { phase: 'prepare' })
  .step(0, '**Poll phase**: is any I/O finished? The file read is still in progress. Because a `setImmediate` is waiting, poll does not block.', { phase: 'poll' })
  .move('i1', 'stack').log('immediate')
  .step("setImmediate(() => console.log('immediate'))", '**Check phase**: `setImmediate` callbacks run.', { phase: 'check' })
  .pop('stack')
  .step(0, '**Close callbacks**: nothing. Iteration 1 is over. Nothing is ready, so the loop will **block in poll**, waiting for the thread pool.', { phase: 'close' })
  .move('rf', 'poll', { sub: 'finished — callback ready' })
  .step(0, 'A pool thread finishes the read and signals the loop. The callback is ready for the poll phase.', { phase: 'idle' })
  .move('rf', 'stack', { label: 'readFile callback', sub: undefined }).log('readFile done')
  .step("console.log('readFile done')", '**Poll phase** (iteration 2): the I/O callback runs.', { phase: 'poll', mark: 'I/O' })
  .push('timers', { id: 't2', label: "log('timeout (from I/O)')", sub: 'due in 1 ms' })
  .step("console.log('timeout (from I/O)')", 'Inside it, a 0 ms timer is set…', { phase: 'poll' })
  .push('check', { id: 'i2', label: "log('immediate (from I/O)')" })
  .step("console.log('immediate (from I/O)')", '…and a `setImmediate`.', { phase: 'poll' })
  .pop('stack').move('i2', 'stack').log('immediate (from I/O)')
  .step("console.log('immediate (from I/O)')", 'After poll comes **check**, so the immediate runs first — every time. This ordering is guaranteed.', { phase: 'check', mark: 'Guaranteed order' })
  .pop('stack').move('t2', 'stack').log('timeout (from I/O)')
  .step("console.log('timeout (from I/O)')", 'The timer has to wait for the **next** iteration’s timers phase.', { phase: 'timers' })
  .pop('stack')
  .step(0, 'No timers, no I/O, no handles left. The loop has nothing to wait for, so the process exits.', { phase: 'done', mark: 'Exit' })
  .build({ kind: 'oneOf', module: 'cjs', outputs: [A, B] });
