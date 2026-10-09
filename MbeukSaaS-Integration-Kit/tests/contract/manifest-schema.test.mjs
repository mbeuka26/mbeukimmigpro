#!/usr/bin/env node
/** Contract test — hub.integration schema minimal */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const template = JSON.parse(readFileSync(join(__dirname, '../../integration/hub.integration.template.json'), 'utf8'));
const fixture = JSON.parse(readFileSync(join(__dirname, '../fixtures/minimal-saas.fixture.json'), 'utf8'));

const required = ['schemaVersion', 'saas', 'integration', 'capabilities'];
let failed = 0;

for (const key of required) {
  if (!template[key]) { console.error(`❌ template missing ${key}`); failed++; }
  if (!fixture[key]) { console.error(`❌ fixture missing ${key}`); failed++; }
}

if (template.integration.sdkPackage !== 'mbeuk-hub-sdk') {
  console.error('❌ sdkPackage must be mbeuk-hub-sdk');
  failed++;
}

if (template.publicConfig.productIdVar === template.publicConfig.applicationIdVar) {
  console.error('❌ product and application vars must differ');
  failed++;
}

if (!template.capabilities.universalGate || !template.frontendBarrier?.module) {
  console.error('❌ universal frontend barrier must be declared');
  failed++;
}

const templateStr = JSON.stringify(template);
if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(templateStr)) {
  console.error('❌ template must not contain real UUIDs');
  failed++;
}

if (failed === 0) {
  console.log('✅ Contract manifest schema OK');
  process.exit(0);
}
process.exit(1);
