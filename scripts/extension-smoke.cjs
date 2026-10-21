// Integration tests use fresh disposable Chromium profiles and real Chrome APIs.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, 'output', 'playwright'); fs.mkdirSync(artifacts, { recursive:true });
const browserPath = process.env.EXTENSION_CHROMIUM;
const errors = [];
async function launch(extensionPath, profile) {
  const context = await chromium.launchPersistentContext(profile, {
    headless:true, channel: browserPath ? undefined : 'chromium', executablePath:browserPath,
    viewport:{ width:1280,height:900 },
    args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]
  });
  const page = await context.newPage();
  await page.goto('chrome://extensions');
  const item = page.locator('extensions-item').first();
  await item.waitFor({ timeout:15000 });
  const id = await item.getAttribute('id'); assert.match(id,/^[a-p]{32}$/);
  const popup = await context.newPage();
  popup.on('pageerror', e => { errors.push(e.message); console.error('PAGE ERROR:',e.message); });
  await popup.goto(`chrome-extension://${id}/popup.html`);
  return { context, page:popup, id };
}
async function logger() {
  const dir=root;
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'logger-qa-'));
  let {context,page,id}=await launch(dir,profile);
  try {
    const fixture={id:'backup-fixture',domain:'docs.example',startTime:Date.now()-120000,endTime:Date.now()-60000,duration:60,date:new Date().toLocaleDateString('sv-SE'),hour:10,isProductive:true,isDistraction:false};
    const imported=await page.evaluate(s=>chrome.runtime.sendMessage({type:'IMPORT_SESSIONS',payload:{sessions:[s]}}),fixture);assert.equal(imported.data.imported,1);
    assert.equal((await page.evaluate(()=>chrome.runtime.sendMessage({type:'GET_SESSIONS'}))).data.length,1);
    await page.goto(`chrome-extension://${id}/dashboard.html`);
    await expect(page.getByRole('heading',{name:'Overview',exact:true})).toBeVisible();
    await page.getByRole('button',{name:/Sites/}).click();await expect(page.getByText('docs.example',{exact:true}).first()).toBeVisible();
    await page.getByRole('button',{name:/Overview/}).click();
    await page.screenshot({path:path.join(artifacts,'logger-dashboard-after.png'),fullPage:true});
    await page.goto(`chrome-extension://${id}/options.html`);
    await page.getByLabel('Choose a backup (JSON, up to 25 MB)').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({sessions:[fixture]}))});
    await expect(page.getByText(/Restored 0 sessions/)).toBeVisible();
    await page.getByLabel('Choose a backup (JSON, up to 25 MB)').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{bad json')});
    await expect(page.locator('#statusBox')).toContainText(/JSON|Unexpected|property/i);
    for(const width of [390,768,1280]) { await page.setViewportSize({width,height:900}); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)); }
    await page.goto(`chrome-extension://${id}/popup.html`); await page.setViewportSize({width:390,height:600});
    await page.screenshot({path:path.join(artifacts,'logger-popup-after.png'),fullPage:true});
    const records=await page.evaluate(()=>chrome.runtime.sendMessage({type:'GET_SESSIONS'}));assert.equal(records.data.length,1);
    await context.close(); ({context,page,id}=await launch(dir,profile));
    const after=await page.evaluate(()=>chrome.runtime.sendMessage({type:'GET_SESSIONS'}));assert.equal(after.data.length,1);
    console.log('PASS Logger: worker registration, legacy backup import, dashboard analytics, malformed backup, responsive settings, retained history across restart');
  } finally { await context.close(); }
}

logger().then(()=>{ assert.deepEqual(errors,[]); }).catch(e=>{ console.error(e); process.exitCode=1; });
