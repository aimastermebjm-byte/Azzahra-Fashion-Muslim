import React, { useState, useEffect } from 'react';
import { Download, X, Share, Smartphone, Zap, WifiOff } from 'lucide-react';

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
      return;
    }

    // Check if user already dismissed the prompt today
    const lastDismissed = localStorage.getItem('azzahra-install-dismissed');
    if (lastDismissed) {
      const dismissedDate = new Date(lastDismissed);
      const now = new Date();
      // Show again after 24 hours
      if (now.getTime() - dismissedDate.getTime() < 24 * 60 * 60 * 1000) {
        setDismissed(true);
        return;
      }
    }

    // Android/Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show modal after a short delay (let splash screen finish)
      setTimeout(() => {
        setShowModal(true);
      }, 1000);
    };

    // iOS Detection
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS) {
      setShowIOSPrompt(true);
      // Show modal after a short delay
      setTimeout(() => {
        setShowModal(true);
      }, 1000);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    const handleAppInstalled = () => {
      setIsStandalone(true);
      setShowModal(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    setDeferredPrompt(null);

    if (outcome === 'accepted') {
      setIsStandalone(true);
      setShowModal(false);
    } else {
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    setShowModal(false);
    setDismissed(true);
    localStorage.setItem('azzahra-install-dismissed', new Date().toISOString());
  };

  if (isStandalone || dismissed || !showModal) return null;

  // Features list
  const features = [
    { icon: Zap, text: 'Akses Lebih Cepat' },
    { icon: WifiOff, text: 'Bisa Offline' },
    { icon: Smartphone, text: 'Seperti Aplikasi Native' },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-sm bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl shadow-2xl overflow-hidden border border-amber-500/30"
        style={{
          animation: 'modalSlideUp 0.4s ease-out'
        }}
      >
        {/* Gold accent top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
        >
          <X className="w-5 h-5 text-white/70" />
        </button>

        {/* Content */}
        <div className="p-6 pt-8 text-center">
          {/* Logo */}
          <div className="mb-6">
            <div
              className="w-24 h-24 mx-auto rounded-2xl overflow-hidden shadow-lg"
              style={{
                boxShadow: '0 0 30px rgba(212, 175, 55, 0.4)'
              }}
            >
              <img
                src="/azzahra-logo.jpg"
                alt="Azzahra Fashion"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-white mb-2">
            Install Aplikasi
          </h2>
          <p className="text-amber-400 font-medium mb-6">
            Azzahra Fashion Muslim
          </p>

          {/* Features */}
          <div className="space-y-3 mb-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-center justify-center gap-3 text-white/80"
              >
                <feature.icon className="w-5 h-5 text-amber-400" />
                <span className="text-sm">{feature.text}</span>
              </div>
            ))}
          </div>

          {/* iOS Instructions */}
          {showIOSPrompt ? (
            <div className="bg-white/10 rounded-xl p-4 mb-6 text-left">
              <p className="text-white/90 text-sm mb-3 font-medium">
                Cara Install di iPhone/iPad:
              </p>
              <div className="space-y-2 text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold">1</span>
                  <span>Ketuk tombol</span>
                  <Share className="w-4 h-4 text-amber-400" />
                  <span>Share</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold">2</span>
                  <span>Pilih "Add to Home Screen"</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold">3</span>
                  <span>Ketuk "Add"</span>
                </div>
              </div>
            </div>
          ) : (
            /* Android Install Button */
            <button
              onClick={handleInstallClick}
              className="w-full py-4 rounded-xl font-bold text-gray-900 text-lg shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3"
              style={{
                background: 'linear-gradient(135deg, #D4AF37, #F5E6C8, #D4AF37)',
                boxShadow: '0 4px 20px rgba(212, 175, 55, 0.4)'
              }}
            >
              <Download className="w-6 h-6" />
              Install Sekarang
            </button>
          )}

          {/* Skip link */}
          <button
            onClick={handleDismiss}
            className="mt-4 text-white/50 text-sm hover:text-white/70 transition-colors"
          >
            Nanti saja
          </button>
        </div>

        {/* Animation keyframes */}
        <style>{`
          @keyframes modalSlideUp {
            from {
              transform: translateY(100px);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default InstallPrompt;
