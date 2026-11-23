import { scenario } from '../../engine/builder';
import { JS_LANES } from '../shared';

const code = `
function fetchUser(id) {
  return new Promise((resolve) => setTimeout(() => resolve({ id }), 100));
}

async function load(id) {
  console.log('1: entering load');
  const user = await fetchUser(id);
  console.log('4: resumed, user', user.id);
  return user;
}

const p = load(7);
console.log('2: load returned a promise');
p.then((u) => console.log('5: then got', u.id));
console.log('3: end of script');
`;

export default scenario({
  id: 'js-async-await', runtime: 'js', group: 'Asynchrony', level: 'core', chapter: 'js/async-await',
  title: 'async/await: pause, return, resume',
  blurb: 'An async function runs until its first await, steps off the stack, and resumes later as a microtask.',
  code,
  takeaway: 'An <code>async</code> function runs <b>synchronously</b> up to its first <code>await</code>. Then it is suspended, its frame leaves the stack, and the caller continues with a pending promise. When the awaited promise settles, the rest of the function resumes as a <b>microtask</b>.',
}, JS_LANES, 'script')
  .push('stack', { id: 'g', label: 'global()' })
  .step(0, 'Two functions are defined. Nothing runs until `load(7)` is called.', { mark: 'Start' })
  .push('stack', { id: 'load', label: 'load(7)' })
  .step('const p = load(7)', 'Calling an async function does **not** defer it. Its body starts right now, on the current stack.')
  .log('1: entering load')
  .step("'1: entering load'", 'Everything before the first `await` is ordinary synchronous code.')
  .push('stack', { id: 'fu', label: 'fetchUser(7)' }).push('webapis', { id: 'tm', label: 'timer 100 ms', sub: 'will resolve({ id: 7 })' })
  .step('setTimeout(() => resolve', '`fetchUser` starts a 100 ms timer and returns a pending promise.')
  .pop('stack').pop('stack').push('heap', { id: 'susp', label: 'load — suspended', sub: 'id = 7, waiting at line 7', tone: 'hot' }, { id: 'pp', label: 'p', sub: 'pending' })
  .step('const user = await', '`await` sees a pending promise, so `load` **suspends**: its frame leaves the stack and is parked on the heap with its local variables. The caller gets back a pending promise `p`.',
    { mark: 'Suspended', detail: 'You can think of `await` like a `yield`: the function hands control back, and the engine resumes it later. Babel used to compile async functions into generators for exactly this reason.' })
  .log('2: load returned a promise')
  .step("'2: load returned a promise'", 'Back in the caller. `load(7)` did not block — the next line runs immediately.')
  .update('pp', { sub: 'pending · 1 reaction registered' })
  .step('p.then(', '`.then` registers a reaction on `p`. Nothing is queued yet, because `p` has not settled.')
  .log('3: end of script')
  .step("'3: end of script'", 'Last synchronous line. Note the order so far: 1, 2, 3 — the rest of `load` has not run.')
  .pop('stack')
  .step(0, 'The stack is empty and there are no microtasks. The loop waits for the timer.', { phase: 'idle' })
  .remove('tm').push('macro', { id: 'tcb', label: 'timer callback', sub: 'calls resolve({ id: 7 })' })
  .step(0, '100 ms later, the timer callback is queued as a task.', { phase: 'idle' })
  .move('tcb', 'stack')
  .step('setTimeout(() => resolve', 'The task runs and resolves `fetchUser`’s promise.', { phase: 'macro', mark: 'Timer' })
  .pop('stack').move('susp', 'micro', { label: 'resume load', sub: 'user = { id: 7 }' })
  .step('setTimeout(() => resolve', 'Resolving the promise does not resume `load` directly — it **queues the continuation as a microtask**.')
  .move('susp', 'stack', { label: 'load (resumed)', tone: 'default' }).log('4: resumed, user 7')
  .step("'4: resumed, user'", 'The microtask runs: `load` resumes right after the `await`, with `user` filled in and `id` still in scope.', { phase: 'micro', mark: 'Resumed' })
  .pop('stack').update('pp', { sub: 'fulfilled: { id: 7 }', tone: 'good' }).push('micro', { id: 'th', label: 'then reaction', sub: "logs '5'" })
  .step('return user;', '`return user` **fulfils `p`**, which queues the `.then` reaction as another microtask.')
  .move('th', 'stack').log('5: then got 7')
  .step("'5: then got'", 'The reaction runs in the same microtask drain. Final order: 1, 2, 3, 4, 5.')
  .pop('stack')
  .step(0, 'Done. The async function never blocked anything — it just paused politely.', { phase: 'idle', mark: 'Done' })
  .build({ kind: 'exact' });
