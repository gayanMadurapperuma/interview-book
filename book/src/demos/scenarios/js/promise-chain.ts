import { scenario } from '../../engine/builder';
import { JS_LANES } from '../shared';

const code = `
Promise.resolve(1)
  .then((n) => {
    console.log('step 1 got', n);
    throw new Error('boom');
  })
  .then(() => {
    console.log('step 2 — skipped');
  })
  .catch((err) => {
    console.log('caught:', err.message);
    return 'recovered';
  })
  .then((v) => console.log('step 4 got', v))
  .finally(() => console.log('finally runs'));
`;

export default scenario({
  id: 'js-promise-chain', runtime: 'js', group: 'Asynchrony', level: 'core', chapter: 'js/promises',
  title: 'Promise chains: how errors travel',
  blurb: 'A throw skips every .then until a .catch — and the chain can recover.',
  code,
  takeaway: 'Every <code>.then</code> returns a <b>new</b> promise. A thrown error rejects that promise, and the rejection passes through <code>.then</code> handlers untouched until a <code>.catch</code> handles it. Returning a value from <code>.catch</code> puts the chain back on the success path.',
}, JS_LANES, 'script')
  .push('stack', { id: 'g', label: 'global()' })
  .push('heap', { id: 'p0', label: 'p0', sub: 'fulfilled: 1', tone: 'good' },
    { id: 'p1', label: 'p1', sub: 'pending' }, { id: 'p2', label: 'p2', sub: 'pending' },
    { id: 'p3', label: 'p3', sub: 'pending' }, { id: 'p4', label: 'p4', sub: 'pending' }, { id: 'p5', label: 'p5', sub: 'pending' })
  .step('Promise.resolve(1)', 'The whole chain is built **synchronously** first. Each `.then/.catch/.finally` returns a new pending promise: p1 … p5.', { mark: 'Build chain' })
  .push('micro', { id: 'h1', label: 'step 1 handler', sub: 'p0 is already fulfilled' })
  .step("console.log('step 1 got'", 'Because `p0` is already fulfilled, the first handler is queued as a microtask right away. The others wait for their promise to settle.')
  .pop('stack')
  .step(0, 'The script ends. The microtask queue starts draining.', { phase: 'micro' })
  .move('h1', 'stack').log('step 1 got 1')
  .step("console.log('step 1 got'", 'Step 1 runs with `n = 1` and prints.', { mark: 'Run' })
  .update('h1', { label: 'throw new Error', tone: 'bad' })
  .step("throw new Error('boom')", 'It **throws**. A throw inside a handler does not crash anything — it rejects the promise that `.then` returned.')
  .pop('stack').update('p1', { sub: 'rejected: boom', tone: 'bad' })
  .push('micro', { id: 'h2', label: 'reaction on p1', sub: 'has no reject handler' })
  .step("throw new Error('boom')", '`p1` is now rejected. The next `.then` only supplied a success handler, so its reaction just passes the rejection along.')
  .move('h2', 'stack')
  .step("console.log('step 2", 'This takes a microtask tick, but `step 2` is **not** called — `.then(fn)` with no second argument rethrows.',
    { detail: '`.then(onFulfilled)` is shorthand for `.then(onFulfilled, (e) => { throw e; })`. So rejections flow past every success-only handler.' })
  .pop('stack').update('p2', { sub: 'rejected: boom', tone: 'bad' }).push('micro', { id: 'h3', label: 'catch handler' })
  .step("console.log('step 2", '`p2` is rejected with the same error. Now the `.catch` reaction is queued.')
  .move('h3', 'stack').log('caught: boom')
  .step("console.log('caught:'", 'The `.catch` handler runs and prints the message.', { mark: 'Caught' })
  .pop('stack').update('p3', { sub: "fulfilled: 'recovered'", tone: 'good' }).push('micro', { id: 'h4', label: 'step 4 handler' })
  .step("return 'recovered'", 'It **returns a value**, so `p3` is *fulfilled* with `"recovered"`. The chain is back on the happy path.')
  .move('h4', 'stack').log('step 4 got recovered')
  .step("console.log('step 4 got'", 'The next `.then` receives the recovered value.')
  .pop('stack').update('p4', { sub: 'fulfilled: undefined', tone: 'good' }).push('micro', { id: 'h5', label: 'finally handler' })
  .step('.finally', '`p4` fulfils (the handler returned nothing). `.finally` is queued.')
  .move('h5', 'stack').log('finally runs')
  .step('.finally', '`finally` runs whether the chain succeeded or failed, and gets no argument. It passes the previous result through.')
  .pop('stack').update('p5', { sub: 'fulfilled: undefined', tone: 'good' })
  .step(0, 'All promises settled. Five handlers took five separate microtask ticks, all before any timer could run.', { phase: 'idle', mark: 'Done' })
  .build({ kind: 'exact' });
