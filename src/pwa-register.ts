import { registerSW } from 'virtual:pwa-register';

// Check for updates every 5 minutes
const intervalMS = 5 * 60 * 1000;

export function registerPWA() {
  const updateSW = registerSW({
    immediate: true, // Check for updates immediately on load
    onNeedRefresh() {
      console.log('🔄 Update tersedia, refresh otomatis...');
      // Auto-update without prompt for better UX
      updateSW(true);
    },
    onOfflineReady() {
      console.log('✅ App ready to work offline');
    },
    onRegistered(r) {
      console.log('✅ Service Worker registered');
      // Periodic check for updates
      if (r) {
        setInterval(() => {
          console.log('🔍 Checking for updates...');
          r.update();
        }, intervalMS);
      }
    },
    onRegisterError(error) {
      console.error('❌ Service Worker registration error:', error);
    },
  });
}
