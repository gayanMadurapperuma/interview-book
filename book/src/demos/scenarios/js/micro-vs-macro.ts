import { scenario } from '../../engine/builder';
import { JS_LANES } from '../shared';

const code = `
console.log('a');

setTimeout(() => console.log('timeout'), 0);

Promise.resolve().then(() => {
  console.log('p1');
  Promise.resolve().then(() => console.log('p2'));
});

queueMicrotask(() => console.log('qm'));

console.log('b');
`;

export default scenario({
  id: 'js-micro-vs-macro', runtime: 'js', group: 'Asynchrony', level: 'core', chapter: 'js/microtasks-and-tasks',
  title: 'Nested microtasks still beat a timer',
  blurb: 'A microtask queued while the queue is draining runs in the same drain.',
  code,
  takeaway: 'The microtask queue drains until it is <b>truly empty</b> — including microtasks added during the drain. Order here: a, b, p1, qm, p2, timeout. Microtasks run in the order they were queued.',
}, JS_LANES, 'script')
  .push('stack', { id: 'g', label: 'global()' })
  .step(0, 'The script starts on the call stack.', { mark: 'Start' })
  .log('a')
  .step(1, '`a` prints — plain synchronous code.')
  .push('webapis', { id: 't', label: 'timer 0 ms' })
  .step(3, '`setTimeout` registers a timer with the browser and moves on.')
  .remove('t').push('macro', { id: 'cbT', label: "log('timeout')", sub: 'timer callback' })
  .step(3, 'The timer expires at once, so its callback joins the **task queue**.')
  .push('micro', { id: 'p1', label: 'then#1', sub: "logs 'p1', queues p2" })
  .step(5, 'The promise is already resolved, so the first `.then` callback goes straight into the **microtask queue**.')
  .push('micro', { id: 'qm', label: "log('qm')", sub: 'queueMicrotask' })
  .step(10, '`queueMicrotask` adds a second microtask, **behind** then#1. Microtasks run first-in, first-out.')
  .log('b')
  .step(12, '`b` prints. Synchronous code is finished.')
  .pop('stack')
  .step(0, 'The stack is empty. Time to drain the microtask queue — all of it.', { phase: 'micro', mark: 'Drain starts' })
  .move('p1', 'stack')
  .step(6, 'then#1 moves onto the stack and starts running.')
  .log('p1')
  .step(6, '`p1` prints.')
  .push('micro', { id: 'p2', label: "log('p2')", sub: 'queued during the drain' })
  .step(7, 'Inside then#1, another `.then` is registered. Its callback joins the **back** of the microtask queue — after `qm`.',
    { detail: 'The drain loop keeps going until the queue is empty, so anything added during the drain still runs before the next task. This is what makes microtask starvation possible.' })
  .pop('stack')
  .step(8, 'then#1 finishes and pops.')
  .move('qm', 'stack').log('qm')
  .step(10, 'Next in line is `qm`. It prints — it was queued before p2.')
  .pop('stack').move('p2', 'stack').log('p2')
  .step(7, 'Now `p2`. The queue is still being drained, so it runs before any task.')
  .pop('stack')
  .step(0, 'The microtask queue is finally empty. The browser may render.', { phase: 'render' })
  .move('cbT', 'stack').log('timeout')
  .step(3, 'Only now does the loop take one task: the timer. `timeout` prints last.', { phase: 'macro', mark: 'Task' })
  .pop('stack')
  .step(0, 'Done. Final order: **a, b, p1, qm, p2, timeout**.', { phase: 'idle' })
  .build({ kind: 'exact' });
