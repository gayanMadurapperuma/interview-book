/**
 * Writes the AWS service icons used by <Diagram> architecture charts to
 * src/scripts/aws-icons.json, a small subset of @iconify-json/logos (CC0).
 * Mermaid loads it lazily as the `aws` icon pack:  service fn(aws:lambda)[Fn]
 *
 *   node scripts/build-aws-icons.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { getIcons } from '@iconify/utils';

const require = createRequire(import.meta.url);
const logos = JSON.parse(readFileSync(require.resolve('@iconify-json/logos/icons.json'), 'utf8'));

// every aws-* icon, renamed without the prefix (aws-lambda -> lambda)
const names = Object.keys(logos.icons).filter((k) => k.startsWith('aws-'));
const subset = getIcons(logos, names, true);
if (!subset) throw new Error('icon subset failed');
const icons = {};
for (const [k, v] of Object.entries(subset.icons)) icons[k.replace(/^aws-/, '')] = v;
const out = { prefix: 'aws', width: subset.width, height: subset.height, icons };
writeFileSync(new URL('../src/scripts/aws-icons.json', import.meta.url), JSON.stringify(out));
console.log(`wrote ${Object.keys(icons).length} icons, ${(JSON.stringify(out).length / 1024).toFixed(1)} KB`);
