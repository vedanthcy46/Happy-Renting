import React, { useState, useEffect } from 'react';

const SplashScreen = ({ children }) => {
  const [phase, setPhase] = useState('enter'); // enter → visible → exit → gone

  useEffect(() => {
    setPhase('enter');
    const t1 = setTimeout(() => setPhase('visible'), 100);
    const t2 = setTimeout(() => setPhase('exit'), 2400);
    const t3 = setTimeout(() => setPhase('gone'), 2900);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  if (phase === 'gone') return children;

  return (
    <>
      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white transition-all duration-700"
        style={{
          opacity: phase === 'exit' ? 0 : 1,
          pointerEvents: phase === 'gone' ? 'none' : 'auto',
        }}
      >
        <div
          className="transition-all duration-700 ease-out flex flex-col items-center"
          style={{
            opacity: phase === 'enter' ? 0 : 1,
            transform: phase === 'enter'
              ? 'scale(0.85) translateY(20px)'
              : phase === 'exit'
              ? 'scale(1.05) translateY(-10px)'
              : 'scale(1) translateY(0)',
          }}
        >
          <img
            src="/vertical-logo.png"
            alt="Happy Renting"
            className="w-auto h-auto max-h-[200px] sm:max-h-[260px] object-contain"
          />
          <div className="mt-8 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" style={{ animationDelay: '200ms' }} />
            <div className="w-2 h-2 rounded-full bg-brand-300 animate-pulse" style={{ animationDelay: '400ms' }} />
          </div>
        </div>
      </div>

      {/* Render children underneath so they are ready when splash exits */}
      <div style={{ opacity: 0, pointerEvents: 'none' }}>{children}</div>
    </>
  );
};

export default SplashScreen;
