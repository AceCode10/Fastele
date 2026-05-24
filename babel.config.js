module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    plugins: [
      './patches/babel-strip-dynamic-import.js',
      'react-native-worklets/plugin',
    ],
  };
};
