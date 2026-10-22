const {
  chromium,
  expect
} = require('@playwright/test');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os'),
  assert = require('node:assert/strict');
const out = path.resolve(__dirname, '../output/playwright/flagship');
const results = [];
fs.mkdirSync(out, {
  recursive: true
});
async function launch(dir, profile) {
  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    executablePath: process.env.EXTENSION_CHROMIUM,
    channel: process.env.EXTENSION_CHROMIUM ? undefined : 'chromium',
    viewport: {
      width: 1280,
      height: 900
    },
    args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`]
  });
  const index = await context.newPage();
  await index.goto('chrome://extensions');
  await index.locator('extensions-item').first().waitFor();
  const id = await index.locator('extensions-item').first().getAttribute('id');
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  return {
    context,
    page,
    id,
    errors
  };
}
async function shot(page, name) {
  await page.waitForTimeout(350);
  await page.screenshot({
    path: path.join(out, name + '.png'),
    fullPage: true,
    animations: 'disabled'
  });
}
async function measure(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const samples = [];
  for (let i = 0; i < 5; i++) {
    await page.reload();
    await page.waitForTimeout(150);
    samples.push(await page.evaluate(() => globalThis.performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd));
  }
  const metrics = await cdp.send('Performance.getMetrics');
  await cdp.detach();
  return {
    domContentLoadedMs: samples,
    medianMs: samples.sort((a, b) => a - b)[2],
    metrics: Object.fromEntries(metrics.metrics.filter(m => ['JSHeapUsedSize', 'Nodes', 'TaskDuration'].includes(m.name)).map(m => [m.name, m.value]))
  };
}
async function logger() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'flagship-log-'));
  let run = await launch(path.resolve(__dirname, '..'), profile);
  let {
    context,
    page,
    id
  } = run;
  try {
    await page.goto(`chrome-extension://${id}/dashboard.html`);
    await expect(page.locator('#reviewSummary')).toContainText('first session');
    const sessions = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      for (let i = 0; i < 3; i++) {
        const start = new Date(date);
        start.setHours(i, 0, 0, 0);
        sessions.push({
          id: `sample-${d}-${i}`,
          domain: ['docs.example', 'video.example', 'news.example'][i],
          startTime: start.getTime(),
          endTime: start.getTime() + [3600000, 1200000, 600000][i] + d * 30000,
          duration: [3600, 1200, 600][i] + d * 30,
          date: date.toLocaleDateString('sv-SE'),
          hour: 9 + i,
          isProductive: i === 0,
          isDistraction: i === 1
        });
      }
    }
    const imported = await page.evaluate(s => chrome.runtime.sendMessage({
      type: 'IMPORT_SESSIONS',
      payload: {
        sessions: s
      }
    }), sessions);
    assert.equal(imported.data.imported, 21);
    await page.reload();
    await expect(page.locator('#reviewSummary')).toContainText('7 days');
    await page.getByLabel('Daily intentional browsing goal').fill('90');
    await page.getByRole('button', {
      name: 'Save goal',
      exact: true
    }).click();
    await expect(page.locator('#goalProgress')).toContainText('90m');
    await shot(page, 'logger-review-after');
    for (const section of ['Sites', 'Patterns', 'Score details', 'Milestones', 'Reports', 'History', 'Settings']) {
      await page.getByRole('button', {
        name: section,
        exact: true
      }).click();
      await expect(page.getByRole('button', { name: section, exact: true })).toHaveAttribute('aria-current', 'page');
      if (section === 'Sites') await expect(page.locator('#sitesTable')).toContainText('docs.example');
      await shot(page, `logger-${section.toLowerCase()}-after`);
    }
    await page.goto(`chrome-extension://${id}/popup.html`);
    await page.setViewportSize({
      width: 390,
      height: 600
    });
    await shot(page, 'logger-popup-after');
    const performance = await measure(page);
    await page.setViewportSize({
      width: 1280,
      height: 900
    });
    await page.goto(`chrome-extension://${id}/onboarding.html`);
    await shot(page, 'logger-onboarding-after');
    await page.getByRole('button', {
      name: 'Start quietly',
      exact: true
    }).click();
    await page.waitForURL(/dashboard.html/);
    const quiet = await page.evaluate(() => chrome.runtime.sendMessage({
      type: 'GET_SETTINGS'
    }));
    assert.equal(quiet.data.interventionEnabled, false);
    assert.equal(quiet.data.notificationsEnabled, false);
    await page.goto(`chrome-extension://${id}/options.html`);
    await shot(page, 'logger-options-after');
    assert.deepEqual(run.errors, []);
    await context.close();
    run = await launch(path.resolve(__dirname, '..'), profile);
    ({
      context,
      page,
      id
    } = run);
    await page.goto(`chrome-extension://${id}/dashboard.html`);
    await expect(page.locator('#goalProgress')).toContainText('90m');
    results.push({
      product: 'Auto Life Logger',
      passed: true,
      performance
    });
  } finally {
    await context.close();
  }
}
logger().then(() => {
  fs.writeFileSync(path.join(out, 'journeys.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}).catch(e => {
  console.error(e);
  process.exitCode = 1;
});
