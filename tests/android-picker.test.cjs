const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function harness() {
  const slots = [],
    dialogs = [],
    dismissals = [],
    cleanups = [];
  let cursor = 0;
  const react = {
    useRef(value) {
      const index = cursor++;
      return (slots[index] ??= { current: value });
    },
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
    useEffect(effect) {
      const index = cursor++;
      if (!(index in slots)) {
        slots[index] = true;
        cleanups.push(effect());
      }
    },
  };
  const output = ts.transpileModule(
    fs.readFileSync(
      require.resolve("../src/components/useAndroidPicker.ts"),
      "utf8",
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports,
    require: (name) =>
      name === "react"
        ? react
        : {
            DateTimePickerAndroid: {
              open: (options) => dialogs.push(options),
              dismiss: (mode) => {
                dismissals.push(mode);
                return Promise.resolve(true);
              },
            },
          },
  });
  return {
    dialogs,
    dismissals,
    render(onChange, mode = "time") {
      cursor = 0;
      return exports.useAndroidPicker(mode, onChange);
    },
    unmount() {
      cleanups.forEach((cleanup) => cleanup?.());
    },
  };
}

test("tracker ticks do not reopen/reset the Android dialog; confirmation uses the latest callback", () => {
  const h = harness(),
    saved = [];
  const initial = new Date(2026, 9, 27, 9, 30);
  h.render(() => assert.fail("stale callback")).show(initial, false);
  for (let tick = 0; tick < 10; tick++) h.render((date) => saved.push(date));
  assert.equal(h.dialogs.length, 1);
  assert.equal(h.dialogs[0].value, initial);
  assert.equal(h.dialogs[0].is24Hour, false);
  const selected = new Date(2026, 9, 27, 14, 45);
  h.dialogs[0].onChange({ type: "set" }, selected);
  assert.deepEqual(saved, [selected]);
  assert.equal(h.render(() => {}).isOpen, false);
});

test("cancel/back leaves the field unchanged and allows reopening", () => {
  const h = harness();
  const picker = h.render(() => assert.fail("cancel committed a value"));
  picker.show(new Date());
  picker.show(new Date());
  assert.equal(h.dialogs.length, 1);
  h.dialogs[0].onChange({ type: "dismissed" }, new Date());
  h.render(() => {}).show(new Date());
  assert.equal(h.dialogs.length, 2);
});

test("unmount dismisses the date dialog and ignores its late result", () => {
  const h = harness();
  h.render(() => assert.fail("unmounted field changed"), "date").show(
    new Date(),
  );
  h.unmount();
  assert.deepEqual(h.dismissals, ["date"]);
  h.dialogs[0].onChange({ type: "set" }, new Date());
});

test("native errors release the open guard so the picker can be retried", () => {
  const h = harness();
  h.render(() => {}).show(new Date(), true);
  h.dialogs[0].onError(new Error("native failure"));
  h.render(() => {}).show(new Date(), true);
  assert.equal(h.dialogs.length, 2);
});
