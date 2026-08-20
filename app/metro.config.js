const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for .cjs files which are used by Firebase v9/v10
config.resolver.sourceExts.push('cjs');

// Disable unstable package exports to prevent resolution conflicts with Firebase
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
