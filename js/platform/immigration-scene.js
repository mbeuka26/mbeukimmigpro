/** Scène visuelle dynamique — immigration (avion, passeport, globe). */
export function renderImmigrationScene() {
  const planeSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80" fill="none" aria-hidden="true">
  <defs>
    <linearGradient id="fuselage" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2a5570"/>
      <stop offset="100%" stop-color="#10283d"/>
    </linearGradient>
  </defs>
  <path d="M8 42 L95 28 L210 22 L232 38 L185 44 L198 58 L155 48 L42 52 Z" fill="url(#fuselage)" stroke="#8faabe" stroke-width="2"/>
  <path d="M95 30 L175 24" stroke="#c9a227" stroke-width="2.5" opacity="0.85"/>
  <ellipse cx="200" cy="26" rx="22" ry="8" fill="#143049" stroke="#6f8ea3" stroke-width="1.5"/>
  <circle cx="224" cy="24" r="5" fill="#4ade80" opacity="0.9"/>
  <path d="M155 48 L175 58 L178 52 Z" fill="#1d4e74" opacity="0.9"/>
</svg>`;

  return `
<div class="auth-scene-3d" role="img" aria-label="Illustration : avion en décollage et passeport — immigration internationale">
  <div class="auth-scene-3d__clouds"></div>
  <div class="auth-scene-3d__globe"></div>
  <div class="auth-scene-3d__runway"></div>
  <div class="auth-scene-3d__passport">
    <div class="auth-scene-3d__passport-cover"><span>PASSEPORT</span></div>
  </div>
  <div class="auth-scene-3d__plane">${planeSvg}</div>
  <p class="auth-scene-3d__caption">Mobilité internationale · Guide &amp; candidature</p>
</div>`;
}
