// Redirect for expo/AppEntry.js when running through pnpm (symlink resolution puts
// AppEntry deep in the pnpm store, so its ../../App import points here instead).
export { App as default } from 'expo-router/build/qualified-entry';
