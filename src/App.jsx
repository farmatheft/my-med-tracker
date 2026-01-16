import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { db } from './firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, Timestamp, orderBy, getDocs, writeBatch } from "firebase/firestore";

// --- ДОПОМІЖНІ ФУНКЦІЇ ---

/**
 * Допоміжна функція для отримання початку дня (00:00:00) для дати
 * @param {Date} date - Вхідна дата
 * @returns {Date} - Новий об'єкт Date, що вказує на початок дня
 */
const getStartOfDay = (date) => {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

/**
 * Форматує об'єкт Date у локалізований рядок ЧАСУ
 * @param {Date} dateObj - Об'єкт дати
 * @returns {string} - Відформатований рядок часу (напр. "14:30")
 */
const formatTime = (dateObj) => {
  return dateObj.toLocaleString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Форматує дату, що переглядається, у гарний рядок
 * @param {Date} date - Дата, що переглядається
 * @returns {string} - "Сьогодні", "Вчора" або локалізована дата
 */
const formatViewedDate = (date) => {
  const today = getStartOfDay(new Date());
  const yesterday = getStartOfDay(new Date());
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.getTime() === today.getTime()) return 'Сьогодні';
  if (date.getTime() === yesterday.getTime()) return 'Вчора';

  return date.toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// --- КОМПОНЕНТ КАРТКИ ТРЕКЕРА ---

/**
 * Компонент картки для відстеження одного типу ліків
 * @param {{title: string, storageKey: string}} props - Налаштування картки
 */
function MedTrackerCard({ title, storageKey }) {
  // Конфігурація для одиниць виміру
  const UNIT_CONFIG = {
    mg: { min: 1, max: 250, step: 1, default: 50, label: 'мг' },
    ml: { min: 0.1, max: 5.0, step: 0.1, default: 0.5, label: 'мл' }
  };

  const [unit, setUnit] = useState('mg');
  const [currentDosage, setCurrentDosage] = useState(UNIT_CONFIG.mg.default);

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDateTime, setSelectedDateTime] = useState(new Date());

  const handleDosageChange = useCallback((event) => {
    setCurrentDosage(Number(event.target.value));
  }, []);

  const handleUnitChange = useCallback((newUnit) => {
    setUnit(newUnit);
    setCurrentDosage(UNIT_CONFIG[newUnit].default);
  }, []);

  const incrementDosage = useCallback(() => {
    setCurrentDosage(prev => {
      const config = UNIT_CONFIG[unit];
      const nextVal = prev + config.step;
      // Виправляємо точність для дробових чисел (напр. 0.1)
      const rounded = Math.round(nextVal * 10) / 10;
      return rounded > config.max ? prev : rounded;
    });
  }, [unit]);

  const decrementDosage = useCallback(() => {
    setCurrentDosage(prev => {
      const config = UNIT_CONFIG[unit];
      const nextVal = prev - config.step;
      const rounded = Math.round(nextVal * 10) / 10;
      return rounded < config.min ? prev : rounded;
    });
  }, [unit]);

  const handleDateTimeChange = useCallback((event) => {
    const { name, value } = event.target;
    const newDateTime = new Date(selectedDateTime);

    if (name === "date") {
      const [year, month, day] = value.split('-').map(Number);
      newDateTime.setFullYear(year, month - 1, day);
    } else if (name === "time") {
      const [hours, minutes] = value.split(':').map(Number);
      newDateTime.setHours(hours, minutes, 0, 0);
    }
    setSelectedDateTime(newDateTime);
  }, [selectedDateTime]);

  const handleAddIntake = useCallback(async () => {
    const intakeTimestamp = showTimePicker ? selectedDateTime : new Date();

    try {
      await addDoc(collection(db, "intakes"), {
        patientId: title,
        dosage: currentDosage,
        unit: unit,
        timestamp: Timestamp.fromDate(intakeTimestamp),
        createdAt: Timestamp.now()
      });

      setShowTimePicker(false); // Закрити вибір часу після додавання
      setSelectedDateTime(new Date()); // Скинути час на поточний
    } catch (e) {
      console.error("Помилка при додаванні запису:", e);
    }
  }, [currentDosage, showTimePicker, selectedDateTime, title, unit]);

  // Форматування для полів input type="date" та "time"
  const formattedDateForInput = useMemo(() => {
    return selectedDateTime.toISOString().split('T')[0];
  }, [selectedDateTime]);

  const formattedTimeForInput = useMemo(() => {
    return selectedDateTime.toTimeString().slice(0, 5);
  }, [selectedDateTime]);

  return (
    <div className="w-full max-w-xs lg:max-w-sm bg-white rounded-3xl shadow-xl p-6 transform transition-transform duration-300 hover:scale-[1.01]">

      {/* --- Заголовок --- */}
      <h1 className="text-4xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-8 tracking-tight">
        Трекер "{title}"
      </h1>

      {/* --- Секція Слайдера --- */}
      <div className="mb-8 p-4 bg-blue-50 rounded-2xl shadow-inner border border-blue-100">

        {/* --- Перемикач одиниць --- */}
        <div className="flex justify-center mb-6">
          <div className="bg-white p-1 rounded-lg shadow-sm border border-blue-100 inline-flex">
            <button
              onClick={() => handleUnitChange('mg')}
              className={`px-4 py-1 rounded-md text-sm font-bold transition-colors duration-200 ${unit === 'mg'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100'
                }`}
            >
              МГ
            </button>
            <button
              onClick={() => handleUnitChange('ml')}
              className={`px-4 py-1 rounded-md text-sm font-bold transition-colors duration-200 ${unit === 'ml'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100'
                }`}
            >
              МЛ
            </button>
          </div>
        </div>

        {/* --- Відображення поточної дози з кнопками --- */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={decrementDosage}
            className="w-12 h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 font-bold text-2xl"
            aria-label="Зменшити дозу"
          >
            -
          </button>

          <div className="text-center drop-shadow-md mx-2 min-w-[120px]">
            <span className={`text-6xl font-extrabold ${unit === 'ml' ? 'text-purple-700' : 'text-blue-700'}`}>
              {currentDosage}
            </span>
            <span className={`text-2xl font-bold ml-1 ${unit === 'ml' ? 'text-purple-500' : 'text-blue-500'}`}>
              {UNIT_CONFIG[unit].label}
            </span>
          </div>

          <button
            onClick={incrementDosage}
            className="w-12 h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 font-bold text-2xl"
            aria-label="Збільшити дозу"
          >
            +
          </button>
        </div>

        {/* --- Слайдер --- */}
        <input
          id={`dosage-slider-${title}`}
          type="range"
          min={UNIT_CONFIG[unit].min}
          max={UNIT_CONFIG[unit].max}
          step={UNIT_CONFIG[unit].step}
          value={currentDosage}
          onChange={handleDosageChange}
          className="w-full h-3 bg-gradient-to-r from-blue-300 to-blue-500 rounded-full appearance-none cursor-pointer accent-blue-600 shadow-md transition-all duration-200 ease-in-out hover:shadow-lg"
          style={{ WebkitAppearance: 'none', height: '8px' }} // Додаткові стилі для крос-браузерності
        />
        <div className="flex justify-between text-sm text-gray-500 mt-2 px-1">
          <span>{UNIT_CONFIG[unit].min} {UNIT_CONFIG[unit].label}</span>
          <span>{UNIT_CONFIG[unit].max} {UNIT_CONFIG[unit].label}</span>
        </div>
      </div>

      {/* --- Акордеон для вибору часу --- */}
      <div className="mb-6">
        <button
          onClick={() => {
            setShowTimePicker(prev => !prev);
            if (!showTimePicker) setSelectedDateTime(new Date()); // Скидаємо на поточний час при відкритті
          }}
          className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-xl text-md transition-all duration-200 shadow-sm flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span>{showTimePicker ? "Приховати вибір часу" : "Вказати час"}</span>
        </button>

        {showTimePicker && (
          <div className="mt-4 p-4 bg-purple-50 rounded-2xl shadow-inner border border-purple-100 animate-fade-in-down">
            <p className="text-sm text-gray-600 mb-3">
              Встановіть дату та час, якщо запис був зроблений раніше.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label htmlFor={`date-picker-${title}`} className="block text-sm font-medium text-gray-700 mb-1">Дата:</label>
                <input
                  type="date"
                  id={`date-picker-${title}`}
                  name="date"
                  value={formattedDateForInput}
                  onChange={handleDateTimeChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
              <div className="flex-1">
                <label htmlFor={`time-picker-${title}`} className="block text-sm font-medium text-gray-700 mb-1">Час:</label>
                <input
                  type="time"
                  id={`time-picker-${title}`}
                  name="time"
                  value={formattedTimeForInput}
                  onChange={handleDateTimeChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- Кнопка Додавання --- */}
      <button
        onClick={handleAddIntake}
        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-4 px-4 rounded-xl text-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-blue-300 mb-4"
      >
        + Додати прийом
      </button>
    </div>
  );
}


// --- КОМПОНЕНТ ТАЙМЛАЙНУ ІСТОРІЇ ---

const DAY_HEIGHT = 500; // Висота одного дня в пікселях

function TimelineHistory() {
  const [intakes, setIntakes] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "intakes"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      }));
      setIntakes(data);
    }, (error) => {
      console.error("Помилка Firestore (Timeline):", error);
    });
    return () => unsubscribe();
  }, []);

  const handleDeleteIntake = useCallback(async (idToDelete) => {
    if (!window.confirm("Видалити цей запис?")) return;
    try {
      await deleteDoc(doc(db, "intakes", idToDelete));
    } catch (e) {
      console.error("Помилка при видаленні запису:", e);
    }
  }, []);

  const groupedByDay = useMemo(() => {
    const groups = {};
    const today = getStartOfDay(new Date());

    // Переконуємось, що сьогоднішній день є в списку, навіть якщо немає записів
    const todayStr = today.toLocaleDateString('uk-UA');
    groups[todayStr] = {
      date: today,
      intakes: []
    };

    intakes.forEach(intake => {
      const date = getStartOfDay(intake.timestamp);
      const dateStr = date.toLocaleDateString('uk-UA');
      if (!groups[dateStr]) {
        groups[dateStr] = {
          date: date,
          intakes: []
        };
      }
      groups[dateStr].intakes.push(intake);
    });

    return Object.values(groups).sort((a, b) => b.date - a.date);
  }, [intakes]);

  return (
    <div className="w-full max-h-[800px] overflow-y-auto custom-scrollbar bg-white rounded-3xl p-4 md:p-8">
      <div className="relative flex flex-col">
        {groupedByDay.map((day, dayIndex) => (
          <div
            key={day.date.getTime()}
            className="relative"
            style={{ height: `${DAY_HEIGHT}px` }}
          >
            {/* Центральна лінія таймлайну */}
            <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-indigo-200 -translate-x-1/2" />

            {/* Події дня */}
            {day.intakes.map((intake) => {
              const minutes = intake.timestamp.getHours() * 60 + intake.timestamp.getMinutes();
              const topPercent = ((1440 - minutes) / 1440) * 100;
              const isAH = intake.patientId === 'AH';

              return (
                <div
                  key={intake.id}
                  className={`absolute flex items-center group ${isAH ? 'right-1/2 pr-0' : 'left-1/2 pl-0'}`}
                  style={{ top: `${topPercent}%`, transform: 'translateY(-50%)' }}
                >
                  {isAH ? (
                    <>
                      <button
                        onClick={() => handleDeleteIntake(intake.id)}
                        className="opacity-0 group-hover:opacity-100 mr-4 text-red-400 hover:text-red-600 transition-opacity"
                        title="Видалити"
                      >
                        ×
                      </button>
                      <span className="font-bold text-lg md:text-xl text-blue-700 whitespace-nowrap">
                        {intake.dosage} {intake.unit}
                      </span>
                      <span className="ml-3 text-sm md:text-base text-gray-500 whitespace-nowrap">
                        {formatTime(intake.timestamp)}
                      </span>
                      <div className="w-5 h-5 rounded-full border-[4px] border-indigo-200 bg-white ml-4 translate-x-1/2 z-10 shadow-sm" />
                    </>
                  ) : (
                    <>
                      <div className="w-5 h-5 rounded-full border-[4px] border-indigo-200 bg-white mr-4 -translate-x-1/2 z-10 shadow-sm" />
                      <span className="mr-3 text-sm md:text-base text-gray-500 whitespace-nowrap">
                        {formatTime(intake.timestamp)}
                      </span>
                      <span className="font-bold text-lg md:text-xl text-purple-700 whitespace-nowrap">
                        {intake.dosage} {intake.unit}
                      </span>
                      <button
                        onClick={() => handleDeleteIntake(intake.id)}
                        className="opacity-0 group-hover:opacity-100 ml-4 text-red-400 hover:text-red-600 transition-opacity"
                        title="Видалити"
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              );
            })}

            {/* Лінія розділювач дня внизу (на 00:00) */}
            <div className="absolute bottom-0 left-0 right-0 border-b-2 border-indigo-100 flex justify-center">
              <div className="absolute -bottom-3 bg-white px-4 py-0.5 rounded-full border border-indigo-50 shadow-sm">
                <span className="text-xs md:text-sm font-bold text-indigo-400">
                  {formatViewedDate(day.date)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- ГОЛОВНИЙ КОМПОНЕНТ ДОДАТКА ---

export default function App() {
  const fileInputRef = useRef(null); // Ref для прихованого input[type=file]

  /**
   * Обробник експорту даних
   */
  const handleExport = useCallback(() => {
    try {
      // Зчитуємо дані обох трекерів з localStorage
      const dataAH = localStorage.getItem('medTrackerHistory_AH') || '[]';
      const dataEI = localStorage.getItem('medTrackerHistory_EI') || '[]';

      // Створюємо єдиний об'єкт для експорту
      const exportData = {
        AH: JSON.parse(dataAH),
        EI: JSON.parse(dataEI),
      };

      // Створюємо JSON-файл і запускаємо завантаження
      const jsonString = JSON.stringify(exportData, null, 2); // 'null, 2' для гарного форматування
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'med_tracker_backup.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Помилка експорту:", error);
      // В реальному додатку тут можна показати повідомлення про помилку (не alert)
    }
  }, []);

  /**
   * Обробник вибору файлу для імпорту
   */
  const handleFileSelect = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    // Перевірка, що це JSON
    if (file.type !== 'application/json') {
      console.warn("Дозволено завантажувати лише файли JSON.");
      event.target.value = null; // Скидання input
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const importedData = JSON.parse(content);

        // Перевірка наявності очікуваних ключів
        if (importedData && importedData.AH && importedData.EI) {
          // Проста валідація, що це масиви
          if (Array.isArray(importedData.AH) && Array.isArray(importedData.EI)) {
            // Записуємо дані в localStorage
            localStorage.setItem('medTrackerHistory_AH', JSON.stringify(importedData.AH));
            localStorage.setItem('medTrackerHistory_EI', JSON.stringify(importedData.EI));

            // Перезавантажуємо сторінку, щоб компоненти оновили свій стан з localStorage
            // Це найпростіший спосіб синхронізувати стан
            window.location.reload();
          } else {
            throw new Error('Невірний формат даних у файлі.');
          }
        } else {
          throw new Error('Файл не містить очікуваних ключів "AH" та "EI".');
        }
      } catch (error) {
        console.error("Помилка імпорту:", error);
        // В реальному додатку тут можна показати повідомлення про помилку (не alert)
      } finally {
        event.target.value = null; // Завжди скидаємо input
      }
    };
    reader.readAsText(file);
  }, []);

  return (
    <>
      {/* Додаємо стилі для анімацій та скролбару */}
      <style>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-down {
          animation: fadeInDown 0.3s ease-out;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #c5c5c5;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }
      `}</style>

      {/* Оновлений контейнер, що включає картки та футер */}
      <div className="flex flex-col min-h-screen w-full bg-gradient-to-br from-blue-100 to-indigo-200 font-sans text-gray-800 pb-10">

        {/* Головний контейнер, що розміщує картки */}
        <main className="flex-grow flex flex-col items-center p-4 gap-8">
          <div className="flex flex-col md:flex-row justify-center items-start gap-4">
            <MedTrackerCard
              title="AH"
              storageKey="medTrackerHistory_AH"
            />
            <MedTrackerCard
              title="EI"
              storageKey="medTrackerHistory_EI"
            />
          </div>

          <div className="w-full max-w-4xl px-2">
            <h2 className="text-3xl font-extrabold text-center text-gray-800 mb-8 tracking-tight">
              Спільна історія
            </h2>
            <TimelineHistory />
          </div>
        </main>

        {/* Секція Імпорту/Експорту (Футер) */}
        <footer className="w-full text-center p-4 mt-auto">
          <div className="inline-flex items-center space-x-3 bg-white/50 backdrop-blur-sm p-2 rounded-full shadow-sm">
            <button
              onClick={handleExport}
              className="text-xs text-gray-700 bg-gray-100 hover:bg-gray-200 py-1.5 px-4 rounded-full transition-colors duration-200 shadow-sm"
              title="Експортувати історію обох карток у .json файл"
            >
              Експорт
            </button>

            <button
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              className="text-xs text-gray-700 bg-gray-100 hover:bg-gray-200 py-1.5 px-4 rounded-full transition-colors duration-200 shadow-sm"
              title="Імпортувати історію з .json файлу"
            >
              Імпорт
            </button>


            {/* Прихований input, який ми активуємо кнопкою "Імпорт" */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".json"
              className="hidden"
            />
          </div>
        </footer>
      </div>
    </>
  );
}