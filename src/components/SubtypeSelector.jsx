import { FaPills } from 'react-icons/fa6';

const SUBTYPE_CSS_COLOR = {
  IV: 'var(--subtype-iv)',
  IM: 'var(--subtype-im)',
  PO: 'var(--subtype-po)',
  'IV+PO': 'var(--subtype-ivpo)',
  VTRK: 'var(--subtype-vtrk)'
};

const hexToRgba = (hex, alpha) => {
  if (!hex || typeof hex !== 'string') return `rgba(0,0,0,${alpha})`;
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (full.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getComputedCssColor = (cssVar) => {
  if (typeof window === 'undefined') return null;
  try {
    const root = document.documentElement;
    const computed = getComputedStyle(root).getPropertyValue(cssVar.replace('var(', '').replace(')', '')).trim();
    return computed || null;
  } catch {
    return null;
  }
};

const SubtypeSelector = ({ value, onChange, options }) => {
  return (
    <div
      className="flex items-center gap-1.5 overflow-x-auto py-1.5 px-1 rounded-xl scrollbar-hide"
      style={{
        background: 'var(--subtype-panel-bg)',
        border: '1px solid var(--subtype-panel-border)',
        WebkitOverflowScrolling: 'touch',
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
      }}
    >
      {options.map((option) => {
        const isActive = value === option.value;
        const Icon = option.icon;
        const cssColor = SUBTYPE_CSS_COLOR[option.value] || 'var(--text-secondary)';
        const computedHex = getComputedCssColor(cssColor);
        const glow = computedHex ? `0 0 8px ${hexToRgba(computedHex, 0.3)}` : 'none';
        const chipBg = computedHex
          ? `linear-gradient(135deg, ${hexToRgba(computedHex, 0.2)}, ${hexToRgba(computedHex, 0.06)})`
          : 'var(--surface)';

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg transition-all whitespace-nowrap shrink-0"
            style={
              isActive
                ? { borderColor: cssColor, background: chipBg, boxShadow: glow, color: cssColor, border: `1px solid ${computedHex || 'var(--border)'}` }
                : {
                  border: '1px solid transparent',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  opacity: 0.5,
                }
            }
          >
            <Icon className="text-xs" />
            {option.value === 'IV+PO' && <FaPills className="text-[7px]" />}
            <span className="text-[10px] font-bold">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default SubtypeSelector;
