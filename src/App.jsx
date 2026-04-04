import { useState, useEffect, useCallback, useRef } from "react";
import Notification from "./components/Notification";
import ThemeSelector from "./components/ThemeSelector";
import IntakeDetailsModal from "./components/IntakeDetailsModal";
import IntakePanel from "./components/IntakePanel";
import TimelineHistory from "./components/TimelineHistory";
import CalendarView from "./components/CalendarView";
import Statistics from "./components/Statistics";
import BankProgress from "./components/BankProgress";
import PinLock from "./components/PinLock";
import { TIMELINE_TITLE_DEFAULT } from "./utils/time";

const AUTO_LOCK_MS = 60_000; // 1 minute

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

  // ── PIN lock state ──────────────────────────────────────────────────────
  const [isLocked, setIsLocked] = useState(true); // always locked on mount
  const [isPanic, setIsPanic] = useState(false);   // panic mode (5050)
  const autoLockTimer = useRef(null);

  const resetAutoLock = useCallback(() => {
    if (autoLockTimer.current) clearTimeout(autoLockTimer.current);
    autoLockTimer.current = setTimeout(() => {
      setIsLocked(true);
      setIsPanic(false);
    }, AUTO_LOCK_MS);
  }, []);

  // Reset timer on any user interaction when unlocked
  useEffect(() => {
    if (isLocked) return;
    const handler = () => resetAutoLock();
    const events = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    resetAutoLock(); // start timer
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (autoLockTimer.current) clearTimeout(autoLockTimer.current);
    };
  }, [isLocked, resetAutoLock]);

  const handleUnlock = useCallback(({ mode }) => {
    setIsLocked(false);
    setIsPanic(mode === "panic");
  }, []);

  const handleLock = useCallback(() => {
    setIsLocked(true);
    setIsPanic(false);
  }, []);

  // Timeline mode: "timeline" | "calendar"
  const [timelineMode, setTimelineMode] = useState("timeline");
  // Calendar month heading
  const [calendarHeading, setCalendarHeading] = useState("");

  // Refs to trigger scroll inside child components
  const scrollToNextDayRef = useRef(null);
  const scrollToPrevDayRef = useRef(null);
  const scrollToNextMonthRef = useRef(null);
  const scrollToPrevMonthRef = useRef(null);

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
            radial-gradient(ellipse 80% 60% at top right, var(--accent-ei) 0%, transparent 55%),
            radial-gradient(ellipse 80% 60% at bottom left, var(--accent-ah) 0%, transparent 55%)
          `,
          opacity: currentTheme?.isDark ? 0.18 : 0.1,
          mixBlendMode: currentTheme?.isDark ? 'screen' : 'normal'
        }}
      />
      {/* Background subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none z-[-1]"
        style={{
          background: `
            linear-gradient(var(--text-primary) 1px, transparent 1px),
            linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          opacity: currentTheme?.isDark ? 0.025 : 0.035,
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

      {/* Header — floating glassmorphic bar */}
      <header
        className="sticky top-0 z-50 flex-shrink-0 px-4 py-2.5"
        style={{
          background: "rgba(0,0,0,0.0)",
        }}
      >
        <div
          className="flex items-center justify-between rounded-2xl px-3 py-2 relative overflow-hidden"
          style={{
            background: currentTheme?.isDark
              ? "rgba(8,12,28,0.55)"
              : "rgba(255,255,255,0.55)",
            backdropFilter: "blur(28px)",
            WebkitBackdropFilter: "blur(28px)",
            border: "1px solid var(--glass-border)",
            boxShadow: "0 4px 24px var(--shadow-color), inset 0 1px 0 var(--glass-shine)",
          }}
        >
          {/* Subtle top shine line */}
          <div
            className="absolute inset-x-0 top-0 h-px pointer-events-none"
            style={{ background: "linear-gradient(90deg, transparent, var(--glass-shine), transparent)" }}
          />

          {/* Left nav button — Stats */}
          <button
            type="button"
            onClick={() =>
              navigateTo(
                activeView === VIEW.STATISTICS ? VIEW.MAIN : VIEW.STATISTICS,
              )
            }
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 relative"
            style={{
              background: activeView === VIEW.STATISTICS
                ? "var(--accent-primary)"
                : "var(--glass-bg)",
              border: "1px solid",
              borderColor: activeView === VIEW.STATISTICS
                ? "transparent"
                : "var(--glass-border)",
              color: activeView === VIEW.STATISTICS
                ? (currentTheme?.isDark ? "#000" : "#fff")
                : "var(--text-primary)",
              boxShadow: activeView === VIEW.STATISTICS
                ? "0 4px 16px var(--accent-primary)"
                : "none",
            }}
            aria-label={
              activeView === VIEW.STATISTICS ? "Show main view" : "Show statistics"
            }
          >
            {activeView === VIEW.STATISTICS ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M3 3v18h18" /><path d="M18 9l-5 5-4-4-3 3" />
              </svg>
            )}
          </button>

          {/* Lock button */}
          <button
            type="button"
            onClick={handleLock}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-90"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-secondary)",
            }}
            aria-label="Lock"
            title="Заблокувати"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </button>

          {/* Center: page title */}
          <div className="flex flex-col items-center select-none">
            <div className="flex items-center gap-1.5 mb-1 pointer-events-none">
              <img src="/logo.svg" alt="Logo" className="w-4 h-4" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }} />
              <span
                className="text-[10px] font-black uppercase tracking-[0.22em] leading-none mt-[2px]"
                style={{ color: "var(--text-primary)", opacity: 0.9 }}
              >
                {activeView === VIEW.MAIN
                  ? "Med Tracker"
                  : activeView === VIEW.STATISTICS
                    ? "Statistics"
                    : "Theme"}
              </span>
            </div>
            {/* Accent dot row */}
            <div className="flex gap-1 mt-1">
              <div
                className="w-1 h-1 rounded-full transition-all duration-300"
                style={{
                  background: "var(--accent-ah)",
                  opacity: activeView === VIEW.MAIN ? 1 : 0.25,
                  transform: activeView === VIEW.MAIN ? "scale(1.2)" : "scale(1)",
                  boxShadow: activeView === VIEW.MAIN ? "0 0 6px var(--accent-ah)" : "none",
                }}
              />
              <div
                className="w-1 h-1 rounded-full transition-all duration-300"
                style={{
                  background: "var(--accent-primary)",
                  opacity: activeView === VIEW.STATISTICS ? 1 : 0.25,
                  transform: activeView === VIEW.STATISTICS ? "scale(1.2)" : "scale(1)",
                  boxShadow: activeView === VIEW.STATISTICS ? "0 0 6px var(--accent-primary)" : "none",
                }}
              />
              <div
                className="w-1 h-1 rounded-full transition-all duration-300"
                style={{
                  background: "var(--accent-ei)",
                  opacity: activeView === VIEW.THEME_SELECTOR ? 1 : 0.25,
                  transform: activeView === VIEW.THEME_SELECTOR ? "scale(1.2)" : "scale(1)",
                  boxShadow: activeView === VIEW.THEME_SELECTOR ? "0 0 6px var(--accent-ei)" : "none",
                }}
              />
            </div>
          </div>

          {/* Right nav button — Theme */}
          <button
            type="button"
            onClick={() =>
              navigateTo(
                activeView === VIEW.THEME_SELECTOR
                  ? VIEW.MAIN
                  : VIEW.THEME_SELECTOR,
              )
            }
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: activeView === VIEW.THEME_SELECTOR
                ? "var(--accent-ei)"
                : "var(--glass-bg)",
              border: "1px solid",
              borderColor: activeView === VIEW.THEME_SELECTOR
                ? "transparent"
                : "var(--glass-border)",
              color: activeView === VIEW.THEME_SELECTOR
                ? "#fff"
                : "var(--text-primary)",
              boxShadow: activeView === VIEW.THEME_SELECTOR
                ? "0 4px 16px var(--accent-ei)"
                : "none",
            }}
            aria-label={
              activeView === VIEW.THEME_SELECTOR ? "Close theme" : "Open theme settings"
            }
          >
            {activeView === VIEW.THEME_SELECTOR ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
                <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
                <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
                <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Page transition loading overlay */}
      {isTransitioning && (
        <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center">
          <div
            className="flex gap-2 px-5 py-3 rounded-2xl"
            style={{
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid var(--glass-border)",
            }}
          >
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
          <div className="flex flex-col gap-4 flex-grow page-enter-left pt-1">
            {/* BankProgress is temporarily hidden per user request */}
            {/* {!isPanic && <BankProgress />} */}

            {/* Intake panel — hidden in panic mode to prevent data leak */}
            {!isPanic && <IntakePanel onAddSuccess={setNotification} disabled={false} />}

            {/* Panic mode: treatment start dates panel */}
            {isPanic && (
              <div
                className="rounded-3xl overflow-hidden relative"
                style={{
                  background: "var(--surface-2)",
                  backdropFilter: "blur(32px)",
                  WebkitBackdropFilter: "blur(32px)",
                  border: "1px solid var(--glass-border)",
                  boxShadow: "0 8px 40px var(--shadow-color-strong), inset 0 1px 0 var(--glass-shine)",
                }}
              >
                <div className="absolute inset-x-0 top-0 h-px pointer-events-none z-10"
                  style={{ background: "linear-gradient(90deg, transparent 5%, var(--glass-shine) 50%, transparent 95%)" }} />
                <div className="flex py-8 px-4">
                  <div className="flex-1 flex flex-col items-center border-r" style={{ borderColor: "var(--glass-border)" }}>
                    <span className="text-2xl font-black mb-1" style={{ color: "var(--accent-ah)" }}>Пацієнт 1</span>
                    <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-secondary)" }}>01.04.2026</span>
                    <span className="text-[9px] font-black tracking-widest uppercase mt-1 opacity-50" style={{ color: "var(--text-secondary)" }}>Початок лікування</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center">
                    <span className="text-2xl font-black mb-1" style={{ color: "var(--accent-ei)" }}>Пацієнт 2</span>
                    <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-secondary)" }}>31.03.2026</span>
                    <span className="text-[9px] font-black tracking-widest uppercase mt-1 opacity-50" style={{ color: "var(--text-secondary)" }}>Початок лікування</span>
                  </div>
                </div>
              </div>
            )}

            <div
              className="rounded-[2rem] pt-4 flex flex-col overflow-hidden relative"
              style={{
                background: currentTheme?.isDark
                  ? "rgba(8,12,28,0.52)"
                  : "rgba(255,255,255,0.52)",
                backdropFilter: "blur(32px)",
                WebkitBackdropFilter: "blur(32px)",
                border: "1px solid var(--glass-border)",
                boxShadow: "0 20px 60px var(--shadow-color-strong), inset 0 1px 0 var(--glass-shine)",
                height: isPanic ? "min(700px, calc(100dvh - 250px))" : "min(700px, calc(100dvh - 350px))",
                minHeight: "350px",
              }}
            >
              {/* Top glass shine edge */}
              <div
                className="absolute inset-x-0 top-0 h-px pointer-events-none z-10"
                style={{ background: "linear-gradient(90deg, transparent 5%, var(--glass-shine) 50%, transparent 95%)" }}
              />
              {isPanic ? (
                <div className="flex-grow flex flex-col gap-4 px-4 py-2 pt-6 overflow-y-auto">
                  {/* Contact 1 */}
                  <div className="rounded-3xl p-5 relative overflow-hidden flex flex-col gap-3"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--glass-border)", boxShadow: "0 8px 32px var(--shadow-color)" }}>
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <svg viewBox="0 0 24 24" width="80" height="80" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
                    </div>
                    <div className="flex items-center gap-4 relative z-10">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: "color-mix(in srgb, var(--accent-primary) 20%, transparent)", border: "2px solid var(--accent-primary)" }}>
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M14.5 15.5l-5 5"/><path d="M9.5 15.5l5 5"/></svg>
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ color: "var(--accent-primary)" }}>Лікар</div>
                        <div className="text-sm font-bold leading-tight uppercase" style={{ color: "var(--text-primary)" }}>Качуровський Сергий Іванович</div>
                      </div>
                    </div>
                    <a href="tel:+380675175364" className="mt-2 w-full py-3 rounded-2xl flex items-center justify-center gap-2 font-black text-sm transition-transform active:scale-95 text-white"
                      style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 4px 16px rgba(16, 185, 129, 0.4)" }}>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      +380 67 517 5364
                    </a>
                  </div>
                  
                  {/* Contact 2 */}
                  <div className="rounded-3xl p-5 relative overflow-hidden flex flex-col gap-3"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--glass-border)", boxShadow: "0 8px 32px var(--shadow-color)" }}>
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <svg viewBox="0 0 24 24" width="80" height="80" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
                    </div>
                    <div className="flex items-center gap-4 relative z-10">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: "color-mix(in srgb, var(--accent-ei) 20%, transparent)", border: "2px solid var(--accent-ei)" }}>
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--accent-ei)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ color: "var(--accent-ei)" }}>Старша медсестра</div>
                        <div className="text-sm font-bold leading-tight uppercase" style={{ color: "var(--text-primary)" }}>Наталія Валеріївна</div>
                      </div>
                    </div>
                    <a href="tel:+380968911908" className="mt-2 w-full py-3 rounded-2xl flex items-center justify-center gap-2 font-black text-sm transition-transform active:scale-95 text-white"
                      style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 4px 16px rgba(16, 185, 129, 0.4)" }}>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      +380 96 891 1908
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  {/* Timeline header: heading + mode switcher */}
                  <div className="flex items-center justify-between px-4 pb-3 flex-shrink-0">
                    {/* Current date/month heading */}
                    <span className="text-xl font-black uppercase tracking-tight select-none" style={{ color: "var(--text-primary)" }}>
                      {timelineMode === "timeline"
                        ? timelineHeading
                        : (calendarHeading || "Календар")}
                    </span>

                    {/* Segmented mode switcher */}
                    <div
                      className="flex items-center rounded-xl p-0.5 gap-0.5"
                      style={{
                        background: "rgba(0,0,0,0.12)",
                        border: "1px solid var(--glass-border)",
                      }}
                    >
                      {/* Timeline tab */}
                      <button
                        type="button"
                        onClick={() => setTimelineMode("timeline")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black transition-all duration-200"
                        style={{
                          background: timelineMode === "timeline" ? "var(--accent-primary)" : "transparent",
                          color: timelineMode === "timeline"
                            ? (currentTheme?.isDark ? "#000" : "#fff")
                            : "var(--text-secondary)",
                          boxShadow: timelineMode === "timeline" ? "0 2px 8px var(--shadow-color-strong)" : "none",
                        }}
                        aria-label="Таймлайн"
                      >
                        {/* Timeline icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 flex-shrink-0">
                          <line x1="12" y1="2" x2="12" y2="22" />
                          <circle cx="12" cy="7" r="2" fill="currentColor" stroke="none" />
                          <circle cx="12" cy="14" r="2" fill="currentColor" stroke="none" />
                          <line x1="12" y1="7" x2="7" y2="7" />
                          <line x1="12" y1="14" x2="17" y2="14" />
                        </svg>
                        <span>Стрічка</span>
                      </button>

                      {/* Calendar tab */}
                      <button
                        type="button"
                        onClick={() => setTimelineMode("calendar")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black transition-all duration-200"
                        style={{
                          background: timelineMode === "calendar" ? "var(--accent-primary)" : "transparent",
                          color: timelineMode === "calendar"
                            ? (currentTheme?.isDark ? "#000" : "#fff")
                            : "var(--text-secondary)",
                          boxShadow: timelineMode === "calendar" ? "0 2px 8px var(--shadow-color-strong)" : "none",
                        }}
                        aria-label="Календар"
                      >
                        {/* Calendar icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 flex-shrink-0">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span>Календар</span>
                      </button>
                    </div>
                  </div>

                  {timelineMode === "timeline" ? (
                    <TimelineHistory
                      onDayChange={(label) =>
                        setTimelineHeading(label || TIMELINE_TITLE_DEFAULT)
                      }
                      selectedId={selectedIntakeId}
                      onSelectIntake={handleSelectIntake}
                      scrollToNextDay={scrollToNextDayRef}
                      scrollToPrevDay={scrollToPrevDayRef}
                      hideData={isPanic}
                    />
                  ) : (
                    <CalendarView
                      onMonthChange={setCalendarHeading}
                      scrollToNextMonth={scrollToNextMonthRef}
                      scrollToPrevMonth={scrollToPrevMonthRef}
                    />
                  )}
                </>
              )}
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

      {activeIntake && !isPanic && (
        <IntakeDetailsModal
          intake={activeIntake}
          onClose={() => handleSelectIntake(null)}
        />
      )}

      {/* PIN Lock overlay — always shown on mount (refresh) */}
      {isLocked && <PinLock onUnlock={handleUnlock} />}
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
