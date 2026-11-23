import { scenario } from '../../engine/builder';
import { NODE_LANES } from '../shared';

const code = `
const { Writable } = require('node:stream');

const slowDisk = new Writable({
  highWaterMark: 3,                       // buffer up to 3 bytes
  write(chunk, encoding, done) {
    setTimeout(done, 20);                 // each write takes 20 ms
  },
});

for (let i = 1; i <= 5; i++) {
  const ok = slowDisk.write('x');
  console.log(\`write #\${i} -> \${ok}\`);
}

slowDisk.once('drain', () => console.log('drain: buffer empty, safe to write'));
`;

const buf = (n: number) => ({ buf: { value: n, max: 5, label: 'Bytes buffered (limit 3)' } });

export default scenario({
  id: 'node-stream-backpressure', runtime: 'node', group: 'Core APIs', level: 'core', chapter: 'node/streams-and-backpressure',
  title: 'Backpressure: when write() returns false',
  blurb: 'A fast producer and a slow consumer. The stream tells you when to stop — if you listen.',
  code,
  takeaway: '<code>write()</code> returns <code>false</code> once the internal buffer reaches <code>highWaterMark</code>. That is a request to <b>pause</b> until the <code>\'drain\'</code> event. Ignoring it does not lose data — it buffers it all in memory, which is how a fast producer crashes a server. <code>pipeline()</code> handles this for you.',
}, NODE_LANES, 'main')
  .push('stack', { id: 'main', label: 'main module' })
  .step('highWaterMark: 3', 'A writable stream that is deliberately slow (20 ms per chunk) with a tiny buffer limit of 3 bytes.', { mark: 'Setup', meters: buf(0) })
  .push('pool', { id: 'c1', label: "chunk 'x' #1", sub: 'being written' })
  .log('write #1 -> true')
  .step("console.log(`write #", 'Write #1: the chunk goes straight to the "disk". It still counts toward the buffer until it is done. 1 < 3, so `write` returns **true**.', { meters: buf(1) })
  .push('heap', { id: 'c2', label: "chunk 'x' #2", sub: 'buffered in memory' }).log('write #2 -> true')
  .step("console.log(`write #", 'Write #2: the disk is busy, so this chunk waits in the buffer. 2 < 3 → **true**.', { meters: buf(2) })
  .push('heap', { id: 'c3', label: "chunk 'x' #3", sub: 'buffered', tone: 'hot' }).log('write #3 -> false')
  .step("console.log(`write #", 'Write #3: the buffer reaches the limit. `write` returns **false** — "please stop for now".', { meters: buf(3), mark: 'false!' })
  .push('heap', { id: 'c4', label: "chunk 'x' #4", sub: 'buffered anyway', tone: 'bad' }).log('write #4 -> false')
  .step("console.log(`write #", 'Our loop ignores the signal. The chunk is **still accepted** and buffered. Streams never drop data; they just use more memory.',
    { meters: buf(4), detail: 'With a 2 GB file and a slow client, ignoring backpressure means all 2 GB end up in your process memory. That is the classic way a Node file server runs out of memory.' })
  .push('heap', { id: 'c5', label: "chunk 'x' #5", sub: 'buffered anyway', tone: 'bad' }).log('write #5 -> false')
  .step("console.log(`write #", 'Write #5: same again. 5 bytes buffered against a limit of 3.', { meters: buf(5) })
  .step("slowDisk.once('drain'", 'The right reaction to `false` is to wait for `drain`. We register for it.', { meters: buf(5) })
  .pop('stack')
  .step(0, 'The main module ends. Each slow write finishes after 20 ms (a timer here), then the next chunk starts.', { phase: 'timers', meters: buf(5) })
  .remove('c1').move('c2', 'pool', { sub: 'being written', tone: 'default' })
  .step('setTimeout(done, 20);', '20 ms: chunk 1 done, chunk 2 starts.', { phase: 'timers', meters: buf(4) })
  .remove('c2').move('c3', 'pool', { sub: 'being written', tone: 'default' })
  .step('setTimeout(done, 20);', '40 ms: chunk 2 done, chunk 3 starts.', { phase: 'timers', meters: buf(3) })
  .remove('c3').move('c4', 'pool', { sub: 'being written', tone: 'default' })
  .step('setTimeout(done, 20);', '60 ms: chunk 3 done.', { phase: 'timers', meters: buf(2) })
  .remove('c4').move('c5', 'pool', { sub: 'being written', tone: 'default' })
  .step('setTimeout(done, 20);', '80 ms: chunk 4 done.', { phase: 'timers', meters: buf(1) })
  .remove('c5').push('stack', { id: 'dr', label: "'drain' listener" }).log('drain: buffer empty, safe to write')
  .step("console.log('drain:", '100 ms: the buffer is empty and `drain` fires. A well-behaved producer resumes writing **now**.', { phase: 'timers', meters: buf(0), mark: 'drain' })
  .pop('stack')
  .step(0, 'In real code, prefer `await pipeline(source, transform, destination)`: it wires up backpressure, errors and cleanup for you.', { phase: 'done', meters: buf(0) })
  .build({ kind: 'exact', module: 'cjs' });
