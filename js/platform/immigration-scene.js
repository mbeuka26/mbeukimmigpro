/** Illustration SVG 3D-style — domaine immigration / mobilité internationale. */
export function renderImmigrationScene() {
  return `
<svg viewBox="0 0 640 400" fill="none" aria-hidden="true">
  <defs>
    <linearGradient id="globeGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1d4e74"/>
      <stop offset="100%" stop-color="#0a2038"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e8c547"/>
      <stop offset="100%" stop-color="#c9a227"/>
    </linearGradient>
  </defs>
  <g class="auth-portal__globe" opacity="0.85">
    <circle cx="200" cy="200" r="88" fill="url(#globeGrad)" stroke="#3d6f8f" stroke-width="2"/>
    <ellipse cx="200" cy="200" rx="88" ry="28" stroke="#6f8ea3" stroke-width="1.2" opacity="0.6"/>
    <path d="M112 200h176M200 112v176" stroke="#4a7a9a" stroke-width="1" opacity="0.5"/>
    <path d="M140 140c28 18 52 18 80 0M140 260c28-18 52-18 80 0" stroke="#5a8fb0" stroke-width="1.2" opacity="0.55"/>
  </g>
  <g transform="translate(380 120)" class="auth-portal__plane">
    <path d="M0 40 L120 20 L140 36 L100 44 L110 70 L80 52 L20 58 Z" fill="#143049" stroke="#7f93a6" stroke-width="2"/>
    <path d="M30 44 L95 28" stroke="#c9a227" stroke-width="2" opacity="0.7"/>
    <circle cx="118" cy="22" r="4" fill="#4ade80" opacity="0.8"/>
  </g>
  <g transform="translate(420 260)">
    <rect x="0" y="0" width="72" height="48" rx="4" fill="#10283d" stroke="#7f93a6" stroke-width="2"/>
    <rect x="8" y="8" width="56" height="32" rx="2" fill="url(#goldGrad)" opacity="0.85"/>
    <text x="36" y="28" text-anchor="middle" fill="#071526" font-size="10" font-weight="800">VISA</text>
  </g>
  <path d="M80 320 Q200 280 320 300 T560 290" stroke="#2a4a61" stroke-width="2" stroke-dasharray="6 8" opacity="0.7"/>
</svg>`;
}
