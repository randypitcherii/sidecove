import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openOnboardingIfDue } from '../../../src/background/onboarding-lifecycle.js';

function background(completed = false, onboardingVersion = undefined, version = '5.1.0') {
    const opened = [];
    globalThis.chrome = {
        runtime: { getManifest: () => ({ version }) },
        storage: { sync: { get: async () => ({ onboardingCompleted: completed, onboardingVersion }) } },
        tabs: { create: async tab => opened.push(tab) }
    };
    return { installed: [openOnboardingIfDue], opened };
}

// The whole service worker, loaded once with a stub chrome, for its message listeners.
async function serviceWorker() {
    const messages = [];
    const event = { addListener() {} };
    const area = data => ({
        async get(keys) {
            const names = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys || data);
            return Object.fromEntries(names.map(k => [k, structuredClone(data[k] ?? keys?.[k])]));
        },
        async set(values) { Object.assign(data, structuredClone(values)); }
    });
    const home = { id: 'home', spaceUuid: 'home', name: 'Home', color: 'grey', bookmarkFolderId: 'home', spaceBookmarks: [], temporaryTabs: [] };
    globalThis.chrome = {
        runtime: { onInstalled: event, onStartup: event, onMessage: { addListener: listener => messages.push(listener) },
            getManifest: () => ({ version: '5.1.0' }), getURL: path => `chrome-extension://sidecove/${path}` },
        sidePanel: { setPanelBehavior: async () => {} },
        commands: { onCommand: event },
        alarms: { onAlarm: event, clear: async () => {}, create: async () => {} },
        storage: { onChanged: event, local: area({ spaceModelVersion: 2, spaces: [home] }), session: area({ spaceSession: true }), sync: area({}) },
        tabs: { onCreated: event, onUpdated: event, onRemoved: event, onReplaced: event, onActivated: event, onMoved: event, onAttached: event, onDetached: event,
            query: async () => [], get: async () => undefined, create: async () => ({}) },
        tabGroups: { onRemoved: event, onUpdated: event, query: async () => [] },
        windows: { onFocusChanged: event, onRemoved: event, get: async id => ({ id, focused: true }) },
        bookmarks: { onCreated: event, onRemoved: event, onChanged: event, onMoved: event, onChildrenReordered: event, onImportEnded: event,
            search: async () => [{ id: 'root' }], get: async () => [], getChildren: async () => [], getSubTree: async () => [{ id: 'root', children: [] }] }
    };
    await import('../../../src/background/background.js');
    return { messages };
}

test('a fresh install opens the onboarding guide once', async () => {
    const app = background();
    await Promise.all(app.installed.map(listener => listener({ reason: 'install' })));
    assert.equal(app.opened.length, 1);
    assert.equal(app.opened[0].url, 'installation-onboarding.html');
    assert.equal(app.opened[0].active, true);
});

test('uncompleted updates and completed installs do not use the same version gate', async () => {
    for (const [reason, completed, expected] of [['update', false, 1], ['install', true, 0]]) {
        const app = background(completed);
        await Promise.all(app.installed.map(listener => listener({ reason })));
        assert.equal(app.opened.length, expected);
    }
});

test('a completed install sees the onboarding once when this extension version changes', async () => {
    const updated = background(true, '5.0.0');
    await Promise.all(updated.installed.map(listener => listener({ reason: 'update', previousVersion: '5.0.0' })));
    assert.equal(updated.opened.length, 1);

    const current = background(true, '5.1.0');
    await Promise.all(current.installed.map(listener => listener({ reason: 'update', previousVersion: '5.0.0' })));
    assert.equal(current.opened.length, 0);
});

test('space-store replies are not intercepted by unrelated Promise listeners', async () => {
    const app = await serviceWorker();
    const replies = [];
    const claims = app.messages.map(listener => listener({ type: 'spaceStore', action: 'get' }, {}, reply => replies.push(reply)));
    assert.equal(claims.filter(claim => claim === true).length, 1);
    assert.equal(claims.some(claim => typeof claim?.then === 'function'), false);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(replies.length, 1);
    assert.equal(replies[0].success, true);
    assert.equal(replies[0].spaces[0].id, 'home');
});
