'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, '_final_desktop_screenshots');
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'all-final-shot-'));
const headless = process.env.FINAL_SCREENSHOT_HEADLESS === '1';

const pad = n => String(n).padStart(2, '0');
const dateKey = ts => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const addDays = (dk, n) => {
  const [y, m, d] = dk.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + n).getTime());
};

function demoData() {
  const now = Date.now();
  const today = dateKey(now);
  const sessions = [];

  const domainPlan = [
    ['github.com', 4200, 8, true, false, 'coding'],
    ['developer.mozilla.org', 3100, 9, true, false, 'docs'],
    ['linear.app', 1800, 11, true, false, 'productivity'],
    ['youtube.com', 1250, 13, false, true, 'entertainment'],
    ['reddit.com', 740, 16, false, true, 'social'],
    ['notion.so', 2100, 17, true, false, 'productivity'],
    ['news.ycombinator.com', 620, 18, false, true, 'social']
  ];

  for (const [domain, duration, hour, isProductive, isDistraction, context] of domainPlan) {
    const startTime = new Date(`${today}T${pad(hour)}:00:00`).getTime();
    sessions.push({
      id: `${today}-${domain}`,
      domain,
      url: `https://${domain}/`,
      title: domain,
      duration,
      date: today,
      hour,
      startTime,
      endTime: startTime + duration * 1000,
      isProductive,
      isDistraction,
      context
    });
  }

  const disciplineScores = {};
  const dailySummaries = {};
  const patternHistory = [];

  for (let i = 13; i >= 0; i -= 1) {
    const dk = addDays(today, -i);
    const score = Math.max(48, Math.min(94, 82 - (i % 5) * 4 + (i % 3) * 3));
    const productive = 5200 + (i % 4) * 900;
    const distract = 700 + (i % 5) * 260;
    const total = productive + distract + 1100;
    if (dk !== today) {
      [
        ['github.com', productive * 0.42, 9, true, false, 'coding'],
        ['developer.mozilla.org', productive * 0.28, 10, true, false, 'docs'],
        ['youtube.com', distract * 0.72, 15, false, true, 'entertainment']
      ].forEach(([domain, duration, hour, isProductive, isDistraction, context]) => {
        const startTime = new Date(`${dk}T${pad(hour)}:00:00`).getTime();
        sessions.push({
          id: `${dk}-${domain}`,
          domain,
          url: `https://${domain}/`,
          title: domain,
          duration: Math.round(duration),
          date: dk,
          hour,
          startTime,
          endTime: startTime + Math.round(duration) * 1000,
          isProductive,
          isDistraction,
          context
        });
      });
    }
    disciplineScores[dk] = {
      score,
      components: {
        prodPts: Math.round(score * 0.4),
        disPts: Math.round(score * 0.3),
        loopPts: Math.round(score * 0.2),
        respPts: Math.max(0, score - Math.round(score * 0.9))
      }
    };
    dailySummaries[dk] = {
      date: dk,
      total,
      productive,
      distract,
      uniqueDomains: 7,
      totalSessions: 9 + (i % 4),
      patternCount: i % 3,
      disciplineScore: score,
      streak: Math.max(1, 8 - i),
      insight: dk === today
        ? 'Your strongest focus window was before lunch. Keep social checks boxed into one planned break.'
        : 'Most focused time came from documentation and build work.',
      topSites: [
        { domain: 'github.com', duration: productive * 0.36 },
        { domain: 'developer.mozilla.org', duration: productive * 0.24 },
        { domain: 'linear.app', duration: productive * 0.16 },
        { domain: 'youtube.com', duration: distract * 0.62 }
      ]
    };
    if (i < 7) {
      patternHistory.push({
        type: i % 2 ? 'TIME_OVERRUN' : 'DISTRACT_LOOP',
        domain: i % 2 ? 'youtube.com' : 'reddit.com',
        count: 3 + (i % 3),
        duration: 900 + i * 90,
        ts: now - i * 86400000 + 14 * 3600000,
        date: dk
      });
    }
  }

  return {
    settings: {
      siteListVersion: 2,
      distractionSites: ['youtube.com', 'reddit.com', 'x.com', 'instagram.com', 'news.ycombinator.com'],
      productiveSites: ['github.com', 'developer.mozilla.org', 'linear.app', 'notion.so', 'docs.google.com'],
      neverTrackDomains: ['bank.example', 'health.example'],
      trackingPausedUntil: 0,
      dataRetentionDays: 90,
      warningThresholdMins: 25,
      loopDetectionVisits: 4,
      loopDetectionWindowMins: 15,
      dailySummaryEnabled: true,
      notificationsEnabled: true,
      interventionEnabled: true,
      strictMode: {
        enabled: true,
        threshold: 3,
        blockedDomains: ['reddit.com'],
        perSiteThresholds: { 'youtube.com': 2, 'reddit.com': 2 },
        bypassMinutes: 20,
        activeHours: { enabled: true, start: 9, end: 18 },
        hardLockUntilTomorrow: false
      }
    },
    sessions,
    dailySummaries,
    disciplineScores,
    patternHistory,
    interventionLog: [
      { response: 'focused', domain: 'youtube.com', date: today, ts: now - 6800000 },
      { response: 'focused', domain: 'reddit.com', date: today, ts: now - 4200000 },
      { response: 'ignored', domain: 'youtube.com', date: today, ts: now - 2100000 }
    ],
    gamification: {
      streak: { current: 6, longest: 11, lastGoodDay: today, lastDate: today },
      achievements: [
        { id: 'first_session', title: 'First Steps', desc: 'Logged your first browsing session', icon: '*', unlockedAt: now - 12 * 86400000 },
        { id: 'focus_60', title: 'Deep Focus', desc: '60+ productive minutes in one day', icon: '*', unlockedAt: now - 9 * 86400000 },
        { id: 'streak_3', title: 'Hot Streak', desc: '3 consecutive good days', icon: '*', unlockedAt: now - 4 * 86400000 },
        { id: 'score_80', title: 'Laser Focus', desc: 'Discipline score of 80 or higher', icon: '*', unlockedAt: now - 2 * 86400000 }
      ],
      totalFocusedResponses: 14
    },
    strictViolations: {
      'reddit.com': { count: 3, lastViolationAt: now - 1200000 }
    }
  };
}

