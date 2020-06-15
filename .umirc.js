
export default {
  history: 'hash',
  plugins: [
    [
      "umi-plugin-react",
      {
        dva: false,
        antd: true,
      }
    ],
    "./umi-plugin-entry.js"
  ],
  routes: [
    { path: '/', component: '../layouts' },
  ],
  targets: { android: 7 }
};

