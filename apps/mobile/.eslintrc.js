// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: "expo",
  ignorePatterns: ["/dist/*"],
  overrides: [
    {
      // app.config.js and this file are Node CommonJS, evaluated by Expo's CLI
      // rather than shipped to a device. Without saying so, `__dirname` and
      // `module` read as undefined globals — a lint error about correct code.
      // Declaring the environment is the fix; a disable comment would only hide
      // it.
      files: ["*.config.js", ".eslintrc.js"],
      env: { node: true },
    },
  ],
};
