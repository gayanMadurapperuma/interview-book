import { scenario } from '../../engine/builder';
import { NODE_LANES } from '../shared';

const code = `
process.on('unhandledRejection', (err) => {
  console.log('unhandledRejection:', err.message);
  process.exitCode = 1;
});

async function getUser(id) {
  throw new Error('database is down');
}

function handleRequest() {
  getUser(1);                         // forgot to await or catch
  console.log('handler returned 200 OK');
}

handleRequest();
`;

export default scenario({
  id: 'node-unhandled-rejection', runtime: 'node', group: 'Core APIs', level: 'core', chapter: 'node/errors-and-resilience',
  title: 'The forgotten await',
  blurb: 'An async error with nobody listening — and why modern Node crashes on it.',
  code,
  takeaway: 'An <code>async</code> function never throws to its caller — it returns a <b>rejected promise</b>. If nobody awaits or catches it, Node raises <code>unhandledRejection</code>, and since Node 15 the default is to <b>crash the process</b>. Always <code>await</code> (or <code>.catch</code>) the promises you create.',
}, NODE_LANES, 'main')
  .push('stack', { id: 'main', label: 'main module' })
  .step("process.on('unhandledRejection'", 'A safety net is registered. Without it, the process would crash at the end of this demo.', { mark: 'Setup' })
  .push('stack', { id: 'h', label: 'handleRequest()' })
  .step('handleRequest();', 'A request comes in and the handler runs.')
  .push('stack', { id: 'g', label: 'getUser(1)' })
  .step('getUser(1);', 'It calls `getUser(1)` but forgets `await`.')
  .update('g', { tone: 'bad' })
  .step("throw new Error('database is down');", 'Inside the async function, an error is thrown…')
  .pop('stack').push('heap', { id: 'p', label: 'Promise', sub: 'rejected: database is down · no handlers', tone: 'bad' })
  .step('getUser(1);', '…but async functions **never** throw to the caller. The error is turned into a **rejected promise**, which the handler simply ignores.',
    { detail: 'try/catch around getUser(1) would NOT catch this either, because nothing is thrown synchronously. Only `await getUser(1)` inside try/catch, or `.catch()`, observes the rejection.' })
  .log('handler returned 200 OK')
  .step("console.log('handler returned", 'The handler happily reports success. The user gets a 200 for an operation that failed.', { mark: 'Lie' })
  .pop('stack').pop('stack')
  .step(0, 'The main module ends and the micro-queues drain. Node checks: is there a rejected promise that still has no handler?', { phase: 'micro' })
  .push('tick', { id: 'ur', label: "emit 'unhandledRejection'" })
  .step(0, 'Yes. Node schedules the `unhandledRejection` event.', { phase: 'micro' })
  .move('ur', 'stack', { label: 'unhandledRejection listener' }).log('unhandledRejection: database is down')
  .step("console.log('unhandledRejection:'", 'Our safety net logs it and marks the exit code as failed.', { phase: 'micro', mark: 'Caught late' })
  .pop('stack').remove('p')
  .step(0, 'Without the listener, Node ≥ 15 would print the stack trace and **exit with code 1**. In production: fix the missing `await`, log these events, and let the process restart cleanly — never silently swallow them.', { phase: 'done' })
  .build({ kind: 'exact', module: 'cjs' });
