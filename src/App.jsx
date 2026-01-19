import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { db } from './firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, Timestamp, orderBy, updateDoc } from "firebase/firestore";

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

const padTime = (value) => String(value).padStart(2, '0');

const formatDateInput = (dateObj) => {
  return `${dateObj.getFullYear()}-${padTime(dateObj.getMonth() + 1)}-${padTime(dateObj.getDate())}`;
};

const formatTimeInput = (dateObj) => {
  return `${padTime(dateObj.getHours())}:${padTime(dateObj.getMinutes())}`;
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

const ThemeSelector = ({ themes, currentTheme, onSelect }) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      {themes.map((theme) => {
        const isSelected = currentTheme.name === theme.name;

        return (
          <button
            key={theme.name}
            type="button"
            onClick={() => onSelect(theme)}
            className={`rounded-2xl border px-3 py-3 text-left transition-all ${isSelected ? 'border-[var(--success-color)] shadow-lg' : 'border-[var(--border)] hover:-translate-y-0.5'}`}
          >
            <div
              className="rounded-xl p-3"
              style={{
                background: `linear-gradient(135deg, ${theme.backgroundGradient[0]}, ${theme.backgroundGradient[1]})`
              }}
            >
              <div
                className="rounded-lg p-2 mb-2"
                style={{
                  background: `linear-gradient(135deg, ${theme.cardBackground[0]}, ${theme.cardBackground[1]})`
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="h-2 w-10 rounded-full" style={{ background: theme.accentAH }} />
                  <div className="h-2 w-6 rounded-full" style={{ background: theme.accentEI }} />
                </div>
              </div>

              <div
                className="relative h-8 rounded-lg overflow-hidden"
                style={{
                  background: `linear-gradient(180deg, ${theme.timelineBackground[0]}, ${theme.timelineBackground[1]})`
                }}
              >
                <div
                  className="absolute left-1/2 top-0 bottom-0 w-1 opacity-90"
                  style={{ background: theme.timelineLine }}
                />
                <div
                  className="absolute left-2 right-2 top-2 h-1 rounded-full opacity-80"
                  style={{ background: theme.accentEI }}
                />
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
              <span className="capitalize">{theme.name}</span>
              {isSelected && <span className="text-[var(--success-color)] text-sm">✓</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
};

const IntakeDetailsModal = ({ intake, onClose }) => {
  const [dosage, setDosage] = useState(intake.dosage);
  const [unit, setUnit] = useState(intake.unit);
  const [dateValue, setDateValue] = useState(formatDateInput(intake.timestamp));
  const [timeValue, setTimeValue] = useState(formatTimeInput(intake.timestamp));
  const [showConfirm, setShowConfirm] = useState(false);
  const accentColor = intake.patientId === 'AH' ? 'var(--accent-ah)' : 'var(--accent-ei)';

  const handleSave = async () => {
    const nextDate = new Date(`${dateValue}T${timeValue}`);
    await updateDoc(doc(db, "intakes", intake.id), {
      dosage: Number(dosage),
      unit,
      timestamp: Timestamp.fromDate(nextDate),
      updatedAt: Timestamp.now()
    });
    onClose();
  };

  const handleDelete = async () => {
    await deleteDoc(doc(db, "intakes", intake.id));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mt-12 w-[min(92vw,520px)] max-h-[85vh] overflow-y-auto rounded-3xl border border-[var(--border)] p-5 shadow-2xl"
        style={{ background: 'linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-black text-[var(--text-primary)]">Деталі запису</h3>
            <p className="text-xs font-semibold text-[var(--text-secondary)] mt-1">{intake.patientId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-[var(--border)] text-[var(--text-primary)] flex items-center justify-center"
            aria-label="Close record"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Доза</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.1"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                className="flex-1 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm font-semibold text-[var(--text-primary)] focus:outline-none"
              />
              {['mg', 'ml'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setUnit(type)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${unit === type ? 'text-white' : 'bg-black/5 text-[var(--text-secondary)]'}`}
                  style={unit === type ? { background: accentColor } : undefined}
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Дата</label>
              <input
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-xs font-semibold text-[var(--text-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Час</label>
              <input
                type="time"
                value={timeValue}
                onChange={(e) => setTimeValue(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-xs font-semibold text-[var(--text-primary)] focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="flex-1 rounded-2xl border border-red-400/70 px-4 py-3 text-xs font-bold text-red-400"
          >
            Видалити
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-2xl bg-gradient-to-r from-[var(--accent-ah)] to-[var(--accent-ei)] px-4 py-3 text-xs font-bold text-white"
          >
            Зберегти
          </button>
        </div>

        {showConfirm && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-3xl">
            <div className="w-[min(80vw,320px)] rounded-2xl border border-[var(--border)] p-4 text-center"
              style={{ background: 'linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))' }}
            >
              <p className="text-sm font-bold text-[var(--text-primary)]">Видалити цей запис?</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">Цю дію не можна скасувати.</p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--text-primary)]"
                >
                  Скасувати
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex-1 rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white"
                >
                  Підтвердити
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function MedTrackerCard({
  title,
  onAddSuccess,
  isSelectingTime,
  selectedTime,
  onStartTimeSelection,
  onCancelTimeSelection,
  onResetTimeSelection
}) {
  const UNIT_CONFIG = {
    mg: { min: 1, max: 250, step: 1, default: 50, label: 'мг' },
    ml: { min: 0.1, max: 5.0, step: 0.1, default: 0.5, label: 'мл' }
  };

  const [unit, setUnit] = useState('mg');
  const [currentDosage, setCurrentDosage] = useState(UNIT_CONFIG.mg.default);
  const isAddDisabled = isSelectingTime && !selectedTime;

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
    const intakeTimestamp = isSelectingTime && selectedTime ? selectedTime : new Date();
    try {
      await addDoc(collection(db, "intakes"), {
        patientId: title,
        dosage: currentDosage,
        unit: unit,
        timestamp: Timestamp.fromDate(intakeTimestamp),
        createdAt: Timestamp.now()
      });
      onAddSuccess(`${title}: Додано ${currentDosage} ${unit}`);
      onResetTimeSelection(title);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div
      className="flex-1 backdrop-blur-md rounded-[2rem] p-3 shadow-lg border border-[var(--border)] relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))' }}
    >
      <div className={`absolute top-3 left-3 px-2 py-0.5 rounded-md text-[10px] font-bold text-white ${title === 'AH' ? 'bg-[var(--accent-ah)]' : 'bg-[var(--accent-ei)]'}`}>
        {title}
      </div>

      <div className="flex flex-col items-center mt-3">
        <div className="flex gap-2 mb-2">
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
          <button onClick={() => adjustDosage(-1)} className="w-9 h-9 rounded-full bg-black/5 text-[var(--text-primary)] text-lg flex items-center justify-center">-</button>
          <div className="text-center">
            <span className="text-3xl font-black text-[var(--text-primary)] leading-none">{currentDosage}</span>
            <span className="text-sm font-bold text-[var(--text-secondary)] ml-1">{UNIT_CONFIG[unit].label}</span>
          </div>
          <button onClick={() => adjustDosage(1)} className="w-9 h-9 rounded-full bg-black/5 text-[var(--text-primary)] text-lg flex items-center justify-center">+</button>
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
            onClick={() => (isSelectingTime ? onCancelTimeSelection(title) : onStartTimeSelection(title))}
            className="w-full py-2 rounded-xl bg-black/5 text-[var(--text-secondary)] text-xs font-semibold flex items-center justify-center gap-2"
          >
            <span className="text-lg">🕒</span>
            {isSelectingTime
              ? (selectedTime ? `Відміна · ${formatTime(selectedTime)}` : 'Відміна')
              : 'Вказати час'}
          </button>

          <button
            onClick={handleAddIntake}
            disabled={isAddDisabled}
            className={`w-full py-3 rounded-2xl bg-gradient-to-r from-[var(--accent-ah)] to-[var(--accent-ei)] text-white font-bold text-lg shadow-md transition-transform ${isAddDisabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
          >
            + Додати
          </button>
        </div>
      </div>
    </div>
  );
}

const DAY_HEIGHT = 960;
const TIMELINE_TITLE_DEFAULT = 'Timeline';

function TimelineHistory({
  onDayChange,
  selectedId,
  onSelectIntake,
  isSelectingTime,
  onTimeSelected
}) {
  const [intakes, setIntakes] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hoverLine, setHoverLine] = useState(null);
  const [selectedLine, setSelectedLine] = useState(null);
  const isPointerDown = useRef(false);
  const scrollRef = useRef(null);
  const dayRefs = useRef([]);

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

  useEffect(() => {
    if (!isSelectingTime) return;
    if (selectedLine) return;
    const now = new Date();
    setSelectedLine({ date: getStartOfDay(now), mins: now.getHours() * 60 + now.getMinutes() });
  }, [isSelectingTime, selectedLine]);

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

  const sortedDays = useMemo(() => groupedByDay, [groupedByDay]);

  useEffect(() => {
    dayRefs.current = sortedDays.map((_, idx) => dayRefs.current[idx] || React.createRef());
  }, [sortedDays]);

   const updateCurrentDayHeading = useCallback(() => {
     if (!scrollRef.current || !sortedDays.length) return;
     const containerTop = scrollRef.current.getBoundingClientRect().top;
     const headerOffset = 48;
     let activeIndex = 0;

     dayRefs.current.forEach((ref, idx) => {
       if (!ref.current) return;
       const rect = ref.current.getBoundingClientRect();
       const topOffset = rect.top - containerTop;
       if (topOffset <= headerOffset) {
         activeIndex = idx;
       }
     });

     const activeDay = sortedDays[activeIndex];
     if (activeDay) {
       onDayChange(formatViewedDate(activeDay.date));
     }
   }, [onDayChange, sortedDays]);

  useEffect(() => {
    updateCurrentDayHeading();
  }, [updateCurrentDayHeading, sortedDays]);

  const getTimeTop = (date) => {
    const mins = date.getHours() * 60 + date.getMinutes();
    return ((1440 - mins) / 1440) * 100;
  };

  const getTopFromMins = (mins) => ((1440 - mins) / 1440) * 100;

  const getMinutesFromPointer = (rect, clientY) => {
    const relative = Math.min(Math.max(clientY - rect.top, 0), rect.height);
    const ratio = 1 - relative / rect.height;
    return Math.round(ratio * 1440);
  };

  const getDayFromPointer = (clientY) => {
    if (!dayRefs.current.length) return null;
    for (let i = 0; i < dayRefs.current.length; i += 1) {
      const ref = dayRefs.current[i]?.current;
      if (!ref) continue;
      const rect = ref.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return { day: sortedDays[i], rect };
      }
    }
    return null;
  };

  const updateHoverFromPointer = (clientY) => {
    const target = getDayFromPointer(clientY);
    if (!target) return;
    const mins = getMinutesFromPointer(target.rect, clientY);
    setHoverLine({ date: target.day.date, mins });
  };

  const updateSelectionFromPointer = (clientY) => {
    const target = getDayFromPointer(clientY);
    if (!target) return;
    const mins = getMinutesFromPointer(target.rect, clientY);
    const selectedDate = new Date(target.day.date);
    selectedDate.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    setSelectedLine({ date: target.day.date, mins });
    onTimeSelected(selectedDate);
  };

  const handlePointerMove = (e) => {
    if (!e.clientY) return;
    updateHoverFromPointer(e.clientY);
    if (isPointerDown.current) {
      updateSelectionFromPointer(e.clientY);
    }
  };

  const handlePointerDown = (e) => {
    isPointerDown.current = true;
    updateSelectionFromPointer(e.clientY);
  };

  const handlePointerUp = () => {
    isPointerDown.current = false;
  };

  useEffect(() => {
    const handleWindowUp = () => {
      isPointerDown.current = false;
    };
    window.addEventListener('pointerup', handleWindowUp);
    window.addEventListener('pointercancel', handleWindowUp);
    return () => {
      window.removeEventListener('pointerup', handleWindowUp);
      window.removeEventListener('pointercancel', handleWindowUp);
    };
  }, []);

  return (
    <div
      ref={scrollRef}
      className="flex-grow overflow-y-auto custom-scrollbar px-4 pb-20"
      onClick={() => onSelectIntake(null)}
      onScroll={updateCurrentDayHeading}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <div className="relative">
         {sortedDays.map((day, index) => (
           <div
             key={day.date.getTime()}
             ref={dayRefs.current[index]}
             className="relative"
              style={{
                height: `${DAY_HEIGHT}px`,
                background: `linear-gradient(180deg, ${index % 2 === 0 ? 'var(--timeline-bg-start)' : 'var(--timeline-bg-alt-start)'}, ${index % 2 === 0 ? 'var(--timeline-bg-end)' : 'var(--timeline-bg-alt-end)'})`
              }}
            >
            {/* Markers */}
            {[...Array(24 * 6)].map((_, i) => {
              const mins = i * 10;
              const top = ((1440 - mins) / 1440) * 100;
              const isMajor = mins % 180 === 0;
              return (
                <div key={i} className="absolute left-1/2 flex items-center" style={{ top: `${top}%` }}>
                  <div className={`h-[1px] bg-[var(--marker-color)] opacity-60 ${isMajor ? 'w-6' : 'w-3'}`} />
                  {isMajor && (
                    <span className="ml-2 text-[10px] font-bold text-[var(--marker-color)]">
                      {String(Math.floor(mins / 60)).padStart(2, '0')}:00
                    </span>
                  )}
                </div>
              );
            })}

            {/* Central Line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-[var(--timeline-line)] -translate-x-1/2 opacity-90 shadow-[0_0_8px_var(--timeline-line)]" />

            {/* Current Time Line */}
            {getStartOfDay(currentTime).getTime() === day.date.getTime() && (
              <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${getTimeTop(currentTime)}%` }}>
                <div className="w-full h-px bg-[var(--accent-ah)] opacity-50 shadow-[0_0_8px_var(--accent-ah)]" />
                <div className="absolute right-0 -top-4 px-2 py-0.5 bg-[var(--accent-ah)] text-white text-[10px] font-bold rounded-l-md shadow-sm">
                  {formatTime(currentTime)}
                </div>
              </div>
            )}

            {/* Hover Line */}
            {hoverLine && hoverLine.date.getTime() === day.date.getTime() && (
              <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: `${getTopFromMins(hoverLine.mins)}%` }}>
                <div className="w-full h-px bg-[var(--marker-color)] opacity-40" />
                <div className="absolute right-0 -top-4 px-2 py-0.5 bg-[var(--marker-color)] text-[var(--text-primary)] text-[10px] font-bold rounded-l-md shadow-sm opacity-80">
                  {formatTime(new Date(day.date.getTime() + hoverLine.mins * 60000))}
                </div>
              </div>
            )}

            {/* Selected Time Line */}
            {isSelectingTime && selectedLine && selectedLine.date.getTime() === day.date.getTime() && (
              <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${getTopFromMins(selectedLine.mins)}%` }}>
                <div className="w-full h-px bg-[var(--accent-ei)] opacity-80 shadow-[0_0_10px_var(--accent-ei)]" />
                <div className="absolute right-0 -top-4 px-2 py-0.5 bg-[var(--accent-ei)] text-white text-[10px] font-bold rounded-l-md shadow-sm">
                  {formatTime(new Date(day.date.getTime() + selectedLine.mins * 60000))}
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
                  onClick={(e) => { e.stopPropagation(); onSelectIntake(isSelected ? null : intake); }}
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
                  </div>
                  <div className={`absolute w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 ${isAH ? '-right-1.5' : '-left-1.5'} ${isAH ? 'bg-[var(--accent-ah)]' : 'bg-[var(--accent-ei)]'}`} />
                </div>
              );
            })}

            <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none">
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
  const [timelineHeading, setTimelineHeading] = useState(TIMELINE_TITLE_DEFAULT);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedIntakeId, setSelectedIntakeId] = useState(null);
  const [activeIntake, setActiveIntake] = useState(null);
  const [activeTimeSelection, setActiveTimeSelection] = useState(null);
  const [selectedTimeMap, setSelectedTimeMap] = useState({});

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
    localStorage.setItem('theme', currentTheme.name);
  }, [currentTheme]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col transition-colors duration-500" style={{ background: `linear-gradient(135deg, var(--bg-gradient-start), var(--bg-gradient-end))` }}>
      {notification && <Notification message={notification} onClose={() => setNotification(null)} />}

      {/* Header */}
      <header className="p-4 flex justify-end items-center">
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="w-10 h-10 rounded-full border border-[var(--border)] text-[var(--text-primary)] shadow-md hover:scale-105 transition-transform"
          style={{ background: 'linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))' }}
          aria-label="Open settings"
        >
          <span className="text-lg">⚙️</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col gap-4 max-w-lg mx-auto w-full px-4 overflow-hidden">
        <div className="flex gap-3">
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

        <div
          className="flex-grow backdrop-blur-md rounded-t-[2.5rem] pt-6 shadow-2xl border-x border-t border-[var(--border)] flex flex-col overflow-hidden"
          style={{ background: 'linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))' }}
        >
          <h2 className="text-center text-xs font-black text-[var(--text-secondary)] tracking-[0.3em] uppercase mb-2">{timelineHeading}</h2>
          {activeTimeSelection && (
            <div className="text-center text-[10px] font-semibold text-[var(--text-secondary)] mb-2">
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
