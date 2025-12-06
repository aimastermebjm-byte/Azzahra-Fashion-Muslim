import React, { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
      return;
    }

    // Android/Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    // iOS Detection
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS) {
      setShowIOSPrompt(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  if (isStandalone || !showBanner) return null;

  // iOS Instruction Banner
  if (showIOSPrompt) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-50 animate-slide-up">
        <div className="flex items-start justify-between max-w-md mx-auto">
          <div className="flex-1 mr-4">
            <h3 className="font-semibold text-gray-900 mb-1">Install Aplikasi Azzahra</h3>
            <p className="text-sm text-gray-600 mb-2">
              Untuk pengalaman terbaik, install aplikasi ke layar utama Anda:
            </p>
            <div className="flex items-center space-x-2 text-sm text-gray-700">
              <span>1. Ketuk tombol Share</span>
              <Share className="w-4 h-4" />
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-700 mt-1">
              <span>2. Pilih "Add to Home Screen"</span>
              <span className="bg-gray-100 border border-gray-300 rounded px-1 text-xs">+</span>
            </div>
          </div>
          <button 
            onClick={() => setShowBanner(false)}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // Android/Chrome Install Button
  if (deferredPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 animate-fade-in md:left-auto md:right-4 md:w-80">
        <div className="bg-white rounded-xl shadow-xl border border-blue-100 p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Download className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Install Aplikasi</h3>
              <p className="text-xs text-gray-500">Akses lebih cepat & hemat kuota</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowBanner(false)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={handleInstallClick}
              className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              Install
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default InstallPrompt;
