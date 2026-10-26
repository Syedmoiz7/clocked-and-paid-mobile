const fs = require("node:fs"),
  ts = require("typescript"),
  Module = require("node:module");
require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    filename,
  );
const test = require("node:test"),
  assert = require("node:assert/strict");
const values = new Map();
let fail = false;
let failPair = -1;
const originalLoad = Module._load;
Module._load = function (request, ...args) {
  if (request === "expo-sqlite/kv-store")
    return {
      default: {
        getItem: async (key) => values.get(key) ?? null,
        setItem: async (key, value) => {
          if (fail) throw new Error("disk full");
          values.set(key, value);
        },
        removeItem: async (key) => values.delete(key),
        multiSet: async (pairs) => {
          if (fail) throw new Error("disk full");
          const staged = new Map(values);
          pairs.forEach(([key, value], index) => {
            if (index === failPair) throw new Error("transaction failed");
            staged.set(key, value);
          });
          values.clear();
          for (const [key, value] of staged) values.set(key, value);
        },
      },
    };
  return originalLoad.call(this, request, ...args);
};
const storage = require("../src/services/storage.ts");
const { initialAppState: initial } = require("../src/store/appSlice.ts");
const KEY = "clocked-and-paid.mobile.state.v1";
const entry = (id) => ({
  id,
  date: "2026-10-20",
  startedAt: "2026-10-20T09:00:00",
  endedAt: "2026-10-20T17:00:00",
  lunchMinutes: 0,
  breakMinutes: 0,
  earnings: 192,
});

test("serialized saving keeps the latest requested state", async () => {
  values.clear();
  await Promise.all([
    storage.saveAppState({ ...initial, history: [entry("one")] }),
    storage.saveAppState({ ...initial, history: [entry("one"), entry("two")] }),
  ]);
  assert.equal((await storage.loadAppState()).history.length, 2);
});
test("recovery high-water snapshot survives history deletion and later settings saves", async () => {
  values.clear();
  await storage.saveAppState({
    ...initial,
    history: [entry("one"), entry("two")],
  });
  await storage.saveAppState({ ...initial, history: [entry("one")] });
  await storage.saveAppState({
    ...initial,
    history: [entry("one")],
    preferences: { ...initial.preferences, showDailyQuote: false },
  });
  assert.equal((await storage.loadAppState()).history.length, 1);
  assert.equal((await storage.loadRecovery()).state.history.length, 2);
});
test("explicit reset removes the old device recovery snapshot", async () => {
  values.clear();
  await storage.saveAppState({ ...initial, history: [entry("private")] });
  await storage.resetStoredWorkspace(initial);
  assert.equal(await storage.loadRecovery(), null);
  assert.equal((await storage.loadAppState()).history.length, 0);
});
test("unreadable saved JSON fails without silently replacing the stored workspace", async () => {
  values.clear();
  values.set(KEY, "{invalid");
  await assert.rejects(storage.loadAppState(), /unreadable/);
  assert.equal(values.get(KEY), "{invalid");
});
test("a failed write is reported but does not permanently poison the save queue", async () => {
  values.clear();
  fail = true;
  await assert.rejects(storage.saveAppState(initial), /disk full/);
  fail = false;
  await storage.saveAppState({ ...initial, history: [entry("saved")] });
  assert.equal((await storage.loadAppState()).history[0].id, "saved");
});
test("structurally corrupt saved JSON also fails without overwriting it", async () => {
  values.clear();
  values.set(KEY, JSON.stringify({ history: "broken" }));
  await assert.rejects(storage.loadAppState(), /unreadable/);
  assert.equal(JSON.parse(values.get(KEY)).history, "broken");
});
test("theme factories preserve the Rose default and create native-safe hex palettes", () => {
  Module._load = function (request, ...args) {
    if (request === "react-native")
      return { StyleSheet: { create: (value) => value } };
    return originalLoad.call(this, request, ...args);
  };
  const theme = require("../src/theme.ts");
  assert.deepEqual(theme.themedColors(338), theme.colors);
  for (const hue of [4, 25, 145, 220, 285]) {
    const palette = theme.themedColors(hue);
    assert.match(palette.accent, /^#[0-9a-f]{6}$/);
    assert.equal(
      theme.makeStyles(palette).button.backgroundColor,
      palette.accent,
    );
    assert.notEqual(palette.background, theme.colors.background);
  }
});
test("failed combined workspace/recovery writes leave both committed values intact", async () => {
  values.clear();
  await storage.saveAppState({ ...initial, history: [entry("old")] });
  const before = new Map(values);
  failPair = 1;
  await assert.rejects(
    storage.saveAppState({ ...initial, history: [entry("old"), entry("new")] }),
    /transaction failed/,
  );
  failPair = -1;
  assert.deepEqual(values, before);
});
test("reset cannot clear business data while failing to clear its recovery copy", async () => {
  values.clear();
  await storage.saveAppState({ ...initial, history: [entry("keep")] });
  const before = new Map(values);
  failPair = 1;
  await assert.rejects(
    storage.resetStoredWorkspace(initial),
    /transaction failed/,
  );
  failPair = -1;
  assert.deepEqual(values, before);
  await storage.resetStoredWorkspace(initial);
  assert.equal(await storage.loadRecovery(), null);
});
test("replacement recovery retains missing prior IDs and imported IDs through automatic saving", async () => {
  values.clear();
  const before = { ...initial, history: [entry("previous")] };
  const next = { ...initial, history: [entry("imported")] };
  await storage.saveAppState(before);
  await storage.saveReplacedWorkspace(before, next);
  await storage.saveAppState(next);
  assert.equal((await storage.loadAppState()).history[0].id, "imported");
  assert.deepEqual(
    (await storage.loadRecovery()).state.history.map((item) => item.id).sort(),
    ["imported", "previous"],
  );
});
test("failed replacement leaves the current workspace and recovery unchanged", async () => {
  values.clear();
  const before = { ...initial, history: [entry("previous")] };
  await storage.saveAppState(before);
  const committed = new Map(values);
  failPair = 1;
  await assert.rejects(
    storage.saveReplacedWorkspace(before, { ...initial, history: [] }),
    /transaction failed/,
  );
  failPair = -1;
  assert.deepEqual(values, committed);
});
