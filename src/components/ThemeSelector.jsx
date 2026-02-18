import { useMemo } from "react";

const ThemeSelector = ({ themes, currentTheme, onSelect }) => {
  const sortedThemes = useMemo(() => {
    const light = themes.filter((t) => !t.isDark).sort((a, b) => a.name.localeCompare(b.name));
    const dark = themes.filter((t) => t.isDark).sort((a, b) => a.name.localeCompare(b.name));
    return [...light, ...dark];
  }, [themes]);

  return (
    <div className="grid grid-cols-2 gap-4">
      {sortedThemes.map((theme) => {
        const isSelected = currentTheme.name === theme.name;
        const isDark = theme.isDark;
        
        // Colors for schematic
        const imColor = theme.subtypeColors?.im || (isDark ? "#BA68C8" : "#a855f7");
        const ivColor = theme.subtypeColors?.iv || (isDark ? "#4FC3F7" : "#3b82f6");
        const btnBg = theme.addButton?.bg || (isDark ? "#FFFFFF" : (theme.accentPrimary || theme.accentAH));
        const border = theme.border || "rgba(255,255,255,0.1)";

        return (
          <button
            key={theme.name}
            type="button"
            onClick={() => onSelect(theme)}
            className={`flex flex-col rounded-2xl border p-2 text-left transition-all duration-300 ${
              isSelected 
                ? 'border-[var(--success-color)] ring-2 ring-[var(--success-color)] ring-opacity-20 scale-[1.02] shadow-xl' 
                : 'border-[var(--border)] bg-black/5 hover:bg-black/10 hover:-translate-y-1'
            }`}
          >
            {/* Canvas Preview */}
            <div
              className="relative aspect-[1/1.1] w-full rounded-xl overflow-hidden flex flex-col items-center justify-center p-2 shadow-inner"
              style={{
                background: `linear-gradient(135deg, ${theme.backgroundGradient[0]}, ${theme.backgroundGradient[1]})`
              }}
            >
              {/* Cards Row */}
              <div className="flex gap-1.5 mb-2 items-center w-full justify-center">
                {/* Left Syringe (IM) */}
                <div className="w-1.5 h-10 rounded-full border border-opacity-30" 
                     style={{ background: imColor, borderColor: border }} />
                
                {/* AH Card */}
                <div className="w-14 h-16 rounded-md border border-opacity-30 flex flex-col p-1"
                     style={{ 
                       background: `linear-gradient(145deg, ${theme.cardBackground[0]}, ${theme.cardBackground[1]})`,
                       borderColor: border
                     }}>
                  <div className="h-2.5 w-full rounded-sm mb-1" style={{ background: theme.accentAH }} />
                  <div className="h-0.5 w-8/12 rounded-full mb-0.5" style={{ background: theme.textPrimary }} />
                  <div className="h-0.5 w-5/12 rounded-full opacity-60" style={{ background: theme.textSecondary }} />
                  <div className="mt-auto h-3 w-full rounded-sm" style={{ background: btnBg }} />
                </div>

                {/* EI Card */}
                <div className="w-14 h-16 rounded-md border border-opacity-30 flex flex-col p-1"
                     style={{ 
                       background: `linear-gradient(145deg, ${theme.cardBackground[0]}, ${theme.cardBackground[1]})`,
                       borderColor: border
                     }}>
                  <div className="h-2.5 w-full rounded-sm mb-1" style={{ background: theme.accentEI }} />
                  <div className="h-0.5 w-8/12 rounded-full mb-0.5" style={{ background: theme.textPrimary }} />
                  <div className="h-0.5 w-5/12 rounded-full opacity-60" style={{ background: theme.textSecondary }} />
                  <div className="mt-auto h-3 w-full rounded-sm" style={{ background: btnBg }} />
                </div>

                {/* Right Syringe (IV) */}
                <div className="w-1.5 h-10 rounded-full border border-opacity-30" 
                     style={{ background: ivColor, borderColor: border }} />
              </div>

              {/* Timeline Preview */}
              <div className="w-32 h-12 rounded-lg border border-opacity-30 relative flex justify-center overflow-hidden"
                   style={{ 
                     background: `linear-gradient(135deg, ${theme.timelineBackground[0]}, ${theme.timelineBackground[1]})`,
                     borderColor: border
                   }}>
                <div className="absolute left-1/2 top-0 bottom-0 w-[1px]" style={{ background: theme.timelineLine }} />
                <div className="absolute right-[55%] top-3 w-6 h-3 rounded-sm" style={{ background: theme.accentAH }} />
                <div className="absolute left-[55%] top-7 w-6 h-3 rounded-sm" style={{ background: theme.accentEI }} />
              </div>
            </div>

            {/* Title & Status */}
            <div className="mt-2 px-1 flex items-center justify-between w-full">
              <span className="text-[10px] font-black uppercase tracking-wider truncate max-w-[80%]" 
                    style={{ color: isSelected ? 'var(--success-color)' : 'var(--text-primary)' }}>
                {theme.name}
              </span>
              {isSelected && (
                <div className="w-4 h-4 rounded-full bg-[var(--success-color)] flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" className="w-2.5 h-2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default ThemeSelector;
