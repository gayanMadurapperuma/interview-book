import { scenario } from '../../engine/builder';
import { NODE_LANES } from '../shared';

const code = `
let ticks = 0;

setTimeout(() => console.log('timer finally ran after', ticks, 'ticks'), 0);

function spin() {
  ticks++;
  if (ticks < 1000) process.nextTick(spin);
  else console.log('stopped scheduling nextTick');
}
process.nextTick(spin);
console.log('main script done');
`;

const m = (n: number) => ({ ticks: { value: n, max: 1000, label: 'nextTick callbacks run' } });

export default scenario({
  id: 'node-nexttick-starvation', runtime: 'node', group: 'Event loop', level: 'advanced', chapter: 'node/event-loop-phases',
  title: 'process.nextTick can starve the loop',
  blurb: 'A nextTick that schedules another nextTick keeps the event loop from ever moving on.',
  code,
  takeaway: 'The nextTick queue is drained <b>completely</b> — including ticks added while draining — before the loop may continue. Recursive <code>nextTick</code> (or recursive promise chains) therefore blocks timers and I/O. Prefer <code>setImmediate</code> for “later, but let I/O run first”.',
}, NODE_LANES, 'main')
  .push('stack', { id: 'main', label: 'main module' })
  .step('let ticks', 'A counter, a 0 ms timer, and a function that keeps re-scheduling itself with `nextTick`.', { mark: 'Start', meters: m(0) })
  .push('timers', { id: 't', label: 'timer callback', sub: 'due in 1 ms' })
  .step("setTimeout(() => console.log('timer finally", 'The timer is registered. It will be due almost immediately.', { meters: m(0) })
  .push('tick', { id: 'k1', label: 'spin()' })
  .step(10, 'The first `spin` is queued on the nextTick queue.', { meters: m(0) })
  .log('main script done')
  .step("console.log('main script done')", 'Main module finishes.', { meters: m(0) })
  .pop('stack').move('k1', 'stack')
  .step('ticks++;', 'Before the loop can start, the nextTick queue is drained. `spin` runs…', { phase: 'micro', mark: 'Drain', meters: m(1) })
  .push('tick', { id: 'k2', label: 'spin()' })
  .step('if (ticks < 1000) process.nextTick(spin);', '…and queues **another** `spin`. The queue is not empty, so draining continues.', { phase: 'micro', meters: m(1) })
  .pop('stack').move('k2', 'stack').push('tick', { id: 'k3', label: 'spin()' })
  .step('ticks++;', 'Again. And again. The timer has been due for a while, but the loop is **not allowed to reach the timers phase** until this queue is empty.',
    { phase: 'micro', meters: m(2), detail: 'This is by design: nextTick callbacks are meant to run "right after the current operation", before any I/O. Node even used to have a maxTickDepth limit for this reason; it was removed, so the safety net is gone.' })
  .pop('stack').update('t', { sub: 'OVERDUE — starving', tone: 'bad' })
  .step('ticks++;', 'Hundreds of ticks later… The same would happen to incoming HTTP requests: they would sit unanswered.', { phase: 'micro', meters: m(500) })
  .move('k3', 'stack', { label: 'spin() #1000' }).log('stopped scheduling nextTick')
  .step("else console.log('stopped scheduling", 'At 1000 the function finally stops re-scheduling itself.', { phase: 'micro', meters: m(1000), mark: '1000 ticks' })
  .pop('stack')
  .step(0, 'The nextTick queue is empty at last. The loop starts.', { phase: 'timers', meters: m(1000) })
  .move('t', 'stack', { tone: 'default', sub: undefined }).log('timer finally ran after 1000 ticks')
  .step("setTimeout(() => console.log('timer finally", 'Only now does the timer run. In a real server, the delay is your users waiting.', { phase: 'timers', meters: m(1000) })
  .pop('stack')
  .step(0, 'Nothing left — the process exits.', { phase: 'done', meters: m(1000) })
  .build({ kind: 'exact', module: 'cjs' });
