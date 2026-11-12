// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);

// Use a stable on-disk store (shared across web/android)
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(root, 'cache') }),
];

// Mapeamento completo dos módulos nativos do Node para o ambiente móvel (Supabase)
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  stream: require.resolve('stream-browserify'),
  zlib: require.resolve('browserify-zlib'),
  crypto: require.resolve('crypto-browserify'),
  util: require.resolve('util'),
};

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 2;

module.exports = config;
