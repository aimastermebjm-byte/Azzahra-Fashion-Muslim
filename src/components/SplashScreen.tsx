import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Start fade out after 4.5 seconds (total 5 seconds with transition)
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 4500);

    // Complete and unmount after fade animation (5 seconds total)
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 5000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'
        }`}
      style={{
        background: 'linear-gradient(180deg, #0d0d0d 0%, #1a1a1a 50%, #0d0d0d 100%)'
      }}
    >
      {/* Gold Shimmer Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              background: 'radial-gradient(circle, #D4AF37 0%, transparent 70%)',
              top: `${[10, 30, 50, 70, 20, 60, 80, 40][i]}%`,
              left: `${[20, 80, 15, 70, 50, 40, 25, 90][i]}%`,
              animation: `float 6s ease-in-out infinite`,
              animationDelay: `${i * 0.5}s`
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6 flex flex-col items-center justify-center min-h-screen">
        {/* Logo Container with Glow Animation */}
        <div
          className="mb-8"
          style={{
            animation: 'logoEntrance 1.5s ease-out forwards'
          }}
        >
          <img
            src="/azzahra-logo.jpg"
            alt="Azzahra Fashion Muslim"
            className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-2xl"
            style={{
              boxShadow: '0 0 30px rgba(212, 175, 55, 0.4), 0 0 60px rgba(212, 175, 55, 0.2), 0 0 90px rgba(212, 175, 55, 0.1)',
              animation: 'glow 2s ease-in-out infinite alternate'
            }}
          />
        </div>

        {/* Tagline */}
        <div
          className="text-center"
          style={{
            animation: 'fadeUp 1s ease-out 0.5s forwards',
            opacity: 0
          }}
        >
          <p
            className="text-lg sm:text-xl font-light tracking-wider mb-2"
            style={{ color: 'rgba(255, 255, 255, 0.9)' }}
          >
            Elegance in Modesty
          </p>
          <p
            className="text-sm sm:text-base font-semibold tracking-wide"
            style={{
              background: 'linear-gradient(90deg, #D4AF37, #F5E6C8, #D4AF37)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            Premium Muslim Fashion
          </p>
        </div>

        {/* Loading Bar */}
        <div
          className="absolute bottom-24 w-48"
          style={{
            animation: 'fadeIn 1s ease-out 1s forwards',
            opacity: 0
          }}
        >
          <div
            className="h-0.5 rounded-full overflow-hidden"
            style={{ background: 'rgba(212, 175, 55, 0.2)' }}
          >
            <div
              className="h-full w-1/3"
              style={{
                background: 'linear-gradient(90deg, transparent, #D4AF37, #F5E6C8, #D4AF37, transparent)',
                animation: 'shimmer 1.5s infinite'
              }}
            />
          </div>
        </div>

        {/* Skip Button */}
        <button
          onClick={() => {
            setFadeOut(true);
            setTimeout(onComplete, 500);
          }}
          className="absolute bottom-12 right-8 text-sm transition-colors"
          style={{
            color: 'rgba(255, 255, 255, 0.5)',
            animation: 'fadeIn 1s ease-out 1.5s forwards',
            opacity: 0
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#D4AF37'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)'}
        >
          Skip →
        </button>
      </div>

      {/* Custom CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { 
            transform: translateY(0) scale(1); 
            opacity: 0.3;
          }
          50% { 
            transform: translateY(-30px) scale(1.5); 
            opacity: 1;
          }
        }

        @keyframes logoEntrance {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes glow {
          0% {
            box-shadow: 
              0 0 30px rgba(212, 175, 55, 0.4),
              0 0 60px rgba(212, 175, 55, 0.2);
          }
          100% {
            box-shadow: 
              0 0 40px rgba(212, 175, 55, 0.6),
              0 0 80px rgba(212, 175, 55, 0.3),
              0 0 120px rgba(212, 175, 55, 0.15);
          }
        }

        @keyframes fadeUp {
          0% {
            transform: translateY(20px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes fadeIn {
          to { opacity: 1; }
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
