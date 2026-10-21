'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'background.js'), 'utf8');

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

async function settle() {
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
}

function createHarness() {
  let now = Date.UTC(2026, 4, 4, 9, 0, 0);
  const storage = {};
  const listeners = {};
  const activeTabs = new Map([
    [1, { id: 1, windowId: 1, url: 'https://docs.example/work', title: 'Docs' }],
    [2, { id: 2, windowId: 1, url: 'https://repo.example/pull/1', title: 'Repository' }]
  ]);

  class FakeDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [now]));
    }

    static now() {
      return now;
    }
  }

  const chrome = {
    alarms: {
      create() {},
      onAlarm: { addListener(listener) { listeners.alarm = listener; } }
    },
    idle: {
      setDetectionInterval() {},
      onStateChanged: { addListener(listener) { listeners.idleStateChanged = listener; } }
    },
    notifications: { create: async () => undefined },
    runtime: {
      getURL: file => `chrome-extension://test/${file}`,
      onInstalled: { addListener(listener) { listeners.installed = listener; } },
      onMessage: { addListener(listener) { listeners.message = listener; } }
    },
    storage: {
      local: {
        async get(keys) {
          if (keys == null) return clone(storage);
          if (typeof keys === 'string') return { [keys]: clone(storage[keys]) };
          const result = {};
          for (const key of keys) result[key] = clone(storage[key]);
          return result;
        },
        async set(values) {
          Object.assign(storage, clone(values));
        },
        async clear() {
          for (const key of Object.keys(storage)) delete storage[key];
        }
      }
    },
    tabs: {
      create: async () => ({ id: 3 }),
      get: async tabId => clone(activeTabs.get(tabId)),
      query: async () => [clone(activeTabs.get(1))],
      sendMessage: async () => undefined,
      onActivated: { addListener(listener) { listeners.tabActivated = listener; } },
      onRemoved: { addListener(listener) { listeners.tabRemoved = listener; } },
      onUpdated: { addListener(listener) { listeners.tabUpdated = listener; } }
    },
    windows: {
      WINDOW_ID_NONE: -1,
      onFocusChanged: { addListener(listener) { listeners.windowFocusChanged = listener; } }
    }
  };

  const context = vm.createContext({ chrome, console, Date: FakeDate, URL });
  vm.runInContext(source, context, { filename: 'background.js' });

  async function send(type, payload) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`No response for ${type}`)), 1000);
      listeners.message({ type, payload }, {}, response => {
        clearTimeout(timeout);
        resolve(clone(response));
      });
    });
  }

  return {
    advance(ms) { now += ms; },
    listeners,
    run: expression => vm.runInContext(expression, context),
    send,
    snapshot: () => clone(storage)
  };
}

test('clear data forgets active sessions and rejects stale session writes', async () => {
  const harness = createHarness();
  await settle();

  harness.advance(5000);
  assert.deepEqual(await harness.send('CLEAR_DATA'), { ok: true, data: true });
  await harness.listeners.tabRemoved(1);
  await settle();

  assert.deepEqual((await harness.send('GET_CURRENT_SESSION')).data, null);
  assert.deepEqual((await harness.send('GET_SESSIONS')).data, []);
  assert.deepEqual(harness.snapshot().sessions, []);

  await harness.listeners.tabActivated({ tabId: 2, windowId: 1 });
  harness.advance(5000);

  const stopping = harness.listeners.tabRemoved(2);
  const clearing = harness.send('CLEAR_DATA');
  await Promise.all([stopping, clearing]);
  await settle();

  const snapshot = harness.snapshot();
  assert.deepEqual(snapshot.sessions, []);
  assert.deepEqual(snapshot.patternHistory, []);
  assert.deepEqual(snapshot.interventionLog, []);
  assert.deepEqual(snapshot.disciplineScores, {});
  assert.deepEqual(snapshot.strictViolations, {});
  assert.equal(snapshot.settings.siteListVersion, 2);
});


