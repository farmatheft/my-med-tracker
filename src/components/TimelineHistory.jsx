import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GiWaterDrop } from 'react-icons/gi';
import { FaSyringe, FaPills } from 'react-icons/fa6';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { formatTime, formatViewedDate, getStartOfDay } from '../utils/time';

const SUBTYPE_BADGES = {
  IV: { label: 'IV', icon: GiWaterDrop, color: '#4FC3F7' },
  IM: { label: 'IM', icon: FaSyringe, color: '#BA68C8' },
  PO: { label: 'PO', icon: FaPills, color: '#FFB74D' },
  'IV+PO': { label: 'IV+PO', icon: GiWaterDrop, color: '#81C784' }
};

const TimelineHistory = ({ onDayChange, selectedId, onSelectIntake, isSelectingTime, onTimeSelected }) => {
  const [intakes, setIntakes] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedLine, setSelectedLine] = useState(null);
  const isPointerDown = useRef(false);
  const scrollRef = useRef(null);
  const dayRefs = useRef([]);

  // Fixed mapping: the visible timeline window represents exactly 24 hours.
  // The parent container defines the viewport height; we just match it.
  const DAY_VIEWPORT_HEIGHT_PX = 600;

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

  const effectiveSelectedLine = useMemo(() => {
    if (!isSelectingTime) return null;
    if (selectedLine) return selectedLine;
    const now = currentTime;
    return { date: getStartOfDay(now), mins: now.getHours() * 60 + now.getMinutes() };
  }, [currentTime, isSelectingTime, selectedLine]);

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

  const formatDurationHM = (minutesTotal) => {
    const total = Math.max(0, Math.round(minutesTotal));
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  };

  const lastPastIntakeIdByPatient = useMemo(() => {
    const now = currentTime;
    const pick = (patientId) => {
      const candidates = intakes
        .filter((i) => i.patientId === patientId)
        .filter((i) => i.timestamp instanceof Date)
        .filter((i) => i.timestamp.getTime() <= now.getTime())
        .slice()
        .sort((a, b) => b.timestamp - a.timestamp);
      return candidates[0]?.id || null;
    };

    return {
      AH: pick('AH'),
      EI: pick('EI')
    };
  }, [currentTime, intakes]);

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
      className="flex-grow overflow-y-auto custom-scrollbar px-5 pb-20"
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
              height: `${DAY_VIEWPORT_HEIGHT_PX}px`,
              background: 'transparent'
            }}
          >
            {/* Markers */}
            <div className="absolute inset-0 pointer-events-none z-0">
              {/* Center reference ticks */}
              {[...Array(24)].map((_, hour) => {
                const mins = hour * 60;
                const top = ((1440 - mins) / 1440) * 100;
                const isLabel = mins % 180 === 0;
                return (
                  <div key={hour} className="absolute left-1/2 flex items-center" style={{ top: `${top}%` }}>
                    <div className="h-px w-4" style={{ background: 'var(--marker-color)', opacity: 0.28 }} />
                    {isLabel && (
                      <span
                        className="absolute -left-20 text-[10px] font-semibold"
                        style={{ color: 'var(--marker-color)', opacity: 0.6 }}
                      >
                        {String(hour).padStart(2, '0')}:00
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Gaps: time passed between two adjacent intakes (AH left, EI right) */}
            <div className="absolute inset-0 pointer-events-none z-0">
              {(() => {
                const isToday = getStartOfDay(currentTime).getTime() === day.date.getTime();

                const sortedByPatient = (patientId) =>
                  day.intakes
                    .filter((i) => i.patientId === patientId)
                    .slice()
                    .sort((a, b) => b.timestamp - a.timestamp);

                const buildGaps = (items) =>
                  items.slice(0, -1).map((current, idx) => {
                    const next = items[idx + 1];

                    const top1 = getTimeTop(current.timestamp);
                    const top2 = getTimeTop(next.timestamp);
                    const top = (top1 + top2) / 2;

                    const minutesPassed = Math.abs((current.timestamp - next.timestamp) / 60000);

                    return {
                      id: `${current.id}__${next.id}`,
                      top,
                      label: formatDurationHM(minutesPassed)
                    };
                  });

                const ahGaps = buildGaps(sortedByPatient('AH'));
                const eiGaps = buildGaps(sortedByPatient('EI'));

                const buildNowGap = (patientId) => {
                  if (!isToday) return null;
                  const lastPast = day.intakes
                    .filter((i) => i.patientId === patientId)
                    .filter((i) => i.timestamp instanceof Date)
                    .filter((i) => i.timestamp.getTime() <= currentTime.getTime())
                    .slice()
                    .sort((a, b) => b.timestamp - a.timestamp)[0];
                  if (!lastPast) return null;

                  const top1 = getTimeTop(lastPast.timestamp);
                  const top2 = getTimeTop(currentTime);
                  const top = (top1 + top2) / 2;
                  const minutesPassed = Math.abs((currentTime - lastPast.timestamp) / 60000);

                  // Avoid rendering a near-zero label when the last intake is essentially "now".
                  if (minutesPassed < 1) return null;

                  return {
                    id: `${lastPast.id}__now`,
                    top,
                    label: formatDurationHM(minutesPassed)
                  };
                };

                const ahNowGap = buildNowGap('AH');
                const eiNowGap = buildNowGap('EI');

                const commonStyle = {
                  color: 'var(--text-secondary)',
                  opacity: 0.22,
                  fontSize: '28px',
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                  textShadow: '0 1px 0 rgba(0,0,0,0.08)'
                };

                return (
                  <>
                    {ahGaps.map((g) => (
                      <div
                        key={`ah-gap-${g.id}`}
                        className="absolute left-1/2 whitespace-nowrap"
                        style={{
                          top: `${g.top}%`,
                          transform: 'translate(-100%, -50%) translateX(-12px)',
                          ...commonStyle
                        }}
                      >
                        {g.label}
                      </div>
                    ))}

                    {ahNowGap && (
                      <div
                        key={`ah-gap-${ahNowGap.id}`}
                        className="absolute left-1/2 whitespace-nowrap"
                        style={{
                          top: `${ahNowGap.top}%`,
                          transform: 'translate(-100%, -50%) translateX(-12px)',
                          ...commonStyle
                        }}
                      >
                        {ahNowGap.label}
                      </div>
                    )}

                    {eiGaps.map((g) => (
                      <div
                        key={`ei-gap-${g.id}`}
                        className="absolute left-1/2 whitespace-nowrap"
                        style={{
                          top: `${g.top}%`,
                          transform: 'translate(0, -50%) translateX(12px)',
                          ...commonStyle
                        }}
                      >
                        {g.label}
                      </div>
                    ))}

                    {eiNowGap && (
                      <div
                        key={`ei-gap-${eiNowGap.id}`}
                        className="absolute left-1/2 whitespace-nowrap"
                        style={{
                          top: `${eiNowGap.top}%`,
                          transform: 'translate(0, -50%) translateX(12px)',
                          ...commonStyle
                        }}
                      >
                        {eiNowGap.label}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Central Line */}
            <div
              className="absolute left-1/2 top-6 bottom-6 -translate-x-1/2 z-0"
              style={{ width: '6px' }}
            >
              <div
                className="absolute inset-y-0 left-1/2 -translate-x-1/2 rounded-full"
                style={{ width: '4px', background: 'var(--timeline-line)', opacity: 0.35 }}
              />
            </div>

            {/* Current Time Line */}
            {getStartOfDay(currentTime).getTime() === day.date.getTime() && (
              <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: `${getTimeTop(currentTime)}%` }}>
                <div className="w-full h-px" style={{ background: 'var(--accent-ah)', opacity: 0.18 }} />
              </div>
            )}

            {/* Selected Time Line */}
            {isSelectingTime &&
              effectiveSelectedLine &&
              effectiveSelectedLine.date.getTime() === day.date.getTime() && (
              <div
                className="absolute left-0 right-0 z-10 pointer-events-none"
                style={{ top: `${getTopFromMins(effectiveSelectedLine.mins)}%` }}
              >
                <div className="w-full h-px" style={{ background: 'var(--accent-ei)', opacity: 0.35 }} />
                <div
                  className="absolute left-1/2 -translate-x-1/2 -top-4 px-4 py-1 rounded-full text-[10px] font-black"
                  style={{
                    color: 'var(--text-primary)',
                    background: 'color-mix(in srgb, var(--success-color) 22%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--success-color) 55%, transparent)',
                    boxShadow: '0 10px 24px var(--shadow-color)'
                  }}
                >
                  {formatTime(new Date(day.date.getTime() + effectiveSelectedLine.mins * 60000))}
                </div>
              </div>
            )}

            {/* Intakes */}
            <div className="absolute inset-0 z-20">
              {day.intakes.map((intake) => {
                const isAH = intake.patientId === 'AH';
                const isSelected = selectedId === intake.id;
                const top = getTimeTop(intake.timestamp);

                const isLastPastForPatient =
                  (isAH && lastPastIntakeIdByPatient.AH === intake.id) ||
                  (!isAH && lastPastIntakeIdByPatient.EI === intake.id);
                const sinceNowLabel = isLastPastForPatient
                  ? formatDurationHM(Math.abs((currentTime - intake.timestamp) / 60000))
                  : null;

                const mainAccent = isAH ? 'var(--accent-ah)' : 'var(--accent-ei)';
                const bubbleBg = isAH
                  ? 'color-mix(in srgb, var(--accent-ah) 14%, transparent)'
                  : 'color-mix(in srgb, var(--accent-ei) 14%, transparent)';

                const subtypeBadge = intake.subtype ? SUBTYPE_BADGES[intake.subtype] : null;
                const SubtypeIcon = subtypeBadge?.icon;

                return (
                  <div
                    key={intake.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectIntake(isSelected ? null : intake);
                    }}
                    className={`absolute flex items-center transition-all duration-200 cursor-pointer ${
                      isAH ? 'right-1/2 pr-5 justify-end' : 'left-1/2 pl-5'
                    } ${selectedId && !isSelected ? 'opacity-30' : 'opacity-100'}`}
                    style={{ top: `${top}%`, transform: 'translateY(-50%)', width: '46%' }}
                  >
                    <div
                      className="px-3 py-2 rounded-2xl border"
                      style={{
                        background: bubbleBg,
                        borderColor: 'rgba(255,255,255,0.55)',
                        boxShadow: isSelected ? '0 18px 44px var(--shadow-color-strong)' : '0 10px 24px var(--shadow-color)',
                        transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                        backdropFilter: 'blur(8px)'
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>
                          {intake.dosage}
                        </span>
                        <span className="text-[10px] font-black" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                          {intake.unit}
                        </span>
                        <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                          {formatTime(intake.timestamp)}
                        </span>
                        {sinceNowLabel && (
                          <span
                            className="ml-1 text-[10px] font-black"
                            style={{ color: 'var(--text-secondary)', opacity: 0.7 }}
                          >
                            +{sinceNowLabel}
                          </span>
                        )}
                        {subtypeBadge && (
                          <span
                            className="ml-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-black"
                            style={{ backgroundColor: subtypeBadge.color, color: 'white' }}
                          >
                            {SubtypeIcon && <SubtypeIcon className="text-[10px]" />}
                            {subtypeBadge.label === 'IV+PO' && <FaPills className="text-[9px]" />}
                            {subtypeBadge.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      className={`absolute w-2.5 h-2.5 rounded-full border-2 z-10 ${
                        isAH ? '-right-1.5' : '-left-1.5'
                      }`}
                      style={{
                        background: `color-mix(in srgb, ${mainAccent} 85%, white)`,
                        borderColor: 'var(--surface-2)',
                        boxShadow: `0 0 16px ${mainAccent}`
                      }}
                    />
                  </div>
                );
              })}
            </div>

            <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none z-30">
              <span
                className="px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest"
                style={{ background: 'transparent', color: 'var(--text-secondary)', opacity: 0.75 }}
              >
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
