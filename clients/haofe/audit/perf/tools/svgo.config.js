module.exports = {
  multipass: true,
  floatPrecision: 1,
  plugins: [{ name: 'preset-default', params: { overrides: {
    removeViewBox: false, removeTitle: false,
    removeUnknownsAndDefaults: { keepRoleAttr: true, keepAriaAttrs: true }
  } } }]
};
