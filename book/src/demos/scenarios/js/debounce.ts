import { scenario } from '../../engine/builder';
import { JS_LANES } from '../shared';

const code = `
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

const save = debounce((text) => console.log('save:', text), 200);

save('h');
save('he');
save('hel');
setTimeout(() => save('hell'), 100);
setTimeout(() => save('hello'), 150);
`;

const clock = (ms: number) => ({ t: { value: ms, max: 350, label: 'Time', unit: ' ms' } });

export default scenario({
  id: 'js-debounce', runtime: 'js', group: 'Modern JavaScript', level: 'core', chapter: 'js/debounce-throttle-delegation',
  title: 'Debounce: five calls, one save',
  blurb: 'Every new call cancels the pending timer and starts a fresh one.',
  code,
  takeaway: 'A debounced function waits for a <b>pause</b>. Each call clears the previous timer and starts a new one, so the real function runs once, <code>ms</code> after the <b>last</b> call. The shared <code>timer</code> variable lives in a closure.',
}, JS_LANES, 'script')
  .push('stack', { id: 'g', label: 'global()' })
  .push('heap', { id: 'cl', label: 'closure of save', sub: 'timer = undefined' })
  .step('const save = debounce', '`debounce` returns a new function. It closes over a private variable `timer` that every call will share.', { mark: 'Setup', meters: clock(0) })
  .push('webapis', { id: 't1', label: 'timer → save("h")', sub: 'fires at 200 ms' }).update('cl', { sub: 'timer = #1' })
  .step("save('h');", 'First keystroke. No timer yet, so `clearTimeout` does nothing and timer #1 is started for 200 ms.', { meters: clock(0) })
  .remove('t1').push('webapis', { id: 't2', label: 'timer → save("he")', sub: 'fires at 200 ms' }).update('cl', { sub: 'timer = #2' })
  .step("save('he');", 'Second call, a moment later: timer #1 is **cancelled** and timer #2 starts.', { meters: clock(0) })
  .remove('t2').push('webapis', { id: 't3', label: 'timer → save("hel")', sub: 'fires at 200 ms' }).update('cl', { sub: 'timer = #3' })
  .step("save('hel');", 'Third call: cancel, restart. Only one pending timer exists at a time.', { meters: clock(0) })
  .push('webapis', { id: 'k4', label: 'keystroke at 100 ms' }, { id: 'k5', label: 'keystroke at 150 ms' })
  .step("setTimeout(() => save('hello')", 'Two more "keystrokes" are simulated at 100 ms and 150 ms.', { meters: clock(0) })
  .pop('stack')
  .step(0, 'The script ends. The page is idle while the user is still typing.', { phase: 'idle', meters: clock(50) })
  .remove('k4').push('stack', { id: 'c4', label: "save('hell')" }).remove('t3').push('webapis', { id: 't4', label: 'timer → save("hell")', sub: 'fires at 300 ms' }).update('cl', { sub: 'timer = #4' })
  .step("setTimeout(() => save('hell')", 'At 100 ms another call arrives. Timer #3 (due at 200 ms) is cancelled; timer #4 is due at 300 ms.', { phase: 'macro', mark: '100 ms', meters: clock(100) })
  .pop('stack').remove('k5').push('stack', { id: 'c5', label: "save('hello')" }).remove('t4').push('webapis', { id: 't5', label: 'timer → save("hello")', sub: 'fires at 350 ms' }).update('cl', { sub: 'timer = #5' })
  .step("setTimeout(() => save('hello')", 'At 150 ms, the last call. Timer #4 is cancelled; timer #5 is due at 350 ms.', { phase: 'macro', mark: '150 ms', meters: clock(150) })
  .pop('stack')
  .step(0, 'Silence. Nothing cancels timer #5 this time.', { phase: 'idle', meters: clock(250) })
  .remove('t5').push('stack', { id: 'fire', label: 'fn("hello")' }).log('save: hello')
  .step('timer = setTimeout(() => fn(...args), ms);', 'At 350 ms — 200 ms after the **last** call — the real function runs once, with the latest arguments.', { phase: 'macro', mark: '350 ms', meters: clock(350) })
  .pop('stack')
  .step(0, 'Five calls, one save. Use debounce for search boxes and autosave. Use **throttle** instead when you want regular updates during activity, like on scroll.', { phase: 'idle', meters: clock(350) })
  .build({ kind: 'exact' });
