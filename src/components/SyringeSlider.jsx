import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';

/**
 * Resolve a CSS variable like "var(--subtype-iv)" to its computed hex value.
 * Falls back to the raw string if it's already a color.
 */
const resolveCssColor = (colorStr) => {
  if (!colorStr) return '#22c55e';
  if (!colorStr.startsWith('var(')) return colorStr;
  try {
    const prop = colorStr.replace('var(', '').replace(')', '').trim();
    const val = getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
    return val || '#22c55e';
  } catch {
    return '#22c55e';
  }
};

const SyringeSlider = ({ value, max, min = 0, step = 1, onChange, color = '#22c55e', side = 'right' }) => {
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  // Resolve CSS variable to actual hex for SVG gradient stops
  const resolvedColor = useMemo(() => resolveCssColor(color), [color]);

  const percentage = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);

  // SVG viewBox: 0 0 80 360
  const svgW = 80;
  const svgH = 360;
  const barrelTop = 70;
  const barrelBottom = 310;
  const barrelH = barrelBottom - barrelTop;
  const barrelLeft = 15;
  const barrelRight = 65;
  const barrelW = barrelRight - barrelLeft;
  const cx = (barrelLeft + barrelRight) / 2;

  // === SYRINGE PHYSICS ===
  // Value 0 (empty): piston at TOP (pushed in). Pull DOWN to fill.
  // Liquid fills ABOVE the piston (between barrel top and piston).
  const pistonY = barrelTop + (percentage / 100) * barrelH;
  const liquidTop = barrelTop;
  const liquidH = pistonY - barrelTop;

  const transClass = isDragging ? '' : 'transition-all duration-300 ease-out';

  const handleMove = useCallback((clientY) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const topRatio = barrelTop / svgH;
    const botRatio = barrelBottom / svgH;
    const barrelScreenTop = rect.top + topRatio * rect.height;
    const barrelScreenBot = rect.top + botRatio * rect.height;
    const barrelScreenH = barrelScreenBot - barrelScreenTop;

    let pos = (clientY - barrelScreenTop) / barrelScreenH;
    pos = Math.min(Math.max(pos, 0), 1);

    const raw = min + pos * (max - min);
    const stepped = Math.round(raw / step) * step;
    const clean = Number(stepped.toFixed(step < 1 ? 1 : 0));
    onChange(Math.min(Math.max(clean, min), max));
  }, [min, max, step, onChange]);

  const onMouseDown = (e) => { setIsDragging(true); handleMove(e.clientY); };
  const onTouchStart = (e) => { setIsDragging(true); handleMove(e.touches[0].clientY); };

  useEffect(() => {
    const onMM = (e) => { if (isDragging) { e.preventDefault(); handleMove(e.clientY); } };
    const onTM = (e) => { if (isDragging) { e.preventDefault(); handleMove(e.touches[0].clientY); } };
    const onEnd = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener('mousemove', onMM, { passive: false });
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onTM, { passive: false });
      window.addEventListener('touchend', onEnd);
    }
    return () => {
      window.removeEventListener('mousemove', onMM);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTM);
      window.removeEventListener('touchend', onEnd);
    };
  }, [isDragging, handleMove]);

  // Graduations
  const grads = [];
  const numTicks = 10;
  for (let i = 0; i <= numTicks; i++) {
    const v = min + (i / numTicks) * (max - min);
    const y = barrelTop + (i / numTicks) * barrelH;
    grads.push({ y, label: Math.round(v * 10) / 10, isMajor: i % 2 === 0 });
  }

  const id = `syringe-${side}`;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none"
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      style={{ touchAction: 'none', cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={`${id}-barrel`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.20)" />
            <stop offset="15%" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="35%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="85%" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.15)" />
          </linearGradient>

          <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="10%" stopColor="rgba(255,255,255,0.45)" />
            <stop offset="20%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>

          {/* Liquid gradient — uses resolved hex color */}
          <linearGradient id={`${id}-liquid`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={resolvedColor} stopOpacity="0.65" />
            <stop offset="30%" stopColor={resolvedColor} stopOpacity="0.9" />
            <stop offset="70%" stopColor={resolvedColor} stopOpacity="0.8" />
            <stop offset="100%" stopColor={resolvedColor} stopOpacity="0.45" />
          </linearGradient>

          <linearGradient id={`${id}-needle`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#9ca3af" />
            <stop offset="30%" stopColor="#e5e7eb" />
            <stop offset="50%" stopColor="#f9fafb" />
            <stop offset="70%" stopColor="#e5e7eb" />
            <stop offset="100%" stopColor="#9ca3af" />
          </linearGradient>

          <linearGradient id={`${id}-rubber`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#374151" />
            <stop offset="30%" stopColor="#6b7280" />
            <stop offset="50%" stopColor="#9ca3af" />
            <stop offset="70%" stopColor="#6b7280" />
            <stop offset="100%" stopColor="#374151" />
          </linearGradient>

          <linearGradient id={`${id}-rod`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#d1d5db" />
            <stop offset="30%" stopColor="#e5e7eb" />
            <stop offset="50%" stopColor="#f3f4f6" />
            <stop offset="70%" stopColor="#e5e7eb" />
            <stop offset="100%" stopColor="#d1d5db" />
          </linearGradient>

          <filter id={`${id}-glow`}>
            <feGaussianBlur stdDeviation="1.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          <clipPath id={`${id}-barrel-clip`}>
            <rect x={barrelLeft} y={barrelTop} width={barrelW} height={barrelH} rx="4" />
          </clipPath>
        </defs>

        {/* ===== NEEDLE ===== */}
        <g>
          <rect x={cx - 0.8} y="8" width="1.6" height="48" fill={`url(#${id}-needle)`} />
          <polygon points={`${cx - 1.2},8 ${cx},0 ${cx + 1.2},8`} fill="#d1d5db" />
          <rect x={cx - 6} y="52" width="12" height="8" rx="2" fill="#d1d5db" />
          <rect x={cx - 5} y="56" width="10" height="6" rx="1.5" fill="#e5e7eb" />
          <rect x={cx - 8} y="62" width="16" height="8" rx="2" fill="#9ca3af" />
          <rect x={cx - 7} y="63" width="14" height="2" rx="1" fill="rgba(255,255,255,0.3)" />
        </g>

        {/* ===== BARREL ===== */}
        <rect x={barrelLeft} y={barrelTop} width={barrelW} height={barrelH} rx="6"
          fill={`url(#${id}-barrel)`} stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />

        <g clipPath={`url(#${id}-barrel-clip)`}>
          {/* Liquid — between barrel top and piston */}
          {liquidH > 0 && (
            <rect x={barrelLeft} y={liquidTop} width={barrelW} height={liquidH}
              fill={`url(#${id}-liquid)`} filter={`url(#${id}-glow)`} className={transClass} />
          )}

          {/* Meniscus at bottom of liquid */}
          {liquidH > 4 && (
            <rect x={barrelLeft + 2} y={pistonY - 3} width={barrelW - 4} height="3"
              fill="rgba(255,255,255,0.25)" className={transClass} rx="1" />
          )}

          {/* Bubbles */}
          {percentage > 8 && (
            <g className={transClass}>
              <circle cx={cx - 6} cy={barrelTop + liquidH * 0.3} r="1.5" fill="rgba(255,255,255,0.45)" className="bubble-float-1" />
              <circle cx={cx + 8} cy={barrelTop + liquidH * 0.55} r="1" fill="rgba(255,255,255,0.35)" className="bubble-float-2" />
              <circle cx={cx - 3} cy={barrelTop + liquidH * 0.15} r="0.7" fill="rgba(255,255,255,0.25)" className="bubble-float-3" />
            </g>
          )}

          {/* Piston / rubber stopper */}
          <rect x={barrelLeft + 1} y={pistonY} width={barrelW - 2} height="8" rx="2"
            fill={`url(#${id}-rubber)`} className={transClass} />
          <line x1={barrelLeft + 3} y1={pistonY + 3} x2={barrelRight - 3} y2={pistonY + 3}
            stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" className={transClass} />
          <line x1={barrelLeft + 3} y1={pistonY + 5} x2={barrelRight - 3} y2={pistonY + 5}
            stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" className={transClass} />
        </g>

        {/* Rod — extends down from piston */}
        <rect x={cx - 3} y={pistonY + 8} width="6" height={svgH - pistonY}
          fill={`url(#${id}-rod)`} className={transClass} />
        <rect x={cx - 0.5} y={pistonY + 8} width="1" height={svgH - pistonY}
          fill="rgba(255,255,255,0.35)" className={transClass} />

        {/* ===== GRADUATIONS ===== */}
        {grads.map(({ y, label, isMajor }) => (
          <g key={y}>
            <line x1={barrelRight + 2} y1={y} x2={barrelRight + (isMajor ? 10 : 6)} y2={y}
              stroke="rgba(255,255,255,0.45)" strokeWidth={isMajor ? "1" : "0.5"} />
            {isMajor && (
              <text x={barrelRight + 12} y={y + 3} fill="rgba(255,255,255,0.6)"
                fontSize="7" fontWeight="600" fontFamily="system-ui, sans-serif">
                {label}
              </text>
            )}
          </g>
        ))}

        {/* Shine overlay */}
        <rect x={barrelLeft} y={barrelTop} width={barrelW} height={barrelH} rx="6"
          fill={`url(#${id}-sheen)`} pointerEvents="none" />

        {/* Flanges */}
        <rect x={barrelLeft - 8} y={barrelBottom} width={barrelW + 16} height="5" rx="2" fill="#cbd5e1" />
        <rect x={barrelLeft - 6} y={barrelBottom + 0.5} width={barrelW + 12} height="1.5" rx="1" fill="rgba(255,255,255,0.4)" />

        {/* Thumb rest */}
        <g className={transClass}>
          <rect x={cx - 14} y={Math.min(pistonY + 120, svgH - 16)} width="28" height="5" rx="2.5" fill="#cbd5e1" />
          <rect x={cx - 12} y={Math.min(pistonY + 121, svgH - 15)} width="24" height="1.5" rx="1" fill="rgba(255,255,255,0.5)" />
        </g>
      </svg>

      <style>{`
        @keyframes bubble-float {
          0% { transform: translateY(0px); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(-8px); opacity: 0; }
        }
        .bubble-float-1 { animation: bubble-float 3s infinite ease-in-out; }
        .bubble-float-2 { animation: bubble-float 4s infinite ease-in-out; animation-delay: 1s; }
        .bubble-float-3 { animation: bubble-float 2.5s infinite ease-in-out; animation-delay: 2s; }
      `}</style>
    </div>
  );
};

export default SyringeSlider;