test('minute checkpoints survive a session end without duplicate live totals', async () => {
  const h = createHarness(); await settle(); h.advance(65000);
  await h.listeners.alarm({ name:'tick' });
  assert.equal(h.snapshot().sessions.length, 1);
  assert.equal((await h.send('GET_SESSIONS', { includeCurrent:true })).data.length, 1);
  h.advance(5000); await h.listeners.tabRemoved(1);
  assert.equal(h.snapshot().sessions.length, 1);
  assert.equal(h.snapshot().sessions[0].duration, 70);
});
test('malformed backups fail without modifying stored history', async () => {
  const h = createHarness(); await settle();
  const before = h.snapshot();
  assert.equal((await h.send('IMPORT_SESSIONS', { sessions:[{ id:'bad',duration:-1 }] })).ok, false);
  assert.deepEqual(h.snapshot(), before);
});
test('legacy session restore merges, deduplicates and respects exclusions', async () => {
  const h = createHarness(); await settle();
  await h.send('SAVE_SETTINGS', { neverTrackDomains:['bank.example'] });
  const start = Date.UTC(2026,4,4,8);
  const s = { id:'restored', domain:'docs.example', startTime:start, endTime:start+60000, duration:60, date:'2026-05-04', hour:8 };
  assert.equal((await h.send('IMPORT_SESSIONS',{ sessions:[s,{ ...s,id:'private',domain:'bank.example' }] })).data.imported,1);
  assert.equal((await h.send('IMPORT_SESSIONS',{ sessions:[s] })).data.imported,0);
  assert.equal(h.snapshot().sessions.length,1);
});
test('content senders cannot read history or delete records', async () => {
  const h = createHarness(); await settle();
  let result;
  h.listeners.message({ type:'CLEAR_DATA' },{ tab:{url:'https://example.com'} },r => { result=r; });
  assert.equal(result.ok,false);
});

test('concurrent session read-modify-writes retain both records', async () => {
  const h=createHarness(); await settle();
  await h.run(`Promise.all(['one','two'].map(id => upsertSession({id,domain:'docs.example',startTime:Date.now()-60000,endTime:Date.now(),duration:60,date:getDateKey(),hour:9})))`);
  assert.deepEqual(h.snapshot().sessions.map(s=>s.id).sort(),['one','two']);
});
test('ordinary update retains stored sessions and user settings', async () => {
  const h=createHarness(); await settle();
  await h.send('SAVE_SETTINGS',{neverTrackDomains:['private.example'],dataRetentionDays:120,siteListVersion:2});
  h.advance(5000); await h.listeners.tabRemoved(1); const before=h.snapshot();
  await h.listeners.installed({reason:'update'});
  assert.deepEqual(h.snapshot().sessions,before.sessions);
  assert.deepEqual(h.snapshot().settings,before.settings);
});
test('extension tabs retain privileged backup access', async () => {
  const h=createHarness(); await settle(); let result;
  h.listeners.message({type:'GET_SETTINGS'},{tab:{url:'chrome-extension://test/options.html'},url:'chrome-extension://test/options.html'},r=>{result=r;});
  await settle(); assert.equal(result.ok,true);
});

test('initializing missing settings preserves an existing history array', async () => {
  const h=createHarness(); await settle();
  await h.run(`chrome.storage.local.set({sessions:[{id:'legacy',domain:'docs.example',duration:60,startTime:Date.now()-60000,endTime:Date.now(),date:getDateKey(),hour:9}]})`);
  await h.run(`(async()=>{ const data=await chrome.storage.local.get(null); await chrome.storage.local.clear(); delete data.settings; await chrome.storage.local.set(data); })()`);
  await h.listeners.installed({reason:'update'});
  assert.equal(h.snapshot().sessions[0].id,'legacy');
});

test('switching to an untrackable page ends the previous website session', async () => {
  const h=createHarness(); await settle(); h.advance(5000);
  await h.run("startSession(3, 'chrome://settings/', 'Settings')");
  assert.equal((await h.send('GET_CURRENT_SESSION')).data,null);
  assert.equal(h.snapshot().sessions.length,1);
  assert.equal(h.snapshot().sessions[0].duration,5);
});

test('a newer session start cancels an older in-flight request', async () => {
  const h=createHarness(); await settle(); h.advance(5000);
  await h.run("Promise.all([startSession(2,'https://old.example/'),startSession(3,'https://new.example/')])");
  assert.equal((await h.send('GET_CURRENT_SESSION')).data.domain,'new.example');
  assert.equal(h.snapshot().sessions.length,1);
});
