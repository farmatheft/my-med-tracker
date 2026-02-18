import { useState } from "react";
import { GiWaterDrop } from "react-icons/gi";
import { FaSyringe, FaPills, FaTrash } from "react-icons/fa6";
import { deleteDoc, doc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { formatDateInput, formatTimeInput } from "../utils/time";

const SUBTYPE_OPTIONS = [
  { value: "IV", label: "IV", icon: GiWaterDrop, color: "var(--subtype-iv)" },
  { value: "IM", label: "IM", icon: FaSyringe, color: "var(--subtype-im)" },
  { value: "PO", label: "PO", icon: FaPills, color: "var(--subtype-po)" },
  {
    value: "IV+PO",
    label: "IV+PO",
    icon: GiWaterDrop,
    color: "var(--subtype-ivpo)",
  },
  {
    value: "VTRK",
    label: "VTRK",
    icon: GiWaterDrop,
    color: "var(--subtype-vtrk)",
  },
];

const IntakeDetailsModal = ({ intake, onClose }) => {
  const [dosage, setDosage] = useState(intake.dosage);
  const [unit, setUnit] = useState(intake.unit);
  const [subtype, setSubtype] = useState(intake.subtype || "");
  const [dateValue, setDateValue] = useState(formatDateInput(intake.timestamp));
  const [timeValue, setTimeValue] = useState(formatTimeInput(intake.timestamp));
  const [showConfirm, setShowConfirm] = useState(false);
  const accentColor =
    intake.patientId === "AH" ? "var(--accent-ah)" : "var(--accent-ei)";

  const handleSave = async () => {
    const nextDate = new Date(`${dateValue}T${timeValue}`);
    await updateDoc(doc(db, "intakes", intake.id), {
      dosage: Number(dosage),
      unit,
      subtype: subtype || null,
      timestamp: Timestamp.fromDate(nextDate),
      updatedAt: Timestamp.now(),
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
        style={{
          background:
            "linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-black text-[var(--text-primary)]">
              Деталі запису
            </h3>
            <p className="text-xs font-semibold text-[var(--text-secondary)] mt-1">
              {intake.patientId}
            </p>
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
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">
              Підтип
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {SUBTYPE_OPTIONS.map((option) => {
                const isActive = subtype === option.value;
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSubtype(option.value)}
                    className={`flex flex-col items-center justify-center rounded-xl border text-[9px] font-bold leading-tight transition-all py-2 ${
                      isActive ? "text-white" : "text-[var(--text-secondary)]"
                    }`}
                    style={
                      isActive
                        ? {
                            backgroundColor: option.color,
                            borderColor: option.color,
                          }
                        : {
                            background:
                              "linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))",
                            borderColor: "var(--border)",
                          }
                    }
                  >
                    <span className="flex items-center gap-0.5 text-sm leading-none mb-1">
                      <Icon className="text-[12px]" />
                      {option.value === "IV+PO" && (
                        <FaPills className="text-[11px]" />
                      )}
                    </span>
                    <span className="text-[8px] font-black tracking-wide">
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">
              Доза
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.1"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                className="flex-1 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm font-semibold text-[var(--text-primary)] focus:outline-none"
              />
              {["mg", "ml"].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    if (unit === type) return;
                    let newDosage = parseFloat(dosage) || 0;
                    if (type === "mg") {
                      // ml -> mg: * 20
                      newDosage = Math.round(newDosage * 20);
                    } else {
                      // mg -> ml: / 20
                      newDosage = Math.round((newDosage / 20) * 10) / 10;
                    }
                    setDosage(newDosage);
                    setUnit(type);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${unit === type ? "text-white" : "bg-black/5 text-[var(--text-secondary)]"}`}
                  style={
                    unit === type ? { background: accentColor } : undefined
                  }
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">
                Дата
              </label>
              <input
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-xs font-semibold text-[var(--text-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">
                Час
              </label>
              <input
                type="time"
                value={timeValue}
                onChange={(e) => setTimeValue(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-xs font-semibold text-[var(--text-primary)] focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="w-12 h-12 flex items-center justify-center rounded-full border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors"
            title="Видалити"
          >
            <FaTrash />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-[var(--border)] px-4 py-3 text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
          >
            Закрити
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-2xl bg-gradient-to-r from-[var(--accent-ah)] to-[var(--accent-ei)] px-4 py-3 text-xs font-bold text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
          >
            Зберегти
          </button>
        </div>

        {showConfirm && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-3xl z-10">
            <div
              className="w-[min(80vw,320px)] rounded-2xl border border-[var(--border)] p-4 text-center shadow-2xl"
              style={{
                background:
                  "linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))",
              }}
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 mx-auto flex items-center justify-center mb-3">
                <FaTrash />
              </div>
              <p className="text-sm font-bold text-[var(--text-primary)]">
                Видалити цей запис?
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Цю дію не можна скасувати.
              </p>
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
                  className="flex-1 rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white shadow-lg"
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

export default IntakeDetailsModal;
