import { scenario } from '../../engine/builder';
import { JS_LANES } from '../shared';

const code = `
console.log('A: script start');

setTimeout(() => {
  console.log('D: timeout');
}, 0);

Promise.resolve().then(() => {
  console.log('C: promise');
});

console.log('B: script end');
`;

export default scenario({
  id: 'js-event-loop',
  runtime: 'js',
  title: 'The event loop: sync, microtask, task',
  blurb: 'Why a 0 ms timeout still runs after a promise callback.',
  group: 'Asynchrony',
  level: 'foundation',
  chapter: 'js/event-loop',
  code,
  takeaway: 'Synchronous code always finishes first. Then the <b>whole</b> microtask queue drains. Only then does <b>one</b> task (like a timer) run. Order: sync → microtasks → task.',
}, JS_LANES, 'script')
  .push('stack', { id: 'global', label: 'global()', sub: 'the script itself' })
  .step(0, 'The script starts. The engine wraps the whole file in a **global** frame and pushes it onto the call stack.', { mark: 'Start' })

  .push('stack', { id: 'log1', label: "console.log('A…')" })
  .step(1, 'Line 1 calls `console.log`. A new frame goes on top of the stack — this is ordinary synchronous code.')
  .log('A: script start').pop('stack')
  .step(1, '`A` is printed immediately and the `console.log` frame pops off. The stack is back to just `global`.')

  .push('webapis', { id: 'timer', label: 'timer 0 ms', sub: 'callback → D' })
  .step(3, '`setTimeout` does **not** run the callback. It hands the callback to the browser’s timer system (a Web API) and returns straight away.',
    { detail: 'The timer lives outside the JavaScript engine. JS just registers the callback and carries on. Even with 0 ms, the callback can only run once the stack is empty and the loop picks it up.' })
  .remove('timer').push('macro', { id: 'cbD', label: '() => log(D)', sub: 'from setTimeout' })
  .step(3, 'The 0 ms timer expires almost instantly, so the browser moves the callback into the **task queue**. It still has to wait its turn.')

  .push('micro', { id: 'cbC', label: '() => log(C)', sub: 'from .then' })
  .step(7, '`Promise.resolve()` is already fulfilled, so `.then` queues its callback in the **microtask queue** — a separate, higher-priority line.',
    { mark: 'Queued' })

  .push('stack', { id: 'log2', label: "console.log('B…')" })
  .step(11, 'The last synchronous line runs.')
  .log('B: script end').pop('stack')
  .step(11, '`B` prints. Notice that nothing asynchronous has run yet — two callbacks are still waiting in their queues.')

  .pop('stack')
  .step(0, 'The script is done and `global` pops. **The call stack is empty** — this is the moment the event loop gets to act.', { phase: 'micro', mark: 'Stack empty' })

  .move('cbC', 'stack')
  .step(8, 'Rule one: before anything else, drain the **entire** microtask queue. The promise callback moves onto the stack.',
    { detail: 'Microtasks are checked every time the stack empties, before rendering and before the next task. That is why promise callbacks beat timers.' })
  .log('C: promise').pop('stack')
  .step(8, '`C` prints. The microtask queue is now empty.')

  .step(0, 'With no microtasks left, the browser may render (update the screen). Nothing changed visually here, so it moves on.', { phase: 'render' })

  .move('cbD', 'stack')
  .step(4, 'Now the loop takes **one** task from the task queue — the timer callback.', { phase: 'macro', mark: 'Task runs' })
  .log('D: timeout').pop('stack')
  .step(4, '`D` prints last, even though its delay was 0 ms. Final order: **A, B, C, D**.')
  .step(0, 'Both queues are empty. The event loop waits for new work (a click, a network response, another timer).', { phase: 'idle', mark: 'Done' })
  .build({ kind: 'exact' });
