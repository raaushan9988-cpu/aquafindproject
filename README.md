# AquaFind – Smart Water Dispenser Locator

> **"Never search for water with an empty bottle again."**  
> *INT 335 Design Thinking Project – The Empty Bottle Problem*

AquaFind is a responsive, location-based web prototype designed to help students, commuters, and campus visitors quickly locate nearby drinking water dispensers within a **50–100 metre** radius, inspect water availability and physical cleanliness ratings, navigate via Google Maps walking directions, and report maintenance issues.

---

## Tech Stack

- **HTML5** – Semantic structure and accessible controls
- **CSS3** – Responsive modern UI with Flexbox, Grid, and blue gradient design system
- **Vanilla JavaScript (ES6+)** – Modular client-side state, filtering, Haversine math, and DOM updates
- **Leaflet.js (v1.9.4)** – Interactive map, custom status markers, popups, and radius overlays
- **OpenStreetMap** – Free map tile layer
- **Browser Geolocation API** – Live GPS coordinates with fallback to simulated Demo Campus Location
- **LocalStorage** – Client-side persistence for issue reports and UI filter preferences

---

## Project Folder Structure

```text
INT PROJECT/
├── index.html                  # Main responsive single-page application
├── README.md                   # Project documentation and setup instructions
├── .gitignore                  # Git ignore rules
├── css/
│   ├── styles.css              # Core visual design system and component styling
│   └── responsive.css          # Tablet and mobile responsive layout rules
├── js/
│   ├── app.js                  # Application state, event wiring, and card rendering
│   ├── map.js                  # Leaflet + OpenStreetMap controller and popups
│   ├── distance.js             # Haversine formula, suitability checks, Google Maps URL builder
│   ├── filters.js              # Multi-criteria search/filtering and dashboard stats
│   ├── report.js               # Issue reporting validation, submission, and LocalStorage log
│   └── storage.js              # Safe LocalStorage read/write/reset helpers
├── data/
│   └── dispensers.json         # Simulated dataset of 10 campus water dispensers
└── assets/
    ├── icons/
    │   └── favicon.svg         # Browser tab icon
    └── images/
        └── logo.svg            # AquaFind brand logo
```

---

## How to Run Locally

Because AquaFind loads `data/dispensers.json` via `fetch()` and uses ES modules + the Browser Geolocation API, serve the folder over `http://localhost` rather than opening `index.html` via `file://`.

### Option 1: Using Python (Built-in)
```powershell
cd "c:\Users\rohit kumar\OneDrive\Documents\INT PROJECT"
python -m http.server 5500
```
Then open `http://localhost:5500` in Google Chrome.

### Option 2: Using Node.js (`npx serve`)
```powershell
cd "c:\Users\rohit kumar\OneDrive\Documents\INT PROJECT"
npx serve -l 5500 .
```
Then open `http://localhost:5500` in Google Chrome.

---

## Implemented Features

1. **Navigation & Hero Section:** Sticky responsive navbar (`Home`, `Find Water`, `Live Map`, `About`, `Report Issue`) and hero controls (`Find Water`, `Enable My Location`, `Use Demo Location`, synced radius selector).
2. **User Location Detection & Demo Fallback:** Browser GPS detection handling permission denial, unavailable position, timeout, and unsupported browsers with seamless fallback to a clearly labeled **Demo Campus Location**.
3. **Haversine Distance & 50m / 100m Radius Filtering:** Real-time distance calculation in metres, nearest-first sorting, dynamic result counts, and concentric map radius rings.
4. **Water Availability System:** Status indicators (`Available` Green, `Low Water` Yellow, `Empty` Red) with synchronized filters.
5. **Cleanliness Monitoring System:** Scores (`80–100` Clean, `50–79` Average, `<50` Dirty), inspection timestamps, cleaning recommendations, and explicit disclaimer that physical cleanliness does not guarantee microbiological safety.
6. **Interactive Leaflet + OpenStreetMap:** Color-coded markers, detailed popups, `Locate Me`, `Show All Dispensers`, and `Nearest Suitable Dispenser` controls.
7. **Dashboard Statistics:** Live-updating `Total Dispensers`, `Water Available`, `Clean Dispensers`, and `Nearby Dispensers` cards.
8. **Search & Multi-Filter Interface:** Search by dispenser name, building, or location combined with distance, water availability, cleanliness filters, and `Reset Filters`.
9. **Google Maps Directions:** Opens walking directions in a new tab using real GPS origin when available, or destination-only when real GPS is unavailable.
10. **Issue Reporting & LocalStorage Persistence:** Validated `"Report a Problem"` form saved in `LocalStorage` as `Pending Verification` (without mutating verified dispenser status), plus a `"Restore Original Demo Data"` button.

---

## Known Limitations

- **Simulated Demonstration Data:** All 10 campus dispenser records, availability statuses, and cleanliness scores are simulated for academic prototype demonstration.
- **No Backend / Shared Database:** Reports stored in `LocalStorage` persist only in the user's current browser and are not shared across different devices.
- **Indoor GPS Accuracy:** Standard browser geolocation indoors can drift by 15–40 metres, affecting strict 50-metre boundary checks.
- **Cleanliness vs. Water Safety:** Cleanliness scores represent visual/physical inspection state only and cannot verify microbiological drinking-water quality without physical sensors or lab testing.
- **Online Map Tiles:** OpenStreetMap tiles and Google Maps directions require an active internet connection.
