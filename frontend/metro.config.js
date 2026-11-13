// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);

const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(root, 'cache') }),
];

// Mapeamento exaustivo de todos os módulos nativos do Node para o ambiente móvel 📱
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  stream: require.resolve('stream-browserify'),
  zlib: require.resolve('browserify-zlib'),
  crypto: require.resolve('crypto-browserify'),
  util: require.resolve('util'),
  http: require.resolve('stream-http'),
  https: require.resolve('https-browserify'),
  net: require.resolve('net-browserify'),
  tls: require.resolve('tls-browserify'),
  url: require.resolve('url'),
  events: require.resolve('events'),
  querystring: require.resolve('querystring-es3'),
  buffer: require.resolve('buffer'),
  assert: require.resolve('assert'),
  path: require.resolve('path-browserify'),
  fs: require.resolve('browserify-fs'),
};

config.maxWorkers = 2;

module.exports = config;
