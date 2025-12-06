import { registerSW } from 'virtual:pwa-register';

// Interval to check for updates (every hour)
const intervalMS = 60 * 60 * 1000;

export function registerPWA() {
  const updateSW = registerSW({
    onNeedRefresh() {
      // Show prompt to user to update
      if (confirm('Aplikasi versi baru tersedia. Refresh sekarang?')) {
        updateSW(true);
      }
    },
    onOfflineReady() {
      console.log('App ready to work offline');
    },
  });
}
