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
    '</style>\n<link rel="stylesheet" href="./css/platform-assistant.css">\n<link rel="stylesheet" href="./css/app-shell.css">\n</head>',
  );
}

const moduleBar = `
<nav class="app-modules" aria-label="Modules métier">
  <span class="app-modules__label">Modules</span>
  <a href="#home" data-module-link="immipro" class="is-active">ImmiPro</a>
  <a href="#cv-generator" data-module-link="cv">CV Pro</a>
  <a href="#assistant-ia" data-module-link="ia">Agent IA</a>
  <span class="app-modules__spacer"></span>
  <button type="button" class="app-modules__logout" data-mbeuk-logout>Déconnexion</button>
</nav>`;

if (!html.includes('app-modules')) {
  html = html.replace('</header>', `</header>\n${moduleBar.trim()}`);
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
