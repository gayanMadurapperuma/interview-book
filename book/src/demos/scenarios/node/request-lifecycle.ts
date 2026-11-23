import { scenario } from '../../engine/builder';
import { NODE_LANES } from '../shared';

const code = `
const http = require('node:http');
const fs = require('node:fs');

const server = http.createServer((req, res) => {
  console.log('2. request arrived');
  fs.readFile(__filename, () => {
    console.log('3. file read on the thread pool');
    res.end('ok');
  });
});

server.listen(0, () => {
  console.log('1. listening');
  http.get({ port: server.address().port, agent: false }, (res) => {
    res.resume();
    res.on('end', () => {
      console.log('4. client got the response');
      server.close(() => console.log('5. server closed'));
    });
  });
});
`;

export default scenario({
  id: 'node-request-lifecycle', runtime: 'node', group: 'Event loop', level: 'core', chapter: 'node/http-servers',
  title: 'One HTTP request, end to end',
  blurb: 'Sockets wait in the OS kernel, file reads wait on the thread pool — and the JS thread is free the whole time.',
  code,
  takeaway: 'Network I/O is watched by the <b>OS kernel</b> (epoll/kqueue/IOCP) with no thread per connection. File I/O goes to the <b>libuv thread pool</b>. Either way, the single JS thread only runs short callbacks in the <b>poll</b> phase — which is how one Node process serves thousands of connections.',
}, NODE_LANES, 'main')
  .push('stack', { id: 'main', label: 'main module' })
  .step('const server = http.createServer', 'The main module creates an HTTP server. Creating it does not open any socket yet.', { mark: 'Start' })
  .push('kernel', { id: 'lsock', label: 'listening socket', sub: 'port :0 → random free port' })
  .step('server.listen(0', '`listen` asks the OS for a listening socket. The **kernel** will watch it — no thread is used for waiting.')
  .pop('stack')
  .step(0, 'Main module done. The loop starts.', { phase: 'timers' })
  .push('stack', { id: 'lcb', label: 'listen callback' }).log('1. listening')
  .step("console.log('1. listening')", 'The socket is bound, and the `listen` callback runs.', { phase: 'poll', mark: 'Listening' })
  .push('kernel', { id: 'csock', label: 'client socket', sub: 'connecting…' })
  .step('http.get(', 'For this demo the same process acts as a client too: `http.get` opens a connection. Also watched by the kernel.', { phase: 'poll' })
  .pop('stack')
  .step(0, 'Nothing to do. The loop **blocks in poll**, asking the kernel: tell me when any socket has data.', { phase: 'idle' })
  .push('poll', { id: 'reqev', label: 'incoming request', sub: 'bytes arrived on the socket' })
  .step(0, 'The kernel reports the new connection and the request bytes. Node’s HTTP parser (C++) turns them into `req` and `res` objects.', { phase: 'idle' })
  .move('reqev', 'stack', { label: 'request handler', sub: '(req, res)' }).log('2. request arrived')
  .step("console.log('2. request arrived')", 'In the **poll** phase, your handler runs.', { phase: 'poll', mark: 'Request' })
  .push('pool', { id: 'rf', label: 'fs.readFile', sub: 'blocking read on a worker thread' })
  .step('fs.readFile(__filename', 'The handler needs a file. Disk access goes to the **thread pool**, and the handler returns immediately.', { phase: 'poll' })
  .pop('stack')
  .step(0, 'The JS thread is **free**. If 1,000 other requests arrived now, their handlers could run.', { phase: 'idle' })
  .move('rf', 'poll', { sub: 'done — callback ready' })
  .step(0, 'A pool thread finishes the read and wakes the loop.', { phase: 'idle' })
  .move('rf', 'stack', { label: 'readFile callback', sub: undefined }).log('3. file read on the thread pool')
  .step("console.log('3. file read", 'The file callback runs in the poll phase…', { phase: 'poll' })
  .update('csock', { sub: 'response bytes in flight' })
  .step("res.end('ok');", '…and `res.end` writes the response. The write is queued to the kernel; we do not wait for it.', { phase: 'poll' })
  .pop('stack').push('poll', { id: 'resev', label: 'response arrived', sub: 'client side' })
  .step(0, 'The client socket receives the response.', { phase: 'idle' })
  .move('resev', 'stack', { label: "res 'end' handler" }).log('4. client got the response')
  .step("console.log('4. client got", 'The client reads it to the end.', { phase: 'poll', mark: 'Response' })
  .remove('lsock').push('stack', { id: 'close', label: 'server.close()' })
  .step('server.close(', '`server.close()` stops listening. The listening socket is closed.', { phase: 'poll' })
  .pop('stack').pop('stack').remove('csock')
  .step(0, 'Once the last connection is closed, the close callback is scheduled.', { phase: 'close' })
  .push('stack', { id: 'ccb', label: 'close callback' }).log('5. server closed')
  .step("console.log('5. server closed')", 'The server reports it is closed.', { phase: 'close' })
  .pop('stack')
  .step(0, 'No sockets, timers or pending I/O remain, so the process exits on its own. No `process.exit()` needed.', { phase: 'done', mark: 'Exit' })
  .build({ kind: 'exact', module: 'cjs' });
