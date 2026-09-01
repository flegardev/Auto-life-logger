# 🎓 Auto Life Logger — Beginner's Learning Guide

## What This Project Does
**Auto-life-logger** is a productivity and habit tracking Chrome Extension (Manifest V3) that tracks time spent on websites, detects user idle states, mines habit patterns, and enforces website blocking schedules.

---

## 🗺️ Architecture Map

```
ENTRY POINT
  │  (manifest.json & background.js Service Worker)
  ▼
EVENT LISTENERS & BROWSER APIS
  │  ├── Active Tab Changes (chrome.tabs.onActivated)
  │  ├── URL Updates (chrome.tabs.onUpdated)
  │  ├── System Idle Detection (chrome.idle.onStateChanged)
  │  └── Alarm Intervals (chrome.alarms.onAlarm)
  ▼
STORAGE QUEUE & METRICS ENGINE
  │  (StorageQueue Write Serializer, Domain Aggregator, Productivity Scoring)
  ▼
CONTENT ENFORCEMENT & UI
     ├── In-page Blocker Overlay (blocker.js)
     └── Analytics Dashboard (dashboard.html, dashboard.js, Chart.js)
```

---

## 🎯 Core Files to Study First (Recommended Learning Order)

1. [`background.js`](file:///C:/Users/tinif/repos/Auto-life-logger/background.js)
   - **Why study first**: Explains Manifest V3 background service worker lifecycles, active tab tracking, async storage write queues, and idle state management.
2. [`dashboard.js`](file:///C:/Users/tinif/repos/Auto-life-logger/dashboard.js)
   - **Why study next**: Shows how to aggregate raw time-series browsing logs into daily/weekly Chart.js bar and doughnut visualizations.
3. [`blocker.js`](file:///C:/Users/tinif/repos/Auto-life-logger/blocker.js)
   - **Why study third**: Demonstrates DOM injection and full-screen blocking overlays to prevent access to distracting websites during focus hours.

---

## 🛠️ How to Run & Verify

1. **Load in Chrome**:
   - Navigate to `chrome://extensions`
   - Enable Developer Mode
   - Load repository folder directly.
