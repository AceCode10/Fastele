const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable package exports (needed by @supabase/supabase-js v2 + Expo SDK 54).
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
