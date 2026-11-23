import { scenario } from '../../engine/builder';
import { JS_LANES } from '../shared';

const code = `
// ---- counter.mjs ----
export let count = 0;
export function increment() { count++; }

// ---- main.mjs ----
import { count, increment } from './counter.mjs';

console.log('before', count);
increment();
console.log('after', count);

try {
  count = 5;
} catch (err) {
  console.log(err.name + ': ' + err.message);
}
`;

const counter = encodeURIComponent('export let count = 0; export function increment() { count++; }');
const source = `
import { count, increment } from 'data:text/javascript,${counter}';
console.log('before', count);
increment();
console.log('after', count);
try { count = 5; } catch (err) { console.log(err.name + ': ' + err.message); }
`;

export default scenario({
  id: 'js-esm-live-bindings', runtime: 'js', group: 'Modern JavaScript', level: 'advanced', chapter: 'js/modules',
  title: 'ES module imports are live views',
  blurb: 'An imported variable is a read-only window onto the exporter’s variable, not a copy.',
  code,
  takeaway: 'ES module imports are <b>live bindings</b>: when the exporting module changes the variable, every importer sees the new value. Importers cannot assign to it. (CommonJS <code>require</code>, by contrast, copies values out of an object.)',
}, JS_LANES, 'script')
  .push('heap', { id: 'cm', label: 'counter.mjs environment', sub: 'count = 0 · increment()' })
  .step('export let count = 0;', 'Before any code runs, all modules are **linked**. `counter.mjs` gets its own environment holding `count` and `increment`.', { mark: 'Link' })
  .push('heap', { id: 'mm', label: 'main.mjs environment', sub: 'count → counter.count (live)', tone: 'hot' })
  .step("import { count, increment }", '`main`’s `count` is not a new variable. It is a **binding** that points straight at `counter`’s `count`.',
    { detail: 'Because imports are resolved before execution, `import` statements are hoisted and must be at the top level. This static structure is also what lets bundlers tree-shake unused exports.' })
  .push('stack', { id: 'main', label: 'main.mjs' }).log('before 0')
  .step("console.log('before', count);", 'Reading `count` follows the binding and finds 0.', { mark: 'Run' })
  .push('stack', { id: 'inc', label: 'increment()' }).update('cm', { sub: 'count = 1 · increment()', tone: 'good' })
  .step('increment();', '`increment` changes **its own** module’s `count` to 1.')
  .pop('stack').update('cm', { tone: 'default' }).log('after 1')
  .step("console.log('after', count);", '`main` reads through the binding again and sees **1**. With a copied value it would still say 0.')
  .push('stack', { id: 'as', label: 'count = 5', tone: 'bad' })
  .step('count = 5;', 'Can the importer write to it? No — import bindings are read-only.')
  .pop('stack').log('TypeError: Assignment to constant variable.')
  .step('console.log(err.name', 'Assigning throws a `TypeError`. Only the module that owns a variable may change it; others must call an exported function.', { phase: 'idle', mark: 'Done' })
  .build({ kind: 'exact', source });
