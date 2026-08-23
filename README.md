# Auto Life Logger

Privacy-first Chrome extension (Manifest V3) for tracking web browsing habits, focus patterns, and site distraction limits.

![Auto Life Logger Promo](store-assets/promo-marquee.png)

## Overview

**Auto Life Logger** is a privacy-first browser extension (Manifest V3) designed to track computer and browsing time productivity without relying on external cloud tracking services. It categorizes visited domain categories (e.g. Work, Social, News, Entertainment), computes focus scores, visualizes interactive daily time breakdown charts, and allows setting domain-specific time quotas.

## Key Features

* **100% Local Processing**: All domain timestamps and session durations stay inside browser memory and `chrome.storage.local`.
* **Automatic Productivity Categorization**: Maps domains to Work, Development, Learning, Social, or Distraction categories.
* **Domain Time Quotas & Soft Limits**: Set daily limits (e.g. max 30m on news sites) with gentle reminder overlays.
* **Timeline Visualizer**: Canvas dashboard displaying hour-by-hour browsing focus distribution.
* **JSON Export & Backup**: Export raw productivity logs for offline personal analysis.

## Tech Stack

* **Extension Standard**: Chrome Extension Manifest V3
* **Core Engine**: Vanilla JavaScript (ES Modules, Web Navigation API, `background.js`)
* **Dashboard**: HTML5, CSS Grid/Flexbox, Canvas API
* **Testing & Validation**: Node.js validation scripts, Playwright UI testing

## Installation

### Load Unpacked Extension

1. Clone the repository:
   ```bash
   git clone https://github.com/flegardev/Auto-life-logger.git
   ```

2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (top right switch).
4. Click **Load unpacked** and select the `auto-life-logger` repository directory.

## Development & Validation Commands

```bash
npm run check       # Syntax check background and content scripts
npm run lint        # Run ESLint validation
npm test            # Run unit test suite
```

## License

This project is licensed under the MIT License.
