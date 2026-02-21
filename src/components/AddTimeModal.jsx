import { useState } from "react";
import { formatDateInput, formatTimeInput } from "../utils/time";

const AddTimeModal = ({ initialDateTime, onSave, onClose, accentColor }) => {
  const [dateValue, setDateValue] = useState(formatDateInput(initialDateTime || new Date()));
  const [timeValue, setTimeValue] = useState(formatTimeInput(initialDateTime || new Date()));

  const handleSave = () => {
    // Create date from strings
    const nextDate = new Date(`${dateValue}T${timeValue}`);
    onSave(nextDate);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 backdrop-blur-md px-4 transition-all"
      onClick={onClose}
    >
      <div
        className="relative mt-24 w-full max-w-[360px] rounded-[2rem] border border-[var(--border)] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.4)] transition-transform animate-in zoom-in-95 duration-200"
        style={{
          background:
            "linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <h3 className="text-lg font-black text-[var(--text-primary)]">
            Вказати час
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-[var(--border)] text-[var(--text-primary)] flex items-center justify-center transition-colors hover:bg-black/5"
            aria-label="Закрити"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] mb-2 px-1">
              Дата
            </label>
            <input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-black/5 px-3 py-2.5 text-sm font-semibold text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-secondary)] transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] mb-2 px-1">
              Час
            </label>
            <input
              type="time"
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-black/5 px-3 py-2.5 text-sm font-semibold text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-secondary)] transition-colors"
            />
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-[var(--border)] px-4 py-3.5 text-xs font-bold text-[var(--text-primary)] transition-all active:scale-95"
          >
            Скасувати
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-2xl px-4 py-3.5 text-xs font-bold text-white shadow-lg shadow-black/20 transition-all active:scale-95 hover:opacity-90"
            style={{ background: accentColor }}
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddTimeModal;
