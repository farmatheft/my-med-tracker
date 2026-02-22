import { useState, useEffect, useCallback } from "react";
import Notification from "./components/Notification";
import ThemeSelector from "./components/ThemeSelector";
import IntakeDetailsModal from "./components/IntakeDetailsModal";
import IntakePanel from "./components/IntakePanel";
import TimelineHistory from "./components/TimelineHistory";
import Statistics from "./components/Statistics";
import { TIMELINE_TITLE_DEFAULT } from "./utils/time";

// --- THEME LOADING ---
const themeModules = import.meta.glob("./themes/*.json", { eager: true });
const themes = Object.values(themeModules).map((m) => m.default);

// Apply theme CSS variables synchronously to avoid flash
function applyTheme(theme) {
  const root = document.documentElement;
  const isDark = Boolean(theme.isDark);

  root.style.setProperty("--bg-gradient-start", theme.backgroundGradient[0]);
  root.style.setProperty("--bg-gradient-end", theme.backgroundGradient[1]);
  root.style.setProperty("--card-bg-start", theme.cardBackground[0]);
  root.style.setProperty("--card-bg-end", theme.cardBackground[1]);
  root.style.setProperty("--text-primary", theme.textPrimary);
  root.style.setProperty("--text-secondary", theme.textSecondary);
  root.style.setProperty("--accent-ah", theme.accentAH);
  root.style.setProperty("--accent-ei", theme.accentEI);
  root.style.setProperty(
    "--accent-primary",
    theme.accentPrimary || theme.accentAH,
  );
  root.style.setProperty("--border", theme.border);
  root.style.setProperty("--timeline-line", theme.timelineLine);
  root.style.setProperty("--marker-color", theme.markerColor);
  root.style.setProperty("--timeline-bg-start", theme.timelineBackground[0]);
  root.style.setProperty("--timeline-bg-end", theme.timelineBackground[1]);
  root.style.setProperty(
    "--timeline-bg-alt-start",
    theme.timelineSecondaryBackground[0],
  );
  root.style.setProperty(
    "--timeline-bg-alt-end",
    theme.timelineSecondaryBackground[1],
  );
  root.style.setProperty("--success-color", theme.success);

  root.style.setProperty(
    "--glow-light",
    isDark ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.2)",
  );
  root.style.setProperty(
    "--glow-dark",
    isDark ? "rgba(255, 255, 255, 0.35)" : "rgba(0, 0, 0, 0.15)",
  );

  root.style.setProperty("--header-gradient-ah-start", theme.accentAH);
  root.style.setProperty(
    "--header-gradient-ah-end",
    isDark ? theme.accentAH : "rgba(255,255,255,0.3)",
  );
  root.style.setProperty("--header-gradient-ei-start", theme.accentEI);
  root.style.setProperty(
    "--header-gradient-ei-end",
    isDark ? theme.accentEI : "rgba(255,255,255,0.3)",
  );

  root.style.setProperty(
    "--surface",
    isDark ? "rgba(15, 23, 42, 0.66)" : "rgba(255, 255, 255, 0.96)",
  );
  root.style.setProperty(
    "--surface-2",
    isDark ? "rgba(2, 6, 23, 0.55)" : "rgba(248, 250, 252, 0.98)",
  );
  root.style.setProperty(
    "--shadow-color",
    isDark ? "rgba(0, 0, 0, 0.55)" : "rgba(15, 23, 42, 0.18)",
  );
  root.style.setProperty(
    "--shadow-color-strong",
    isDark ? "rgba(0, 0, 0, 0.72)" : "rgba(15, 23, 42, 0.28)",
  );
  root.style.setProperty(
    "--header-overlay",
    isDark ? "rgba(0, 0, 0, 0.70)" : "rgba(2, 6, 23, 0.70)",
  );
  root.style.setProperty(
    "--action-bg",
    isDark ? "rgba(0, 0, 0, 0.78)" : "rgba(0, 0, 0, 0.82)",
  );
  root.style.setProperty(
    "--action-border",
    isDark ? "rgba(255, 255, 255, 0.10)" : "rgba(255, 255, 255, 0.12)",
  );

  const subtype = theme.subtypeColors || {};
  root.style.setProperty(
    "--subtype-iv",
    subtype.iv || (isDark ? "#4FC3F7" : "#3b82f6"),
  );
  root.style.setProperty(
    "--subtype-im",
    subtype.im || (isDark ? "#BA68C8" : "#a855f7"),
  );
  root.style.setProperty(
    "--subtype-po",
    subtype.po || (isDark ? "#FFB74D" : "#f59e0b"),
  );
  root.style.setProperty(
    "--subtype-ivpo",
    subtype.ivpo || (isDark ? "#81C784" : "#22c55e"),
  );
  root.style.setProperty(
    "--subtype-vtrk",
    subtype.vtrk || (isDark ? "#FACC15" : "#FACC15"),
  );

  const subtypePanel = theme.subtypePanel || {};
  root.style.setProperty(
    "--subtype-panel-bg",
    subtypePanel.bg ||
      (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
  );
  root.style.setProperty(
    "--subtype-panel-border",
    subtypePanel.border ||
      (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"),
  );

  const addButton = theme.addButton || {};
  // addButton.bg can be a plain color or a CSS gradient string
  root.style.setProperty(
    "--add-btn-bg",
    addButton.bg || (isDark ? "#FFFFFF" : "var(--accent-primary)"),
  );
  root.style.setProperty(
    "--add-btn-text",
    addButton.text || (isDark ? "var(--accent-primary)" : "#FFFFFF"),
  );
  root.style.setProperty(
    "--add-btn-border",
    addButton.border ||
      (isDark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.12)"),
  );
  root.style.setProperty(
    "--add-btn-glow",
    addButton.glow || (isDark ? "var(--accent-primary)" : "rgba(0,0,0,0.3)"),
  );

  // Premium texture key (SVG pattern rendered in App)
  root.style.setProperty("--premium-texture-key", theme.premiumTexture ? `"${theme.premiumTexture}"` : "none");
  root.setAttribute("data-premium-texture", theme.premiumTexture || "");

  const gradientHeader = theme.gradientHeader || {};
  root.style.setProperty(
    "--gradient-header-overlay",
    gradientHeader.overlay ||
      (isDark ? "rgba(0, 0, 0, 0.5)" : "rgba(255, 255, 255, 0.5)"),
  );
  root.style.setProperty(
    "--gradient-header-text",
    gradientHeader.textColor || (isDark ? "#FFFFFF" : "#1A1A1A"),
  );

  // Update meta theme-color for Android
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute("content", theme.backgroundGradient[0]);
  } else {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = theme.backgroundGradient[0];
    document.head.appendChild(meta);
  }
}

