import { useMemo, useRef, useEffect, useState } from 'react';

/**
 * PillTower — renders a "shaky tower" of stacked pills with animations.
 *
 * @param {number} pills  - Number of whole pills (integer only now)
 * @param {string} accentColor - CSS color for glow/shadow
 * @param {"25"|"10"|"5"} pillType - pill size
 * @param {boolean} mini - render small inline icon only
 * @param {boolean} animate - whether to animate pill add/remove
 */
export default function PillTower({
  pills = 0,
  accentColor = "var(--subtype-po)",
  pillType = "25",
  mini = false,
  animate = false,
  className = "",
}) {
  const is10 = pillType === "10";
  const is5 = pillType === "5";
  const is25 = pillType === "25";

  // Track previous pill count for animation direction
  const prevPillsRef = useRef(pills);
  const [animatingPills, setAnimatingPills] = useState([]);
  const animIdRef = useRef(0);

  useEffect(() => {
    if (!animate) {
      prevPillsRef.current = pills;
      return;
    }
    const prev = prevPillsRef.current;
    const diff = pills - prev;
    prevPillsRef.current = pills;

    if (diff === 0) return;

    if (diff > 0) {
      // Adding pills — animate each new pill falling in
      const newAnims = [];
      for (let i = 0; i < diff; i++) {
        animIdRef.current++;
        newAnims.push({
          id: animIdRef.current,
          floor: prev + i,
          type: 'add',
          delay: i * (i === 0 && prev === 0 ? 0 : 60),
        });
      }
      setAnimatingPills(a => [...a, ...newAnims]);
      // Clean up after animation
      const timeout = setTimeout(() => {
        setAnimatingPills(a => a.filter(p => !newAnims.find(n => n.id === p.id)));
      }, 600 + (diff - 1) * 60);
      return () => clearTimeout(timeout);
    } else {
      // Removing pills — animate pills flying up
      const removeCount = Math.abs(diff);
      const newAnims = [];
      for (let i = 0; i < removeCount; i++) {
        animIdRef.current++;
        newAnims.push({
          id: animIdRef.current,
          floor: prev - 1 - i,
          type: 'remove',
          delay: i * 60,
        });
      }
      setAnimatingPills(a => [...a, ...newAnims]);
      const timeout = setTimeout(() => {
        setAnimatingPills(a => a.filter(p => !newAnims.find(n => n.id === p.id)));
      }, 500 + (removeCount - 1) * 60);
      return () => clearTimeout(timeout);
    }
  }, [pills, animate]);

  const floors = useMemo(() => {
    const result = [];
    const wholePills = Math.floor(pills);
    for (let i = 0; i < wholePills; i++) {
      result.push({ id: `w-${i}`, type: 'whole', floor: i });
    }
    return result;
  }, [pills]);

  // Mini icon for timeline cards
  if (mini) {
    if (is5) {
      return (
        <svg viewBox="0 0 18 18" className={`inline-block ${className}`}
          style={{ width: 9, height: 9, verticalAlign: 'middle' }}>
          <circle cx="9" cy="9" r="7" fill="#e2e8f0" opacity="0.5"
            stroke="#94a3b8" strokeWidth="1.2" />
        </svg>
      );
    }
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
  const PILL_RX = is5 ? 13 : is10 ? 16 : 28;
  const PILL_RY = is5 ? 8 : is10 ? 10 : 10;
  const PILL_THICKNESS = is5 ? 5 : is10 ? 6 : 8;
  const SPACING = is5 ? 8 : is10 ? 10 : 12;

  const maxFloor = Math.max(floors.length, 1);
  const vHeight = 60 + maxFloor * SPACING;
  const vWidth = is5 ? 42 : is10 ? 50 : 80;

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
          {is5 ? (
            <>
              <linearGradient id={`${uid}-top`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="60%" stopColor="#f1f5f9" />
                <stop offset="100%" stopColor="#e8ecf0" />
              </linearGradient>
              <linearGradient id={`${uid}-side`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f1f5f9" />
                <stop offset="100%" stopColor="#d1d5db" />
              </linearGradient>
            </>
          ) : (
            <>
              <linearGradient id={`${uid}-top`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="60%" stopColor="#f1f5f9" />
                <stop offset="100%" stopColor="#e2e8f0" />
              </linearGradient>
              <linearGradient id={`${uid}-side`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#cbd5e1" />
              </linearGradient>
            </>
          )}
          <linearGradient id={`${uid}-score`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#94a3b8" stopOpacity="0" />
            <stop offset="20%" stopColor="#94a3b8" stopOpacity="0.7" />
            <stop offset="80%" stopColor="#94a3b8" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#94a3b8" stopOpacity="0" />
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
          @keyframes pillFallIn${uid} {
            0% { transform: translateY(-40px); opacity: 0; }
            60% { transform: translateY(3px); opacity: 1; }
            80% { transform: translateY(-1px); }
            100% { transform: translateY(0); opacity: 1; }
          }
          @keyframes pillFlyOut${uid} {
            0% { transform: translateY(0); opacity: 1; }
            100% { transform: translateY(-40px); opacity: 0; }
          }
          .pill-fall-${uid} {
            animation: pillFallIn${uid} 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          }
          .pill-fly-${uid} {
            animation: pillFlyOut${uid} 0.35s ease-in both;
          }
        `}</style>

        <g className={floors.length > 2 ? `ps-${uid}` : ""}>
          {floors.map((floor, idx) => {
            const y = vHeight - 20 - floor.floor * SPACING;
            const cx = vWidth / 2;
            const offsetX = Math.sin(floor.floor * 7.13) * (is5 ? 1.5 : is10 ? 2 : 3);
            const x = cx + offsetX;

            // Check if this pill is being animated
            const animInfo = animatingPills.find(a => a.floor === floor.floor && a.type === 'add');
            const animClass = animInfo ? `pill-fall-${uid}` : '';
            const animDelay = animInfo ? `${animInfo.delay}ms` : '0ms';

            if (is5) {
              // ── 5mg pill: small round, lighter color, no score line ──
              return (
                <g key={floor.id} className={animClass}
                  style={animInfo ? { animationDelay: animDelay } : undefined}>
                  {/* Side */}
                  <ellipse cx={x} cy={y + PILL_THICKNESS / 2} rx={PILL_RX} ry={PILL_RY}
                    fill={`url(#${uid}-side)`} stroke="#b0b8c4" strokeWidth="0.3" />
                  {/* Top */}
                  <ellipse cx={x} cy={y} rx={PILL_RX} ry={PILL_RY}
                    fill={`url(#${uid}-top)`} stroke="#b0b8c4" strokeWidth="0.5" />
                  {/* Highlight — whiter for 5mg */}
                  <ellipse cx={x - 2} cy={y - 2} rx={PILL_RX * 0.4} ry={PILL_RY * 0.35}
                    fill="white" opacity="0.5" />
                </g>
              );
            }

            if (is10) {
              // ── 10mg pill: small round, no score line ──
              return (
                <g key={floor.id} className={animClass}
                  style={animInfo ? { animationDelay: animDelay } : undefined}>
                  <ellipse cx={x} cy={y + PILL_THICKNESS / 2} rx={PILL_RX} ry={PILL_RY}
                    fill={`url(#${uid}-side)`} stroke="#94a3b8" strokeWidth="0.3" />
                  <ellipse cx={x} cy={y} rx={PILL_RX} ry={PILL_RY}
                    fill={`url(#${uid}-top)`} stroke="#94a3b8" strokeWidth="0.5" />
                  <ellipse cx={x - 3} cy={y - 2} rx={PILL_RX * 0.4} ry={PILL_RY * 0.35}
                    fill="white" opacity="0.4" />
                </g>
              );
            }

            // ── 25mg pill: large oval with score line ──
            return (
              <g key={floor.id} className={animClass}
                style={animInfo ? { animationDelay: animDelay } : undefined}>
                <path
                  d={`M ${x - PILL_RX} ${y} v ${PILL_THICKNESS} a ${PILL_RX} ${PILL_RY} 0 0 0 ${PILL_RX * 2} 0 v -${PILL_THICKNESS} Z`}
                  fill={`url(#${uid}-side)`} stroke="#94a3b8" strokeWidth="0.4" />
                <ellipse cx={x} cy={y} rx={PILL_RX} ry={PILL_RY}
                  fill={`url(#${uid}-top)`} stroke="#94a3b8" strokeWidth="0.6" />
                <line x1={x - PILL_RX + 2} y1={y} x2={x + PILL_RX - 2} y2={y}
                  stroke={`url(#${uid}-score)`} strokeWidth="1.2" strokeLinecap="round" />
                <ellipse cx={x - 4} cy={y - 2} rx={PILL_RX * 0.55} ry={PILL_RY * 0.4}
                  fill="white" opacity="0.35" />
              </g>
            );
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
  if (pillType === "5") {
    return (
      <svg viewBox="0 0 18 18" className={className}
        style={{ width: size * 0.6, height: size * 0.6, verticalAlign: 'middle' }}>
        <circle cx="9" cy="9" r="7" fill="#e2e8f0" opacity="0.4"
          stroke="#94a3b8" strokeWidth="1.4" />
      </svg>
    );
  }
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
