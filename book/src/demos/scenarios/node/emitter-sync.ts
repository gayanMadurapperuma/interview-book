import { scenario } from '../../engine/builder';
import { NODE_LANES } from '../shared';

const code = `
const { EventEmitter } = require('node:events');
const orders = new EventEmitter();

orders.on('placed', (id) => console.log('email listener got', id));
orders.on('placed', (id) => console.log('stock listener got', id));

console.log('before emit');
orders.emit('placed', 42);
console.log('after emit');

orders.once('placed', () => console.log('once: first time only'));
orders.emit('placed', 43);
orders.emit('placed', 44);
`;

export default scenario({
  id: 'node-emitter-sync', runtime: 'node', group: 'Core APIs', level: 'foundation', chapter: 'node/event-emitter',
  title: 'EventEmitter is synchronous',
  blurb: 'emit() calls every listener right away, in order, before it returns.',
  code,
  takeaway: '<code>emit()</code> is <b>not</b> asynchronous. It loops over the listeners and calls each one immediately, in registration order, on the current stack. A slow or throwing listener therefore blocks — or crashes — the code that called <code>emit</code>.',
}, NODE_LANES, 'main')
  .push('stack', { id: 'main', label: 'main module' })
  .push('heap', { id: 'l1', label: "'placed' → email listener" }, { id: 'l2', label: "'placed' → stock listener" })
  .step("orders.on('placed', (id) => console.log('stock", 'Two listeners are registered for `placed`. Internally they are simply stored in an array on the emitter object, in order.', { mark: 'Register' })
  .log('before emit')
  .step("console.log('before emit')", 'Prints `before emit`.')
  .push('stack', { id: 'e1', label: "emit('placed', 42)" })
  .step("orders.emit('placed', 42);", '`emit` is called. Watch the stack: it does **not** queue anything.', { mark: 'emit()' })
  .push('stack', { id: 'c1', label: 'email listener(42)' }).log('email listener got 42')
  .step("console.log('email listener got'", 'The first listener runs **inside** `emit`, on top of it on the stack.')
  .pop('stack').push('stack', { id: 'c2', label: 'stock listener(42)' }).log('stock listener got 42')
  .step("console.log('stock listener got'", 'Then the second, in registration order.')
  .pop('stack').pop('stack').log('after emit')
  .step("console.log('after emit')", 'Only after **all** listeners return does `emit` return. So `after emit` prints last — no event loop involved.',
    { detail: 'If you want listeners to run later, schedule it yourself inside the listener with setImmediate or queueMicrotask. Also: if a listener throws, the exception propagates out of emit() into your code.' })
  .push('heap', { id: 'l3', label: "'placed' → once listener", sub: 'removes itself after one call' })
  .step("orders.once('placed'", '`once` adds a listener that removes itself the first time it runs.', { mark: 'once()' })
  .push('stack', { id: 'e2', label: "emit('placed', 43)" }).log('email listener got 43').log('stock listener got 43')
  .step("orders.emit('placed', 43);", 'Emit 43: the two regular listeners run…')
  .remove('l3').log('once: first time only')
  .step("orders.emit('placed', 43);", '…then the `once` listener, which is removed **before** it is called.')
  .pop('stack').push('stack', { id: 'e3', label: "emit('placed', 44)" }).log('email listener got 44').log('stock listener got 44')
  .step("orders.emit('placed', 44);", 'Emit 44: only the two permanent listeners are left.')
  .pop('stack').pop('stack')
  .step(0, 'All of this ran in the main module, before the event loop even started. Not a single callback was queued.', { phase: 'done', mark: 'Done' })
  .build({ kind: 'exact', module: 'cjs' });
