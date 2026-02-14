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
    <div
      className="flex-1 relative rounded-[2.5rem] overflow-hidden border border-[var(--border)] shadow-2xl transition-all duration-500 group"
      style={{
        background: 'var(--surface)',
        boxShadow: 'inset 0 0 60px rgba(0,0,0,0.1), 0 20px 40px var(--shadow-color-strong)'
      }}
    >
      {/* Inner Shadow Overlay for 3D Volume Effect */}
      <div className="absolute inset-0 pointer-events-none z-20 rounded-[2.5rem] shadow-[inset_0_0_40px_rgba(0,0,0,0.2)]"></div>

      {/* Grid Layout: 
          - Mobile: Stacked (Syringe hidden or smaller? User asked for big syringe. Maybe side-by-side even on mobile if space allows, or stack.)
          - Desktop: Side-by-side.
      */}
      <div className={`grid min-h-[480px] relative z-10 ${title === 'EI' ? 'grid-cols-[100px_1fr]' : 'grid-cols-[1fr_100px]'
        }`}>

        {/* --- LEFT COLUMN (Syringe for EI) --- */}
        {title === 'EI' && (
          <div className="relative w-full bg-black/5 border-r border-white/5">
            <div className="absolute inset-0 w-full py-6">
              <SyringeSlider
                value={currentDosage}
                onChange={setCurrentDosage}
                min={UNIT_CONFIG[unit].min}
                max={UNIT_CONFIG[unit].max}
                step={UNIT_CONFIG[unit].step}
                color={activeColor}
                side="left"
              />
            </div>
          </div>
        )}

        {/* --- MAIN CONTENT (Middle) --- */}
        <div className="flex flex-col h-full p-5 relative">

          {/* Header Area */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex flex-col">
              <h2
                className="text-4xl sm:text-5xl font-black tracking-tighter leading-none mb-1"
                style={{
                  background: title === 'AH'
                    ? 'linear-gradient(to right, var(--accent-ah), var(--subtype-im))'
                    : 'linear-gradient(to right, var(--accent-ei), var(--subtype-iv))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                }}
              >
                {title}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                {/* Unit Toggle */}
                <div className="flex bg-black/5 rounded-lg p-0.5">
                  {['mg', 'ml'].map((u) => (
                    <button
                      key={u}
                      onClick={() => handleUnitChange(u)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${unit === u
                        ? 'bg-white shadow text-black'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Subtype Badge */}
            <div className="relative">
              <SubtypeSelector
                value={subtype}
                onChange={setSubtype}
                options={SUBTYPE_OPTIONS}
              />
            </div>
          </div>

          {/* Large Dosage Display */}
          <div className="flex-1 flex flex-col items-center justify-center py-2">
            <div className="relative">
              <span
                className="text-6xl sm:text-[5rem] leading-none font-black tracking-tighter"
                style={{ color: 'var(--text-primary)' }}
              >
                {currentDosage}
              </span>
              <span className="absolute -top-4 -right-8 text-xl font-bold text-[var(--text-secondary)] opacity-60">
                {UNIT_CONFIG[unit].label}
              </span>
            </div>

            {/* Dosage Buttons */}
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => adjustDosage(-1)}
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-black bg-[var(--surface-2)] text-[var(--text-primary)] shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                −
              </button>
              <button
                onClick={() => adjustDosage(1)}
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-black bg-[var(--surface-2)] text-[var(--text-primary)] shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                +
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-auto pt-4 border-t border-[var(--border)]">
            <div className="flex items-center justify-between gap-3 mb-4">
              <button
                type="button"
                onClick={() => (isSelectingTime ? onCancelTimeSelection(title) : onStartTimeSelection(title))}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider border transition-all ${isSelectingTime
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                  : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
                  }`}
              >
                <FaRegClock className="text-lg" />
                {isSelectingTime ? (selectedTime ? formatTime(selectedTime) : 'Now') : 'Time'}
              </button>
            </div>

            <AddIntakeButton onClick={handleAddIntake} disabled={isAddDisabled} />
          </div>

        </div>

        {/* --- RIGHT COLUMN (Syringe for AH) --- */}
        {title === 'AH' && (
          <div className="relative w-full bg-black/5 border-l border-white/5">
            <div className="absolute inset-0 w-full py-6">
              <SyringeSlider
                value={currentDosage}
                onChange={setCurrentDosage}
                min={UNIT_CONFIG[unit].min}
                max={UNIT_CONFIG[unit].max}
                step={UNIT_CONFIG[unit].step}
                color={activeColor}
                side="right"
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default MedTrackerCard;
