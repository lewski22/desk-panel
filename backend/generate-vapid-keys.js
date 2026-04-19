#!/usr/bin/env node
/**
 * generate-vapid-keys.js
 *
 * Uruchom JEDEN RAZ na serwerze produkcyjnym:
 *   node scripts/generate-vapid-keys.js
 *
 * Wynik wklej do .env backendu.
 * NIGDY nie regeneruj kluczy po deploymencie — subskrypcje push przestaną działać.
 */

const { generateVAPIDKeys } = require('web-push');

const keys = generateVAPIDKeys();

console.log('\n✅ VAPID Keys generated — add to backend .env:\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@reserti.com`);
console.log('\n⚠  Save VAPID_PRIVATE_KEY securely. Never commit to git.\n');
