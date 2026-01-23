import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GiWaterDrop } from 'react-icons/gi';
import { FaSyringe, FaPills } from 'react-icons/fa6';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { DAY_HEIGHT, formatTime, formatViewedDate, getStartOfDay } from '../utils/time';

const SUBTYPE_BADGES = {
  IV: { label: 'IV', icon: GiWaterDrop, color: '#4FC3F7' },
  IM: { label: 'IM', icon: FaSyringe, color: '#BA68C8' },
  PO: { label: 'PO', icon: FaPills, color: '#FFB74D' },
  'IV+PO': { label: 'IV+PO', icon: GiWaterDrop, color: '#81C784' }
};

const TimelineHistory = ({ onDayChange, selectedId, onSelectIntake, isSelectingTime, onTimeSelected }) => {
  const [intakes, setIntakes] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hoverLine, setHoverLine] = useState(null);
  const [selectedLine, setSelectedLine] = useState(null);
  const isPointerDown = useRef(false);
  const scrollRef = useRef(null);
  const dayRefs = useRef([]);

  useEffect(() => {
    const q = query(collection(db, 'intakes'), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setIntakes(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date()
        }))
      );
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

    intakes.forEach((intake) => {
      const dateStr = getStartOfDay(intake.timestamp).toLocaleDateString('uk-UA');
      if (!groups[dateStr]) groups[dateStr] = { date: getStartOfDay(intake.timestamp), intakes: [] };
      groups[dateStr].intakes.push(intake);
    });

    return Object.values(groups).sort((a, b) => b.date - a.date);
  }, [intakes]);

  const sortedDays = useMemo(() => groupedByDay, [groupedByDay]);

  useEffect(() => {
    dayRefs.current = sortedDays.map((_, idx) => dayRefs.current[idx] || { current: null });
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
            ref={(el) => {
              dayRefs.current[index] = { current: el };
            }}
            className="relative"
            style={{
              height: `${DAY_HEIGHT}px`,
              background: `linear-gradient(180deg, ${
                index % 2 === 0 ? 'var(--timeline-bg-start)' : 'var(--timeline-bg-alt-start)'
              }, ${index % 2 === 0 ? 'var(--timeline-bg-end)' : 'var(--timeline-bg-alt-end)'})`
            }}
          >
            <div className="absolute inset-0 z-0">
              {/* Markers */}
              {[...Array(24 * 6)].map((_, i) => {
                const mins = i * 10;
                const top = ((1440 - mins) / 1440) * 100;
                const isMajor = mins % 180 === 0;
                return (
                <div key={i} className="absolute left-1/2 flex items-center" style={{ top: `${top}%` }}>
                    <div className={`h-[1px] bg-[var(--marker-color)] opacity-40 ${isMajor ? 'w-6' : 'w-3'}`} />
                    {isMajor && (
                      <span className="ml-2 text-[10px] font-bold text-[var(--marker-color)] opacity-70">
                        {String(Math.floor(mins / 60)).padStart(2, '0')}:00
                      </span>
                    )}
                  </div>
                );
              })}
              {/* Central Line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-[var(--timeline-line)] -translate-x-1/2 opacity-80 shadow-[0_0_8px_var(--timeline-line)]" />
            </div>

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

              const subtypeBadge = intake.subtype ? SUBTYPE_BADGES[intake.subtype] : null;
              const SubtypeIcon = subtypeBadge?.icon;

              return (
                <div
                  key={intake.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectIntake(isSelected ? null : intake);
                  }}
                  className={`absolute z-10 flex items-center transition-all duration-300 cursor-pointer ${
                    isAH ? 'right-1/2 pr-4 justify-end' : 'left-1/2 pl-4'
                  } ${selectedId && !isSelected ? 'opacity-30 scale-95' : 'opacity-100 scale-100'}`}
                  style={{ top: `${top}%`, transform: 'translateY(-50%)', width: '45%' }}
                >
                  <div
                    className={`flex flex-col ${isAH ? 'items-end' : 'items-start'} ${
                      isSelected ? 'bg-white/10 p-2 rounded-2xl ring-1 ring-[var(--border)]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-black ${isAH ? 'text-[var(--accent-ah)]' : 'text-[var(--accent-ei)]'}`}>
                        {intake.dosage}
                      </span>
                      <span className="text-[10px] font-bold text-[var(--text-secondary)]">{intake.unit}</span>
                      <span className="text-xs font-bold text-[var(--text-primary)] opacity-60">{formatTime(intake.timestamp)}</span>
                      {subtypeBadge && SubtypeIcon && (
                        <span
                          className="ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold text-white"
                          style={{ backgroundColor: subtypeBadge.color }}
                        >
                          <span className="flex items-center gap-0.5 text-[10px]">
                            <SubtypeIcon className="text-[10px]" />
                            {subtypeBadge.label === 'IV+PO' && <FaPills className="text-[9px]" />}
                          </span>
                          {subtypeBadge.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className={`absolute w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 ${
                      isAH ? '-right-1.5' : '-left-1.5'
                    } ${isAH ? 'bg-[var(--accent-ah)]' : 'bg-[var(--accent-ei)]'}`}
                  />
                </div>
              );
            })}

            <div className="absolute top-4 left-0 right-0 z-20 flex justify-center pointer-events-none">
              <span className="px-4 py-1 rounded-full bg-black/5 text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm">
                {formatViewedDate(day.date)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TimelineHistory;
