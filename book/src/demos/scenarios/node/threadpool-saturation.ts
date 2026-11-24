import { scenario } from '../../engine/builder';
import { NODE_LANES } from '../shared';

const code = `
process.env.UV_THREADPOOL_SIZE = '4';   // the default, set explicitly
const crypto = require('node:crypto');

const start = Date.now();
const finished = [];

for (let job = 1; job <= 6; job++) {
  crypto.pbkdf2('secret', 'salt', 300_000, 64, 'sha512', () => {
    finished.push(Date.now() - start);
    if (finished.length === 6) {
      console.log('6 jobs on 4 threads');
      console.log('last job took about twice as long:', finished[5] > finished[0] * 1.6);
    }
  });
}
`;

export default scenario({
  id: 'node-threadpool-saturation', runtime: 'node', group: 'Performance', level: 'advanced', chapter: 'node/libuv-thread-pool',
  title: 'Thread pool saturation',
  blurb: 'Six password hashes, four threads: the last two must wait their turn.',
  code,
  takeaway: 'libuv has <b>4 threads</b> by default, shared by <code>fs</code>, <code>crypto.pbkdf2/scrypt</code>, <code>zlib</code> and <code>dns.lookup</code>. When they are all busy, new work queues — so slow hashing can delay unrelated file reads. Raise <code>UV_THREADPOOL_SIZE</code> (before the pool starts) or move work elsewhere.',
}, NODE_LANES, 'main')
  .push('stack', { id: 'main', label: 'main module' })
  .step("process.env.UV_THREADPOOL_SIZE", 'The pool size can only be set **before** the pool is first used. 4 is the default.', { mark: 'Start' })
  .push('pool', { id: 'j1', label: 'pbkdf2 job 1' })
  .step("crypto.pbkdf2('secret'", 'Job 1 goes to the thread pool. pbkdf2 is deliberately slow (300,000 rounds) — exactly what you want for password hashing.')
  .push('pool', { id: 'j2', label: 'pbkdf2 job 2' }, { id: 'j3', label: 'pbkdf2 job 3' }, { id: 'j4', label: 'pbkdf2 job 4' })
  .step("crypto.pbkdf2('secret'", 'Jobs 2, 3 and 4 take the other three threads. The pool is now **full**.')
  .push('pool', { id: 'j5', label: 'pbkdf2 job 5' }, { id: 'j6', label: 'pbkdf2 job 6' })
  .step("crypto.pbkdf2('secret'", 'Jobs 5 and 6 have no free thread. They sit in libuv’s **work queue**.', { mark: 'Saturated' })
  .pop('stack')
  .step(0, 'The JS thread is idle, but that does not help: the bottleneck is the pool, not the event loop.', { phase: 'idle',
    detail: 'Any fs.readFile issued now would also queue behind jobs 5 and 6. This is a classic hidden latency source: a burst of logins slows down static file serving.' })
  .move('j1', 'poll', { sub: 'done' }).move('j2', 'poll', { sub: 'done' }).move('j3', 'poll', { sub: 'done' }).move('j4', 'poll', { sub: 'done' })
  .step(0, 'After ~T ms the first four finish together. Jobs 5 and 6 **only now** get threads.', { phase: 'idle', mark: 'Wave 1' })
  .move('j1', 'stack', { label: 'callback 1' }).pop('stack').remove('j2').remove('j3').remove('j4')
  .step('finished.push', 'Their four callbacks run in the poll phase and record their times.', { phase: 'poll' })
  .step(0, 'Jobs 5 and 6 are running now, started late.', { phase: 'idle' })
  .move('j5', 'poll', { sub: 'done' }).move('j6', 'poll', { sub: 'done' })
  .step(0, 'At about **2T** they finish — twice the latency of the first wave, for identical work.', { phase: 'idle', mark: 'Wave 2' })
  .move('j5', 'stack', { label: 'callback 5' }).pop('stack').move('j6', 'stack', { label: 'callback 6' }).log('6 jobs on 4 threads')
  .step("console.log('6 jobs on 4 threads')", 'The last callback reports.', { phase: 'poll' })
  .log('last job took about twice as long: true')
  .step("console.log('last job took", 'Confirmed: the last job waited about one extra full "wave".', { phase: 'poll' })
  .pop('stack')
  .step(0, 'Takeaway for interviews: async ≠ infinitely parallel. Know which APIs use the pool.', { phase: 'done' })
  .build({ kind: 'none', reason: 'timing depends on the CPU core count of the machine running the tests' });
