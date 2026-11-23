import { scenario } from '../../engine/builder';
import { JS_LANES } from '../shared';

const code = `
const user = {
  name: 'Ada',
  hello() { return 'hi ' + this?.name; },
};

console.log(user.hello());

const detached = user.hello;
console.log(detached());

const bound = user.hello.bind(user);
console.log(bound());

const arrow = { name: 'Bo', hello: () => 'hi ' + this?.name };
console.log(arrow.hello());
`;

export default scenario({
  id: 'js-this-binding', runtime: 'js', group: 'Scope & closures', level: 'core', chapter: 'js/this-keyword',
  title: 'Who is `this`? Four calls, four answers',
  blurb: 'The same function returns different results depending only on how it is called.',
  code,
  takeaway: '<code>this</code> is decided by the <b>call site</b>: <code>obj.fn()</code> → obj; plain <code>fn()</code> → undefined (strict mode); <code>bind</code> fixes it forever; arrow functions never have their own and borrow it from where they were written.',
}, JS_LANES, 'script')
  .push('stack', { id: 'g', label: 'module top level', sub: 'this = undefined' })
  .push('heap', { id: 'u', label: "user { name: 'Ada' }", sub: '← user' }, { id: 'fn', label: 'function hello', sub: 'user.hello' })
  .step(1, 'The object and its method live on the heap. Note: the method is just a function stored in a property — it does not "belong" to `user`.', { mark: 'Setup' })
  .push('stack', { id: 'c1', label: 'hello()', sub: 'this = user' })
  .step(6, 'Called as `user.hello()` — there is an object **left of the dot**, so `this` is `user`.')
  .pop('stack').log('hi Ada')
  .step(6, 'Prints `hi Ada`.')
  .push('heap', { id: 'd', label: 'detached', sub: '→ same function' })
  .step(8, '`detached` now points at the same function. Copying a method does not copy any link to `user`.')
  .push('stack', { id: 'c2', label: 'detached()', sub: 'this = undefined', tone: 'bad' })
  .step(9, 'Called plainly — nothing left of the dot. In strict code (all modules and classes are strict) `this` is `undefined`.',
    { detail: 'In old non-strict scripts `this` would fall back to the global object (`window`). The `?.` here avoids a TypeError so we can see the value; without it, `this.name` would throw.' })
  .pop('stack').log('hi undefined')
  .step(9, 'Prints `hi undefined`. This is the bug you get when passing `user.hello` as a callback, e.g. `setTimeout(user.hello)`.', { mark: 'Lost this' })
  .push('heap', { id: 'b', label: 'bound', sub: 'new function, this locked to user', tone: 'good' })
  .step(11, '`.bind(user)` returns a **new** function whose `this` is permanently `user`, however it is called later.')
  .push('stack', { id: 'c3', label: 'bound()', sub: 'this = user (bound)' })
  .step(12, 'Called plainly — but bound functions ignore the call site.')
  .pop('stack').log('hi Ada')
  .step(12, 'Prints `hi Ada`.')
  .push('heap', { id: 'a', label: "arrow { name: 'Bo' }", sub: 'hello is an arrow fn' })
  .step(14, 'An arrow function has **no `this` of its own**. It uses the `this` of the place where it was written — here, the module top level.')
  .push('stack', { id: 'c4', label: 'arrow.hello()', sub: 'this = outer this = undefined' })
  .step(15, 'Even though it is called as `arrow.hello()`, the dot does not matter for arrows.')
  .pop('stack').log('hi undefined')
  .step(15, 'Prints `hi undefined` — not `hi Bo`. Arrows are great for callbacks *inside* methods, but wrong *as* methods.', { phase: 'idle', mark: 'Done' })
  .build({ kind: 'exact' });
