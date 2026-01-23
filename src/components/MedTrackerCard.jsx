import { useEffect, useMemo, useState } from 'react';
import { GiWaterDrop } from 'react-icons/gi';
import { FaSyringe, FaPills } from 'react-icons/fa6';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { formatTime, getStartOfDay } from '../utils/time';

const UNIT_CONFIG = {
  mg: { min: 0, max: 250, step: 1, default: 0, label: 'мг' },
  ml: { min: 0, max: 5.0, step: 0.1, default: 0, label: 'мл' }
};

const SUBTYPE_OPTIONS = [
  { value: 'IV', label: 'IV', icon: GiWaterDrop, color: '#4FC3F7' },
  { value: 'IM', label: 'IM', icon: FaSyringe, color: '#BA68C8' },
  { value: 'PO', label: 'PO', icon: FaPills, color: '#FFB74D' },
  { value: 'IV+PO', label: 'IV+PO', icon: GiWaterDrop, color: '#81C784' }
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
  const [sliderValue, setSliderValue] = useState(0);
  const [subtype, setSubtype] = useState(() => getDefaultSubtype(title));
  const isAddDisabled = isSelectingTime && !selectedTime;
  const isSelectedToday = selectedTime
    ? getStartOfDay(selectedTime).getTime() === getStartOfDay(new Date()).getTime()
    : false;
  const selectedDateLabel = selectedTime && !isSelectedToday
    ? ` ${selectedTime.toLocaleDateString('uk-UA')}`
    : '';

  const handleUnitChange = (newUnit) => {
    setUnit(newUnit);
    setCurrentDosage(UNIT_CONFIG[newUnit].default);
  };

  const getDosageFromPercent = (percent) => {
    const config = UNIT_CONFIG[unit];
    const raw = (percent / 100) * config.max;
    const precision = config.step < 1 ? 10 : 1;
    const rounded = Math.round(raw * precision) / precision;
    return Math.min(Math.max(rounded, config.min), config.max);
  };

  const getPercentFromDosage = (value) => {
    const config = UNIT_CONFIG[unit];
    if (!config.max) return 0;
    return Math.round((value / config.max) * 100);
  };

  const sliderPercent = useMemo(() => getPercentFromDosage(currentDosage), [currentDosage, unit]);

  useEffect(() => {
    setSliderValue(sliderPercent);
  }, [sliderPercent]);

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
      className="flex-1 backdrop-blur-md rounded-[2rem] p-3 shadow-lg border border-[var(--border)] relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))' }}
    >
      <div
        className={`absolute top-3 left-3 px-2 py-0.5 rounded-md text-[10px] font-bold text-white ${
          title === 'AH' ? 'bg-[var(--accent-ah)]' : 'bg-[var(--accent-ei)]'
        }`}
      >
        {title}
      </div>

      <div className="flex flex-col items-center mt-3">
        <div className="flex gap-2 mb-2">
          {['mg', 'ml'].map((u) => (
            <button
              key={u}
              onClick={() => handleUnitChange(u)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                unit === u
                  ? u === 'mg'
                    ? 'bg-[var(--accent-ah)] text-white'
                    : 'bg-[var(--accent-ei)] text-white'
                  : 'bg-black/5 text-[var(--text-secondary)]'
              }`}
            >
              {u.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-1.5 w-full mb-3">
          {SUBTYPE_OPTIONS.map((option) => {
            const isActive = subtype === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSubtype(option.value)}
                className={`flex flex-col items-center justify-center rounded-xl border text-[9px] font-bold leading-tight transition-all ${
                  isActive ? 'text-white' : 'text-[var(--text-secondary)]'
                }`}
                style={
                  isActive
                    ? { backgroundColor: option.color, borderColor: option.color }
                    : {
                        background: 'linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))',
                        borderColor: 'var(--border)'
                      }
                }
              >
                <span className="flex items-center gap-0.5 text-sm leading-none">
                  <Icon className="text-[12px]" />
                  {option.value === 'IV+PO' && <FaPills className="text-[11px]" />}
                </span>
                <span className="text-[8px] font-black tracking-wide">{option.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between w-full px-2 mb-4">
          <button
            onClick={() => adjustDosage(-1)}
            className="w-9 h-9 rounded-full bg-black/5 text-[var(--text-primary)] text-lg flex items-center justify-center"
          >
            -
          </button>
          <div className="text-center">
            <span className="text-3xl font-black text-[var(--text-primary)] leading-none">{currentDosage}</span>
            <span className="text-sm font-bold text-[var(--text-secondary)] ml-1">{UNIT_CONFIG[unit].label}</span>
          </div>
          <button
            onClick={() => adjustDosage(1)}
            className="w-9 h-9 rounded-full bg-black/5 text-[var(--text-primary)] text-lg flex items-center justify-center"
          >
            +
          </button>
        </div>

        <div className="w-full mb-6">
          <div
            className={`syringe-slider ${sliderValue >= 98 ? 'is-full' : ''}`}
            style={{
              '--syringe-fill': `${sliderValue}%`,
              '--syringe-accent': title === 'AH' ? 'var(--accent-ah)' : 'var(--accent-ei)'
            }}
          >
            <div className="syringe-slider__piston" style={{ left: `calc(${sliderValue}% + 20px)` }}>
              <span className="syringe-slider__piston-handle" />
              <span className="syringe-slider__piston-rod" />
            </div>
            <div className="syringe-slider__body">
              <div className="syringe-slider__liquid" />
              <div className="syringe-slider__shine" />
              <div className="syringe-slider__bubbles">
                <span className="bubble bubble-1" />
                <span className="bubble bubble-2" />
                <span className="bubble bubble-3" />
              </div>
            </div>
            <div className="syringe-slider__needle" />
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={sliderValue}
              onChange={(e) => {
                const nextPercent = Number(e.target.value);
                setSliderValue(nextPercent);
                setCurrentDosage(getDosageFromPercent(nextPercent));
              }}
              className="syringe-slider__input"
              aria-label="Слайдер обʼєму"
            />
          </div>
        </div>

        <div className="w-full space-y-2">
          <button
            onClick={() => (isSelectingTime ? onCancelTimeSelection(title) : onStartTimeSelection(title))}
            className="w-full py-2 rounded-xl text-[var(--text-secondary)] text-xs font-semibold flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))' }}
          >
            {isSelectingTime ? (
              selectedTime ? (
                <span className="flex items-center gap-2">
                  {`${formatTime(selectedTime)}${selectedDateLabel}`}
                  <span className="text-red-500 text-base leading-none">✕</span>
                </span>
              ) : (
                'Відміна'
              )
            ) : (
              'Вказати час'
            )}
          </button>

          <button
            onClick={handleAddIntake}
            disabled={isAddDisabled}
            className={`w-full py-3 rounded-2xl bg-gradient-to-r from-[var(--accent-ah)] to-[var(--accent-ei)] text-white font-bold text-lg shadow-md transition-transform ${
              isAddDisabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'
            }`}
          >
            + Додати
          </button>
        </div>
      </div>
    </div>
  );
};

export default MedTrackerCard;
