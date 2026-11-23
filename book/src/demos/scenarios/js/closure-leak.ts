import { scenario } from '../../engine/builder';
import { JS_LANES } from '../shared';

const code = `
const listeners = new Set();   // stands in for window's listener list
const onResize = (fn) => listeners.add(fn);
const offResize = (fn) => listeners.delete(fn);

function mountChart() {
  const bigData = new Array(1_000_000).fill(0);   // ~8 MB
  const handler = () => bigData.length;           // closure keeps bigData alive
  onResize(handler);
  return handler;
}

let h = mountChart();
mountChart();                 // mounted again — and never cleaned up
console.log('listeners:', listeners.size);

offResize(h);
h = null;
console.log('listeners:', listeners.size);
`;

export default scenario({
  id: 'js-closure-leak', runtime: 'js', group: 'Engine & memory', level: 'advanced', chapter: 'js/garbage-collection',
  title: 'A real memory leak: forgotten listeners',
  blurb: 'Garbage collection follows references from roots. A forgotten listener is a reference.',
  code,
  takeaway: 'Memory is freed only when nothing <b>reachable</b> points to it. A registered listener is reachable (the host holds it), so everything its closure uses stays alive. Always remove listeners, timers and subscriptions when a component goes away.',
}, JS_LANES, 'script')
  .push('stack', { id: 'g', label: 'global()' })
  .push('heap', { id: 'set', label: 'listeners (Set)', sub: 'a GC root via the global scope · size 0' })
  .step('const listeners', 'Roots are where the garbage collector starts: global variables, the running stack, and anything the host holds (DOM listeners, timers). Our `listeners` set plays the role of `window`’s listener list.', { mark: 'Roots' })
  .push('stack', { id: 'm1', label: 'mountChart()' })
  .push('heap', { id: 'big1', label: 'bigData #1', sub: '~8 MB array' })
  .step('const bigData', 'A large array is allocated on the heap. Right now only the running `mountChart` frame points to it.')
  .push('heap', { id: 'h1', label: 'handler #1', sub: 'closure → bigData #1' })
  .step('const handler', 'The handler is a closure: it keeps a reference to `bigData` so it can read `.length` later.')
  .update('set', { sub: 'size 1 → handler #1' })
  .step('onResize(handler);', 'Registering it puts the handler into the root set. Now there is a path: **root → handler → bigData**.')
  .pop('stack').update('h1', { sub: 'closure → bigData #1 · also held by h' })
  .step('let h = mountChart();', '`mountChart` returns and its frame is gone — but scope ending does **not** free memory. Two paths still reach `bigData #1`: the listener set and the variable `h`.')
  .push('stack', { id: 'm2', label: 'mountChart()' })
  .push('heap', { id: 'big2', label: 'bigData #2', sub: '~8 MB array' }, { id: 'h2', label: 'handler #2', sub: 'closure → bigData #2' })
  .update('set', { sub: 'size 2 → handler #1, #2' })
  .step('mountChart();                 // mounted again', 'The component mounts a second time (think: route change in a single-page app). Another 8 MB, another listener…', { mark: 'Leak' })
  .pop('stack').update('h2', { sub: 'closure → bigData #2 · NO variable points here', tone: 'bad' }).update('big2', { tone: 'bad' })
  .step('mountChart();                 // mounted again', '…and this time the return value was thrown away. Nobody can ever call `offResize` for handler #2. It is unreachable for **your code**, but still reachable for the **GC**.')
  .log('listeners: 2')
  .step(14, 'Two listeners are registered.')
  .update('set', { sub: 'size 1 → handler #2' })
  .step('offResize(h);', 'We remove handler #1 from the set. One root path gone — but `h` still points at it.')
  .remove('h1').remove('big1')
  .step('h = null;', 'Clearing `h` removes the last path. On its next run, the collector **marks** everything reachable from roots, then **sweeps** the rest: handler #1 and bigData #1 are freed.',
    { detail: 'Modern engines use mark-and-sweep (with generations), not reference counting. That means cycles do not matter: two objects pointing at each other are still freed if no root reaches them.' })
  .log('listeners: 1')
  .step(18, 'One listener is left: the one we lost track of. Its 8 MB will live as long as the page does. Mount the chart 50 times and you have leaked 400 MB.', { phase: 'idle', mark: 'Done' })
  .build({ kind: 'exact' });
