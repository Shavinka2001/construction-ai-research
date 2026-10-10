/**
 * Component 2 preview — a wall run with a detected opening, a column clashing
 * into it, and the prescribed clearance shift that resolves the overlap.
 * Mirrors the before/after that `build_verified_gcr_recommendation()` returns.
 */
export function ClashPreview() {
  return (
    <svg
      viewBox="0 0 320 150"
      className="h-full w-full"
      role="img"
      aria-label="A column clashing with a detected door opening, and the prescribed 0.4 metre shift that clears it."
    >
      <defs>
        <pattern
          id="clashHatch"
          width="6"
          height="6"
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
        >
          <line x1="0" y1="0" x2="0" y2="6" stroke="#F87171" strokeWidth="1.4" />
        </pattern>
      </defs>

      {/* Wall runs — extracted centrelines, drawn at their stroke thickness. */}
      <g stroke="#CBD5E1" strokeWidth="7" strokeLinecap="square">
        <line x1="24" y1="30" x2="296" y2="30" />
        <line x1="24" y1="120" x2="296" y2="120" />
        <line x1="24" y1="30" x2="24" y2="120" />
        <line x1="296" y1="30" x2="296" y2="120" />
      </g>

      {/* Interior partition, below the load-bearing thickness threshold. */}
      <line
        x1="170"
        y1="30"
        x2="170"
        y2="120"
        stroke="#94A3B8"
        strokeWidth="3.5"
      />

      {/* Detected door opening — subtracted from the wall run. */}
      <line x1="92" y1="120" x2="140" y2="120" stroke="#0F172A" strokeWidth="9" />
      <line x1="92" y1="120" x2="140" y2="120" stroke="#22D3EE" strokeWidth="2.5" />
      <path
        d="M92 120 A 48 48 0 0 1 140 120"
        fill="none"
        stroke="#22D3EE"
        strokeWidth="1"
        strokeDasharray="3 3"
        strokeOpacity="0.6"
      />
      <text x="92" y="139" fill="#22D3EE" fontSize="7.5" fontWeight="700">
        D1 &middot; DOOR
      </text>

      {/* Clashing column (original position). */}
      <rect
        x="118"
        y="108"
        width="24"
        height="24"
        fill="url(#clashHatch)"
        stroke="#F87171"
        strokeWidth="1.6"
      />
      <text x="106" y="102" fill="#F87171" fontSize="7.5" fontWeight="700">
        CLASH
      </text>

      {/* Prescribed shift. */}
      <line
        x1="146"
        y1="120"
        x2="186"
        y2="120"
        stroke="#D4AF37"
        strokeWidth="1.2"
        strokeDasharray="4 3"
      />
      <path d="M186 120 l-6 -3.5 v7 Z" fill="#D4AF37" />
      <text x="150" y="113" fill="#D4AF37" fontSize="7.5" fontWeight="700">
        +0.40 m
      </text>

      {/* Resolved column position, re-validated clear. */}
      <rect
        x="186"
        y="108"
        width="24"
        height="24"
        fill="#10B981"
        fillOpacity="0.2"
        stroke="#10B981"
        strokeWidth="1.8"
      />
      <path
        d="M193 120 l4 4 l8 -9"
        fill="none"
        stroke="#10B981"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Status chip. */}
      <g transform="translate(206 20)">
        <rect
          width="94"
          height="22"
          rx="6"
          fill="#0F172A"
          fillOpacity="0.72"
          stroke="#D4AF37"
          strokeOpacity="0.35"
        />
        <text x="9" y="14.5" fill="#D4AF37" fontSize="7.5" fontWeight="700">
          GCR RE-VERIFIED
        </text>
      </g>
    </svg>
  );
}
