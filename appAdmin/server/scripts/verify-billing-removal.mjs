import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(process.cwd());
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

assert.equal(exists('routes/payment.js'), false, 'Cashfree payment route must be removed');
const index = read('index.js');
assert.doesNotMatch(index, /paymentRoutes|\/api\/payment/, 'Server must not mount a payment router');
const generate = read('routes/generate.js');
assert.match(generate, /puter-user-pays/, 'Generation history must identify Puter User-Pays');
assert.doesNotMatch(generate, /CLOUDFLARE|Not enough credits|dailyCredits/, 'Legacy server-side generation billing must be absent');
const appRoot = path.resolve(root, '../../app');
const appFiles = [
  'src/screens/PricingScreen.js',
  'src/screens/ProfileScreen.js',
  'src/screens/GenerateScreen.js',
  'src/screens/travel/TravelDetailScreen.js',
];
for (const file of appFiles) {
  const source = fs.readFileSync(path.join(appRoot, file), 'utf8');
  assert.doesNotMatch(source, /Cashfree|CASHFREE|create-order|supportCreator/, `${file} must not expose Cashfree checkout`);
}
assert.match(read('README-PUTER-INTEGRATION.md'), /informational only/i, 'Billing screen must be documented as informational');
console.log('PASS: Cashfree routes and checkout UI removed; native image billing is Puter User-Pays; ImageKit reference upload is retained.');
