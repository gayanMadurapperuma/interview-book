import { scenario } from '../../engine/builder';
import { JS_LANES } from '../shared';

const code = `
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function sequential() {
  const t = Date.now();
  for (const ms of [300, 300, 300]) await wait(ms);
  return Date.now() - t;
}

async function parallel() {
  const t = Date.now();
  await Promise.all([300, 300, 300].map((ms) => wait(ms)));
  return Date.now() - t;
}

const s = await sequential();
console.log('sequential ~', Math.round(s / 100) * 100, 'ms');
const p = await parallel();
console.log('parallel ~', Math.round(p / 100) * 100, 'ms');
`;

const clock = (ms: number) => ({ elapsed: { value: ms, max: 900, label: 'Time elapsed', unit: ' ms' } });

export default scenario({
  id: 'js-await-in-loops', runtime: 'js', group: 'Asynchrony', level: 'core', chapter: 'js/async-await',
  title: 'await in a loop: sequential vs parallel',
  blurb: 'The same three 300 ms waits take 900 ms or 300 ms depending on where you put await.',
  code,
  takeaway: '<code>await</code> inside a loop waits for each item before <b>starting</b> the next one. If the jobs are independent, start them all first and <code>await Promise.all(...)</code> — total time becomes the slowest job, not the sum.',
}, JS_LANES, 'script')
  .push('stack', { id: 'g', label: 'module' })
  .step('const s = await sequential()', 'We run the same three 300 ms jobs twice: first one after another, then all at once.', { mark: 'Start', meters: clock(0) })
  .push('stack', { id: 'seq', label: 'sequential()' }).push('webapis', { id: 's1', label: 'wait #1 · 300 ms' })
  .step('for (const ms of', 'Iteration 1 starts the first timer and then **awaits** it. The loop cannot continue until it finishes.', { meters: clock(0) })
  .pop('stack').pop('stack')
  .step('for (const ms of', 'Both `sequential` and the module are suspended. Only **one** timer is running.', { phase: 'idle', meters: clock(150) })
  .remove('s1').push('stack', { id: 'seq2', label: 'sequential() resumed' }).push('webapis', { id: 's2', label: 'wait #2 · 300 ms' })
  .step('for (const ms of', 'At 300 ms the first wait resolves, the loop resumes and only **now** starts timer #2.', { phase: 'micro', meters: clock(300) })
  .pop('stack')
  .step('for (const ms of', 'Waiting again…', { phase: 'idle', meters: clock(450) })
  .remove('s2').push('stack', { id: 'seq3', label: 'sequential() resumed' }).push('webapis', { id: 's3', label: 'wait #3 · 300 ms' })
  .step('for (const ms of', 'At 600 ms timer #3 starts. The waits are laid end to end.', { phase: 'micro', meters: clock(600) })
  .pop('stack').remove('s3')
  .step(6, 'At 900 ms the last wait finishes and `sequential` returns ~900.', { phase: 'micro', meters: clock(900) })
  .push('stack', { id: 'g2', label: 'module (resumed)' }).log('sequential ~ 900 ms')
  .step("console.log('sequential ~'", '**900 ms** — the sum of all three.', { mark: '900 ms', meters: clock(900) })
  .push('stack', { id: 'par', label: 'parallel()' })
  .push('webapis', { id: 'a', label: 'wait #1 · 300 ms' }, { id: 'b', label: 'wait #2 · 300 ms' }, { id: 'c', label: 'wait #3 · 300 ms' })
  .step('await Promise.all', '`.map` calls `wait` three times **before** anything is awaited, so all three timers start together. `Promise.all` waits for the group.', { mark: 'Parallel', meters: clock(0) })
  .pop('stack').pop('stack')
  .step('await Promise.all', 'Three timers run side by side.', { phase: 'idle', meters: clock(150) })
  .clear('webapis').push('stack', { id: 'par2', label: 'parallel() resumed' })
  .step(12, 'They all finish at about 300 ms. `Promise.all` fulfils and `parallel` resumes.', { phase: 'micro', meters: clock(300) })
  .pop('stack').push('stack', { id: 'g3', label: 'module (resumed)' }).log('parallel ~ 300 ms')
  .step("console.log('parallel ~'", '**300 ms** — the time of the slowest job. Same work, three times faster.', { mark: '300 ms', meters: clock(300) })
  .pop('stack')
  .step(0, 'Use the sequential form only when each step needs the previous result. Otherwise, start everything, then await together.', { phase: 'idle', meters: clock(300) })
  .build({ kind: 'exact' });
