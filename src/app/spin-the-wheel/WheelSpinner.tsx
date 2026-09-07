'use client';

import { useState } from 'react';

export const WHEEL_COLORS = [
  '#c8f135', '#ff6b35', '#ffc857', '#4d8f58',
  '#b64c2e', '#a77b27', '#78a819', '#9c3d2b',
  '#d4a93a', '#2b6248', '#e27f39', '#779725',
  '#81402b', '#c59832'
];

interface WheelSpinnerProps {
  scenarios: string[];
  onSpinComplete: (scenario: string) => void;
  canSpin: boolean;
  isAdmin: boolean;
}

export default function WheelSpinner({ scenarios, onSpinComplete, canSpin, isAdmin }: WheelSpinnerProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);

  const handleSpin = () => {
    if (!canSpin || isSpinning || scenarios.length === 0) return;

    setIsSpinning(true);

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
    <section className="wheel-stage" aria-label="Scenario wheel">
      <div className="wheel-stage__rail" aria-hidden="true">
        <span>Scenario Selector</span>
        <span>Week {scenarios.length > 0 ? 'Live' : 'Complete'}</span>
      </div>
      <div className="wheel-stage__body">
        <div className="wheel-stage__copy">
          <p className="eyebrow">Commissioner&apos;s Call</p>
          <h2>Spin. That. Wheel.</h2>
          <p>One weekly scenario decides the chase. The wheel only gives each scenario one shot at glory.</p>
          <div className="wheel-stage__key" aria-label="Wheel color key">
            <span><i className="wheel-stage__dot wheel-stage__dot--lime" /> In play</span>
            <span><i className="wheel-stage__dot wheel-stage__dot--orange" /> One spin only</span>
          </div>
        </div>

        {/* Wheel Container */}
        <div className="wheel-stage__wheel relative w-full max-w-[500px] aspect-square px-4">
        {/* Pointer */}
        <div className="wheel-stage__pointer absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 sm:-translate-y-4 z-10" aria-hidden="true">
          <div className="w-0 h-0 border-l-[12px] sm:border-l-[20px] border-l-transparent border-r-[12px] sm:border-r-[20px] border-r-transparent border-t-[18px] sm:border-t-[30px]" />
        </div>

        {/* Wheel SVG */}
        <svg 
          width="100%" 
          height="100%" 
          viewBox="0 0 500 500"
          className="wheel-stage__svg rounded-full"
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
                  stroke="#07100d"
                  strokeWidth="3"
                />
                <text
                  x={textX}
                  y={textY}
                  fill="#07100d"
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
          
          <circle cx="250" cy="250" r="42" fill="#f7f4ea" stroke="#07100d" strokeWidth="5" />
        </svg>

        {/* Center button overlay */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <button
            onClick={handleSpin}
            disabled={!canSpin || isSpinning}
            className="wheel-stage__spin w-16 h-16 sm:w-20 sm:h-20 rounded-full font-bold text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-110 active:scale-95"
          >
            {isSpinning ? '...' : 'SPIN'}
          </button>
        </div>
        </div>
      </div>

      {/* Spin Button */}
      {!canSpin && scenarios.length > 0 && (
        <div className="wheel-stage__notice">
          <p>{isAdmin ? 'This week\'s scenario has already been determined.' : 'Commissioner controls this shared wheel.'}</p>
          <p className="text-sm mt-1">{isAdmin ? 'The wheel will be available again next week.' : 'Results appear here for everyone after each spin.'}</p>
        </div>
      )}
    </section>
  );
}
