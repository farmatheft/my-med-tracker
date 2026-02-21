import { useState, useEffect, useCallback } from "react";
import Notification from "./components/Notification";
import ThemeSelector from "./components/ThemeSelector";
import IntakeDetailsModal from "./components/IntakeDetailsModal";
import MedTrackerCard from "./components/MedTrackerCard";
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
  const [mobileCardIndex, setMobileCardIndex] = useState(0);

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
            {/* Cards: desktop/tablet side-by-side */}
            <div className="hidden sm:flex gap-3">
              <MedTrackerCard title="AH" onAddSuccess={setNotification} />
              <MedTrackerCard title="EI" onAddSuccess={setNotification} />
            </div>

            {/* Cards: mobile carousel */}
            <div className="sm:hidden">
              <div className="relative overflow-hidden">
                <div
                  className="flex transition-transform duration-300 ease-out"
                  style={{
                    transform: `translateX(-${mobileCardIndex * 100}%)`,
                  }}
                  onTouchStart={(e) => {
                    const touch = e.touches[0];
                    e.currentTarget.dataset.touchStartX = touch.clientX;
                  }}
                  onTouchEnd={(e) => {
                    const touch = e.changedTouches[0];
                    const startX = parseFloat(
                      e.currentTarget.dataset.touchStartX,
                    );
                    const diff = startX - touch.clientX;
                    if (Math.abs(diff) > 50) {
                      if (diff > 0 && mobileCardIndex < 1)
                        setMobileCardIndex(1);
                      if (diff < 0 && mobileCardIndex > 0)
                        setMobileCardIndex(0);
                    }
                  }}
                >
                  <div className="min-w-full">
                    <MedTrackerCard title="AH" onAddSuccess={setNotification} />
                  </div>
                  <div className="min-w-full">
                    <MedTrackerCard title="EI" onAddSuccess={setNotification} />
                  </div>
                </div>
              </div>

              {/* AH/EI Button Switcher */}
              <div className="mt-2 flex justify-center gap-1">
                <button
                  type="button"
                  onClick={() => setMobileCardIndex(0)}
                  className="px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200"
                  style={{
                    background:
                      mobileCardIndex === 0 ? "var(--accent-ah)" : "transparent",
                    color:
                      mobileCardIndex === 0 ? "#FFFFFF" : "var(--text-secondary)",
                    border: "1px solid var(--border)",
                    boxShadow:
                      mobileCardIndex === 0 ? "0 0 8px var(--glow-light)" : "none",
                  }}
                  aria-label="Show AH card"
                >
                  AH
                </button>
                <button
                  type="button"
                  onClick={() => setMobileCardIndex(1)}
                  className="px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200"
                  style={{
                    background:
                      mobileCardIndex === 1 ? "var(--accent-ei)" : "transparent",
                    color:
                      mobileCardIndex === 1 ? "#FFFFFF" : "var(--text-secondary)",
                    border: "1px solid var(--border)",
                    boxShadow:
                      mobileCardIndex === 1 ? "0 0 8px var(--glow-light)" : "none",
                  }}
                  aria-label="Show EI card"
                >
                  EI
                </button>
              </div>
            </div>

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
