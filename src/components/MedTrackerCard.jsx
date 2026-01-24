import { useState } from 'react';
import { GiWaterDrop } from 'react-icons/gi';
import { FaSyringe, FaPills, FaRegClock } from 'react-icons/fa6';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { formatTime, getStartOfDay } from '../utils/time';
import SyringeSlider from './SyringeSlider';

const UNIT_CONFIG = {
  mg: { min: 0, max: 100, step: 1, default: 0, label: 'мг' },
  ml: { min: 0, max: 5.0, step: 0.1, default: 0, label: 'мл' }
};

const SUBTYPE_OPTIONS = [
  { value: 'IV', label: 'IV', icon: GiWaterDrop, color: '#3b82f6' }, // Blue
  { value: 'IM', label: 'IM', icon: FaSyringe, color: '#a855f7' },   // Purple
  { value: 'PO', label: 'PO', icon: FaPills, color: '#f59e0b' },     // Amber/Orange
  { value: 'IV+PO', label: 'IV+PO', icon: GiWaterDrop, color: '#22c55e' } // Green
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

  const activeSubtypeConfig = SUBTYPE_OPTIONS.find(o => o.value === subtype);
  const activeColor = activeSubtypeConfig ? activeSubtypeConfig.color : (title === 'AH' ? '#22c55e' : '#3b82f6');

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
    <div
      className="flex-1 rounded-[2rem] p-4 shadow-xl relative flex flex-col gap-3 transition-all duration-300 hover:shadow-2xl"
      style={{ background: 'linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))' }}
    >
      {/* Header */}
      <div className="flex justify-between items-center">
        <div 
          className="px-3 py-1 rounded-lg text-[10px] font-bold text-white shadow-sm"
          style={{ backgroundColor: title === 'AH' ? '#22c55e' : '#22c55e' }}
        >
          {title}
        </div>

        <div
          className="flex rounded-lg p-1 gap-1 border border-[var(--border)]"
          style={{ background: 'linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))' }}
        >
          {['mg', 'ml'].map((u) => (
            <button
              key={u}
              onClick={() => handleUnitChange(u)}
              className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                unit === u
                  ? 'text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              style={unit === u ? { backgroundColor: 'var(--success-color)' } : {}}
            >
              {u.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Subtypes */}
      <div className="flex justify-between px-2">
        {SUBTYPE_OPTIONS.map((option) => {
          const isActive = subtype === option.value;
          const Icon = option.icon;
          return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSubtype(option.value)}
                className={`w-10 h-10 rounded-full flex flex-col items-center justify-center transition-all duration-300 ${
                  isActive 
                    ? 'text-white shadow-md scale-110' 
                    : 'text-[var(--text-secondary)] border border-[var(--border)]'
                }`}
                style={
                  isActive
                    ? { backgroundColor: option.color }
                    : { background: 'linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))' }
                }
              >
                <div className="flex items-center justify-center h-4">
                  <Icon className={isActive ? "text-base" : "text-base"} />
                  {option.value === 'IV+PO' && <FaPills className="text-[8px] ml-0.5" />}
                </div>
              <span className="text-[7px] font-bold mt-0.5">{option.label}</span>
            </button>
          );
        })}
      </div>

      {/* Dosage Control */}
      <div className="flex items-center justify-between px-2">
        <button
          onClick={() => adjustDosage(-1)}
          className="w-8 h-8 rounded-full text-[var(--text-secondary)] text-lg flex items-center justify-center transition-colors shadow-sm border border-[var(--border)]"
          style={{ background: 'linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))' }}
        >
          -
        </button>
        <div className="text-center">
          <span className="text-3xl font-black text-[var(--text-primary)]">{currentDosage}</span>
          <span className="text-sm font-bold text-[var(--text-secondary)] opacity-60 ml-1">{UNIT_CONFIG[unit].label}</span>
        </div>
        <button
          onClick={() => adjustDosage(1)}
          className="w-8 h-8 rounded-full text-[var(--text-secondary)] text-lg flex items-center justify-center transition-colors shadow-sm border border-[var(--border)]"
          style={{ background: 'linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))' }}
        >
          +
        </button>
      </div>

      {/* Slider */}
      <div className="px-2">
        <SyringeSlider
          value={currentDosage}
          onChange={setCurrentDosage}
          min={UNIT_CONFIG[unit].min}
          max={UNIT_CONFIG[unit].max}
          step={UNIT_CONFIG[unit].step}
          color={activeColor}
          className="h-16"
        />
      </div>

      {/* Time Selection */}
      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={() => (isSelectingTime ? onCancelTimeSelection(title) : onStartTimeSelection(title))}
          className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--text-primary)] transition-colors"
        >
          {isSelectingTime ? (selectedTime ? 'Змінити час' : 'Скасувати') : 'Вказати час'}
        </button>
        
        <div className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
          {isSelectingTime && selectedTime ? (
            <>
              <span>{formatTime(selectedTime)}</span>
              {selectedDateLabel && (
                <span className="text-[10px] text-[var(--text-secondary)] opacity-70">{selectedDateLabel}</span>
              )}
            </>
          ) : (
            <span>{formatTime(new Date())}</span>
          )}
          <FaRegClock className="text-[var(--text-secondary)] text-base opacity-80" />
        </div>
      </div>

      {/* Add Button */}
      <button
        onClick={handleAddIntake}
        disabled={isAddDisabled}
        className={`w-full py-3 rounded-xl text-white font-bold text-base shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100`}
        style={{ backgroundColor: 'var(--success-color)' }}
      >
        + Додати
      </button>
    </div>
  );
};

export default MedTrackerCard;
