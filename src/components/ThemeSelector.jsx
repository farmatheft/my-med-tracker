import { useMemo } from "react";

/* ── Inline SVG textures for premium themes ───────────────────────────────── */
const TEXTURES = {
  "crosshatch-gold": `
    <svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'>
      <line x1='0' y1='0' x2='24' y2='24' stroke='rgba(212,165,32,0.12)' stroke-width='0.6'/>
      <line x1='24' y1='0' x2='0' y2='24' stroke='rgba(212,165,32,0.12)' stroke-width='0.6'/>
    </svg>`,
  "aurora-waves": `
    <svg xmlns='http://www.w3.org/2000/svg' width='60' height='30'>
      <path d='M0 15 Q15 5 30 15 Q45 25 60 15' fill='none' stroke='rgba(0,229,255,0.08)' stroke-width='1'/>
      <path d='M0 20 Q15 10 30 20 Q45 30 60 20' fill='none' stroke='rgba(124,58,237,0.06)' stroke-width='1'/>
    </svg>`,
  "carbon-fiber": `
    <svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'>
      <rect width='4' height='4' fill='rgba(255,45,85,0.07)'/>
      <rect x='4' y='4' width='4' height='4' fill='rgba(255,45,85,0.07)'/>
      <rect x='4' y='0' width='4' height='4' fill='rgba(255,255,255,0.02)'/>
      <rect x='0' y='4' width='4' height='4' fill='rgba(255,255,255,0.02)'/>
    </svg>`,
  "petals": `
    <svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'>
      <circle cx='20' cy='20' r='8' fill='none' stroke='rgba(232,67,122,0.08)' stroke-width='0.8'/>
      <circle cx='0' cy='0' r='8' fill='none' stroke='rgba(192,38,160,0.06)' stroke-width='0.8'/>
      <circle cx='40' cy='0' r='8' fill='none' stroke='rgba(192,38,160,0.06)' stroke-width='0.8'/>
      <circle cx='0' cy='40' r='8' fill='none' stroke='rgba(232,67,122,0.06)' stroke-width='0.8'/>
      <circle cx='40' cy='40' r='8' fill='none' stroke='rgba(232,67,122,0.06)' stroke-width='0.8'/>
    </svg>`,
  "crystal-grid": `
    <svg xmlns='http://www.w3.org/2000/svg' width='30' height='30'>
      <polygon points='15,2 28,9 28,21 15,28 2,21 2,9' fill='none' stroke='rgba(0,102,255,0.08)' stroke-width='0.7'/>
      <line x1='15' y1='2' x2='15' y2='28' stroke='rgba(0,170,255,0.05)' stroke-width='0.5'/>
      <line x1='2' y1='15' x2='28' y2='15' stroke='rgba(0,170,255,0.05)' stroke-width='0.5'/>
    </svg>`,
  "linen-weave": `
    <svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'>
      <line x1='0' y1='0' x2='8' y2='0' stroke='rgba(200,134,10,0.1)' stroke-width='0.6'/>
      <line x1='0' y1='4' x2='8' y2='4' stroke='rgba(200,134,10,0.06)' stroke-width='0.6'/>
      <line x1='0' y1='0' x2='0' y2='8' stroke='rgba(200,134,10,0.08)' stroke-width='0.6'/>
      <line x1='4' y1='0' x2='4' y2='8' stroke='rgba(200,134,10,0.05)' stroke-width='0.6'/>
    </svg>`,
};

function getTextureCss(textureKey) {
  if (!textureKey || !TEXTURES[textureKey]) return null;
  const svg = TEXTURES[textureKey].trim().replace(/\n\s+/g, " ");
  const encoded = encodeURIComponent(svg);
  return `url("data:image/svg+xml,${encoded}")`;
}

