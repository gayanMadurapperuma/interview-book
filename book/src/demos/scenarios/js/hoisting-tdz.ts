import { scenario } from '../../engine/builder';
import { JS_LANES } from '../shared';

const code = `
console.log(typeof greet);
console.log(count);

try {
  console.log(total);
} catch (err) {
  console.log(err.name + ': ' + err.message);
}

var count = 1;
let total = 2;
function greet() { return 'hi'; }
`;

export default scenario({
  id: 'js-hoisting-tdz', runtime: 'js', group: 'Scope & closures', level: 'foundation', chapter: 'js/hoisting-and-tdz',
  title: 'Hoisting and the temporal dead zone',
  blurb: 'Before any line runs, the engine has already created every variable — in three different states.',
  code,
  takeaway: 'Before running, the engine scans the scope. <b>Function declarations</b> are ready to use, <b>var</b> starts as <code>undefined</code>, and <b>let/const/class</b> exist but are locked (the TDZ) until their line runs.',
}, JS_LANES, 'script')
  .push('stack', { id: 'g', label: 'global()', sub: 'creation phase' })
  .step(0, 'Before a single line executes, the engine runs a **creation phase**: it scans the code and sets up every declared name.', { mark: 'Creation' })
  .push('heap', { id: 'fg', label: 'greet', sub: '→ function, fully ready', tone: 'good' })
  .step(12, '`function greet` is hoisted **completely** — name and body. It can be called from line 1.')
  .push('heap', { id: 'vc', label: 'count', sub: '= undefined' })
  .step(10, '`var count` is hoisted, but only the name. It starts as `undefined`; the `= 1` happens later, when line 11 actually runs.')
  .push('heap', { id: 'lt', label: 'total', sub: '<uninitialised> — TDZ', tone: 'bad' })
  .step(11, '`let total` is also registered — but **uninitialised**. Touching it before its line throws. This window is the *temporal dead zone*.',
    { detail: 'let/const ARE hoisted in the sense that the scope knows about them from the start. That is why an inner `let x` shadows an outer `x` for the whole block, even above its declaration.' })
  .update('g', { sub: 'execution phase' }).log('function')
  .step(1, 'Execution begins. `typeof greet` is `"function"` — the declaration was hoisted with its body.', { mark: 'Execute' })
  .log('undefined')
  .step(2, '`count` exists but has not been assigned yet, so it prints `undefined`. No error — which is why `var` bugs are sneaky.')
  .push('stack', { id: 'tr', label: 'try { log(total) }' })
  .step(5, 'Reading `total` while it is still in the TDZ…')
  .pop('stack').push('stack', { id: 'ca', label: 'catch (err)', tone: 'bad' })
  .log("ReferenceError: Cannot access 'total' before initialization")
  .step(7, '…throws a **ReferenceError**. A loud failure is better than a silent `undefined` — that was the whole point of `let`.')
  .pop('stack').update('vc', { sub: '= 1' })
  .step(10, 'Now line 10 runs and `count` finally becomes 1.')
  .update('lt', { sub: '= 2', tone: 'good' })
  .step(11, 'Line 11 runs: `total` leaves the TDZ and becomes 2. From here on it behaves normally.')
  .step(12, 'The function declaration line does nothing at runtime — it was all handled in the creation phase.', { phase: 'idle', mark: 'Done' })
  .build({ kind: 'exact' });
