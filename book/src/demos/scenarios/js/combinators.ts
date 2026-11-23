import { scenario } from '../../engine/builder';
import { JS_LANES } from '../shared';

const code = `
const task = (name, ms, ok = true) =>
  new Promise((resolve, reject) => setTimeout(() => {
    console.log(\`\${ms}ms: \${name} \${ok ? 'fulfilled' : 'rejected'}\`);
    ok ? resolve(name) : reject(new Error(name + ' failed'));
  }, ms));

const a = task('a', 300);
const b = task('b', 100, false);
const c = task('c', 200);

try {
  await Promise.all([a, b, c]);
} catch (err) {
  console.log('all rejected:', err.message);
}

const results = await Promise.allSettled([a, b, c]);
console.log('allSettled:', results.map((r) => r.status).join(', '));
`;

export default scenario({
  id: 'js-combinators', runtime: 'js', group: 'Asynchrony', level: 'advanced', chapter: 'js/promise-combinators',
  title: 'Promise.all fails fast, allSettled waits',
  blurb: 'One rejection ends Promise.all early — but the other work keeps running anyway.',
  code,
  takeaway: '<code>Promise.all</code> rejects as soon as <b>one</b> input rejects and ignores the rest. <code>Promise.allSettled</code> waits for every input and reports each outcome. Neither one <b>cancels</b> anything — promises start work the moment they are created.',
}, JS_LANES, 'script')
  .push('stack', { id: 'g', label: 'module' })
  .push('webapis', { id: 'ta', label: 'a · 300 ms', sub: 'will fulfil' }, { id: 'tb', label: 'b · 100 ms', sub: 'will reject' }, { id: 'tc', label: 'c · 200 ms', sub: 'will fulfil' })
  .step("const c = task('c', 200);", 'All three tasks start **immediately** — creating a promise starts its work. `Promise.all` has not even been called yet.', { mark: 'Start' })
  .push('heap', { id: 'all', label: 'Promise.all([a, b, c])', sub: 'pending' })
  .step('await Promise.all([a', '`Promise.all` subscribes to all three and the module awaits it.')
  .pop('stack')
  .step('await Promise.all([a', 'The module is suspended. Three timers are running.', { phase: 'idle' })
  .remove('tb').push('stack', { id: 'cbb', label: 'b timer callback' }).log('100ms: b rejected')
  .step('reject(new Error', 'At 100 ms, `b` rejects.', { phase: 'macro', mark: '100 ms' })
  .pop('stack').update('all', { sub: 'rejected: b failed', tone: 'bad' }).push('micro', { id: 'resume1', label: 'resume module', sub: 'with the error' })
  .step('reject(new Error', '`Promise.all` rejects **right away** with b’s error. It does not wait for `a` or `c`.')
  .move('resume1', 'stack').log('all rejected: b failed')
  .step("console.log('all rejected:'", 'The `catch` runs. As far as this code knows, the batch is over…', { phase: 'micro', mark: 'all() rejected' })
  .remove('resume1').push('heap', { id: 'set', label: 'Promise.allSettled([a, b, c])', sub: 'pending · b already settled' })
  .step('const results = await Promise.allSettled', '…but `a` and `c` are **still running**. Nothing was cancelled. Now `allSettled` subscribes to the same three promises.',
    { detail: 'If you need to actually stop the other work (for example, abort HTTP requests), pass an AbortController signal into each task and call controller.abort() when one fails.' })
  .remove('tc').push('stack', { id: 'cbc', label: 'c timer callback' }).log('200ms: c fulfilled')
  .step("console.log(`${ms}ms", 'At 200 ms `c` fulfils. `Promise.all` already gave up on it; `allSettled` records it.', { phase: 'macro', mark: '200 ms' })
  .pop('stack').remove('ta').push('stack', { id: 'cba', label: 'a timer callback' }).log('300ms: a fulfilled')
  .step("console.log(`${ms}ms", 'At 300 ms `a` fulfils. That was the last one.', { phase: 'macro', mark: '300 ms' })
  .pop('stack').update('set', { sub: 'fulfilled: 3 results', tone: 'good' }).push('micro', { id: 'resume2', label: 'resume module' })
  .step("console.log(`${ms}ms", '`allSettled` fulfils — it **never** rejects. You get one `{ status, value | reason }` per input, in input order.')
  .move('resume2', 'stack').log('allSettled: fulfilled, rejected, fulfilled')
  .step("console.log('allSettled:'", 'Statuses follow the **input** order (a, b, c), not the finish order.', { phase: 'micro' })
  .pop('stack')
  .step(0, 'Rule of thumb: use `all` when one failure makes the whole result useless; use `allSettled` when partial success is still useful.', { phase: 'idle', mark: 'Done' })
  .build({ kind: 'exact' });
