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

  const isAH = title === 'AH';

  return (
    <div
      className="flex-1 relative rounded-3xl overflow-hidden transition-all duration-500"
      style={{
        background: 'linear-gradient(145deg, var(--card-bg-start), var(--card-bg-end))',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 32px var(--shadow-color), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {/* Top shine line */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)' }}
      />

      {/* Card content — flex row with syringe + main content */}
      <div className={`flex ${isAH ? 'flex-row' : 'flex-row-reverse'}`}>

        {/* Syringe column — smaller 70px */}
        <div className="relative overflow-hidden" style={{ width: '70px', minWidth: '70px' }}>
          {/* Inner shadow for recessed 3D well effect */}
          <div
            className="absolute inset-0 z-10 pointer-events-none"
            style={{
              boxShadow: isAH
                ? 'inset -15px 0 25px -8px rgba(0,0,0,0.35), inset 0 8px 15px -4px rgba(0,0,0,0.2), inset 0 -8px 15px -4px rgba(0,0,0,0.2)'
                : 'inset 15px 0 25px -8px rgba(0,0,0,0.35), inset 0 8px 15px -4px rgba(0,0,0,0.2), inset 0 -8px 15px -4px rgba(0,0,0,0.2)',
            }}
          />
          <div className="absolute inset-0" style={{ top: '-20px', bottom: '-40px' }}>
            <SyringeSlider
              value={currentDosage}
              onChange={setCurrentDosage}
              min={UNIT_CONFIG[unit].min}
              max={UNIT_CONFIG[unit].max}
              step={UNIT_CONFIG[unit].step}
              color={activeColor}
              side={isAH ? 'right' : 'left'}
            />
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-col flex-1 min-w-0 p-4">

          {/* Title + unit toggle row */}
          <div className="flex items-center justify-between mb-1">
            <h2
              className="text-3xl font-black tracking-tighter leading-none"
              style={{
                background: isAH
                  ? 'linear-gradient(135deg, var(--accent-ah), var(--subtype-im))'
                  : 'linear-gradient(135deg, var(--accent-ei), var(--subtype-iv))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {title}
            </h2>
            <div
              className="flex rounded-lg overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {['mg', 'ml'].map((u) => (
                <button
                  key={u}
                  onClick={() => handleUnitChange(u)}
                  className="px-3 py-1 text-[10px] font-bold transition-all"
                  style={{
                    background: unit === u ? 'rgba(255,255,255,0.15)' : 'transparent',
                    color: unit === u ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Subtype selector — own row, compact horizontal, always visible */}
          <SubtypeSelector
            value={subtype}
            onChange={setSubtype}
            options={SUBTYPE_OPTIONS}
          />

          {/* Dosage display */}
          <div className="flex-1 flex flex-col items-center justify-center py-3">
            <div className="relative">
              <span
                className="text-5xl leading-none font-black tracking-tighter tabular-nums"
                style={{ color: 'var(--text-primary)' }}
              >
                {currentDosage}
              </span>
              <span
                className="absolute -top-2 -right-6 text-xs font-bold"
                style={{ color: 'var(--text-secondary)', opacity: 0.6 }}
              >
                {UNIT_CONFIG[unit].label}
              </span>
            </div>

            <div className="flex gap-3 mt-3">
              <button
                onClick={() => adjustDosage(-1)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-black transition-all hover:scale-110 active:scale-90"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-primary)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                −
              </button>
              <button
                onClick={() => adjustDosage(1)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-black transition-all hover:scale-110 active:scale-90"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-primary)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* Footer actions */}
          <div className="mt-auto pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              type="button"
              onClick={() => (isSelectingTime ? onCancelTimeSelection(title) : onStartTimeSelection(title))}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider mb-2 transition-all"
              style={{
                background: isSelectingTime ? 'var(--accent-primary)' : 'rgba(255,255,255,0.04)',
                color: isSelectingTime ? '#fff' : 'var(--text-secondary)',
                border: isSelectingTime ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <FaRegClock className="text-xs" />
              {isSelectingTime ? (selectedTime ? formatTime(selectedTime) : 'Now') : 'Time'}
            </button>
            <AddIntakeButton onClick={handleAddIntake} disabled={isAddDisabled} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedTrackerCard;
