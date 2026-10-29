// Chegga Web — Broadcast Tactical Showcase SVG for the Hero Stage
//
// Shows an authentic Broadcast Studio chessboard slice using real Staunton
// pieces (cburnett), glowing candidate-move Bezier trails, a live "!! Brilliant"
// tactical sacrifice callout, a "?? Hang Queen" refutation reticle, and an
// evaluation advantage curve with time-pressure heat band.

export function renderHeroArt(): string {
  const base = import.meta.env.BASE_URL;
  return `
    <div class="hero-stage-art" aria-hidden="true">
      <div class="hero-stage-glow"></div>
      <svg class="hero-stage-svg" viewBox="0 0 460 318" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="hero-board-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#141c28" />
            <stop offset="100%" stop-color="#0b0f16" />
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
            <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.32" />
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
        <rect x="12" y="10" width="436" height="236" rx="16" fill="url(#hero-board-bg)" stroke="#2b3548" stroke-width="1.5" />
        
        <!-- Vertical Live Eval Gauge on Left of Stage -->
        <rect x="24" y="24" width="14" height="208" rx="7" fill="#0d1118" stroke="#252f40" stroke-width="1.2" />
        <rect x="25.5" y="66" width="11" height="164.5" rx="5.5" fill="#edeff3" />
        <rect x="25.5" y="66" width="11" height="34" rx="4" fill="#22d3ee" opacity="0.9" />
        <text x="31" y="58" fill="#22d3ee" font-family="JetBrains Mono, monospace" font-size="8.5" font-weight="800" text-anchor="middle">+4.2</text>

        <!-- 6x4 Tactical Board Slice (c3 to h6) -->
        <g transform="translate(48, 24)">
          <rect x="-2" y="-2" width="312" height="210" rx="8" fill="none" stroke="#2c374a" stroke-width="1.5" />
          ${Array.from({ length: 4 }, (_, r) =>
            Array.from({ length: 6 }, (_, c) => {
              const isLight = (r + c) % 2 === 0;
              const x = c * 51.3;
              const y = r * 51.5;
              return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="51.4" height="51.6" fill="url(#${isLight ? "hero-sq-light" : "hero-sq-dark"})" />`;
            }).join("")
          ).join("")}

          <!-- Tactical Heatmap Tints -->
          <!-- Brilliant target square e5 (col 2, row 1) -->
          <rect x="102.6" y="51.5" width="51.4" height="51.6" fill="#22d3ee" fill-opacity="0.38" />
          <rect x="105.6" y="54.5" width="45.4" height="45.6" rx="5" stroke="#22d3ee" stroke-width="2" stroke-dasharray="6 4" class="hero-pulse-ring" />

          <!-- Secondary candidate square f4 (col 3, row 2) -->
          <rect x="153.9" y="103.0" width="51.4" height="51.6" fill="#4caf50" fill-opacity="0.32" />

          <!-- Blunder square c6 (col 0, row 0) -->
          <rect x="0" y="0" width="51.4" height="51.6" fill="#e53935" fill-opacity="0.36" />
          <rect x="2.5" y="2.5" width="46.4" height="46.6" rx="5" stroke="#e53935" stroke-width="1.75" />

          <!-- Origin square d3 (col 1, row 3) -->
          <rect x="51.3" y="154.5" width="51.4" height="51.6" fill="#22d3ee" fill-opacity="0.22" />

          <!-- Flowing Candidate Move Trails -->
          <!-- Secondary Best Trail: d3 -> f4 -->
          <path d="M 77 180 Q 135 168 179 129" stroke="#4caf50" stroke-width="4" stroke-dasharray="7 5" stroke-linecap="round" opacity="0.85" class="hero-flow-trail" />
          <circle cx="179" cy="129" r="5" fill="#4caf50" />

          <!-- Blunder Opponent Trail: b8 -> c6 -->
          <path d="M 26 4 L 26 26" stroke="#e53935" stroke-width="3" stroke-linecap="round" opacity="0.85" />

          <!-- Brilliant Sacrifice Curve: d3 -> e5 -->
          <path d="M 77 180 Q 82 112 128 77" stroke="url(#hero-cyan-glow)" stroke-width="6" stroke-linecap="round" filter="url(#hero-neon-cyan)" class="hero-flow-trail-fast" />
          <polygon points="128,68 137,81 121,83" fill="#22d3ee" />

          <!-- Fork Projection Lines from e5 to c6 and g6 -->
          <line x1="128" y1="77" x2="32" y2="28" stroke="#22d3ee" stroke-width="2" stroke-dasharray="3 4" opacity="0.75" />
          <line x1="128" y1="77" x2="230" y2="28" stroke="#22d3ee" stroke-width="2" stroke-dasharray="3 4" opacity="0.75" />

          <!-- Authentic Timeless Staunton Pieces (cburnett vectors) -->
          <!-- Black Knight on c6 (col 0, row 0) -->
          <image href="${base}piece/cburnett/bN.svg" x="3" y="3" width="45" height="45" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));" />

          <!-- Black King on g6 (col 4, row 0) -->
          <image href="${base}piece/cburnett/bK.svg" x="208" y="3" width="45" height="45" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));" />

          <!-- White Queen landing on e5 (col 2, row 1) -->
          <g filter="url(#hero-neon-cyan)">
            <image href="${base}piece/cburnett/wQ.svg" x="105" y="54" width="46" height="46" style="filter: drop-shadow(0 2px 6px rgba(34,211,238,0.7));" />
          </g>

          <!-- White Bishop on f4 (col 3, row 2) -->
          <image href="${base}piece/cburnett/wB.svg" x="156" y="106" width="45" height="45" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));" />
        </g>

        <!-- Floating Broadcast Callout Pill: !! Brilliant -->
        <g transform="translate(196, 48)">
          <rect x="0" y="0" width="182" height="46" rx="10" fill="#0c121b" fill-opacity="0.94" stroke="#22d3ee" stroke-width="1.5" filter="url(#hero-neon-cyan)" />
          <circle cx="23" cy="23" r="14" fill="#22d3ee" />
          <text x="23" y="28" fill="#041018" font-family="JetBrains Mono, monospace" font-size="13.5" font-weight="900" text-anchor="middle">!!</text>
          <text x="46" y="20" fill="#ffffff" font-family="Space Grotesk, sans-serif" font-size="12" font-weight="700">3. Qxe5+ Brilliant!</text>
          <text x="46" y="35" fill="#94a3b8" font-family="Inter, sans-serif" font-size="10">Tactical sacrifice · +4.2</text>
        </g>

        <!-- Floating Blunder Badge on c6 -->
        <g transform="translate(86, 14)">
          <rect x="0" y="0" width="94" height="22" rx="6" fill="#180b10" fill-opacity="0.94" stroke="#e53935" stroke-width="1.2" filter="url(#hero-neon-red)" />
          <text x="47" y="14.5" fill="#f87171" font-family="JetBrains Mono, monospace" font-size="9.5" font-weight="700" text-anchor="middle">?? Hang Queen</text>
        </g>

        <!-- Bottom Broadcast Evaluation Scrubber Strip -->
        <g transform="translate(12, 254)">
          <rect x="0" y="0" width="436" height="52" rx="10" fill="#0e131d" stroke="#212a3b" stroke-width="1" />
          <text x="14" y="16" fill="#8e9bb0" font-family="Space Grotesk, sans-serif" font-size="9" font-weight="700" letter-spacing="0.06em">EVALUATION FLOW &amp; ADVANTAGE</text>
          <text x="422" y="16" fill="#22d3ee" font-family="JetBrains Mono, monospace" font-size="9" font-weight="700" text-anchor="end">Stockfish 18 · Real Time</text>
          <!-- Midline -->
          <line x1="14" y1="34" x2="422" y2="34" stroke="#232d3d" stroke-width="1" stroke-dasharray="3 3" />
          <!-- Time panic heat band -->
          <rect x="250" y="21" width="40" height="23" fill="#e53935" fill-opacity="0.16" rx="3" />
          <!-- Eval wave fill & stroke -->
          <path d="M 14 34 C 60 33, 95 30, 140 31 C 185 32, 220 42, 260 43 C 290 43, 310 22, 350 23 C 380 23, 405 21, 422 21 L 422 46 L 14 46 Z" fill="url(#hero-eval-fill)" />
          <path d="M 14 34 C 60 33, 95 30, 140 31 C 185 32, 220 42, 260 43 C 290 43, 310 22, 350 23 C 380 23, 405 21, 422 21" stroke="#22d3ee" stroke-width="2" fill="none" stroke-linecap="round" />
          <circle cx="260" cy="43" r="3.5" fill="#e53935" stroke="#0b0f16" stroke-width="1.5" />
          <circle cx="320" cy="22.5" r="4" fill="#22d3ee" stroke="#ffffff" stroke-width="1.5" />
        </g>
      </svg>
    </div>
  `;
}