// Apply saved theme immediately (before React renders) to prevent flash
const savedThemeName = localStorage.getItem("theme");
const initialTheme =
  themes.find((t) => t.name === savedThemeName) || themes[0];
applyTheme(initialTheme);

// Active view/page enum
const VIEW = {
  MAIN: "main",
  STATISTICS: "statistics",
  THEME_SELECTOR: "theme_selector",
};

export default function App() {
  const [currentTheme, setCurrentTheme] = useState(initialTheme);
  const [notification, setNotification] = useState(null);
  const [timelineHeading, setTimelineHeading] = useState(
    TIMELINE_TITLE_DEFAULT,
  );
  const [activeView, setActiveView] = useState(VIEW.MAIN);
  const [prevView, setPrevView] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedIntakeId, setSelectedIntakeId] = useState(null);
  const [activeIntake, setActiveIntake] = useState(null);

  // Apply theme whenever it changes (also persists to localStorage)
  useEffect(() => {
    applyTheme(currentTheme);
    localStorage.setItem("theme", currentTheme.name);
  }, [currentTheme]);

  const navigateTo = useCallback((view) => {
    setPrevView((prev) => prev);
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveView(view);
      setIsTransitioning(false);
    }, 120);
  }, []);

  const handleSelectIntake = (intake) => {
    if (!intake) {
      setSelectedIntakeId(null);
      setActiveIntake(null);
      return;
    }
    setSelectedIntakeId(intake.id);
    setActiveIntake(intake);
  };

  const handleSelectTheme = (theme) => {
    setCurrentTheme(theme);
    navigateTo(VIEW.MAIN);
  };

  // Determine page entry animation class
  const getPageAnimation = (view) => {
    if (view === VIEW.STATISTICS) return "page-enter-right";
    if (view === VIEW.THEME_SELECTOR) return "page-enter-left";
    return "page-enter-left";
  };

  return (
    <div
      className="h-screen w-screen overflow-y-auto overflow-x-hidden flex flex-col relative"
      style={{
        background: `linear-gradient(135deg, var(--bg-gradient-start), var(--bg-gradient-end))`,
        transition: "background 0.5s ease",
      }}
    >
      {/* Background ambient light */}
      <div 
        className="absolute inset-0 pointer-events-none z-[-2]"
        style={{
          background: `
            radial-gradient(circle at top right, var(--accent-ei) 0%, transparent 40%),
            radial-gradient(circle at bottom left, var(--accent-ah) 0%, transparent 40%)
          `,
          opacity: currentTheme?.isDark ? 0.15 : 0.08,
          mixBlendMode: currentTheme?.isDark ? 'screen' : 'normal'
        }}
      />
      {/* Background noise grid */}
      <div 
        className="absolute inset-0 pointer-events-none z-[-1]"
        style={{
          background: `
            linear-gradient(var(--text-primary) 1px, transparent 1px),
            linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)
          `,
          backgroundSize: '30px 30px',
          opacity: currentTheme?.isDark ? 0.03 : 0.04,
          mixBlendMode: currentTheme?.isDark ? 'screen' : 'multiply'
        }}
      />
      {/* Premium theme texture overlay */}
      {currentTheme?.isPremium && currentTheme?.premiumTexture && (
        <PremiumTextureOverlay textureKey={currentTheme.premiumTexture} isDark={currentTheme.isDark} />
      )}

      {notification && (
        <Notification
          message={notification}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Header */}
      <header className="p-3 flex justify-between items-center flex-shrink-0">
        <button
          type="button"
          onClick={() =>
            navigateTo(
              activeView === VIEW.STATISTICS ? VIEW.MAIN : VIEW.STATISTICS,
            )
          }
          className="w-10 h-10 rounded-full border border-[var(--border)] text-[var(--text-primary)] shadow-md hover:scale-105 transition-transform flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))",
            boxShadow:
              activeView === VIEW.STATISTICS
                ? "0 0 0 2px var(--accent-primary)"
                : undefined,
          }}
          aria-label={
            activeView === VIEW.STATISTICS ? "Show main view" : "Show statistics"
          }
        >
          {activeView === VIEW.STATISTICS ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="M3 3v18h18" />
              <path d="M18 9l-5 5-4-4-3 3" />
            </svg>
          )}
        </button>

        {/* Center: App title (visible on main view) */}
        <div className="flex items-center gap-2">
          {activeView === VIEW.MAIN && (
            <span
              className="text-xs font-black uppercase tracking-widest opacity-50"
              style={{ color: "var(--text-primary)" }}
            >
              Med Tracker
            </span>
          )}
          {activeView === VIEW.STATISTICS && (
            <span
              className="text-xs font-black uppercase tracking-widest opacity-70"
              style={{ color: "var(--text-primary)" }}
            >
              Statistics
            </span>
          )}
          {activeView === VIEW.THEME_SELECTOR && (
            <span
              className="text-xs font-black uppercase tracking-widest opacity-70"
              style={{ color: "var(--text-primary)" }}
            >
              Theme
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            navigateTo(
              activeView === VIEW.THEME_SELECTOR
                ? VIEW.MAIN
                : VIEW.THEME_SELECTOR,
            )
          }
          className="w-10 h-10 rounded-full border border-[var(--border)] text-[var(--text-primary)] shadow-md hover:scale-105 transition-transform flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))",
            boxShadow:
              activeView === VIEW.THEME_SELECTOR
                ? "0 0 0 2px var(--accent-primary)"
                : undefined,
          }}
          aria-label={
            activeView === VIEW.THEME_SELECTOR ? "Close theme" : "Open theme settings"
          }
        >
          {activeView === VIEW.THEME_SELECTOR ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
              <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
              <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
              <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
            </svg>
          )}
        </button>
      </header>

      {/* Page transition loading overlay */}
      {isTransitioning && (
        <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center">
          <div className="flex gap-2">
            <div className="pulse-dot" />
            <div className="pulse-dot" />
            <div className="pulse-dot" />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-grow flex flex-col gap-4 max-w-3xl mx-auto w-full px-4 pb-6 min-h-0">
        {/* MAIN VIEW */}
        {activeView === VIEW.MAIN && (
          <div className="flex flex-col gap-4 flex-grow page-enter-left">
            {/* Unified intake panel — works on all screen sizes */}
            <IntakePanel onAddSuccess={setNotification} />

            <div
              className="rounded-[2.5rem] pt-6 shadow-soft-strong border border-[var(--border)] flex flex-col overflow-hidden"
              style={{
                background: "var(--surface)",
                height: "600px",
              }}
            >
              <h2 className="text-center text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">
                {timelineHeading}
              </h2>
              <TimelineHistory
                onDayChange={(label) =>
                  setTimelineHeading(label || TIMELINE_TITLE_DEFAULT)
                }
                selectedId={selectedIntakeId}
                onSelectIntake={handleSelectIntake}
              />
            </div>
          </div>
        )}

        {/* STATISTICS VIEW */}
        {activeView === VIEW.STATISTICS && (
          <div className={`flex flex-col flex-grow ${getPageAnimation(VIEW.STATISTICS)}`}>
            <Statistics onBack={() => navigateTo(VIEW.MAIN)} />
          </div>
        )}

        {/* THEME SELECTOR VIEW */}
        {activeView === VIEW.THEME_SELECTOR && (
          <div className={`flex flex-col flex-grow ${getPageAnimation(VIEW.THEME_SELECTOR)}`}>
            <ThemePage
              themes={themes}
              currentTheme={currentTheme}
              onSelect={handleSelectTheme}
              onBack={() => navigateTo(VIEW.MAIN)}
            />
          </div>
        )}
      </main>

      {activeIntake && (
        <IntakeDetailsModal
          intake={activeIntake}
          onClose={() => handleSelectIntake(null)}
        />
      )}
    </div>
  );
}

