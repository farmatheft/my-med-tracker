import { useMemo } from 'react';

/**
 * PillTower — renders a "shaky tower" of stacked pills.
 *
 * @param {number} pills  - Number of pills (supports 0.5 increments for 25mg), e.g. 2.5
 * @param {string} accentColor - CSS color for glow/shadow
 * @param {"25"|"10"} pillType - "25" = large with score line, "10" = small round no score
 * @param {boolean} mini - render small inline icon only
 */
export default function PillTower({
  pills = 0,
  accentColor = "var(--subtype-po)",
  pillType = "25",
  mini = false,
  className = "",
}) {
  const is10 = pillType === "10";

  const floors = useMemo(() => {
    const result = [];
    const wholePills = Math.floor(pills);
    const hasHalf = !is10 && pills % 1 !== 0; // 10mg pills don't halve

    for (let i = 0; i < wholePills; i++) {
      result.push({ id: `w-${i}`, type: 'whole', floor: i });
    }
    if (hasHalf) {
      result.push({ id: `h-${wholePills}`, type: 'half', floor: wholePills });
    }
    return result;
  }, [pills, is10]);

  // Mini icon for timeline cards
  if (mini) {
    const sz = is10 ? 10 : 14;
    return (
      <svg viewBox={is10 ? "0 0 20 20" : "0 0 28 12"} className={`inline-block ${className}`}
        style={{ width: sz, height: is10 ? sz : sz * 0.42, verticalAlign: 'middle' }}>
        {is10 ? (
          <circle cx="10" cy="10" r="8" fill="var(--subtype-po)" opacity="0.2"
            stroke="var(--subtype-po)" strokeWidth="1.2" />
        ) : (
          <>
            <ellipse cx="14" cy="6" rx="13" ry="5.5" fill="var(--subtype-po)" opacity="0.18"
              stroke="var(--subtype-po)" strokeWidth="1" />
            <line x1="14" y1="1" x2="14" y2="11" stroke="var(--subtype-po)" strokeWidth="0.8" opacity="0.5" />
          </>
        )}
      </svg>
    );
  }

  // Visual constants per pill type
  const PILL_RX = is10 ? 16 : 28;
  const PILL_RY = is10 ? 10 : 10;
  const PILL_THICKNESS = is10 ? 6 : 8;
  const SPACING = is10 ? 10 : 12;

  const maxFloor = Math.max(floors.length, 1);
  const vHeight = 60 + maxFloor * SPACING;
  const vWidth = is10 ? 50 : 80;

  const uid = useMemo(() => `pt-${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <div className={`w-full h-full flex items-end justify-center overflow-visible ${className}`}>
      <svg
        viewBox={`0 0 ${vWidth} ${vHeight}`}
        className="w-full relative z-10"
        style={{
          maxHeight: "90%",
          paddingBottom: "8px",
          overflow: "visible",
          filter: floors.length > 0 ? `drop-shadow(0 8px 12px color-mix(in srgb, ${accentColor} 40%, transparent))` : "none",
        }}
      >
        <defs>
          <linearGradient id={`${uid}-top`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <linearGradient id={`${uid}-side`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id={`${uid}-score`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#94a3b8" stopOpacity="0" />
            <stop offset="20%" stopColor="#94a3b8" stopOpacity="0.7" />
            <stop offset="80%" stopColor="#94a3b8" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#94a3b8" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${uid}-cut`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#f1f5f9" />
          </linearGradient>
        </defs>

        <style>{`
          @keyframes pillShake${uid} {
            0%, 100% { transform: translate(0, 0) rotate(0deg); }
            20% { transform: translate(-0.3px, 0.2px) rotate(-0.2deg); }
            40% { transform: translate(0.4px, -0.2px) rotate(0.3deg); }
            60% { transform: translate(-0.2px, 0.3px) rotate(-0.15deg); }
            80% { transform: translate(0.3px, 0.15px) rotate(0.2deg); }
          }
          .ps-${uid} {
            animation: pillShake${uid} 4s infinite ease-in-out;
            transform-origin: ${vWidth / 2}px ${vHeight - 20}px;
          }
        `}</style>

        <g className={floors.length > 2 ? `ps-${uid}` : ""}>
          {floors.map((floor) => {
            const y = vHeight - 20 - floor.floor * SPACING;
            const cx = vWidth / 2;
            const offsetX = Math.sin(floor.floor * 7.13) * (is10 ? 2 : 3);
            const x = cx + offsetX;

            if (is10) {
              // ── 10mg pill: small round, no score line ───────────────
              return (
                <g key={floor.id}>
                  {/* Side */}
                  <ellipse cx={x} cy={y + PILL_THICKNESS / 2} rx={PILL_RX} ry={PILL_RY}
                    fill={`url(#${uid}-side)`} stroke="#94a3b8" strokeWidth="0.3" />
                  {/* Top */}
                  <ellipse cx={x} cy={y} rx={PILL_RX} ry={PILL_RY}
                    fill={`url(#${uid}-top)`} stroke="#94a3b8" strokeWidth="0.5" />
                  {/* Highlight */}
                  <ellipse cx={x - 3} cy={y - 2} rx={PILL_RX * 0.4} ry={PILL_RY * 0.35}
                    fill="white" opacity="0.4" />
                </g>
              );
            }

            if (floor.type === 'whole') {
              // ── 25mg pill: large oval with score line ───────────────
              return (
                <g key={floor.id}>
                  <path
                    d={`M ${x - PILL_RX} ${y} v ${PILL_THICKNESS} a ${PILL_RX} ${PILL_RY} 0 0 0 ${PILL_RX * 2} 0 v -${PILL_THICKNESS} Z`}
                    fill={`url(#${uid}-side)`} stroke="#94a3b8" strokeWidth="0.4" />
                  <ellipse cx={x} cy={y} rx={PILL_RX} ry={PILL_RY}
                    fill={`url(#${uid}-top)`} stroke="#94a3b8" strokeWidth="0.6" />
                  {/* Score line */}
                  <line x1={x - PILL_RX + 2} y1={y} x2={x + PILL_RX - 2} y2={y}
                    stroke={`url(#${uid}-score)`} strokeWidth="1.2" strokeLinecap="round" />
                  <ellipse cx={x - 4} cy={y - 2} rx={PILL_RX * 0.55} ry={PILL_RY * 0.4}
                    fill="white" opacity="0.35" />
                </g>
              );
            } else {
              // ── 25mg half pill ──────────────────────────────────────
              return (
                <g key={floor.id}>
                  <path
                    d={`M ${x} ${y - PILL_RY} v ${PILL_THICKNESS} A ${PILL_RX} ${PILL_RY} 0 0 0 ${x} ${y + PILL_RY + PILL_THICKNESS} v -${PILL_THICKNESS} A ${PILL_RX} ${PILL_RY} 0 0 1 ${x} ${y - PILL_RY} Z`}
                    fill={`url(#${uid}-side)`} stroke="#94a3b8" strokeWidth="0.4" />
                  <rect x={x - 0.8} y={y - PILL_RY} width="1.6" height={PILL_RY * 2 + PILL_THICKNESS}
                    fill={`url(#${uid}-cut)`} stroke="#cbd5e1" strokeWidth="0.3" />
                  <path
                    d={`M ${x} ${y - PILL_RY} A ${PILL_RX} ${PILL_RY} 0 0 0 ${x} ${y + PILL_RY} Z`}
                    fill={`url(#${uid}-top)`} stroke="#94a3b8" strokeWidth="0.6" />
                  <ellipse cx={x - 8} cy={y - 1.5} rx={PILL_RX * 0.3} ry={PILL_RY * 0.35}
                    fill="white" opacity="0.3" />
                </g>
              );
            }
          })}
        </g>

        {floors.length === 0 && (
          <ellipse
            cx={vWidth / 2} cy={vHeight - 20}
            rx={PILL_RX * 0.9} ry={PILL_RY * 0.9}
            fill="var(--shadow-color-strong)"
            opacity="0.4"
            style={{ filter: "blur(2px)" }}
          />
        )}
      </svg>
    </div>
  );
}

/** Small inline pill icon for timeline cards */
export function PillIcon({ size = 16, pillType = "25", className = "" }) {
  const is10 = pillType === "10";
  if (is10) {
    return (
      <svg viewBox="0 0 20 20" className={className}
        style={{ width: size * 0.7, height: size * 0.7, verticalAlign: 'middle' }}>
        <circle cx="10" cy="10" r="8" fill="var(--subtype-po)" opacity="0.22"
          stroke="var(--subtype-po)" strokeWidth="1.4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 10" className={className}
      style={{ width: size, height: size * 0.42, verticalAlign: 'middle' }}>
      <ellipse cx="12" cy="5" rx="11" ry="4.5" fill="var(--subtype-po)" opacity="0.22"
        stroke="var(--subtype-po)" strokeWidth="1.2" />
      <line x1="12" y1="0.5" x2="12" y2="9.5" stroke="var(--subtype-po)" strokeWidth="0.7" opacity="0.6" />
    </svg>
  );
}