const ThemeSelector = ({ themes, currentTheme, onSelect }) => {
  const { lightThemes, darkThemes } = useMemo(() => {
    return {
      lightThemes: themes
        .filter((t) => !t.isDark)
        .sort((a, b) => {
          // premium themes go first within their section
          const ap = a.isPremium ? 0 : 1;
          const bp = b.isPremium ? 0 : 1;
          return ap !== bp ? ap - bp : a.name.localeCompare(b.name);
        }),
      darkThemes: themes
        .filter((t) => t.isDark)
        .sort((a, b) => {
          const ap = a.isPremium ? 0 : 1;
          const bp = b.isPremium ? 0 : 1;
          return ap !== bp ? ap - bp : a.name.localeCompare(b.name);
        }),
    };
  }, [themes]);

  const renderThemeCard = (theme) => {
    const isSelected = currentTheme.name === theme.name;
    const isDark     = theme.isDark;
    const isPremium  = Boolean(theme.isPremium);
    const textureCss = isPremium ? getTextureCss(theme.premiumTexture) : null;

    const imColor = theme.subtypeColors?.im || (isDark ? "#BA68C8" : "#a855f7");
    const ivColor = theme.subtypeColors?.iv || (isDark ? "#4FC3F7" : "#3b82f6");

    // Add button bg — handle linear-gradient strings from premium themes
    const rawBtnBg = theme.addButton?.bg || (isDark ? "#FFFFFF" : theme.accentPrimary || theme.accentAH);
    const btnBgIsGradient = typeof rawBtnBg === "string" && rawBtnBg.startsWith("linear-gradient");
    const btnBg = btnBgIsGradient ? rawBtnBg : rawBtnBg;

    const border = theme.border || "rgba(255,255,255,0.1)";

    // Display name: strip [$] prefix for label, keep for id
    const displayName = theme.name.replace(/^\[\$\]\s*/, "");

    return (
      <button
        key={theme.name}
        type="button"
        onClick={() => onSelect(theme)}
        className={`flex flex-col rounded-2xl border p-2 text-left transition-all duration-250 relative overflow-hidden ${
          isSelected
            ? "scale-[1.04] shadow-xl"
            : "hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]"
        }`}
        style={{
          borderColor: isSelected
            ? isPremium ? theme.accentAH : "var(--success-color)"
            : isPremium ? `${theme.accentAH}55` : "var(--border)",
          background: isSelected
            ? `linear-gradient(135deg, ${theme.backgroundGradient[0]}33, ${theme.backgroundGradient[1]}18)`
            : "transparent",
          boxShadow: isSelected
            ? `0 0 0 2px ${isPremium ? theme.accentAH : "var(--success-color)"}, 0 8px 24px var(--shadow-color)`
            : isPremium
            ? `0 2px 12px ${theme.accentAH}22`
            : undefined,
        }}
      >
        {/* Premium shimmer border */}
        {isPremium && (
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              background: `linear-gradient(135deg, ${theme.accentAH}18, transparent 40%, ${theme.accentEI}12)`,
              zIndex: 0,
            }}
          />
        )}

        {/* Canvas Preview */}
        <div
          className="relative aspect-[1/1.1] w-full rounded-xl overflow-hidden flex flex-col items-center justify-center p-2 shadow-inner z-10"
          style={{
            background: `linear-gradient(135deg, ${theme.backgroundGradient[0]}, ${theme.backgroundGradient[1]})`,
          }}
        >
          {/* SVG texture overlay */}
          {textureCss && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ backgroundImage: textureCss, backgroundRepeat: "repeat" }}
            />
          )}

          {/* Premium label badge */}
          {isPremium && (
            <div
              className="absolute top-1 right-1 px-1 py-0.5 rounded text-[7px] font-black tracking-wider z-10"
              style={{
                background: `linear-gradient(135deg, ${theme.accentAH}, ${theme.accentEI})`,
                color: isDark ? "#000" : "#fff",
                boxShadow: `0 1px 4px ${theme.accentAH}66`,
              }}
            >
              PRO
            </div>
          )}

          {/* Cards Row */}
          <div className="flex gap-1.5 mb-2 items-center w-full justify-center relative z-10">
            {/* Left accent bar (IM) */}
            <div
              className="w-1.5 h-9 rounded-full"
              style={{ background: imColor, opacity: 0.85 }}
            />

            {/* AH Card */}
            <div
              className="w-12 h-14 rounded-lg border flex flex-col p-1"
              style={{
                background: `linear-gradient(145deg, ${theme.cardBackground[0]}, ${theme.cardBackground[1]})`,
                borderColor: border,
              }}
            >
              <div className="h-2 w-full rounded-sm mb-1" style={{ background: theme.accentAH }} />
              <div
                className="h-px w-8/12 rounded-full mb-0.5"
                style={{ background: theme.textPrimary, opacity: 0.8 }}
              />
              <div
                className="h-px w-5/12 rounded-full"
                style={{ background: theme.textSecondary, opacity: 0.5 }}
              />
              <div
                className="mt-auto h-2.5 w-full rounded-sm"
                style={{ background: btnBgIsGradient ? theme.accentAH : btnBg, opacity: 0.9 }}
              />
            </div>

            {/* EI Card */}
            <div
              className="w-12 h-14 rounded-lg border flex flex-col p-1"
              style={{
                background: `linear-gradient(145deg, ${theme.cardBackground[0]}, ${theme.cardBackground[1]})`,
                borderColor: border,
              }}
            >
              <div className="h-2 w-full rounded-sm mb-1" style={{ background: theme.accentEI }} />
              <div
                className="h-px w-8/12 rounded-full mb-0.5"
                style={{ background: theme.textPrimary, opacity: 0.8 }}
              />
              <div
                className="h-px w-5/12 rounded-full"
                style={{ background: theme.textSecondary, opacity: 0.5 }}
              />
              <div
                className="mt-auto h-2.5 w-full rounded-sm"
                style={{ background: btnBgIsGradient ? theme.accentEI : btnBg, opacity: 0.9 }}
              />
            </div>

            {/* Right accent bar (IV) */}
            <div
              className="w-1.5 h-9 rounded-full"
              style={{ background: ivColor, opacity: 0.85 }}
            />
          </div>

          {/* Timeline Preview */}
          <div
            className="w-28 h-10 rounded-lg relative flex justify-center overflow-hidden z-10"
            style={{
              background: `linear-gradient(135deg, ${theme.timelineBackground[0]}, ${theme.timelineBackground[1]})`,
              borderColor: border,
              border: `1px solid ${border}`,
            }}
          >
            <div
              className="absolute left-1/2 top-0 bottom-0 w-px"
              style={{ background: theme.timelineLine, opacity: 0.6 }}
            />
            <div
              className="absolute right-[52%] top-2.5 w-5 h-2.5 rounded-sm"
              style={{ background: theme.accentAH, opacity: 0.9 }}
            />
            <div
              className="absolute left-[52%] top-5 w-5 h-2.5 rounded-sm"
              style={{ background: theme.accentEI, opacity: 0.9 }}
            />
          </div>
        </div>

        {/* Title & Status */}
        <div className="mt-1.5 px-0.5 flex items-center justify-between w-full z-10 relative" style={{ minWidth: 0 }}>
          <span
            className="text-fit"
            style={{
              fontSize: 8,
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              maxWidth: "80%",
              color: isSelected
                ? isPremium ? theme.accentAH : "var(--success-color)"
                : isPremium
                ? theme.accentAH
                : "var(--text-primary)",
            }}
          >
            {displayName}
          </span>
          {isSelected ? (
            <div
              className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: isPremium ? theme.accentAH : "var(--success-color)" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" className="w-2 h-2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          ) : isPremium ? (
            <span
              className="text-[8px] font-black"
              style={{ color: theme.accentAH }}
            >
              $
            </span>
          ) : null}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {lightThemes.length > 0 && (
        <div>
          <div className="flex items-center" style={{ gap: 10, marginBottom: 10 }}>
            <h5 style={{ fontSize: 9, fontWeight: 900, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.3em" }}>
              Light
            </h5>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span style={{ fontSize: 9, color: "var(--text-secondary)", opacity: 0.5 }}>
              {lightThemes.length}
            </span>
          </div>
          <div className="grid grid-cols-3" style={{ gap: 10 }}>
            {lightThemes.map(renderThemeCard)}
          </div>
        </div>
      )}

      {darkThemes.length > 0 && (
        <div>
          <div className="flex items-center" style={{ gap: 10, marginBottom: 10 }}>
            <h5 style={{ fontSize: 9, fontWeight: 900, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.3em" }}>
              Dark
            </h5>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span style={{ fontSize: 9, color: "var(--text-secondary)", opacity: 0.5 }}>
              {darkThemes.length}
            </span>
          </div>
          <div className="grid grid-cols-3" style={{ gap: 10 }}>
            {darkThemes.map(renderThemeCard)}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeSelector;