// ── Premium texture SVG overlay ──────────────────────────────────────────────
const PREMIUM_TEXTURE_CSS = {
  "crosshatch-gold":
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cline x1='0' y1='0' x2='24' y2='24' stroke='rgba(212%2C165%2C32%2C0.1)' stroke-width='0.6'/%3E%3Cline x1='24' y1='0' x2='0' y2='24' stroke='rgba(212%2C165%2C32%2C0.1)' stroke-width='0.6'/%3E%3C/svg%3E")`,
  "aurora-waves":
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='60'%3E%3Cpath d='M0 30 Q30 10 60 30 Q90 50 120 30' fill='none' stroke='rgba(0%2C229%2C255%2C0.08)' stroke-width='1.2'/%3E%3Cpath d='M0 45 Q30 25 60 45 Q90 65 120 45' fill='none' stroke='rgba(124%2C58%2C237%2C0.06)' stroke-width='1'/%3E%3Cpath d='M0 15 Q30 0 60 15 Q90 30 120 15' fill='none' stroke='rgba(0%2C229%2C255%2C0.05)' stroke-width='0.8'/%3E%3C/svg%3E")`,
  "carbon-fiber":
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='4' height='4' fill='rgba(255%2C45%2C85%2C0.07)'/%3E%3Crect x='4' y='4' width='4' height='4' fill='rgba(255%2C45%2C85%2C0.07)'/%3E%3Crect x='4' y='0' width='4' height='4' fill='rgba(255%2C255%2C255%2C0.018)'/%3E%3Crect x='0' y='4' width='4' height='4' fill='rgba(255%2C255%2C255%2C0.018)'/%3E%3C/svg%3E")`,
  "petals":
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Ccircle cx='40' cy='40' r='18' fill='none' stroke='rgba(232%2C67%2C122%2C0.08)' stroke-width='0.8'/%3E%3Ccircle cx='40' cy='40' r='34' fill='none' stroke='rgba(192%2C38%2C160%2C0.05)' stroke-width='0.6'/%3E%3Cellipse cx='40' cy='18' rx='7' ry='14' fill='rgba(232%2C67%2C122%2C0.04)' transform='rotate(0 40 40)'/%3E%3Cellipse cx='40' cy='18' rx='7' ry='14' fill='rgba(192%2C38%2C160%2C0.03)' transform='rotate(60 40 40)'/%3E%3Cellipse cx='40' cy='18' rx='7' ry='14' fill='rgba(232%2C67%2C122%2C0.03)' transform='rotate(120 40 40)'/%3E%3Cellipse cx='40' cy='18' rx='7' ry='14' fill='rgba(192%2C38%2C160%2C0.04)' transform='rotate(180 40 40)'/%3E%3Cellipse cx='40' cy='18' rx='7' ry='14' fill='rgba(232%2C67%2C122%2C0.03)' transform='rotate(240 40 40)'/%3E%3Cellipse cx='40' cy='18' rx='7' ry='14' fill='rgba(192%2C38%2C160%2C0.03)' transform='rotate(300 40 40)'/%3E%3C/svg%3E")`,
  "crystal-grid":
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpolygon points='30%2C4 56%2C18 56%2C42 30%2C56 4%2C42 4%2C18' fill='none' stroke='rgba(0%2C102%2C255%2C0.08)' stroke-width='0.8'/%3E%3Cpolygon points='30%2C14 46%2C23 46%2C37 30%2C46 14%2C37 14%2C23' fill='none' stroke='rgba(0%2C170%2C255%2C0.05)' stroke-width='0.6'/%3E%3Cline x1='30' y1='4' x2='30' y2='56' stroke='rgba(0%2C102%2C255%2C0.04)' stroke-width='0.5'/%3E%3Cline x1='4' y1='30' x2='56' y2='30' stroke='rgba(0%2C102%2C255%2C0.04)' stroke-width='0.5'/%3E%3C/svg%3E")`,
  "linen-weave":
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12'%3E%3Cline x1='0' y1='0' x2='12' y2='0' stroke='rgba(200%2C134%2C10%2C0.12)' stroke-width='0.8'/%3E%3Cline x1='0' y1='4' x2='12' y2='4' stroke='rgba(200%2C134%2C10%2C0.07)' stroke-width='0.5'/%3E%3Cline x1='0' y1='8' x2='12' y2='8' stroke='rgba(200%2C134%2C10%2C0.09)' stroke-width='0.6'/%3E%3Cline x1='0' y1='0' x2='0' y2='12' stroke='rgba(200%2C134%2C10%2C0.1)' stroke-width='0.7'/%3E%3Cline x1='4' y1='0' x2='4' y2='12' stroke='rgba(200%2C134%2C10%2C0.05)' stroke-width='0.4'/%3E%3Cline x1='8' y1='0' x2='8' y2='12' stroke='rgba(200%2C134%2C10%2C0.07)' stroke-width='0.5'/%3E%3C/svg%3E")`,

  // ── new premium textures ──────────────────────────────────────────────────
  "velvet-dots":
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Ccircle cx='10' cy='10' r='1.2' fill='rgba(192%2C132%2C252%2C0.12)'/%3E%3Ccircle cx='0' cy='0' r='0.8' fill='rgba(232%2C121%2C249%2C0.08)'/%3E%3Ccircle cx='20' cy='0' r='0.8' fill='rgba(232%2C121%2C249%2C0.08)'/%3E%3Ccircle cx='0' cy='20' r='0.8' fill='rgba(192%2C132%2C252%2C0.08)'/%3E%3Ccircle cx='20' cy='20' r='0.8' fill='rgba(192%2C132%2C252%2C0.08)'/%3E%3C/svg%3E")`,

  "ocean-waves":
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='40'%3E%3Cpath d='M0 20 Q12.5 10 25 20 Q37.5 30 50 20 Q62.5 10 75 20 Q87.5 30 100 20' fill='none' stroke='rgba(0%2C180%2C216%2C0.10)' stroke-width='1.2'/%3E%3Cpath d='M0 30 Q12.5 20 25 30 Q37.5 40 50 30 Q62.5 20 75 30 Q87.5 40 100 30' fill='none' stroke='rgba(0%2C119%2C182%2C0.07)' stroke-width='0.9'/%3E%3Cpath d='M0 10 Q12.5 0 25 10 Q37.5 20 50 10 Q62.5 0 75 10 Q87.5 20 100 10' fill='none' stroke='rgba(0%2C180%2C216%2C0.06)' stroke-width='0.7'/%3E%3C/svg%3E")`,

  "matrix-rain":
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='40'%3E%3Ctext x='2' y='14' font-size='9' fill='rgba(0%2C255%2C65%2C0.13)' font-family='monospace'%3E1%3C/text%3E%3Ctext x='2' y='28' font-size='9' fill='rgba(0%2C255%2C65%2C0.08)' font-family='monospace'%3E0%3C/text%3E%3Ctext x='11' y='20' font-size='9' fill='rgba(57%2C255%2C20%2C0.09)' font-family='monospace'%3E1%3C/text%3E%3Ctext x='11' y='36' font-size='9' fill='rgba(0%2C255%2C65%2C0.06)' font-family='monospace'%3E0%3C/text%3E%3C/svg%3E")`,

  "ember-sparks":
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='8' cy='8' r='0.9' fill='rgba(255%2C107%2C0%2C0.18)'/%3E%3Ccircle cx='28' cy='14' r='1.2' fill='rgba(255%2C60%2C0%2C0.12)'/%3E%3Ccircle cx='16' cy='28' r='0.7' fill='rgba(255%2C183%2C0%2C0.15)'/%3E%3Ccircle cx='36' cy='32' r='1.0' fill='rgba(255%2C107%2C0%2C0.10)'/%3E%3Ccircle cx='4' cy='36' r='0.6' fill='rgba(255%2C60%2C0%2C0.13)'/%3E%3Ccircle cx='22' cy='4' r='0.8' fill='rgba(255%2C183%2C0%2C0.10)'/%3E%3C/svg%3E")`,

  "stardust":
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Ccircle cx='6' cy='6' r='0.7' fill='rgba(129%2C140%2C248%2C0.22)'/%3E%3Ccircle cx='30' cy='12' r='1.1' fill='rgba(167%2C139%2C250%2C0.16)'/%3E%3Ccircle cx='52' cy='8' r='0.6' fill='rgba(192%2C132%2C252%2C0.18)'/%3E%3Ccircle cx='18' cy='30' r='0.9' fill='rgba(129%2C140%2C248%2C0.14)'/%3E%3Ccircle cx='46' cy='26' r='0.7' fill='rgba(244%2C114%2C182%2C0.16)'/%3E%3Ccircle cx='10' cy='50' r='1.0' fill='rgba(167%2C139%2C250%2C0.12)'/%3E%3Ccircle cx='40' cy='48' r='0.6' fill='rgba(232%2C121%2C249%2C0.14)'/%3E%3Ccircle cx='56' cy='44' r='0.8' fill='rgba(129%2C140%2C248%2C0.18)'/%3E%3C/svg%3E")`,

  "hammered-metal":
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cellipse cx='8' cy='8' rx='4' ry='3' fill='none' stroke='rgba(217%2C119%2C6%2C0.12)' stroke-width='0.6'/%3E%3Cellipse cx='24' cy='8' rx='3' ry='4' fill='none' stroke='rgba(180%2C83%2C9%2C0.09)' stroke-width='0.5'/%3E%3Cellipse cx='8' cy='24' rx='5' ry='3' fill='none' stroke='rgba(217%2C119%2C6%2C0.10)' stroke-width='0.6'/%3E%3Cellipse cx='24' cy='24' rx='3' ry='5' fill='none' stroke='rgba(180%2C83%2C9%2C0.10)' stroke-width='0.5'/%3E%3Cellipse cx='16' cy='16' rx='4' ry='4' fill='none' stroke='rgba(251%2C191%2C36%2C0.08)' stroke-width='0.5'/%3E%3C/svg%3E")`,

  "candy-bubbles":
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50'%3E%3Ccircle cx='12' cy='12' r='5' fill='none' stroke='rgba(217%2C70%2C239%2C0.10)' stroke-width='0.8'/%3E%3Ccircle cx='38' cy='18' r='7' fill='none' stroke='rgba(236%2C72%2C153%2C0.08)' stroke-width='0.7'/%3E%3Ccircle cx='20' cy='38' r='4' fill='none' stroke='rgba(217%2C70%2C239%2C0.12)' stroke-width='0.6'/%3E%3Ccircle cx='42' cy='40' r='6' fill='none' stroke='rgba(192%2C132%2C252%2C0.08)' stroke-width='0.7'/%3E%3Ccircle cx='6' cy='36' r='3' fill='none' stroke='rgba(236%2C72%2C153%2C0.10)' stroke-width='0.5'/%3E%3C/svg%3E")`,

  "coral-dots":
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='6' cy='6' r='1.8' fill='rgba(249%2C115%2C22%2C0.12)'/%3E%3Ccircle cx='18' cy='6' r='1.2' fill='rgba(239%2C68%2C68%2C0.09)'/%3E%3Ccircle cx='6' cy='18' r='1.2' fill='rgba(251%2C191%2C36%2C0.10)'/%3E%3Ccircle cx='18' cy='18' r='1.8' fill='rgba(249%2C115%2C22%2C0.10)'/%3E%3Ccircle cx='12' cy='12' r='0.8' fill='rgba(239%2C68%2C68%2C0.08)'/%3E%3C/svg%3E")`,

  "snowflake-grid":
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Cline x1='24' y1='4' x2='24' y2='44' stroke='rgba(59%2C130%2C246%2C0.09)' stroke-width='0.7'/%3E%3Cline x1='4' y1='24' x2='44' y2='24' stroke='rgba(59%2C130%2C246%2C0.09)' stroke-width='0.7'/%3E%3Cline x1='9' y1='9' x2='39' y2='39' stroke='rgba(14%2C165%2C233%2C0.06)' stroke-width='0.5'/%3E%3Cline x1='39' y1='9' x2='9' y2='39' stroke='rgba(14%2C165%2C233%2C0.06)' stroke-width='0.5'/%3E%3Ccircle cx='24' cy='24' r='2' fill='none' stroke='rgba(59%2C130%2C246%2C0.10)' stroke-width='0.6'/%3E%3Ccircle cx='24' cy='24' r='6' fill='none' stroke='rgba(59%2C130%2C246%2C0.06)' stroke-width='0.5'/%3E%3C/svg%3E")`,
};

function PremiumTextureOverlay({ textureKey, isDark }) {
  const css = PREMIUM_TEXTURE_CSS[textureKey];
  if (!css) return null;
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: css,
        backgroundRepeat: "repeat",
        opacity: isDark ? 1 : 0.85,
        zIndex: 0,
      }}
    />
  );
}

// Theme selector as a full page
function ThemePage({ themes, currentTheme, onSelect, onBack }) {
  return (
    <div className="flex flex-col gap-4 pb-10">
      <div className="flex items-center gap-3 mb-2">
        <div>
          <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">
            Theme
          </h2>
          <p className="text-xs font-semibold text-[var(--text-secondary)] mt-0.5">
            Active:{" "}
            <span
              className="font-black"
              style={{ color: "var(--accent-primary)" }}
            >
              {currentTheme.name}
            </span>
          </p>
        </div>
      </div>

      <ThemeSelector
        themes={themes}
        currentTheme={currentTheme}
        onSelect={onSelect}
      />
    </div>
  );
}
