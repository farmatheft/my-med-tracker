import React, { useEffect, useState } from 'react';

export default function SplashScreen({ onComplete }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Show splash screen for 2.8 seconds, then fade out
    const timer1 = setTimeout(() => setFading(true), 2800);
    const timer2 = setTimeout(() => { if (onComplete) onComplete(); }, 3300);
    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, [onComplete]);

  const cushionThickness = 32;
  const pillThickness = 20;

  return (
    <>
      <style>{`
        .splash-bg {
          background: radial-gradient(circle at 50% 50%, #4B4B52 0%, #151518 100%);
        }
        .preserve-3d {
          transform-style: preserve-3d;
        }
        
        /* Physics: 0% and 100% is the bottom of the bounce */
        @keyframes pillJump {
          0%, 100% { 
            transform: translateZ(12px); 
            animation-timing-function: cubic-bezier(0.33, 1, 0.68, 1); 
          }
          50% { 
            transform: translateZ(260px); 
            animation-timing-function: cubic-bezier(0.32, 0, 0.67, 0); 
          }
        }
        
        @keyframes pillSpin {
          0% { transform: rotateY(0deg) rotateX(0deg); }
          100% { transform: rotateY(1080deg) rotateX(720deg); }
        }
        
        @keyframes pillShadowPulse {
          0%, 100% {
            transform: scale(1.1);
            opacity: 0.7;
            animation-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
          }
          50% {
            transform: scale(0.35);
            opacity: 0.1;
            animation-timing-function: cubic-bezier(0.32, 0, 0.67, 0);
          }
        }
        
        @keyframes cushionImpact {
          0%, 100% { 
            transform: translateZ(-8px) scale3d(0.97, 0.97, 0.9); 
            animation-timing-function: cubic-bezier(0.33, 1, 0.68, 1); 
          }
          15%, 85% { 
            transform: translateZ(0) scale3d(1, 1, 1); 
            animation-timing-function: cubic-bezier(0.32, 0, 0.67, 0); 
          }
          50% { 
            transform: translateZ(0) scale3d(1, 1, 1); 
          }
        }
      `}</style>

      <div className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-500 splash-bg ${fading ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        
        {/* Pro Texture */}
        <div className="absolute inset-0 pointer-events-none opacity-20" style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), radial-gradient(rgba(0,0,0,0.15) 1.5px, transparent 1.5px)',
            backgroundSize: '8px 8px', backgroundPosition: '0 0, 4px 4px'
        }} />
        
        <div style={{ perspective: '1200px' }} className="pointer-events-none flex items-center justify-center scale-[0.8] sm:scale-100">
          <div className="relative preserve-3d" style={{ transform: 'rotateX(60deg) rotateZ(45deg)' }}>
            
            {/* Cushion floor shadow */}
            <div className="absolute w-[240px] h-[240px] bg-black/60 rounded-[35px] -top-[120px] -left-[120px] filter blur-[18px] pointer-events-none" />

            {/* Cushion Base */}
            <div className="absolute preserve-3d" style={{ animation: 'cushionImpact 2.0s infinite' }}>
              {Array.from({ length: cushionThickness }).map((_, i) => (
                <div key={'cushion'+i} className="absolute w-[220px] h-[220px] rounded-[36px] -top-[110px] -left-[110px]"
                     style={{
                       backgroundColor: i === cushionThickness - 1 ? '#4D4D54' : '#3A3A40',
                       transform: `translateZ(${i}px)`,
                       border: i === cushionThickness - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none'
                     }}>
                     
                     {/* The indentation shadow from the pill when it hits */}
                     {i === cushionThickness - 1 && (
                       <>
                         <div className="absolute top-1/2 left-1/2 -ml-[55px] -mt-[55px] w-[110px] h-[110px] bg-black/50 rounded-full blur-[8px]" style={{ animation: 'pillShadowPulse 2.0s infinite' }} />
                         <div className="absolute top-1/2 left-1/2 -ml-[105px] -mt-[105px] w-[210px] h-[210px] rounded-[32px] border-2 border-white/5 opacity-50" />
                       </>
                     )}
                </div>
              ))}
            </div>

            {/* Pill Bouncing Container */}
            <div className="absolute preserve-3d" style={{ animation: 'pillJump 2.0s infinite' }}>
               <div className="absolute preserve-3d" style={{ animation: 'pillSpin 2.0s infinite linear' }}>
                 {Array.from({ length: pillThickness }).map((_, i) => (
                   <div key={'pill'+i} className="absolute w-[90px] h-[90px] rounded-full -top-[45px] -left-[45px]"
                        style={{
                          backgroundColor: i === pillThickness - 1 ? '#FFFFFF' : '#D4D4D4',
                          background: i === pillThickness - 1 ? 'radial-gradient(circle at 30% 30%, #ffffff 0%, #cccccc 100%)' : '#D4D4D4',
                          transform: `translateZ(${i}px)`,
                          overflow: 'hidden'
                        }}>
                        
                        {/* Score line on the top surface */}
                        {i === pillThickness - 1 && (
                          <div className="w-full h-full relative" style={{ transform: 'rotate(15deg)' }}>
                            <div className="absolute top-1/2 left-0 w-full h-[4px] bg-white opacity-90" />
                            <div className="absolute top-1/2 left-0 w-full h-[3px] -mt-[3px] bg-[#A8A8A8]" />
                          </div>
                        )}
                   </div>
                 ))}
               </div>
            </div>

          </div>
        </div>
        
      </div>
    </>
  );
}
