const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const test = require("node:test");
const assert = require("node:assert/strict");
require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    filename,
  );
const model = require("../src/features/settings/model.ts");
const {
  appReducer,
  initialAppState,
  setMockAccount,
} = require("../src/store/appSlice.ts");
const { commitWorkspaceAction } = require("../src/services/commitWorkspace.ts");

function harness(overrides = {}) {
  let state = {
    ...initialAppState,
    account: { mode: "mock", name: "Demo", email: "old@example.com" },
  };
  const slots = [],
    effects = [],
    calls = { account: [], password: [], writes: [] };
  let cursor = 0;
  const props = {
    saving: false,
    onAccount: async (changes) => {
      calls.account.push(changes);
      const prepared = model.prepareAccountUpdate(state.account, changes);
      if (prepared.error) return prepared.error;
      await commitWorkspaceAction(setMockAccount(prepared.account), {
        read: () => state,
        write: async (next) => calls.writes.push(next),
        dispatch: (action) => {
          state = appReducer(state, action);
        },
      });
      return null;
    },
    onPassword: async (value) => {
      calls.password.push(value);
    },
    onSignIn() {},
    onSignOut() {},
    ...overrides,
  };
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots))
        slots[i] = typeof initial === "function" ? initial() : initial;
      return [
        slots[i],
        (next) => {
          slots[i] = typeof next === "function" ? next(slots[i]) : next;
        },
      ];
    },
    useRef(value) {
      const i = cursor++;
      return (slots[i] ??= { current: value });
    },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((value, j) => value !== slots[i][j])) {
        slots[i] = deps;
        effects.push(effect);
      }
    },
  };
  const exports = {};
  const code = ts.transpileModule(
    fs.readFileSync(
      require.resolve("../src/features/settings/AccountCard.tsx"),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  const element = (type, props) => ({ type, props });
  vm.runInNewContext(code, {
    exports,
    Error,
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime")
        return { jsx: element, jsxs: element, Fragment: "Fragment" };
      if (name === "react-native")
        return { Text: "Text", View: "View", Keyboard: { dismiss() {} } };
      if (name.includes("FormControls"))
        return { Action: "Action", Field: "Field" };
      if (name.includes("ThemeProvider"))
        return { useThemeTokens: () => ({ colors: {}, styles: {} }) };
      if (name === "./model") return model;
      throw new Error(name);
    },
  });
  function nodes(tree) {
    if (!tree || typeof tree !== "object") return [];
    if (Array.isArray(tree)) return tree.flatMap(nodes);
    return [tree, ...nodes(tree.props?.children)];
  }
  const render = () => {
    cursor = 0;
    const tree = exports.AccountCard({ ...props, account: state.account });
    effects.splice(0).forEach((effect) => effect());
    return nodes(tree);
  };
  return {
    calls,
    field: (label) =>
      render().find(
        (node) => node.type === "Field" && node.props.label === label,
      ).props,
    button: (title) =>
      render().find(
        (node) => node.type === "Action" && node.props.title === title,
      ).props,
    feedback: (action) =>
      render().find(
        (node) =>
          node.type?.name === "AccountFeedback" && node.props.action === action,
      ).props.result,
    account: () => state.account,
  };
}
const settled = () => new Promise((resolve) => setImmediate(resolve));

test("invalid email shows feedback beside email and does not call save", () => {
  const h = harness();
  h.field("Email address").onChange("bad");
  h.button("Update email (mock)").onPress();
  assert.equal(h.calls.account.length, 0);
  assert.match(h.feedback("email").message, /valid email/);
  assert.equal(h.feedback("email").action, "email");
});

test("valid email update reaches durable save and updates current account", async () => {
  const h = harness();
  assert.equal(h.button("Update email (mock)").disabled, true);
  h.field("Email address").onChange("new@example.com");
  assert.equal(h.button("Update email (mock)").disabled, false);
  h.button("Update email (mock)").onPress();
  await settled();
  assert.equal(h.calls.writes.length, 1);
  assert.equal(h.calls.writes[0].account.email, "new@example.com");
  assert.equal(h.account().email, "new@example.com");
  assert.equal(h.feedback("email").error, false);
  assert.equal(h.button("Update email (mock)").disabled, true);
});

test("email save failure retains edited input and exposes the error locally", async () => {
  const h = harness({
    onAccount: async () => {
      throw new Error("Storage unavailable");
    },
  });
  h.field("Email address").onChange("new@example.com");
  h.button("Update email (mock)").onPress();
  await settled();
  assert.equal(h.field("Email address").value, "new@example.com");
  assert.equal(h.account().email, "old@example.com");
  assert.match(h.feedback("email").message, /Storage unavailable/);
  assert.equal(h.button("Update email (mock)").disabled, false);
});

test("short or mismatched passwords show local validation without saving", () => {
  const h = harness();
  h.field("New password").onChange("short");
  h.field("Confirm password").onChange("short");
  h.button("Update password (mock)").onPress();
  assert.match(h.feedback("password").message, /at least 6/);
  h.field("New password").onChange("long-password");
  h.button("Update password (mock)").onPress();
  assert.match(h.feedback("password").message, /don't match/);
  assert.equal(h.calls.password.length, 0);
});

test("password save waits for completion, blocks duplicate taps and clears secrets on success", async () => {
  let finish,
    count = 0;
  const h = harness({
    onPassword: () => {
      count++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  h.field("New password").onChange("long-password");
  h.field("Confirm password").onChange("long-password");
  const button = h.button("Update password (mock)");
  button.onPress();
  button.onPress();
  assert.equal(count, 1);
  assert.equal(h.field("New password").value, "long-password");
  assert.equal(h.field("New password").disabled, true);
  assert.equal(h.button("Updating password…").disabled, true);
  finish();
  await settled();
  assert.equal(h.field("New password").value, "");
  assert.equal(h.field("Confirm password").value, "");
  assert.equal(h.feedback("password").error, false);
});

test("password storage failure preserves inputs and enables retry", async () => {
  const h = harness({
    onPassword: async () => {
      throw new Error("Secure storage unavailable");
    },
  });
  h.field("New password").onChange("long-password");
  h.field("Confirm password").onChange("long-password");
  h.button("Update password (mock)").onPress();
  await settled();
  assert.equal(h.field("New password").value, "long-password");
  assert.equal(h.field("Confirm password").value, "long-password");
  assert.match(h.feedback("password").message, /Secure storage unavailable/);
  assert.equal(h.button("Update password (mock)").disabled, false);
});
