const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  SESSION_REFRESH_REMINDER_INTERVAL_MS,
  createStateStore,
  nextSessionRefreshReminderAt,
  validateSidebarState,
} = require("../electron/state.cjs");

test("launcher state persists language and autostart atomically", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-web-gpt-launcher-state-"));
  const file = path.join(root, "state.json");
  try {
    const store = createStateStore(file);
    assert.deepEqual(store.read(), {
      version: 1,
      language: null,
      autoStart: true,
      keepRunningOnClose: true,
      showBrowserDuringTurns: true,
      browserInteractionMode: "automatic",
      experimentalBiggerContext: false,
      experimentalSkillAttachments: false,
      experimentalFreshConversationPerTurn: false,
      useSavedChats: false,
      zeroRiskProEnabled: false,
      browserSmokePassed: false,
      browserSmokeVersion: null,
      sidebarOpen: true,
      sidebarWidth: 252,
      mcpGuideStep: 0,
      sessionRefreshReminderAt: null,
    });
    store.update({
      language: "zh-CN",
      keepRunningOnClose: false,
      browserSmokePassed: true,
      browserSmokeVersion: "0.2.0",
    });
    assert.deepEqual(createStateStore(file).read(), {
      version: 1,
      language: "zh-CN",
      autoStart: true,
      keepRunningOnClose: false,
      showBrowserDuringTurns: true,
      browserInteractionMode: "automatic",
      experimentalBiggerContext: false,
      experimentalSkillAttachments: false,
      experimentalFreshConversationPerTurn: false,
      useSavedChats: false,
      zeroRiskProEnabled: false,
      browserSmokePassed: true,
      browserSmokeVersion: "0.2.0",
      sidebarOpen: true,
      sidebarWidth: 252,
      mcpGuideStep: 0,
      sessionRefreshReminderAt: null,
    });
    if (process.platform !== "win32") assert.equal(fs.statSync(file).mode & 0o077, 0);
    assert.equal(fs.readdirSync(root).some(name => name.includes(".tmp-")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("sidebar state accepts only bounded native shell dimensions", () => {
  assert.deepEqual(validateSidebarState({ open: false, width: 300.4 }), {
    sidebarOpen: false,
    sidebarWidth: 300,
  });
  assert.throws(() => validateSidebarState({ open: "yes", width: 300 }), /invalid/);
  assert.throws(() => validateSidebarState({ open: true, width: 100 }), /between 240 and 420/);
  assert.throws(() => validateSidebarState({ open: true, width: 900 }), /between 240 and 420/);
});

test("every supported launcher language survives a state update and reload", () => {
  const languages = require("../electron/languages.json");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-web-gpt-locale-state-"));
  const file = path.join(root, "state.json");
  try {
    for (const language of Object.keys(languages)) {
      const store = createStateStore(file);
      store.update({ language });
      assert.equal(createStateStore(file).read().language, language);
    }
    for (const language of ["__proto__", "constructor", "unknown", [], {}]) {
      fs.writeFileSync(file, JSON.stringify({ version: 1, language }));
      const state = createStateStore(file).read();
      assert.equal(state.language, null);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("persisted sidebar corruption is repaired without changing the rest of launcher state", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-web-gpt-sidebar-state-"));
  const file = path.join(root, "state.json");
  try {
    fs.writeFileSync(file, JSON.stringify({
      version: 1,
      language: "zh-CN",
      onboardingComplete: "yes",
      autoStart: "yes",
      experimentalFreshConversationPerTurn: "true",
      bridgeEnabled: false,
      browserSmokePassed: "yes",
      browserSmokeVersion: { invalid: true },
      sidebarOpen: "yes",
      sidebarWidth: 900,
      mcpGuideStep: 99,
      sessionRefreshReminderAt: "not-a-date",
      coreSetupComplete: "yes",
    }));
    assert.deepEqual(createStateStore(file).read(), {
      version: 1,
      language: "zh-CN",
      autoStart: true,
      keepRunningOnClose: true,
      showBrowserDuringTurns: true,
      browserInteractionMode: "automatic",
      experimentalBiggerContext: false,
      experimentalSkillAttachments: false,
      experimentalFreshConversationPerTurn: false,
      useSavedChats: false,
      zeroRiskProEnabled: false,
      browserSmokePassed: false,
      browserSmokeVersion: null,
      sidebarOpen: true,
      sidebarWidth: 252,
      mcpGuideStep: 0,
      sessionRefreshReminderAt: null,
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("browser interaction defaults to Automatic and preserves a saved choice before core setup", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-web-gpt-interaction-state-"));
  const file = path.join(root, "state.json");
  try {
    const store = createStateStore(file);
    assert.equal(store.read().browserInteractionMode, "automatic");
    store.update({ browserInteractionMode: "manual" });
    assert.equal(createStateStore(file).read().browserInteractionMode, "manual");
    assert.equal(createStateStore(file).read().zeroRiskProEnabled, false);
    store.update({ coreSetupComplete: true, zeroRiskProEnabled: true, experimentalFreshConversationPerTurn: true });
    assert.equal(createStateStore(file).read().zeroRiskProEnabled, true);
    assert.equal(createStateStore(file).read().experimentalFreshConversationPerTurn, true);
    store.update({ browserInteractionMode: "automatic" });
    assert.equal(createStateStore(file).read().experimentalFreshConversationPerTurn, true);
    fs.writeFileSync(file, JSON.stringify({
      version: 1,
      browserInteractionMode: "manual",
      zeroRiskProEnabled: true,
    }));
    assert.equal(createStateStore(file).read().browserInteractionMode, "manual");
    assert.equal(createStateStore(file).read().zeroRiskProEnabled, false);
    fs.writeFileSync(file, JSON.stringify({
      version: 1,
      browserInteractionMode: "manual",
    }));
    assert.equal(createStateStore(file).read().browserInteractionMode, "manual");
    fs.writeFileSync(file, JSON.stringify({ version: 1, browserInteractionMode: "unsafe" }));
    assert.equal(createStateStore(file).read().browserInteractionMode, "automatic");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("session refresh reminders are deferred by exactly 48 hours", () => {
  const now = Date.UTC(2026, 7, 5, 12, 0, 0);
  assert.equal(SESSION_REFRESH_REMINDER_INTERVAL_MS, 48 * 60 * 60 * 1000);
  assert.equal(nextSessionRefreshReminderAt(now), "2026-08-07T12:00:00.000Z");
  assert.throws(() => nextSessionRefreshReminderAt(Number.NaN), /must be finite/);
});

test("legacy onboarding and social flags are discarded without losing preferences", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-web-gpt-legacy-state-"));
  const file = path.join(root, "state.json");
  try {
    for (const onboardingComplete of [false, true]) {
      fs.writeFileSync(file, JSON.stringify({
        version: 1,
        language: "ja",
        onboardingComplete,
        githubOpened: true,
        xOpened: false,
        browserInteractionMode: "manual",
        autoStart: false,
      }));
      const state = createStateStore(file).read();
      assert.equal(state.language, "ja");
      assert.equal(state.browserInteractionMode, "manual");
      assert.equal(state.autoStart, false);
      for (const key of ["onboardingComplete", "githubOpened", "xOpened"]) {
        assert.equal(Object.hasOwn(state, key), false);
      }
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
