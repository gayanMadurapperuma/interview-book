import { scenario } from '../../engine/builder';
import { JS_LANES } from '../shared';

const code = `
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log('var i =', i), 0);
}

for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log('let j =', j), 0);
}
`;

export default scenario({
  id: 'js-closures-loop', runtime: 'js', group: 'Scope & closures', level: 'foundation', chapter: 'js/closures',
  title: 'Closures in loops: var vs let',
  blurb: 'Why the var loop prints 3, 3, 3 and the let loop prints 0, 1, 2.',
  code,
  takeaway: 'A closure captures a <b>variable</b>, not a value. <code>var</code> gives the whole loop one shared variable; <code>let</code> creates a fresh variable for every iteration, so each callback remembers its own.',
}, JS_LANES, 'script')
  .push('stack', { id: 'g', label: 'global()' })
  .step(0, 'Two loops that look almost the same. Watch what each callback actually remembers.', { mark: 'Start' })
  .push('heap', { id: 'vi', label: 'var i', sub: '= 0 · one shared box' })
  .step(1, '`var i` is created **once**, for the whole function (here, the whole script). There is only one box called `i`.')
  .push('macro', { id: 'v1', label: '() => log(i)', sub: 'closes over the shared i' })
  .step(2, 'Iteration 1 schedules a callback. The arrow function closes over the **variable** `i` — the box — not the number 0.')
  .update('vi', { sub: '= 1 · one shared box' }).push('macro', { id: 'v2', label: '() => log(i)', sub: 'same shared i' })
  .step(2, 'Iteration 2: `i` becomes 1 and a second callback is queued. It points at the **same** box.')
  .update('vi', { sub: '= 2 · one shared box' }).push('macro', { id: 'v3', label: '() => log(i)', sub: 'same shared i' })
  .step(2, 'Iteration 3: `i` becomes 2. Three callbacks, one box.')
  .update('vi', { sub: '= 3 · loop ended', tone: 'hot' })
  .step(1, 'The loop runs `i++` one last time, so `i` is **3**, and `3 < 3` is false. The loop ends — but the callbacks have not run yet.', { mark: 'var loop done' })
  .push('heap', { id: 'j0', label: 'let j (iteration 1)', sub: '= 0' })
  .push('macro', { id: 'l1', label: '() => log(j)', sub: 'closes over j #1' })
  .step(6, 'Now the `let` loop. Each iteration gets a **brand-new** `j` box, copied from the previous one. Callback 4 closes over box #1, which holds 0.',
    { detail: 'The spec says a `for (let …)` loop creates a new lexical environment per iteration and copies the current value in. That is exactly so closures inside the loop behave the way people expect.' })
  .push('heap', { id: 'j1', label: 'let j (iteration 2)', sub: '= 1' })
  .push('macro', { id: 'l2', label: '() => log(j)', sub: 'closes over j #2' })
  .step(6, 'Iteration 2: a new box holding 1. Callback 5 closes over that one.')
  .push('heap', { id: 'j2', label: 'let j (iteration 3)', sub: '= 2' })
  .push('macro', { id: 'l3', label: '() => log(j)', sub: 'closes over j #3' })
  .step(6, 'Iteration 3: a third box holding 2. Six callbacks are now waiting in the task queue.')
  .pop('stack')
  .step(0, 'The script ends. No microtasks are waiting, so the loop starts taking tasks, one per turn.', { phase: 'micro' })
  .move('v1', 'stack').log('var i = 3')
  .step(2, 'The first `var` callback reads the shared `i` — which is 3 by now.', { phase: 'macro', mark: 'Tasks run' })
  .pop('stack').move('v2', 'stack').log('var i = 3')
  .step(2, 'Same box, same value: 3.')
  .pop('stack').move('v3', 'stack').log('var i = 3')
  .step(2, 'And again 3. That’s the classic bug.')
  .pop('stack').remove('vi').move('l1', 'stack').log('let j = 0')
  .step(6, 'The first `let` callback reads **its own** box: 0. (Nothing references `var i` any more, so it can be garbage-collected.)')
  .pop('stack').remove('j0').move('l2', 'stack').log('let j = 1')
  .step(6, 'The second `let` callback reads box #2, which holds 1.')
  .pop('stack').remove('j1').move('l3', 'stack').log('let j = 2')
  .step(6, 'The third reads box #3, which holds 2.')
  .pop('stack').remove('j2')
  .step(0, 'All callbacks ran. Output: **3, 3, 3** then **0, 1, 2**.', { phase: 'idle', mark: 'Done' })
  .build({ kind: 'exact' });
