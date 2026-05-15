module.exports = function (api) {
  api.cache(true);
  return {
    // Round 17 — added `jsxImportSource: "nativewind"` so the babel preset
    // routes JSX through NativeWind's `jsxRuntime`, which is what enables
    // `className` on every React Native primitive. The `nativewind/babel`
    // preset is the second-stage transform that lifts `className` strings
    // into Reanimated-friendly style objects at compile time.
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel"
    ]
  };
};
