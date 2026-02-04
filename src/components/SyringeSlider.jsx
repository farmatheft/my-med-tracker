import React, { useRef, useEffect, useState } from 'react';

const SyringeSlider = ({ value, max, min = 0, step = 1, onChange, color = '#22c55e', className = '' }) => {
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const percentage = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);

  const handleMove = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // Use a defined area for interaction to match the barrel visually
    const startX = rect.left + rect.width * 0.15;
    const endX = rect.left + rect.width * 0.75;
    const width = endX - startX;
    
    let pos = (clientX - startX) / width;
    pos = Math.min(Math.max(pos, 0), 1);
    
    const rawValue = min + pos * (max - min);
    const steppedValue = Math.round(rawValue / step) * step;
    // Fix floating point precision issues (e.g. 0.30000000000000004)
    const cleanValue = Number(steppedValue.toFixed(step < 1 ? 1 : 0));
    
    onChange(Math.min(Math.max(cleanValue, min), max));
  };

  const onMouseDown = (e) => {
    setIsDragging(true);
    handleMove(e.clientX);
  };

  const onTouchStart = (e) => {
    setIsDragging(true);
    handleMove(e.touches[0].clientX);
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (isDragging) handleMove(e.clientX);
    };
    const onTouchMove = (e) => {
      if (isDragging) handleMove(e.touches[0].clientX);
    };
    const onEnd = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('touchend', onEnd);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [isDragging]);

  // Barrel coordinates
  const barrelStart = 50;
  const barrelEnd = 250;
  const barrelWidth = barrelEnd - barrelStart;
  const liquidWidth = (percentage / 100) * barrelWidth;
  const plungerPos = barrelStart + liquidWidth;

  // We use transition-all with duration-300 or 500 for a smooth reset/movement animation
  const transitionClass = isDragging ? "transition-none" : "transition-all duration-500 ease-in-out";

  return (
    <div className={`syringe-wrapper w-full flex flex-col ${className}`}>
      <div 
        ref={containerRef}
        className="syringe-container w-full h-16 relative flex items-center justify-center cursor-pointer select-none"
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        <svg viewBox="0 0 350 100" className="w-full h-full drop-shadow-md">
        {/* Needle */}
        <line x1="10" y1="50" x2="50" y2="50" stroke="#94a3b8" strokeWidth="2" />
        
        {/* Barrel Tip */}
        <path d="M40 40 L50 35 L50 65 L40 60 Z" fill="#e2e8f0" />

        {/* Liquid background (empty barrel) */}
        <rect x={barrelStart} y="35" width={barrelWidth} height="30" fill="#f8fafc" rx="2" stroke="#e2e8f0" strokeWidth="1" />

        {/* Liquid Layer */}
        <rect 
          x={barrelStart} 
          y="36" 
          width={liquidWidth} 
          height="28" 
          fill={color} 
          className={`${transitionClass} liquid-wave`}
          style={{ opacity: 0.8 }}
        />

        {/* Bubbles - appear as plunger moves out */}
        {percentage > 2 && (
          <g className={`bubbles ${transitionClass}`} style={{ transform: `scaleX(${percentage/100})` }}>
            <circle cx={barrelStart + (barrelWidth * 0.1)} cy="45" r="2.5" fill="white" className="bubble-anim bubble-delay-1" style={{ opacity: 0.6 }} />
            <circle cx={barrelStart + (barrelWidth * 0.3)} cy="55" r="1.5" fill="white" className="bubble-anim bubble-delay-2" style={{ opacity: 0.6 }} />
            <circle cx={barrelStart + (barrelWidth * 0.45)} cy="48" r="2" fill="white" className="bubble-anim bubble-delay-3" style={{ opacity: 0.6 }} />
          </g>
        )}

        {/* Barrel Graduations */}
        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(p => {
          const x = barrelStart + (p / 100) * barrelWidth;
          const isMajor = p % 50 === 0;
          return (
            <line key={p} x1={x} y1="35" x2={x} y2={isMajor ? "48" : "42"} stroke="#cbd5e1" strokeWidth="1" />
          );
        })}

        {/* Plunger Rod */}
        <rect 
          x={plungerPos} 
          y="45" 
          width={barrelWidth} 
          height="10" 
          fill="#cbd5e1" 
          className={transitionClass}
        />

        {/* Plunger Head (Inside Barrel) */}
        <rect 
          x={plungerPos - 4} 
          y="36" 
          width="8" 
          height="28" 
          fill="#64748b" 
          rx="1"
          className={transitionClass}
        />

        {/* Plunger Handle (Interactive part) */}
        <g className={transitionClass} style={{ transform: `translateX(${liquidWidth}px)` }}>
          {/* Vertical handle plate */}
          <rect x={barrelStart + barrelWidth} y="25" width="8" height="50" fill="#94a3b8" rx="2" />
          {/* Grip ring */}
          <circle cx={barrelStart + barrelWidth + 4} cy="50" r="18" fill="white" stroke="#e2e8f0" strokeWidth="2" />
          <circle cx={barrelStart + barrelWidth + 4} cy="50" r="6" fill="#cbd5e1" />
          
          {/* Visual indicator of dragging */}
          {isDragging && <circle cx={barrelStart + barrelWidth + 4} cy="50" r="22" fill={color} style={{ opacity: 0.1 }} />}
        </g>

        {/* Scale Numbers */}
        <text x={barrelStart} y="85" fontSize="10" fontWeight="bold" fill="#94a3b8" textAnchor="middle">{min}</text>
        <text x={barrelEnd} y="85" fontSize="10" fontWeight="bold" fill="#94a3b8" textAnchor="middle">{max}</text>
      </svg>
      </div>

      {/* Control Slider */}
      {/* <div className="slider-control w-full px-2 mt-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="slider-input w-full h-2 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${color} 0%, ${color} ${percentage}%, #e2e8f0 ${percentage}%, #e2e8f0 100%)`
          }}
        />
      </div> */}
      <style>{`
        @keyframes bubble-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        .bubble-anim {
          animation: bubble-float 3s ease-in-out infinite;
        }
        .bubble-delay-1 { animation-delay: 0s; }
        .bubble-delay-2 { animation-delay: 1s; }
        .bubble-delay-3 { animation-delay: 2s; }

        /* Slider styling */
        .slider-input::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${color};
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
          border: 2px solid white;
        }
        .slider-input::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${color};
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
          border: 2px solid white;
        }
        .slider-input::-webkit-slider-runnable-track {
          height: 8px;
          border-radius: 4px;
        }
        .slider-input::-moz-range-track {
          height: 8px;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default SyringeSlider;
