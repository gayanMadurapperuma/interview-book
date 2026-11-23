import { scenario } from '../../engine/builder';
import { NODE_LANES } from '../shared';

const code = `
const http = require('node:http');

const server = http.createServer((req, res) => {
  console.log('request in progress (takes 100 ms)');
  setTimeout(() => res.end('done'), 100);
  process.kill(process.pid, 'SIGTERM');      // the orchestrator says: stop
});

process.on('SIGTERM', () => {
  console.log('SIGTERM: stop accepting, let in-flight work finish');
  server.close(() => console.log('server closed: safe to exit'));
});

server.listen(0, '127.0.0.1', () => {
  const { port } = server.address();
  http.get({ host: '127.0.0.1', port, agent: false }, (res) => {
    res.resume();
    res.on('end', () => console.log('client got its response'));
  });
});
`;

const A = ['request in progress (takes 100 ms)', 'SIGTERM: stop accepting, let in-flight work finish', 'server closed: safe to exit', 'client got its response'];
const B = ['request in progress (takes 100 ms)', 'SIGTERM: stop accepting, let in-flight work finish', 'client got its response', 'server closed: safe to exit'];

export default scenario({
  id: 'node-graceful-shutdown', runtime: 'node', group: 'Production', level: 'advanced', chapter: 'node/graceful-shutdown',
  title: 'Graceful shutdown on SIGTERM',
  blurb: 'Stop taking new work, finish what is in flight, then exit — no dropped requests.',
  code,
  takeaway: 'Kubernetes, Docker and most platforms send <b>SIGTERM</b> before killing a process. Handle it: <code>server.close()</code> stops new connections but lets in-flight requests finish; close DB pools; then let the process exit. Add a hard timeout in case something hangs.',
}, NODE_LANES, 'main')
  .push('stack', { id: 'main', label: 'main module' })
  .push('kernel', { id: 'ls', label: 'listening socket', sub: '127.0.0.1:random' })
  .step("server.listen(0, '127.0.0.1'", 'The server starts listening.', { mark: 'Start' })
  .pop('stack').push('stack', { id: 'lcb', label: 'listen callback' }).push('kernel', { id: 'cs', label: 'client connection' })
  .step("http.get({ host: '127.0.0.1'", 'Once it is listening, a client connects (in real life: a user’s request).', { phase: 'poll' })
  .pop('stack').push('stack', { id: 'rh', label: 'request handler' }).log('request in progress (takes 100 ms)')
  .step("console.log('request in progress", 'The request handler starts a slow, 100 ms piece of work.', { phase: 'poll', mark: 'In flight' })
  .push('timers', { id: 'w', label: "res.end('done')", sub: 'due at 100 ms' })
  .step("setTimeout(() => res.end('done'), 100);", 'The response will be sent when the work is done.', { phase: 'poll' })
  .push('tick', { id: 'sig', label: 'SIGTERM', sub: 'from the orchestrator', tone: 'bad' })
  .step("process.kill(process.pid, 'SIGTERM');", 'Right in the middle of it, the platform asks the process to stop — e.g. a new deploy is rolling out.', { phase: 'poll', mark: 'SIGTERM' })
  .pop('stack').move('sig', 'stack', { label: 'SIGTERM handler', tone: 'default', sub: undefined }).log('SIGTERM: stop accepting, let in-flight work finish')
  .step("console.log('SIGTERM:", 'Our handler runs. Without one, Node would exit immediately and the in-flight request would be cut off.', { phase: 'poll' })
  .remove('ls').update('cs', { sub: 'still open — response pending' })
  .step('server.close(() =>', '`server.close()` stops accepting **new** connections at once, but keeps existing ones until they finish.',
    { detail: 'In Kubernetes, also fail your readiness probe first so the load balancer stops sending traffic, and keep a hard timeout (e.g. 25 s) that calls process.exit(1) if shutdown hangs.' })
  .pop('stack')
  .step(0, 'The process stays alive because a timer and a connection are still active.', { phase: 'idle' })
  .move('w', 'stack').update('cs', { sub: 'response sent, closing' })
  .step("setTimeout(() => res.end('done'), 100);", 'At 100 ms the work finishes and the response is sent. The user never noticed the shutdown.', { phase: 'timers', mark: 'Finished' })
  .pop('stack').remove('cs').push('stack', { id: 'cc', label: 'close callback' }).log('server closed: safe to exit')
  .step("console.log('server closed", 'The last connection closes, so `server.close`’s callback fires.', { phase: 'close' })
  .pop('stack').push('stack', { id: 'ce', label: "client 'end'" }).log('client got its response')
  .step("console.log('client got", 'The client finishes reading its response. (These last two can arrive in either order.)', { phase: 'poll' })
  .pop('stack')
  .step(0, 'Nothing is left, so the process exits by itself with code 0. Zero dropped requests.', { phase: 'done', mark: 'Exit' })
  .build({ kind: 'oneOf', module: 'cjs', outputs: [A, B] });
