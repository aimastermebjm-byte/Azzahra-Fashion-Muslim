import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Start fade out after 2.5 seconds
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 2500);

    // Complete and unmount after fade animation (3 seconds total)
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-gradient-to-br from-brand-primary via-brand-info to-brand-accent flex items-center justify-center transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Animated Background Circles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-48 -mt-48 animate-pulse" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full -ml-40 -mb-40 animate-pulse" style={{ animationDelay: '0.75s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-white/5 rounded-full -ml-32 -mt-32 animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6">
        {/* Logo Container with Animation */}
        <div className="mb-8 animate-fade-in-scale">
          <div className="inline-block bg-white/10 backdrop-blur-xl rounded-3xl p-8 sm:p-12 shadow-2xl border border-white/20">
            <div className="text-6xl sm:text-7xl font-bold text-white tracking-tight">
              <span className="bg-gradient-to-r from-white to-brand-accent bg-clip-text text-transparent">
                A
              </span>
              <span className="text-white">zzahra</span>
            </div>
            <div className="text-xl sm:text-2xl font-light text-white/90 tracking-wider mt-2">
              FASHION
            </div>
          </div>
        </div>

        {/* Brand Name - Slide Up Animation */}
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-6 animate-slide-up">
          Azzahra Fashion
        </h1>

        {/* Tagline - Fade In Animation */}
        <p className="text-base sm:text-lg text-white/90 font-light leading-relaxed max-w-md mx-auto animate-fade-in" style={{ animationDelay: '0.3s' }}>
          Sahabat anda belanja kebutuhan busana muslim
          <br />
          <span className="text-brand-accent font-semibold">
            dijamin original tangan pertama
          </span>
        </p>

        {/* Loading Indicator - Shimmer Effect */}
        <div className="mt-12 animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <div className="w-48 h-1 bg-white/20 rounded-full mx-auto overflow-hidden">
            <div className="h-full w-1/2 bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer" />
          </div>
        </div>

        {/* Optional Skip Button */}
        <button
          onClick={() => {
            setFadeOut(true);
            setTimeout(onComplete, 500);
          }}
          className="absolute bottom-8 right-8 text-white/60 hover:text-white/90 text-sm transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
};

export default SplashScreen;
