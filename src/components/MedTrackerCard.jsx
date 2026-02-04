import { useState } from 'react';
import { GiWaterDrop } from 'react-icons/gi';
import { FaSyringe, FaPills, FaRegClock } from 'react-icons/fa6';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { formatTime, getStartOfDay } from '../utils/time';
import SyringeSlider from './SyringeSlider';
import AddIntakeButton from './AddIntakeButton';
import SubtypeSelector from './SubtypeSelector';

const UNIT_CONFIG = {
  mg: { min: 0, max: 100, step: 1, default: 0, label: 'мг' },
  ml: { min: 0, max: 5.0, step: 0.1, default: 0, label: 'мл' }
};

const SUBTYPE_OPTIONS = [
  { value: 'IV', label: 'IV', icon: GiWaterDrop },
  { value: 'IM', label: 'IM', icon: FaSyringe },
  { value: 'PO', label: 'PO', icon: FaPills },
  { value: 'IV+PO', label: 'IV+PO', icon: GiWaterDrop },
  { value: 'VTRK', label: 'VTRK', icon: GiWaterDrop }
];

const getDefaultSubtype = (title) => {
  if (title === 'AH') return 'IM';
  if (title === 'EI') return 'IV';
  return '';
};

const MedTrackerCard = ({
  title,
  onAddSuccess,
  isSelectingTime,
  selectedTime,
  onStartTimeSelection,
  onCancelTimeSelection,
  onResetTimeSelection
}) => {
  const [unit, setUnit] = useState('mg');
  const [currentDosage, setCurrentDosage] = useState(UNIT_CONFIG.mg.default);
  const [subtype, setSubtype] = useState(() => getDefaultSubtype(title));
  
  const isAddDisabled = isSelectingTime && !selectedTime;
  const isSelectedToday = selectedTime
    ? getStartOfDay(selectedTime).getTime() === getStartOfDay(new Date()).getTime()
    : false;
  const selectedDateLabel = selectedTime && !isSelectedToday
    ? ` ${selectedTime.toLocaleDateString('uk-UA')}`
    : '';

  const activeColor =
    subtype === 'IV'
      ? 'var(--subtype-iv)'
      : subtype === 'IM'
        ? 'var(--subtype-im)'
        : subtype === 'PO'
          ? 'var(--subtype-po)'
          : subtype === 'IV+PO'
            ? 'var(--subtype-po)'
            : subtype === 'VTRK'
            ? 'var(--subtype-vtrk)'
            : title === 'AH'
              ? 'var(--accent-ah)'
              : 'var(--accent-ei)';

  const handleUnitChange = (newUnit) => {
    setUnit(newUnit);
    setCurrentDosage(UNIT_CONFIG[newUnit].default);
  };

  const adjustDosage = (delta) => {
    setCurrentDosage((prev) => {
      const config = UNIT_CONFIG[unit];
      const nextVal = Math.round((prev + delta * config.step) * 10) / 10;
      return Math.min(Math.max(nextVal, config.min), config.max);
    });
  };

  const handleAddIntake = async () => {
    const intakeTimestamp = isSelectingTime && selectedTime ? selectedTime : new Date();
    try {
      await addDoc(collection(db, 'intakes'), {
        patientId: title,
        dosage: currentDosage,
        unit: unit,
        subtype: subtype || null,
        timestamp: Timestamp.fromDate(intakeTimestamp),
        createdAt: Timestamp.now()
      });
      onAddSuccess(`${title}: Додано ${currentDosage} ${unit}`);
      onResetTimeSelection(title);
      setCurrentDosage(0);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 rounded-[2rem] overflow-hidden border border-[var(--border)] shadow-soft-strong">
      {/* Header Panel - Gradient with overlay */}
      <div
        className="p-3 rounded-t-[2rem]"
        style={{
          background: `linear-gradient(135deg, var(--gradient-header-start), var(--gradient-header-end))`,
          borderBottom: '2px solid var(--add-btn-border)'
        }}
      >
        {/* Dark overlay for contrast */}
        <div
          className="rounded-[1.5rem] p-2"
          style={{ backgroundColor: 'var(--gradient-header-overlay)' }}
        >
          <div className="flex items-center justify-between gap-2">
            {/* Title Badge */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
              style={{
                background: 'var(--success-color)',
                color: 'var(--add-btn-bg)',
                boxShadow: '0 0 12px var(--success-color)'
              }}
            >
              {title}
            </div>

            {/* Unit Toggle */}
            <div
              className="flex items-center rounded-xl p-1 shrink-0"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              {['mg', 'ml'].map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => handleUnitChange(u)}
                  className="px-3 py-1 rounded-lg text-[10px] font-bold tracking-wide transition"
                  style={
                    unit === u
                      ? {
                          background: 'var(--success-color)',
                          color: 'var(--add-btn-bg)'
                        }
                      : { color: 'var(--gradient-header-text)', opacity: 0.8 }
                  }
                >
                  {u.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Subtype Selector */}
            <div
              className="flex justify-center items-center gap-1 px-2 py-1 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.1)' }}
            >
              {SUBTYPE_OPTIONS.map((option) => {
                const isActive = subtype === option.value;
                const Icon = option.icon;
                const cssColor =
                  option.value === 'IV' ? 'var(--subtype-iv)' :
                  option.value === 'IM' ? 'var(--subtype-im)' :
                  option.value === 'PO' ? 'var(--subtype-po)' :
                  option.value === 'IV+PO' ? 'var(--subtype-po)' :
                  option.value === 'VTRK' ? 'var(--subtype-vtrk)' :
                  'var(--text-secondary)';
                
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSubtype(option.value)}
                    className="flex flex-col items-center gap-0.5 transition-opacity"
                    style={{ opacity: isActive ? 1 : 0.5 }}
                  >
                    <div
                      className="w-7 h-7 rounded-lg border flex items-center justify-center"
                      style={
                        isActive
                          ? { borderColor: cssColor, background: `color-mix(in srgb, ${cssColor} 30%, transparent)`, color: cssColor }
                          : { borderColor: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'var(--gradient-header-text)' }
                      }
                    >
                      <span className="flex items-center gap-0.5">
                        <Icon className="text-xs" />
                        {option.value === 'IV+PO' && <FaPills className="text-[6px]" />}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Body Panel - With small gap from header */}
      <div
        className="mt-1 p-4 sm:p-5 rounded-t-[1.5rem] flex flex-col gap-4 sm:gap-5"
        style={{ background: 'var(--surface-2)' }}
      >
        {/* Dosage Control with Large Value Indicator */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => adjustDosage(-1)}
            className="w-10 h-10 rounded-xl text-lg font-black flex items-center justify-center active:scale-95 transition"
            style={{
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              boxShadow: '0 10px 24px var(--shadow-color)'
            }}
            aria-label="Decrease dosage"
          >
            −
          </button>

          <div className="flex items-end gap-1">
            <span className="text-5xl font-black tracking-tight text-[var(--text-primary)]">{currentDosage}</span>
            <span className="text-lg font-extrabold mb-2" style={{ color: 'var(--text-secondary)', opacity: 0.55 }}>
              {UNIT_CONFIG[unit].label}
            </span>
          </div>

          <button
            type="button"
            onClick={() => adjustDosage(1)}
            className="w-10 h-10 rounded-xl text-lg font-black flex items-center justify-center active:scale-95 transition"
            style={{
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              boxShadow: '0 10px 24px var(--shadow-color)'
            }}
            aria-label="Increase dosage"
          >
            +
          </button>
        </div>

        {/* Slider */}
        <div className="mt-1">
          <SyringeSlider
            value={currentDosage}
            onChange={setCurrentDosage}
            min={UNIT_CONFIG[unit].min}
            max={UNIT_CONFIG[unit].max}
            step={UNIT_CONFIG[unit].step}
            color={activeColor}
            className="h-14"
          />
        </div>

        {/* Time Selection */}
        <div className="flex flex-col items-center gap-1 mt-2">
          <button
            type="button"
            onClick={() => (isSelectingTime ? onCancelTimeSelection(title) : onStartTimeSelection(title))}
            className="text-[10px] font-black uppercase tracking-[0.22em] transition"
            style={{ color: 'var(--text-secondary)', opacity: 0.75 }}
          >
            {isSelectingTime ? (selectedTime ? 'Змінити час' : 'Скасувати') : 'Вказати час'}
          </button>

          <div
            className="px-4 py-2 rounded-xl"
            style={{ background: `color-mix(in srgb, ${activeColor} 12%, transparent)` }}
          >
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black" style={{ color: activeColor }}>
                {isSelectingTime && selectedTime ? formatTime(selectedTime) : formatTime(new Date())}
              </span>
              <FaRegClock className="text-base" style={{ color: activeColor, opacity: 0.75 }} />
            </div>
            {isSelectingTime && selectedTime && selectedDateLabel && (
              <div className="text-center text-[10px] font-semibold mt-0.5" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                {selectedDateLabel}
              </div>
            )}
          </div>
        </div>

        {/* Add Button */}
        <AddIntakeButton onClick={handleAddIntake} disabled={isAddDisabled} />
      </div>
    </div>
  );
};

export default MedTrackerCard;
