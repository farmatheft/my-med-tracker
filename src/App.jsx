import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { db } from './firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, Timestamp, orderBy } from "firebase/firestore";

// --- THEME LOADING ---
const themeModules = import.meta.glob('./themes/*.json', { eager: true });
const themes = Object.values(themeModules).map(m => m.default);

// --- HELPERS ---
const getStartOfDay = (date) => {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

const formatTime = (dateObj) => {
  return dateObj.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatViewedDate = (date) => {
  const today = getStartOfDay(new Date());
  const yesterday = getStartOfDay(new Date());
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.getTime() === today.getTime()) return 'Сьогодні';
  if (date.getTime() === yesterday.getTime()) return 'Вчора';

  return date.toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// --- COMPONENTS ---

const Notification = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-full shadow-2xl z-50 notification-enter">
      {message}
    </div>
  );
};

function MedTrackerCard({ title, onAddSuccess }) {
  const UNIT_CONFIG = {
    mg: { min: 1, max: 250, step: 1, default: 50, label: 'мг' },
    ml: { min: 0.1, max: 5.0, step: 0.1, default: 0.5, label: 'мл' }
  };

  const [unit, setUnit] = useState('mg');
  const [currentDosage, setCurrentDosage] = useState(UNIT_CONFIG.mg.default);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDateTime, setSelectedDateTime] = useState(new Date());

  const handleUnitChange = (newUnit) => {
    setUnit(newUnit);
    setCurrentDosage(UNIT_CONFIG[newUnit].default);
  };

  const adjustDosage = (delta) => {
    setCurrentDosage(prev => {
      const config = UNIT_CONFIG[unit];
      const nextVal = Math.round((prev + delta * config.step) * 10) / 10;
      return Math.min(Math.max(nextVal, config.min), config.max);
    });
  };

  const handleAddIntake = async () => {
    const intakeTimestamp = showTimePicker ? selectedDateTime : new Date();
    try {
      await addDoc(collection(db, "intakes"), {
        patientId: title,
        dosage: currentDosage,
        unit: unit,
        timestamp: Timestamp.fromDate(intakeTimestamp),
        createdAt: Timestamp.now()
      });
      onAddSuccess(`${title}: Додано ${currentDosage} ${unit}`);
      setShowTimePicker(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 bg-[var(--card-bg)] backdrop-blur-md rounded-[2.5rem] p-4 shadow-lg border border-[var(--border)] relative overflow-hidden">
      <div className={`absolute top-3 left-3 px-2 py-0.5 rounded-md text-[10px] font-bold text-white ${title === 'AH' ? 'bg-[var(--accent-ah)]' : 'bg-[var(--accent-ei)]'}`}>
        {title}
      </div>

      <div className="flex flex-col items-center mt-4">
        <div className="flex gap-2 mb-3">
          {['mg', 'ml'].map(u => (
            <button
              key={u}
              onClick={() => handleUnitChange(u)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${unit === u ? (u === 'mg' ? 'bg-[var(--accent-ah)] text-white' : 'bg-[var(--accent-ei)] text-white') : 'bg-black/5 text-[var(--text-secondary)]'}`}
            >
              {u.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between w-full px-2 mb-4">
          <button onClick={() => adjustDosage(-1)} className="w-10 h-10 rounded-full bg-black/5 text-[var(--text-primary)] text-xl flex items-center justify-center">-</button>
          <div className="text-center">
            <span className="text-4xl font-black text-[var(--text-primary)] leading-none">{currentDosage}</span>
            <span className="text-sm font-bold text-[var(--text-secondary)] ml-1">{UNIT_CONFIG[unit].label}</span>
          </div>
          <button onClick={() => adjustDosage(1)} className="w-10 h-10 rounded-full bg-black/5 text-[var(--text-primary)] text-xl flex items-center justify-center">+</button>
        </div>

        <input
          type="range"
          min={UNIT_CONFIG[unit].min}
          max={UNIT_CONFIG[unit].max}
          step={UNIT_CONFIG[unit].step}
          value={currentDosage}
          onChange={(e) => setCurrentDosage(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer mb-6"
          style={{ background: `linear-gradient(90deg, var(--accent-ah) 0%, var(--accent-ei) 100%)` }}
        />

        <div className="w-full space-y-2">
           <button
            onClick={() => setShowTimePicker(!showTimePicker)}
            className="w-full py-2 rounded-xl bg-black/5 text-[var(--text-secondary)] text-xs font-semibold flex items-center justify-center gap-2"
          >
            <span className="text-lg">🕒</span> {showTimePicker ? 'Приховати час' : 'Вказати час'}
          </button>

          {showTimePicker && (
            <div className="p-2 bg-black/5 rounded-xl flex gap-2">
              <input
                type="time"
                value={selectedDateTime.toTimeString().slice(0,5)}
                onChange={(e) => {
                  const [h, m] = e.target.value.split(':');
                  const d = new Date(selectedDateTime);
                  d.setHours(h, m);
                  setSelectedDateTime(d);
                }}
                className="flex-1 bg-transparent text-xs text-[var(--text-primary)] focus:outline-none"
              />
            </div>
          )}

          <button
            onClick={handleAddIntake}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-[var(--accent-ah)] to-[var(--accent-ei)] text-white font-bold text-lg shadow-md active:scale-95 transition-transform"
          >
            + Додати
          </button>
        </div>
      </div>
    </div>
  );
}

const DAY_HEIGHT = 800;

function TimelineHistory() {
  const [intakes, setIntakes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const q = query(collection(db, "intakes"), orderBy("timestamp", "desc"));
    return onSnapshot(q, (snapshot) => {
      setIntakes(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      })));
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (window.confirm("Видалити?")) {
      await deleteDoc(doc(db, "intakes", id));
      setSelectedId(null);
    }
  };

  const groupedByDay = useMemo(() => {
    const groups = {};
    const today = getStartOfDay(new Date());
    groups[today.toLocaleDateString('uk-UA')] = { date: today, intakes: [] };

    intakes.forEach(intake => {
      const dateStr = getStartOfDay(intake.timestamp).toLocaleDateString('uk-UA');
      if (!groups[dateStr]) groups[dateStr] = { date: getStartOfDay(intake.timestamp), intakes: [] };
      groups[dateStr].intakes.push(intake);
    });

    return Object.values(groups).sort((a, b) => b.date - a.date);
  }, [intakes]);

  const getTimeTop = (date) => {
    const mins = date.getHours() * 60 + date.getMinutes();
    return ((1440 - mins) / 1440) * 100;
  };

  return (
    <div className="flex-grow overflow-y-auto custom-scrollbar px-4 pb-20" onClick={() => setSelectedId(null)}>
      <div className="relative">
        {groupedByDay.map((day) => (
          <div key={day.date.getTime()} className="relative" style={{ height: `${DAY_HEIGHT}px` }}>
            {/* Markers */}
            {[...Array(24 * 6)].map((_, i) => {
              const mins = i * 10;
              const top = ((1440 - mins) / 1440) * 100;
              const isMajor = mins % 180 === 0;
              return (
                <div key={i} className="absolute left-1/2 flex items-center" style={{ top: `${top}%` }}>
                  <div className={`h-[1px] bg-[var(--marker-color)] opacity-30 ${isMajor ? 'w-6' : 'w-3'}`} />
                  {isMajor && (
                    <span className="ml-2 text-[10px] font-bold text-[var(--marker-color)]">
                      {String(Math.floor(mins / 60)).padStart(2, '0')}:00
                    </span>
                  )}
                </div>
              );
            })}

            {/* Central Line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-[var(--timeline-line)] -translate-x-1/2" />

            {/* Current Time Line */}
            {getStartOfDay(currentTime).getTime() === day.date.getTime() && (
              <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${getTimeTop(currentTime)}%` }}>
                <div className="w-full h-px bg-[var(--accent-ah)] opacity-50 shadow-[0_0_8px_var(--accent-ah)]" />
                <div className="absolute right-0 -top-4 px-2 py-0.5 bg-[var(--accent-ah)] text-white text-[10px] font-bold rounded-l-md shadow-sm">
                  {formatTime(currentTime)}
                </div>
              </div>
            )}

            {/* Intakes */}
            {day.intakes.map((intake) => {
              const isAH = intake.patientId === 'AH';
              const isSelected = selectedId === intake.id;
              const top = getTimeTop(intake.timestamp);

              return (
                <div
                  key={intake.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(isSelected ? null : intake.id); }}
                  className={`absolute flex items-center transition-all duration-300 cursor-pointer ${isAH ? 'right-1/2 pr-4 justify-end' : 'left-1/2 pl-4'} ${selectedId && !isSelected ? 'opacity-30 scale-95' : 'opacity-100 scale-100'}`}
                  style={{ top: `${top}%`, transform: 'translateY(-50%)', width: '45%' }}
                >
                  <div className={`flex flex-col ${isAH ? 'items-end' : 'items-start'} ${isSelected ? 'bg-white/10 p-2 rounded-2xl ring-1 ring-[var(--border)]' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-black ${isAH ? 'text-[var(--accent-ah)]' : 'text-[var(--accent-ei)]'}`}>
                        {intake.dosage}
                      </span>
                      <span className="text-[10px] font-bold text-[var(--text-secondary)]">{intake.unit}</span>
                      <span className="text-xs font-bold text-[var(--text-primary)] opacity-60">{formatTime(intake.timestamp)}</span>
                    </div>
                    {isSelected && (
                      <button
                        onClick={(e) => handleDelete(e, intake.id)}
                        className="mt-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs shadow-lg animate-fade-in-down"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className={`absolute w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 ${isAH ? '-right-1.5' : '-left-1.5'} ${isAH ? 'bg-[var(--accent-ah)]' : 'bg-[var(--accent-ei)]'}`} />
                </div>
              );
            })}

            <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
              <span className="px-4 py-1 rounded-full bg-black/5 text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm">
                {formatViewedDate(day.date)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [currentTheme, setCurrentTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return themes.find(t => t.name === saved) || themes[0];
  });
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bg-gradient-start', currentTheme.backgroundGradient[0]);
    root.style.setProperty('--bg-gradient-end', currentTheme.backgroundGradient[1]);
    root.style.setProperty('--card-bg', currentTheme.cardBackground);
    root.style.setProperty('--text-primary', currentTheme.textPrimary);
    root.style.setProperty('--text-secondary', currentTheme.textSecondary);
    root.style.setProperty('--accent-ah', currentTheme.accentAH);
    root.style.setProperty('--accent-ei', currentTheme.accentEI);
    root.style.setProperty('--border', currentTheme.border);
    root.style.setProperty('--timeline-line', currentTheme.timelineLine);
    root.style.setProperty('--marker-color', currentTheme.markerColor);
    root.style.setProperty('--success-color', currentTheme.success);
    localStorage.setItem('theme', currentTheme.name);
  }, [currentTheme]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col transition-colors duration-500" style={{ background: `linear-gradient(135deg, var(--bg-gradient-start), var(--bg-gradient-end))` }}>
      {notification && <Notification message={notification} onClose={() => setNotification(null)} />}

      {/* Header with Theme Switcher */}
      <header className="p-4 flex justify-between items-center">
        <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight">TRACKER</h1>
        <div className="flex gap-2">
          {themes.map(t => (
            <button
              key={t.name}
              onClick={() => setCurrentTheme(t)}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${currentTheme.name === t.name ? 'scale-125 border-[var(--text-primary)]' : 'border-transparent opacity-50'}`}
              style={{ background: t.backgroundGradient[0] }}
              title={t.name}
            />
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col gap-4 max-w-lg mx-auto w-full px-4 overflow-hidden">
        <div className="flex gap-4">
          <MedTrackerCard title="AH" onAddSuccess={setNotification} />
          <MedTrackerCard title="EI" onAddSuccess={setNotification} />
        </div>

        <div className="flex-grow bg-[var(--card-bg)] backdrop-blur-md rounded-t-[2.5rem] pt-6 shadow-2xl border-x border-t border-[var(--border)] flex flex-col overflow-hidden">
          <h2 className="text-center text-xs font-black text-[var(--text-secondary)] tracking-[0.3em] uppercase mb-4">Timeline</h2>
          <TimelineHistory />
        </div>
      </main>
    </div>
  );
}
