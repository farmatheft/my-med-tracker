import React, { useState, useEffect } from 'react';
import Notification from './components/Notification';
import ThemeSelector from './components/ThemeSelector';
import IntakeDetailsModal from './components/IntakeDetailsModal';
import MedTrackerCard from './components/MedTrackerCard';
import TimelineHistory from './components/TimelineHistory';
import { TIMELINE_TITLE_DEFAULT } from './utils/time';

// --- THEME LOADING ---
const themeModules = import.meta.glob('./themes/*.json', { eager: true });
const themes = Object.values(themeModules).map(m => m.default);

export default function App() {
  const [currentTheme, setCurrentTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return themes.find(t => t.name === saved) || themes[0];
  });
  const [notification, setNotification] = useState(null);
  const [timelineHeading, setTimelineHeading] = useState(TIMELINE_TITLE_DEFAULT);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedIntakeId, setSelectedIntakeId] = useState(null);
  const [activeIntake, setActiveIntake] = useState(null);
  const [activeTimeSelection, setActiveTimeSelection] = useState(null);
  const [selectedTimeMap, setSelectedTimeMap] = useState({});
  const [mobileCardIndex, setMobileCardIndex] = useState(0);
  const touchStartX = React.useRef(null);

  const handleSelectIntake = (intake) => {
    if (!intake) {
      setSelectedIntakeId(null);
      setActiveIntake(null);
      return;
    }
    setSelectedIntakeId(intake.id);
    setActiveIntake(intake);
  };

  const handleStartTimeSelection = (patientId) => {
    setActiveTimeSelection(patientId);
    setSelectedTimeMap((prev) => ({ ...prev, [patientId]: null }));
  };

  const handleCancelTimeSelection = (patientId) => {
    setActiveTimeSelection((prev) => (prev === patientId ? null : prev));
    setSelectedTimeMap((prev) => ({ ...prev, [patientId]: null }));
  };

  const handleResetTimeSelection = (patientId) => {
    setSelectedTimeMap((prev) => ({ ...prev, [patientId]: null }));
    setActiveTimeSelection((prev) => (prev === patientId ? null : prev));
  };

  const handleTimeSelected = (date) => {
    if (!activeTimeSelection) return;
    setSelectedTimeMap((prev) => ({ ...prev, [activeTimeSelection]: date }));
  };

  useEffect(() => {
    const root = document.documentElement;
    const isDark = Boolean(currentTheme.isDark);

    root.style.setProperty('--bg-gradient-start', currentTheme.backgroundGradient[0]);
    root.style.setProperty('--bg-gradient-end', currentTheme.backgroundGradient[1]);
    root.style.setProperty('--card-bg-start', currentTheme.cardBackground[0]);
    root.style.setProperty('--card-bg-end', currentTheme.cardBackground[1]);
    root.style.setProperty('--text-primary', currentTheme.textPrimary);
    root.style.setProperty('--text-secondary', currentTheme.textSecondary);
    root.style.setProperty('--accent-ah', currentTheme.accentAH);
    root.style.setProperty('--accent-ei', currentTheme.accentEI);
    root.style.setProperty('--border', currentTheme.border);
    root.style.setProperty('--timeline-line', currentTheme.timelineLine);
    root.style.setProperty('--marker-color', currentTheme.markerColor);
    root.style.setProperty('--timeline-bg-start', currentTheme.timelineBackground[0]);
    root.style.setProperty('--timeline-bg-end', currentTheme.timelineBackground[1]);
    root.style.setProperty('--timeline-bg-alt-start', currentTheme.timelineSecondaryBackground[0]);
    root.style.setProperty('--timeline-bg-alt-end', currentTheme.timelineSecondaryBackground[1]);
    root.style.setProperty('--success-color', currentTheme.success);

    // --- Derived surfaces & shadows (keeps themes working without requiring new JSON keys)
    root.style.setProperty('--surface', isDark ? 'rgba(15, 23, 42, 0.66)' : 'rgba(255, 255, 255, 0.96)');
    root.style.setProperty('--surface-2', isDark ? 'rgba(2, 6, 23, 0.55)' : 'rgba(248, 250, 252, 0.98)');
    root.style.setProperty('--shadow-color', isDark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(15, 23, 42, 0.18)');
    root.style.setProperty('--shadow-color-strong', isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.28)');
    root.style.setProperty('--header-overlay', isDark ? 'rgba(0, 0, 0, 0.70)' : 'rgba(2, 6, 23, 0.70)');
    root.style.setProperty('--action-bg', isDark ? 'rgba(0, 0, 0, 0.78)' : 'rgba(0, 0, 0, 0.82)');
    root.style.setProperty('--action-border', isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(255, 255, 255, 0.12)');

    // --- Subtype colors (theme-driven)
    const subtype = currentTheme.subtypeColors || {};
    root.style.setProperty('--subtype-iv', subtype.iv || (isDark ? '#4FC3F7' : '#3b82f6'));
    root.style.setProperty('--subtype-im', subtype.im || (isDark ? '#BA68C8' : '#a855f7'));
    root.style.setProperty('--subtype-po', subtype.po || (isDark ? '#FFB74D' : '#f59e0b'));
    root.style.setProperty('--subtype-ivpo', subtype.ivpo || (isDark ? '#81C784' : '#22c55e'));
    root.style.setProperty('--subtype-vtrk', subtype.vtrk || (isDark ? '#FACC15' : '#FACC15'));

    // --- Subtype panel (top of each card)
    const subtypePanel = currentTheme.subtypePanel || {};
    root.style.setProperty('--subtype-panel-bg', subtypePanel.bg || (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'));
    root.style.setProperty(
      '--subtype-panel-border',
      subtypePanel.border || (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)')
    );

    // --- Add button colors (theme-driven; dark-on-light, light-on-dark)
    const addButton = currentTheme.addButton || {};
    root.style.setProperty('--add-btn-bg', addButton.bg || (isDark ? 'rgba(255,255,255,0.92)' : 'rgba(2, 6, 23, 0.86)'));
    root.style.setProperty('--add-btn-text', addButton.text || (isDark ? 'rgba(2, 6, 23, 0.92)' : currentTheme.success));
    root.style.setProperty('--add-btn-border', addButton.border || (isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.12)'));
    root.style.setProperty('--add-btn-glow', addButton.glow || currentTheme.success);

    localStorage.setItem('theme', currentTheme.name);
  }, [currentTheme]);

  return (
    <div className="h-screen w-screen overflow-y-auto overflow-x-hidden flex flex-col transition-colors duration-500" style={{ background: `linear-gradient(135deg, var(--bg-gradient-start), var(--bg-gradient-end))` }}>
      {notification && <Notification message={notification} onClose={() => setNotification(null)} />}

      {/* Header */}
      <header className="p-3 flex justify-end items-center">
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="w-10 h-10 rounded-full border border-[var(--border)] text-[var(--text-primary)] shadow-md hover:scale-105 transition-transform flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))' }}
          aria-label="Open settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col gap-4 max-w-3xl mx-auto w-full px-4 pb-6">
        {/* Cards: desktop/tablet side-by-side */}
        <div className="hidden sm:flex gap-3">
          <MedTrackerCard
            title="AH"
            onAddSuccess={setNotification}
            isSelectingTime={activeTimeSelection === 'AH'}
            selectedTime={selectedTimeMap.AH}
            onStartTimeSelection={handleStartTimeSelection}
            onCancelTimeSelection={handleCancelTimeSelection}
            onResetTimeSelection={handleResetTimeSelection}
          />
          <MedTrackerCard
            title="EI"
            onAddSuccess={setNotification}
            isSelectingTime={activeTimeSelection === 'EI'}
            selectedTime={selectedTimeMap.EI}
            onStartTimeSelection={handleStartTimeSelection}
            onCancelTimeSelection={handleCancelTimeSelection}
            onResetTimeSelection={handleResetTimeSelection}
          />
        </div>

        {/* Cards: mobile carousel */}
        <div className="sm:hidden">
          <div
            className="relative overflow-hidden"
            onTouchStart={(e) => {
              touchStartX.current = e.touches?.[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              const start = touchStartX.current;
              const end = e.changedTouches?.[0]?.clientX ?? null;
              touchStartX.current = null;
              if (start == null || end == null) return;
              const dx = end - start;
              const threshold = 50;
              if (dx > threshold) setMobileCardIndex(0);
              if (dx < -threshold) setMobileCardIndex(1);
            }}
          >
            <div
              className="flex transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${mobileCardIndex * 100}%)` }}
            >
              <div className="min-w-full">
                <MedTrackerCard
                  title="AH"
                  onAddSuccess={setNotification}
                  isSelectingTime={activeTimeSelection === 'AH'}
                  selectedTime={selectedTimeMap.AH}
                  onStartTimeSelection={handleStartTimeSelection}
                  onCancelTimeSelection={handleCancelTimeSelection}
                  onResetTimeSelection={handleResetTimeSelection}
                />
              </div>
              <div className="min-w-full">
                <MedTrackerCard
                  title="EI"
                  onAddSuccess={setNotification}
                  isSelectingTime={activeTimeSelection === 'EI'}
                  selectedTime={selectedTimeMap.EI}
                  onStartTimeSelection={handleStartTimeSelection}
                  onCancelTimeSelection={handleCancelTimeSelection}
                  onResetTimeSelection={handleResetTimeSelection}
                />
              </div>
            </div>
          </div>

          {/* Dots */}
          <div className="mt-2 flex justify-center gap-2">
            {[0, 1].map((idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setMobileCardIndex(idx)}
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  background: idx === mobileCardIndex ? 'var(--text-primary)' : 'rgba(0,0,0,0.18)',
                  opacity: idx === mobileCardIndex ? 0.8 : 0.45
                }}
                aria-label={idx === 0 ? 'Show AH card' : 'Show EI card'}
              />
            ))}
          </div>
        </div>

        <div
          className="rounded-[2.5rem] pt-6 shadow-soft-strong border border-[var(--border)] flex flex-col overflow-hidden"
          style={{
            background: 'var(--surface)',
            // Fixed viewport for the timeline window.
            // One full day (24h) is mapped to this height; scrolling moves across days, not within a day.
            height: '600px'
          }}
        >
          <h2 className="text-center text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">{timelineHeading}</h2>
          {activeTimeSelection && (
            <div className="text-center text-xs font-semibold text-[var(--text-secondary)] mb-2">
              Оберіть час на таймлайні
            </div>
          )}
          <TimelineHistory
            onDayChange={(label) => setTimelineHeading(label || TIMELINE_TITLE_DEFAULT)}
            selectedId={selectedIntakeId}
            onSelectIntake={handleSelectIntake}
            isSelectingTime={Boolean(activeTimeSelection)}
            onTimeSelected={handleTimeSelected}
          />
        </div>
      </main>

      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="mt-16 w-[min(92vw,520px)] max-h-[80vh] overflow-y-auto rounded-3xl border border-[var(--border)] p-5 shadow-2xl"
            style={{ background: 'linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-black text-[var(--text-primary)]">Settings</h3>
                <p className="text-xs font-semibold text-[var(--text-secondary)] mt-1">Current theme: {currentTheme.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="w-8 h-8 rounded-full border border-[var(--border)] text-[var(--text-primary)] flex items-center justify-center"
                aria-label="Close settings"
              >
                ✕
              </button>
            </div>

            <div className="mb-3">
              <h4 className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-[0.3em]">Theme</h4>
            </div>

            <ThemeSelector
              themes={themes}
              currentTheme={currentTheme}
              onSelect={(theme) => setCurrentTheme(theme)}
            />
          </div>
        </div>
      )}

      {activeIntake && (
        <IntakeDetailsModal
          intake={activeIntake}
          onClose={() => handleSelectIntake(null)}
        />
      )}
    </div>
  );
}
