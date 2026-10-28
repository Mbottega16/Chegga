// Chegga Web — Broadcast Tactical Showcase SVG for the Hero Stage
//
// Pure zero-dependency SVG illustration showing an angled Broadcast Studio
// chessboard slice, glowing candidate-move Bezier trails, a live "!! Brilliant"
// tactical sacrifice callout, a "?? Blunder" warning reticle, and an animated
// evaluation advantage curve underneath.

export function renderHeroArt(): string {
  return `
    <div class="hero-stage-art" aria-hidden="true">
      <div class="hero-stage-glow"></div>
      <svg class="hero-stage-svg" viewBox="0 0 460 330" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="hero-board-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#18202c" />
            <stop offset="100%" stop-color="#0d1118" />
          </linearGradient>
          <linearGradient id="hero-sq-light" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#d7e3ea" />
            <stop offset="100%" stop-color="#b8cad6" />
          </linearGradient>
          <linearGradient id="hero-sq-dark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3f6a83" />
            <stop offset="100%" stop-color="#2c4e63" />
          </linearGradient>
          <linearGradient id="hero-cyan-glow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.95" />
            <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0.3" />
          </linearGradient>
          <linearGradient id="hero-eval-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#22d3ee" stop-opacity="0.0" />
          </linearGradient>
          <filter id="hero-neon-cyan" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="hero-neon-red" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <!-- Outer Studio Frame -->
        <rect x="18" y="14" width="424" height="238" rx="18" fill="url(#hero-board-bg)" stroke="#2b3548" stroke-width="1.5" />
        
        <!-- Vertical Live Eval Gauge on Left of Stage -->
        <rect x="32" y="30" width="12" height="206" rx="6" fill="#111620" stroke="#2a3344" stroke-width="1" />
        <rect x="33" y="72" width="10" height="163" rx="5" fill="#edeff3" />
        <rect x="33" y="72" width="10" height="32" rx="4" fill="#22d3ee" opacity="0.85" />
        <text x="38" y="64" fill="#22d3ee" font-family="JetBrains Mono, monospace" font-size="8.5" font-weight="800" text-anchor="middle">+4.2</text>

        <!-- 6x4 Tactical Board Slice (c3 to h6) -->
        <g transform="translate(58, 30)">
          <rect x="-2" y="-2" width="312" height="210" rx="10" fill="none" stroke="#334155" stroke-width="2" />
          ${Array.from({ length: 4 }, (_, r) =>
            Array.from({ length: 6 }, (_, c) => {
              const isLight = (r + c) % 2 === 0;
              const x = c * 51.3;
              const y = r * 51.5;
              return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="51.4" height="51.6" fill="url(#${isLight ? "hero-sq-light" : "hero-sq-dark"})" />`;
            }).join("")
          ).join("")}

          <!-- Candidate Heatmap Tints -->
          <!-- Brilliant target square e5 (col 2, row 1) -->
          <rect x="102.6" y="51.5" width="51.4" height="51.6" fill="#22d3ee" fill-opacity="0.38" />
          <rect x="105.6" y="54.5" width="45.4" height="45.6" rx="5" stroke="#22d3ee" stroke-width="2" stroke-dasharray="6 4" class="hero-pulse-ring" />

          <!-- Secondary candidate square f4 (col 3, row 2) -->
          <rect x="153.9" y="103.0" width="51.4" height="51.6" fill="#4caf50" fill-opacity="0.32" />

          <!-- Blunder square c6 (col 0, row 0) -->
          <rect x="0" y="0" width="51.4" height="51.6" fill="#e53935" fill-opacity="0.36" />
          <rect x="3" y="3" width="45.4" height="45.6" rx="5" stroke="#e53935" stroke-width="1.75" />

          <!-- Origin square d3 (col 1, row 3) -->
          <rect x="51.3" y="154.5" width="51.4" height="51.6" fill="#22d3ee" fill-opacity="0.2" />

          <!-- Flowing Candidate Move Trails -->
          <!-- Secondary Best Trail: d3 -> f4 -->
          <path d="M 77 180 Q 135 168 179 129" stroke="#4caf50" stroke-width="4" stroke-dasharray="7 5" stroke-linecap="round" opacity="0.85" class="hero-flow-trail" />
          <circle cx="179" cy="129" r="5" fill="#4caf50" />

          <!-- Blunder Opponent Trail: b8 -> c6 -->
          <path d="M 26 6 L 26 26" stroke="#e53935" stroke-width="3.5" stroke-linecap="round" opacity="0.8" />

          <!-- Brilliant Sacrifice Curve: d3 -> e5 -->
          <path d="M 77 180 Q 82 112 128 77" stroke="url(#hero-cyan-glow)" stroke-width="6.5" stroke-linecap="round" filter="url(#hero-neon-cyan)" class="hero-flow-trail-fast" />
          <polygon points="128,68 137,81 121,83" fill="#22d3ee" />

          <!-- Fork Projection Lines from e5 to c6 and g6 -->
          <line x1="128" y1="77" x2="32" y2="28" stroke="#22d3ee" stroke-width="2" stroke-dasharray="3 4" opacity="0.75" />
          <line x1="128" y1="77" x2="230" y2="28" stroke="#22d3ee" stroke-width="2" stroke-dasharray="3 4" opacity="0.75" />

          <!-- Stylized Chess Piece Silhouettes -->
          <!-- Black Knight on c6 (col 0, row 0) -->
          <g transform="translate(11, 8)">
            <path d="M7 28 L23 28 L21 24 L9 24 Z M9 23 C9 16 12 13 17 11 C14 11 10 13 8 11 C6 9 9 5 13 4 C15 2 18 3 19 5 C22 7 23 13 21 23 Z" fill="#141821" stroke="#edeff3" stroke-width="1.5" stroke-linejoin="round" />
          </g>

          <!-- Black King on g6 (col 4, row 0) -->
          <g transform="translate(216, 7)">
            <path d="M15 2 L15 7 M12.5 4.5 L17.5 4.5 M6 29 L24 29 L22 25 L8 25 Z M8 24 C7 16 10 11 15 11 C20 11 23 16 22 24 Z" fill="#141821" stroke="#edeff3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </g>

          <!-- White Queen / Knight Landing on e5 (col 2, row 1) -->
          <g transform="translate(113, 59)" filter="url(#hero-neon-cyan)">
            <path d="M5 28 L25 28 L23 24 L7 24 Z M7 23 L5 11 L11 16 L15 9 L19 16 L25 11 L23 23 Z" fill="#ffffff" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round" />
            <circle cx="5" cy="9" r="1.8" fill="#22d3ee" />
            <circle cx="15" cy="7" r="2" fill="#22d3ee" />
            <circle cx="25" cy="9" r="1.8" fill="#22d3ee" />
          </g>

          <!-- White Bishop on f4 (col 3, row 2) -->
          <g transform="translate(165, 111)" opacity="0.88">
            <path d="M6 28 L24 28 L22 24 L8 24 Z M9 23 C8 15 11 9 15 7 C19 9 22 15 21 23 Z" fill="#f8fafc" stroke="#1e293b" stroke-width="1.5" />
            <circle cx="15" cy="5" r="1.8" fill="#f8fafc" stroke="#1e293b" stroke-width="1.2" />
          </g>
        </g>

        <!-- Floating Broadcast Callout Pill: !! Brilliant -->
        <g transform="translate(202, 54)">
          <rect x="0" y="0" width="174" height="44" rx="10" fill="#0d131d" fill-opacity="0.92" stroke="#22d3ee" stroke-width="1.5" filter="url(#hero-neon-cyan)" />
          <circle cx="22" cy="22" r="13" fill="#22d3ee" />
          <text x="22" y="26.5" fill="#061018" font-family="JetBrains Mono, monospace" font-size="13" font-weight="900" text-anchor="middle">!!</text>
          <text x="43" y="19" fill="#ffffff" font-family="Space Grotesk, sans-serif" font-size="12" font-weight="700">3. Qxe5+ Brilliant!</text>
          <text x="43" y="33" fill="#94a3b8" font-family="Inter, sans-serif" font-size="10">Forks king &amp; knight · +4.2</text>
        </g>

        <!-- Floating Blunder Badge on c6 -->
        <g transform="translate(96, 18)">
          <rect x="0" y="0" width="96" height="24" rx="7" fill="#1a0d12" fill-opacity="0.92" stroke="#e53935" stroke-width="1.2" filter="url(#hero-neon-red)" />
          <text x="48" y="15.5" fill="#f87171" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700" text-anchor="middle">?? Hang Queen</text>
        </g>

        <!-- Bottom Broadcast Evaluation Scrubber Strip -->
        <g transform="translate(18, 262)">
          <rect x="0" y="0" width="424" height="54" rx="12" fill="#10151f" stroke="#242c3d" stroke-width="1.2" />
          <text x="16" y="18" fill="#9aa4b6" font-family="Space Grotesk, sans-serif" font-size="10" font-weight="700" letter-spacing="0.06em">EVALUATION FLOW &amp; TIME PRESSURE</text>
          <text x="408" y="18" fill="#22d3ee" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700" text-anchor="end">Stockfish 16 WASM · Local</text>
          <!-- Midline -->
          <line x1="16" y1="36" x2="408" y2="36" stroke="#263042" stroke-width="1" stroke-dasharray="3 3" />
          <!-- Time panic heat band -->
          <rect x="242" y="23" width="38" height="24" fill="#e53935" fill-opacity="0.16" rx="3" />
          <!-- Eval wave fill & stroke -->
          <path d="M 16 36 C 60 35, 95 32, 140 33 C 185 34, 220 44, 258 45 C 285 45, 305 24, 345 25 C 375 25, 395 23, 408 23 L 408 48 L 16 48 Z" fill="url(#hero-eval-fill)" />
          <path d="M 16 36 C 60 35, 95 32, 140 33 C 185 34, 220 44, 258 45 C 285 45, 305 24, 345 25 C 375 25, 395 23, 408 23" stroke="#22d3ee" stroke-width="2.2" fill="none" stroke-linecap="round" />
          <circle cx="258" cy="45" r="4" fill="#e53935" stroke="#0d1118" stroke-width="1.5" />
          <circle cx="316" cy="24.5" r="4.5" fill="#22d3ee" stroke="#ffffff" stroke-width="1.5" />
        </g>
      </svg>
    </div>
  `;
}
