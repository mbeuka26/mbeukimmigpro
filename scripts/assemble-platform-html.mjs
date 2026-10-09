#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'content/immigration-guide-full.html');
const out = path.join(root, 'platform.html');

let html = fs.readFileSync(src, 'utf8');
html = html
  .replaceAll('../manifest.json', './manifest.json')
  .replaceAll('../src/mbeuk-gate/mbeuk-hub-gate.css', './src/mbeuk-gate/mbeuk-hub-gate.css')
  .replaceAll('../admin.html', './admin.html');

const assistant = fs.readFileSync(path.join(root, 'content/assistant-section.html'), 'utf8');
html = html.replace('<!-- __ASSISTANT_PLACEHOLDER__ -->', assistant.trim());

if (!html.includes('platform-assistant.css')) {
  html = html.replace(
    '</style>\n</head>',
    '</style>\n<link rel="stylesheet" href="./css/platform-assistant.css">\n</head>',
  );
}

if (!html.includes('id="app"')) {
  html = html.replace('<body>', '<body>\n<div id="app">');
  html = html.replace('</body>', '</div>\n<script type="module" src="./js/platform/platform-boot.js"></script>\n</body>');
}

if (!html.includes('id="hub-user-status"')) {
  html = html.replace(
    '<div style="display:flex;align-items:center;gap:0.5rem">',
    '<div id="hub-user-status" aria-live="polite" title="Statut Hub"></div>\n  <div style="display:flex;align-items:center;gap:0.5rem">',
  );
}

fs.writeFileSync(out, html);
console.log('Wrote', out, html.length, 'bytes');
