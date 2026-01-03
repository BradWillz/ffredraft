'use client';

import { useState, useRef } from 'react';

export const WHEEL_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7'
];

interface WheelSpinnerProps {
  scenarios: string[];
  onSpinComplete: (scenario: string) => void;
  canSpin: boolean;
}

export default function WheelSpinner({ scenarios, onSpinComplete, canSpin }: WheelSpinnerProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleSpin = () => {
    if (!canSpin || isSpinning || scenarios.length === 0) return;

    setIsSpinning(true);

    // Play spinning sound
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => console.log('Audio play failed:', err));
    }

    // Random selection
    const selectedIndex = Math.floor(Math.random() * scenarios.length);
    const selectedScenario = scenarios[selectedIndex];

    // Calculate rotation
    const degreesPerSegment = 360 / scenarios.length;
    const targetRotation = selectedIndex * degreesPerSegment;
    
    // Add multiple full rotations + target rotation
    const fullRotations = 5 + Math.random() * 3; // 5-8 full spins
    const totalRotation = rotation + (fullRotations * 360) + (360 - targetRotation);

    setRotation(totalRotation);

    // Wait for animation to complete
    setTimeout(() => {
      setIsSpinning(false);
      onSpinComplete(selectedScenario);
    }, 4000);
  };

  const segmentAngle = 360 / scenarios.length;

  return (
    <div className="flex flex-col items-center w-full">
      {/* Audio element for spinning sound */}
      <audio ref={audioRef} src="/wheel-spin.mp3" preload="auto" />
      
      {/* Wheel Container */}
      <div className="relative w-full max-w-[500px] aspect-square mb-8 px-4">
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 sm:-translate-y-4 z-10">
          <div className="w-0 h-0 border-l-[12px] sm:border-l-[20px] border-l-transparent border-r-[12px] sm:border-r-[20px] border-r-transparent border-t-[18px] sm:border-t-[30px] border-t-yellow-400 drop-shadow-lg" />
        </div>

        {/* Wheel SVG */}
        <svg 
          width="100%" 
          height="100%" 
          viewBox="0 0 500 500"
          className="rounded-full shadow-2xl"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: isSpinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none'
          }}
        >
          {scenarios.map((scenario, index) => {
            const startAngle = index * segmentAngle - 90;
            const endAngle = startAngle + segmentAngle;
            
            const startRad = (startAngle * Math.PI) / 180;
            const endRad = (endAngle * Math.PI) / 180;
            const radius = 250;
            
            const x1 = 250 + radius * Math.cos(startRad);
            const y1 = 250 + radius * Math.sin(startRad);
            const x2 = 250 + radius * Math.cos(endRad);
            const y2 = 250 + radius * Math.sin(endRad);
            
            const largeArc = segmentAngle > 180 ? 1 : 0;
            const pathData = `M 250 250 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

            const textAngle = startAngle + segmentAngle / 2;
            const textRad = (textAngle * Math.PI) / 180;
            const textRadius = radius * 0.7;
            const textX = 250 + textRadius * Math.cos(textRad);
            const textY = 250 + textRadius * Math.sin(textRad);

            return (
              <g key={index}>
                <path
                  d={pathData}
                  fill={WHEEL_COLORS[index % WHEEL_COLORS.length]}
                  stroke="white"
                  strokeWidth="2"
                />
                <text
                  x={textX}
                  y={textY}
                  fill="white"
                  fontSize="28"
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {index + 1}
                </text>
              </g>
            );
          })}
          
          <circle cx="250" cy="250" r="40" fill="white" stroke="#333" strokeWidth="3" />
        </svg>

        {/* Center button overlay */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <button
            onClick={handleSpin}
            disabled={!canSpin || isSpinning}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white border-3 sm:border-4 border-gray-800 font-bold text-gray-800 text-base sm:text-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-110 active:scale-95 shadow-xl"
          >
            {isSpinning ? '...' : 'SPIN'}
          </button>
        </div>
      </div>

      {/* Spin Button */}
      {!canSpin && scenarios.length > 0 && (
        <div className="text-white/70 text-center">
          <p>This week&apos;s scenario has already been determined.</p>
          <p className="text-sm mt-1">The wheel will be available again next week.</p>
        </div>
      )}
    </div>
  );
}
