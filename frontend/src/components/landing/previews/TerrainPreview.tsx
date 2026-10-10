/**
 * Component 1 preview — DEM contour bands with a steep-slope flag and the
 * weighted buildability read-out, mirroring `score_site()` output.
 */
export function TerrainPreview() {
  return (
    <svg
      viewBox="0 0 320 150"
      className="h-full w-full"
      role="img"
      aria-label="Digital elevation contour bands with a flagged steep-slope zone and a buildability score of 78 out of 100."
    >
      <defs>
        <linearGradient id="terrainFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="terrainRisk" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity="0" />
          <stop offset="55%" stopColor="#D4AF37" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Contour stack — each band is one sampled elevation step. */}
      <path
        d="M0 132 C 46 120, 78 96, 120 92 S 206 104, 248 80 S 296 54, 320 46 L320 150 L0 150 Z"
        fill="url(#terrainFill)"
      />
      {[0, 14, 28, 42].map((offset, index) => (
        <path
          key={offset}
          d={`M0 ${132 - offset} C 46 ${120 - offset}, 78 ${96 - offset}, 120 ${
            92 - offset
          } S 206 ${104 - offset}, 248 ${80 - offset} S 296 ${54 - offset}, 320 ${
            46 - offset
          }`}
          fill="none"
          stroke="#10B981"
          strokeOpacity={0.5 - index * 0.09}
          strokeWidth={index === 0 ? 1.8 : 1}
        />
      ))}

      {/* Steep-slope corridor flagged for geotechnical review. */}
      <rect x="236" y="20" width="84" height="130" fill="url(#terrainRisk)" />
      <line
        x1="236"
        y1="20"
        x2="236"
        y2="150"
        stroke="#D4AF37"
        strokeWidth="1"
        strokeDasharray="3 3"
        strokeOpacity="0.7"
      />
      <text
        x="243"
        y="34"
        fill="#D4AF37"
        fontSize="8.5"
        fontWeight="700"
        letterSpacing="0.6"
      >
        SLOPE &gt; 15%
      </text>

      {/* Transect sample pins. */}
      {[24, 72, 120, 168, 216].map((x, index) => (
        <circle
          key={x}
          cx={x}
          cy={132 - index * 9 - (index > 2 ? 14 : 0)}
          r="2.6"
          fill="#10B981"
        />
      ))}

      {/* Score chip. */}
      <g transform="translate(14 14)">
        <rect
          width="104"
          height="34"
          rx="8"
          fill="#0F172A"
          fillOpacity="0.72"
          stroke="#10B981"
          strokeOpacity="0.35"
        />
        <text x="10" y="14" fill="#94A3B8" fontSize="7" letterSpacing="0.8">
          BUILDABILITY
        </text>
        <text x="10" y="27" fill="#FFFFFF" fontSize="13" fontWeight="700">
          78
          <tspan fill="#64748B" fontSize="8">
            {" "}
            / 100
          </tspan>
        </text>
        <text x="72" y="27" fill="#10B981" fontSize="8" fontWeight="700">
          GOOD
        </text>
      </g>
    </svg>
  );
}
