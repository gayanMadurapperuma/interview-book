import { scenario } from '../../engine/builder';
import { JS_LANES } from '../shared';

const code = `
class Animal {
  constructor(name) { this.name = name; }
  speak() { return this.name + ' makes a sound'; }
}
class Dog extends Animal {
  speak() { return this.name + ' barks'; }
}

const rex = new Dog('Rex');
console.log(rex.speak());
console.log(rex.toString());
console.log(rex.fly);
console.log(Object.getPrototypeOf(rex) === Dog.prototype);
`;

export default scenario({
  id: 'js-prototype-lookup', runtime: 'js', group: 'Objects & prototypes', level: 'core', chapter: 'js/prototypes-and-classes',
  title: 'Walking the prototype chain',
  blurb: 'How rex.speak, rex.toString and rex.fly are each found — or not.',
  code,
  takeaway: 'A property lookup checks the object itself, then follows the hidden <code>[[Prototype]]</code> link upward until it finds the name or reaches <code>null</code>. <code>class</code> and <code>extends</code> are a friendlier way to build exactly this chain.',
}, JS_LANES, 'script')
  .push('stack', { id: 'g', label: 'global()' })
  .push('heap',
    { id: 'op', label: 'Object.prototype', sub: 'toString, hasOwnProperty… → null' },
    { id: 'ap', label: 'Animal.prototype', sub: 'speak() · → Object.prototype' },
    { id: 'dp', label: 'Dog.prototype', sub: 'speak() · → Animal.prototype' })
  .step('class Dog', 'Declaring the classes builds a chain of prototype objects. Each method is stored **once**, on a prototype — not copied into every instance.', { mark: 'Classes' })
  .push('stack', { id: 'ctor', label: "new Dog('Rex')" })
  .step("const rex", '`new` creates an empty object and links its hidden `[[Prototype]]` to `Dog.prototype`.')
  .push('heap', { id: 'rex', label: "rex { name: 'Rex' }", sub: '→ Dog.prototype' })
  .step('constructor(name)', '`Dog` has no constructor of its own, so the inherited `Animal` constructor runs and sets the **own** property `name`.')
  .pop('stack')
  .step("const rex", 'The new object is returned and stored in `rex`. It holds only one own property.')
  .update('rex', { tone: 'hot' })
  .step('rex.speak()', 'Look up `speak`. Step 1: does `rex` itself have it? No — only `name`.', { mark: 'Lookup: speak' })
  .update('rex', { tone: 'default' }).update('dp', { tone: 'good' })
  .step('rex.speak()', 'Step 2: follow the link to `Dog.prototype`. Found! The search **stops** here, so `Animal`’s version is never reached (that is overriding).')
  .push('stack', { id: 'sp', label: 'speak()', sub: 'this = rex' }).log('Rex barks')
  .step("' barks'", 'It runs with `this = rex`, because it was called as `rex.speak()`. Prints `Rex barks`.')
  .pop('stack').update('dp', { tone: 'default' }).update('rex', { tone: 'hot' })
  .step('rex.toString()', 'Look up `toString`. Not on `rex`…', { mark: 'Lookup: toString' })
  .update('rex', { tone: 'default' }).update('dp', { tone: 'hot' })
  .step('rex.toString()', '…not on `Dog.prototype`…')
  .update('dp', { tone: 'default' }).update('ap', { tone: 'hot' })
  .step('rex.toString()', '…not on `Animal.prototype`…')
  .update('ap', { tone: 'default' }).update('op', { tone: 'good' }).log('[object Object]')
  .step('rex.toString()', '…found on `Object.prototype`, at the top of almost every chain. Prints `[object Object]`.')
  .update('op', { tone: 'default' }).update('rex', { tone: 'muted' }).update('dp', { tone: 'muted' }).update('ap', { tone: 'muted' })
  .step('rex.fly', 'Look up `fly`: the engine walks the **whole** chain and finds nothing…', { mark: 'Lookup: fly' })
  .update('op', { tone: 'muted' }).log('undefined')
  .step('rex.fly', '…reaches `null`, and returns `undefined`. Reading a missing property is not an error.')
  .update('op', { tone: 'default' }).update('rex', { tone: 'default' }).update('dp', { tone: 'good' }).update('ap', { tone: 'default' }).log('true')
  .step('getPrototypeOf', '`Object.getPrototypeOf(rex)` reads the hidden link directly. It is `Dog.prototype` — prints `true`.', { phase: 'idle', mark: 'Done' })
  .build({ kind: 'exact' });
