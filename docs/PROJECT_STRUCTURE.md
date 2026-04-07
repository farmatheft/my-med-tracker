# My Med Tracker - Project Structure & Implementation

## 1. Project Overview
My Med Tracker is a Progressive Web App (PWA) designed for tracking medication intakes for two distinct patients ("AH" and "EI"). It features real-time synchronization via Firebase, dynamic theming, interactive timeline visualization, and comprehensive statistics.

## 2. File Structure

```
/
├── .firebaserc / firebase.json  # Firebase configuration
├── index.html                   # Entry point (meta tags for PWA)
├── package.json                 # Dependencies
├── vite.config.js               # Vite build configuration
├── src/
│   ├── main.jsx                 # React root
│   ├── App.jsx                  # Main application shell & routing
│   ├── firebase.js              # Firebase initialization
│   ├── index.css                # Global styles & Tailwind directives
│   ├── assets/                  # Static assets
│   ├── components/              # React Components
│   │   ├── AddIntakeButton.jsx    # "Add" button with animation
│   │   ├── IntakeDetailsModal.jsx # Edit/Delete modal for intakes
│   │   ├── MedTrackerCard.jsx     # Main card for adding new intakes
│   │   ├── Notification.jsx       # Toast notifications
│   │   ├── Statistics.jsx         # Charts & Analysis view
│   │   ├── SubtypeSelector.jsx    # Pill selector for medication types
│   │   ├── SyringeSlider.jsx      # Vertical slider for dosage input
│   │   ├── ThemeSelector.jsx      # Theme picker UI
│   │   └── TimelineHistory.jsx    # Scrollable timeline visualization
│   ├── themes/                  # Theme definition files (JSON)
│   │   ├── abyss.json, aurora.json, ...
│   └── utils/
│       └── time.js              # Time formatting & calculation helpers
```

## 3. Key Components

### `App.jsx`
- **Role**: The central hub. Manages global state (theme, notifications).
- **Theme Logic**: Loads theme JSONs dynamically. Uses `useEffect` to inject CSS variables into `:root` and update the `<meta name="theme-color">` for Android status bar integration.
- **Layout**: Toggles between the main Tracker view and the Statistics view.

### `MedTrackerCard.jsx`
- **Role**: Interface for adding new medication entries.
- **Features**:
  - Vertical `SyringeSlider` for precise dosage control.
  - Subtype selection (IV, IM, PO, etc.).
  - **New**: Native `datetime-local` input for custom time entry.

### `TimelineHistory.jsx`
- **Role**: Visualizes past intakes on a vertical timeline.
- **Features**:
  - Real-time Firestore listener.
  - Zoomable interface (pinch/buttons).
  - Visual gaps calculation between doses.
  - Grouping by day.

### `Statistics.jsx`
- **Role**: Analytics dashboard.
- **Features**:
  - Daily dosage trends (Area Chart).
  - Hourly distribution (Bar Chart).
  - Subtype breakdown (Pie Charts).
  - **New**: Interval analysis (average time between doses).
  - **New**: Last 24-hour detailed summary.

## 4. Theme System

Themes are defined in `src/themes/*.json`. Each file follows this structure:

```json
{
  "name": "Theme Name",
  "isDark": true, // or false
  "backgroundGradient": ["#StartColor", "#EndColor"],
  "cardBackground": ["#StartColor", "#EndColor"],
  "textPrimary": "#Color",
  "textSecondary": "#Color",
  "accentAH": "#Color",
  "accentEI": "#Color",
  // ... other specific UI element colors
}
```

**Implementation**:
- `App.jsx` reads the selected theme object.
- It maps these values to CSS Custom Properties (Variables) like `--bg-gradient-start`, `--accent-ah`.
- Components use these variables (e.g., `var(--accent-ah)`) for styling, ensuring instant theme switching without re-rendering logic.

## 5. Data Model (Firestore)

**Collection**: `intakes`

| Field       | Type      | Description                               |
|-------------|-----------|-------------------------------------------|
| `id`        | String    | Auto-generated Document ID                |
| `patientId` | String    | "AH" or "EI"                              |
| `dosage`    | Number    | Amount (e.g., 2.5)                        |
| `unit`      | String    | "mg" or "ml"                              |
| `subtype`   | String    | "IV", "IM", "PO", "IV+PO", "VTRK"         |
| `timestamp` | Timestamp | Date & Time of intake                     |
| `createdAt` | Timestamp | Date & Time record was created            |

## 6. Recent Updates & Implementation Details

### Statistics Upgrade
- **Intervals**: Calculated by sorting intakes and averaging the time difference between consecutive entries.
- **Last 24h**: A specific filter applied to the raw intake list to show immediate history, separate from the main daily aggregation.
- **Animations**: Added CSS keyframes in `index.css` (`animate-in`, `slide-in-from-bottom`) and used `recharts` built-in animation props (`animationDuration`).

### Time Selection
- **Simplified**: Replaced complex custom timeline clicking with a standard HTML5 `<input type="datetime-local" />` within `MedTrackerCard`. This provides a native, familiar picker for mobile users.

### Edit Panel (`IntakeDetailsModal`)
- **VTRK**: Added new subtype.
- **UX**: Replaced the text "Delete" button with a round Trash icon button for better spatial separation of destructive actions.

### Mobile Integration
- **Status Bar**: The `theme-color` meta tag is programmatically updated in `App.jsx` to match the current theme's background, providing an immersive experience on Android PWA mode.
