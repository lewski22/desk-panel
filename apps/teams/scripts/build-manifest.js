#!/usr/bin/env node
// Builds manifest/manifest.json from manifest/manifest.example.json by substituting
// ${VAR} placeholders with environment variable values.
// Required env vars: TEAMS_APP_ID, TEAMS_BOT_APP_ID, AZURE_CLIENT_ID

const fs   = require('fs');
const path = require('path');

const REQUIRED = ['TEAMS_APP_ID', 'TEAMS_BOT_APP_ID', 'AZURE_CLIENT_ID'];

const missing = REQUIRED.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const templatePath = path.join(__dirname, '..', 'manifest', 'manifest.example.json');
const outputPath   = path.join(__dirname, '..', 'manifest', 'manifest.json');

let content = fs.readFileSync(templatePath, 'utf8');

content = content.replace(/\$\{([A-Z0-9_]+)\}/g, (_, key) => {
  const val = process.env[key];
  if (!val) {
    console.error(`Unresolved placeholder \${${key}} — set the env var and retry`);
    process.exit(1);
  }
  return val;
});

fs.writeFileSync(outputPath, content, 'utf8');
console.log(`manifest.json written to ${outputPath}`);
