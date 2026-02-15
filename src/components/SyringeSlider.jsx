import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';

/** Resolve CSS var like "var(--x)" to computed hex */
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
  const resolvedColor = useMemo(() => resolveCssColor(color), [color]);

  const percentage = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);

  const svgW = 80, svgH = 340;
  const barrelTop = 65, barrelBottom = 285;
  const barrelH = barrelBottom - barrelTop;
  const barrelLeft = 18, barrelRight = 62;
  const barrelW = barrelRight - barrelLeft;
  const cx = (barrelLeft + barrelRight) / 2;

  // Physics: value=0 → piston at top (pushed in, empty). Pull down to fill.
  const pistonY = barrelTop + (percentage / 100) * barrelH;
  const liquidH = pistonY - barrelTop;

  const trans = isDragging ? '' : 'transition-all duration-200 ease-out';

  const handleMove = useCallback((clientY) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const t = barrelTop / svgH, b = barrelBottom / svgH;
    const sTop = rect.top + t * rect.height;
    const sH = (b - t) * rect.height;
    let pos = Math.min(Math.max((clientY - sTop) / sH, 0), 1);
    const raw = min + pos * (max - min);
    const stepped = Math.round(raw / step) * step;
    onChange(Math.min(Math.max(Number(stepped.toFixed(step < 1 ? 1 : 0)), min), max));
  }, [min, max, step, onChange]);

  const onMouseDown = (e) => { setIsDragging(true); handleMove(e.clientY); };
  const onTouchStart = (e) => { setIsDragging(true); handleMove(e.touches[0].clientY); };

  useEffect(() => {
    if (!isDragging) return;
    const mm = (e) => { e.preventDefault(); handleMove(e.clientY); };
    const tm = (e) => { e.preventDefault(); handleMove(e.touches[0].clientY); };
    const up = () => setIsDragging(false);
    window.addEventListener('mousemove', mm, { passive: false });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', tm, { passive: false });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', tm);
      window.removeEventListener('touchend', up);
    };
  }, [isDragging, handleMove]);

  const id = `syr-${side}`;

  // Graduation marks
  const ticks = [];
  for (let i = 0; i <= 10; i++) {
    const y = barrelTop + (i / 10) * barrelH;
    const v = min + (i / 10) * (max - min);
    ticks.push({ y, label: Math.round(v * 10) / 10, major: i % 2 === 0 });
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none"
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      style={{ touchAction: 'none', cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          {/* Glass barrel — semi-transparent white with cylindrical gradient */}
          <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#d4d4d8" stopOpacity="0.6" />
            <stop offset="12%" stopColor="#fafafa" stopOpacity="0.85" />
            <stop offset="30%" stopColor="#e4e4e7" stopOpacity="0.5" />
            <stop offset="55%" stopColor="#d4d4d8" stopOpacity="0.35" />
            <stop offset="80%" stopColor="#a1a1aa" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#71717a" stopOpacity="0.55" />
          </linearGradient>

          {/* Shine stripe */}
          <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="8%" stopColor="rgba(255,255,255,0.7)" />
            <stop offset="16%" stopColor="rgba(255,255,255,0.2)" />
            <stop offset="40%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>

          {/* Liquid */}
          <linearGradient id={`${id}-liq`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={resolvedColor} stopOpacity="0.55" />
            <stop offset="25%" stopColor={resolvedColor} stopOpacity="0.85" />
            <stop offset="75%" stopColor={resolvedColor} stopOpacity="0.75" />
            <stop offset="100%" stopColor={resolvedColor} stopOpacity="0.4" />
          </linearGradient>

          {/* Needle */}
          <linearGradient id={`${id}-ndl`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a1a1aa" />
            <stop offset="35%" stopColor="#e4e4e7" />
            <stop offset="50%" stopColor="#fafafa" />
            <stop offset="65%" stopColor="#e4e4e7" />
            <stop offset="100%" stopColor="#a1a1aa" />
          </linearGradient>

          {/* Rubber piston */}
          <linearGradient id={`${id}-rub`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#52525b" />
            <stop offset="30%" stopColor="#71717a" />
            <stop offset="50%" stopColor="#a1a1aa" />
            <stop offset="70%" stopColor="#71717a" />
            <stop offset="100%" stopColor="#52525b" />
          </linearGradient>

          {/* Rod */}
          <linearGradient id={`${id}-rod`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#d4d4d8" />
            <stop offset="30%" stopColor="#e4e4e7" />
            <stop offset="50%" stopColor="#f4f4f5" />
            <stop offset="70%" stopColor="#e4e4e7" />
            <stop offset="100%" stopColor="#d4d4d8" />
          </linearGradient>

          <clipPath id={`${id}-clip`}>
            <rect x={barrelLeft} y={barrelTop} width={barrelW} height={barrelH} rx="5" />
          </clipPath>

          <filter id={`${id}-gl`}>
            <feGaussianBlur stdDeviation="1.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ── NEEDLE ── */}
        <rect x={cx - 0.7} y="6" width="1.4" height="42" fill={`url(#${id}-ndl)`} />
        <polygon points={`${cx - 1},6 ${cx},0 ${cx + 1},6`} fill="#d4d4d8" />
        {/* Luer hub */}
        <rect x={cx - 5} y="46" width="10" height="7" rx="2" fill="#d4d4d8" />
        <rect x={cx - 4} y="47" width="8" height="2" rx="1" fill="rgba(255,255,255,0.5)" />
        <rect x={cx - 7} y="55" width="14" height="10" rx="3" fill="#a1a1aa" />
        <rect x={cx - 6} y="56" width="12" height="2" rx="1" fill="rgba(255,255,255,0.35)" />

        {/* ── BARREL ── visible glass cylinder */}
        <rect x={barrelLeft} y={barrelTop} width={barrelW} height={barrelH} rx="5"
          fill={`url(#${id}-glass)`} stroke="rgba(161,161,170,0.5)" strokeWidth="0.6" />

        {/* Barrel contents (clipped) */}
        <g clipPath={`url(#${id}-clip)`}>
          {/* Liquid between top and piston */}
          {liquidH > 0 && (
            <rect x={barrelLeft} y={barrelTop} width={barrelW} height={liquidH}
              fill={`url(#${id}-liq)`} filter={`url(#${id}-gl)`} className={trans} />
          )}
          {/* Meniscus highlight */}
          {liquidH > 3 && (
            <rect x={barrelLeft + 3} y={pistonY - 2} width={barrelW - 6} height="2"
              fill="rgba(255,255,255,0.35)" rx="1" className={trans} />
          )}
          {/* Bubbles */}
          {percentage > 10 && (
            <g className={trans}>
              <circle cx={cx - 5} cy={barrelTop + liquidH * 0.25} r="1.3" fill="rgba(255,255,255,0.5)" className="syr-b1" />
              <circle cx={cx + 6} cy={barrelTop + liquidH * 0.5} r="0.9" fill="rgba(255,255,255,0.4)" className="syr-b2" />
              <circle cx={cx - 2} cy={barrelTop + liquidH * 0.12} r="0.6" fill="rgba(255,255,255,0.3)" className="syr-b3" />
            </g>
          )}
          {/* Piston rubber stopper */}
          <rect x={barrelLeft + 1} y={pistonY} width={barrelW - 2} height="7" rx="2"
            fill={`url(#${id}-rub)`} className={trans} />
          <line x1={barrelLeft + 3} y1={pistonY + 2.5} x2={barrelRight - 3} y2={pistonY + 2.5}
            stroke="rgba(0,0,0,0.25)" strokeWidth="0.4" className={trans} />
          <line x1={barrelLeft + 3} y1={pistonY + 4.5} x2={barrelRight - 3} y2={pistonY + 4.5}
            stroke="rgba(0,0,0,0.15)" strokeWidth="0.4" className={trans} />
        </g>

        {/* Plunger rod */}
        <rect x={cx - 2.5} y={pistonY + 7} width="5" height={svgH - pistonY}
          fill={`url(#${id}-rod)`} className={trans} />
        <rect x={cx - 0.4} y={pistonY + 7} width="0.8" height={svgH - pistonY}
          fill="rgba(255,255,255,0.4)" className={trans} />

        {/* Graduation marks — on the right side of barrel */}
        {ticks.map(({ y, label, major }) => (
          <g key={y}>
            <line x1={barrelRight + 1} y1={y} x2={barrelRight + (major ? 8 : 4)} y2={y}
              stroke="rgba(100,100,120,0.6)" strokeWidth={major ? "0.8" : "0.4"} />
            {major && (
              <text x={barrelRight + 10} y={y + 2.5} fill="rgba(200,200,220,0.7)"
                fontSize="6" fontWeight="600" fontFamily="system-ui">{label}</text>
            )}
          </g>
        ))}

        {/* Glass shine overlay */}
        <rect x={barrelLeft} y={barrelTop} width={barrelW} height={barrelH} rx="5"
          fill={`url(#${id}-shine)`} pointerEvents="none" />

        {/* Finger flanges */}
        <rect x={barrelLeft - 6} y={barrelBottom} width={barrelW + 12} height="4" rx="2" fill="#d4d4d8" />
        <rect x={barrelLeft - 4} y={barrelBottom + 0.5} width={barrelW + 8} height="1.2" rx="0.6" fill="rgba(255,255,255,0.5)" />

        {/* Thumb pad */}
        <g className={trans}>
          <rect x={cx - 12} y={Math.min(pistonY + 90, svgH - 14)} width="24" height="4" rx="2" fill="#d4d4d8" />
          <rect x={cx - 10} y={Math.min(pistonY + 91, svgH - 13)} width="20" height="1.2" rx="0.6" fill="rgba(255,255,255,0.5)" />
        </g>
      </svg>

      <style>{`
        @keyframes syr-bubble { 0%{transform:translateY(0);opacity:0} 50%{opacity:1} 100%{transform:translateY(-6px);opacity:0} }
        .syr-b1{animation:syr-bubble 3s infinite ease-in-out}
        .syr-b2{animation:syr-bubble 4s infinite ease-in-out;animation-delay:1s}
        .syr-b3{animation:syr-bubble 2.5s infinite ease-in-out;animation-delay:2s}
      `}</style>
    </div>
  );
};

export default SyringeSlider;
