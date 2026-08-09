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
