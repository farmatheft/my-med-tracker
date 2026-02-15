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
        border: '1px solid var(--border)',
        boxShadow: '0 8px 32px var(--shadow-color)',
      }}
    >
      <div className={`flex min-h-[380px] sm:min-h-[420px] ${isAH ? 'flex-row' : 'flex-row-reverse'}`}>

        {/* Syringe column — compact 60px, no shadow */}
        <div
          className="relative overflow-hidden"
          style={{
            width: '60px',
            minWidth: '60px',
            borderRight: isAH ? '1px solid var(--border)' : 'none',
            borderLeft: isAH ? 'none' : '1px solid var(--border)',
          }}
        >
          <div className="absolute inset-0" style={{ top: '-10px', bottom: '-30px' }}>
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
        <div className="flex flex-col flex-1 min-w-0 p-3 sm:p-4">

          {/* Row 1: Title + unit toggle */}
          <div className="flex items-center justify-between mb-2">
            <h2
              className="text-2xl sm:text-3xl font-black tracking-tighter leading-none"
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
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)' }}
            >
              {['mg', 'ml'].map((u) => (
                <button
                  key={u}
                  onClick={() => handleUnitChange(u)}
                  className="px-2.5 py-0.5 text-[10px] font-bold transition-all"
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

          {/* Row 2: Subtype selector — always fully visible */}
          <SubtypeSelector
            value={subtype}
            onChange={setSubtype}
            options={SUBTYPE_OPTIONS}
          />

          {/* Row 3: Dosage display + controls */}
          <div className="flex-1 flex flex-col items-center justify-center py-2">
            <div className="relative">
              <span
                className="text-4xl sm:text-5xl leading-none font-black tracking-tighter tabular-nums"
                style={{ color: 'var(--text-primary)' }}
              >
                {currentDosage}
              </span>
              <span
                className="absolute -top-1.5 -right-5 text-[10px] font-bold"
                style={{ color: 'var(--text-secondary)', opacity: 0.6 }}
              >
                {UNIT_CONFIG[unit].label}
              </span>
            </div>

            <div className="flex gap-2.5 mt-2.5">
              {[{ d: -1, sym: '−' }, { d: 1, sym: '+' }].map(({ d, sym }) => (
                <button
                  key={d}
                  onClick={() => adjustDosage(d)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-base font-black transition-all hover:scale-110 active:scale-90"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>

          {/* Row 4: Time + Add */}
          <div className="mt-auto pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => (isSelectingTime ? onCancelTimeSelection(title) : onStartTimeSelection(title))}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider mb-2 transition-all"
              style={{
                background: isSelectingTime ? 'var(--accent-primary)' : 'rgba(255,255,255,0.04)',
                color: isSelectingTime ? '#fff' : 'var(--text-secondary)',
                border: isSelectingTime ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
              }}
            >
              <FaRegClock className="text-[10px]" />
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
