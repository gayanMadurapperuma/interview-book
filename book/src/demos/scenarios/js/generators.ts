import { scenario } from '../../engine/builder';
import { JS_LANES } from '../shared';

const code = `
function* dialogue() {
  console.log('body starts');
  const a = yield 1;
  console.log('received a =', a);
  const b = yield 2;
  return a + b;
}

const it = dialogue();
console.log('created — nothing has run');
console.log(it.next());
console.log(it.next(10));
console.log(it.next(20));
console.log(it.next());
`;

export default scenario({
  id: 'js-generators', runtime: 'js', group: 'Asynchrony', level: 'advanced', chapter: 'js/iterators-and-generators',
  title: 'Generators: a function you can pause',
  blurb: 'Each next() runs the body to the next yield — and can send a value back in.',
  code,
  takeaway: 'Calling a generator function runs <b>none</b> of its body. Each <code>next(v)</code> resumes it until the next <code>yield</code>, and <code>v</code> becomes the value of the paused <code>yield</code> expression. This pause-and-resume ability is what <code>async/await</code> is built on.',
}, JS_LANES, 'script')
  .push('stack', { id: 'g', label: 'module' })
  .push('heap', { id: 'gen', label: 'generator object', sub: 'state: not started' })
  .step('const it = dialogue();', 'Calling `dialogue()` returns a generator object. **Not one line** of the body has run.', { mark: 'Create' })
  .log('created — nothing has run')
  .step("console.log('created", 'Proof: this line prints, but `body starts` has not appeared.')
  .push('stack', { id: 'n1', label: 'it.next()' }).update('gen', { sub: 'state: running' })
  .step(11, 'The first `next()` starts the body from the top.')
  .push('stack', { id: 'body', label: 'dialogue body' }).log('body starts')
  .step("console.log('body starts')", 'The body runs on the stack like a normal function…', { mark: 'Run' })
  .pop('stack').pop('stack').update('gen', { sub: 'paused at yield 1 · locals kept', tone: 'hot' }).log('{ value: 1, done: false }')
  .step('const a = yield 1;', '…until `yield 1`. It hands `1` out and **pauses**. Its frame leaves the stack, but its local variables are kept alive on the heap.')
  .push('stack', { id: 'n2', label: 'it.next(10)' }).push('stack', { id: 'body2', label: 'dialogue body (resumed)' }).update('gen', { sub: 'running · a = 10', tone: 'default' })
  .step('console.log(it.next(10));', 'The two-way part: `next(10)` resumes the body, and `10` becomes the result of the paused `yield 1`. So `a = 10`.', { mark: 'Send 10' })
  .log('received a = 10')
  .step("console.log('received a ='", 'The body continues with `a` set.')
  .pop('stack').pop('stack').update('gen', { sub: 'paused at yield 2 · a = 10', tone: 'hot' }).log('{ value: 2, done: false }')
  .step('const b = yield 2;', 'It pauses again at `yield 2`, still remembering `a`.')
  .push('stack', { id: 'n3', label: 'it.next(20)' }).push('stack', { id: 'body3', label: 'dialogue body (resumed)' }).update('gen', { sub: 'running · a = 10, b = 20', tone: 'default' })
  .step('console.log(it.next(20));', '`next(20)` resumes with `b = 20`.', { mark: 'Send 20' })
  .pop('stack').pop('stack').update('gen', { sub: 'finished', tone: 'muted' }).log('{ value: 30, done: true }')
  .step('return a + b;', 'The body **returns** 30. A return produces `done: true`.')
  .push('stack', { id: 'n4', label: 'it.next()' }).pop('stack').log('{ value: undefined, done: true }')
  .step(14, 'A finished generator stays finished. Every further `next()` gives `{ value: undefined, done: true }`.', { phase: 'idle', mark: 'Done' })
  .build({ kind: 'exact' });