async function waitForExtension(context) {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
  const extensionId = worker.url().split('/')[2];
  if (!extensionId) throw new Error(`Could not determine extension id from ${worker.url()}`);
  return extensionId;
}

async function waitForDashboard(page) {
  await page.waitForSelector('.dash-shell');
  await page.waitForTimeout(500);
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    viewport: { width: 1440, height: 900 },
    args: [
      `--disable-extensions-except=${root}`,
      `--load-extension=${root}`,
      '--no-first-run',
      '--no-default-browser-check'
    ]
  });

  try {
    const extensionId = await waitForExtension(context);
    const extensionUrl = file => `chrome-extension://${extensionId}/${file}`;
    const page = await context.newPage();

    await page.goto(extensionUrl('dashboard.html'));
    await page.evaluate(data => chrome.storage.local.set(data), demoData());
    await page.reload();
    await waitForDashboard(page);
    await page.screenshot({
      path: path.join(outputDir, '01-main-dashboard-or-home.png'),
      fullPage: true
    });

    await page.getByRole('button', { name: /Patterns/ }).click();
    await page.waitForSelector('#page-patterns.active');
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(outputDir, '02-key-feature.png'),
      fullPage: true
    });

    await page.getByRole('button', { name: /Settings/ }).click();
    await page.waitForSelector('#page-settings.active');
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(outputDir, '03-detail-or-secondary-screen.png'),
      fullPage: true
    });

    console.log(`Saved screenshots in ${path.relative(root, outputDir)}`);
  } finally {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {
    // The temp profile is disposable.
  }
  console.error(error);
  process.exit(1);
});
