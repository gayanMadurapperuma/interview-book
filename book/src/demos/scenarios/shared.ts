import { RUNTIMES } from '../runtimes';

export const JS_LANES = RUNTIMES.js.lanes.map((l) => l.k);
export const NODE_LANES = RUNTIMES.node.lanes.map((l) => l.k);
