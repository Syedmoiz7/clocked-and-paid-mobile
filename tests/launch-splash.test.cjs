const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const test = require("node:test");
const assert = require("node:assert/strict");

// Exercise bootstrap's storage/layout boundary without a native splash module.
function harness({ failLoad = false, failSave = false } = {}) {
  const slots = [],
    effects = [],
    calls = { hide: 0, save: 0 };
  let cursor = 0;
  const dispatch = () => {};
  const state = {};
  const react = {
    useState(value) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = value;
      return [
        slots[index],
        (next) => {
          slots[index] = next;
        },
      ];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => slots[index][i] !== value)) {
        slots[index] = deps;
        effects.push(effect);
      }
    },
  };
  const storage = {
    loadAppState: async () => {
      if (failLoad) throw new Error("Unreadable workspace");
      return null;
    },
    saveAppState: async () => {
      calls.save++;
      if (failSave) throw new Error("Write failed");
    },
  };
  const element = (type, props, key) => ({ type, props, key });
  const exports = {};
  const code = ts.transpileModule(
    fs.readFileSync(
      require.resolve("../src/bootstrap/AppBootstrap.tsx"),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  vm.runInNewContext(code, {
    exports,
    Error,
    setInterval: () => 1,
    clearInterval() {},
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx: element, jsxs: element };
      if (name === "react-native")
        return {
          View: "View",
          Text: "Text",
          Alert: {},
          AppState: { addEventListener: () => ({ remove() {} }) },
        };
      if (name === "expo-splash-screen") return { hide: () => calls.hide++ };
      if (name.endsWith("/storage")) return storage;
      if (name.endsWith("/hooks"))
        return { useAppDispatch: () => dispatch, useAppSelector: () => state };
      if (name.endsWith("/ThemeProvider"))
        return { useThemeTokens: () => ({ colors: {}, styles: {} }) };
      if (name.endsWith("/appSlice")) return { refreshTrackerDay() {} };
      if (name.endsWith("/dateOnly")) return { localDate() {} };
      if (name.endsWith("/PrivacyProvider"))
        return { PrivacyProvider: "PrivacyProvider" };
      if (name.endsWith("/AppLoading")) return { AppLoading: "AppLoading" };
      if (name.endsWith("/JobReminderHost"))
        return { JobReminderHost: "JobReminderHost" };
      if (name.endsWith("/FormControls")) return { Action: "Action" };
      if (name.endsWith("/backup")) return {};
      throw new Error(name);
    },
  });
  return {
    calls,
    render() {
      cursor = 0;
      const tree = exports.AppBootstrap({ children: "app" });
      effects.splice(0).forEach((effect) => effect());
      return tree;
    },
  };
}
const settled = () => new Promise((resolve) => setImmediate(resolve));

test("native splash remains visible while workspace hydration is pending", () => {
  const h = harness();
  const loading = h.render();
  loading.props.onLayout();
  assert.equal(loading.key, "loading");
  assert.equal(h.calls.hide, 0);
  assert.equal(h.calls.save, 0);
});

test("native splash hides after the ready screen has laid out", async () => {
  const h = harness();
  h.render();
  await settled();
  const ready = h.render();
  assert.equal(ready.key, "ready");
  assert.equal(h.calls.hide, 0);
  ready.props.onLayout();
  assert.equal(h.calls.hide, 1);
  assert.equal(h.calls.save, 1);
});

test("failed hydration exposes recovery instead of leaving an indefinite splash or overwriting storage", async () => {
  const h = harness({ failLoad: true });
  h.render();
  await settled();
  const failed = h.render();
  assert.equal(failed.key, "error");
  assert.match(JSON.stringify(failed), /Workspace unavailable/);
  failed.props.onLayout();
  assert.equal(h.calls.hide, 1);
  assert.equal(h.calls.save, 0);
});

test("later save errors retain the mounted workspace after launch", async () => {
  const h = harness({ failSave: true });
  h.render();
  await settled();
  const ready = h.render();
  ready.props.onLayout();
  await settled();
  const failed = h.render();
  assert.equal(failed.key, ready.key);
  assert.match(JSON.stringify(failed), /Local saving failed/);
  assert.equal(h.calls.hide, 1);
});
