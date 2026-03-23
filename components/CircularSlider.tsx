import React, { useState, useEffect, useRef } from 'react';

interface CircularSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
}

const CircularSlider: React.FC<CircularSliderProps> = ({ value, onChange, min = 0, max = 1000, step = 1, label = 'pieces' }) => {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [angle, setAngle] = useState(0);

  // Initialize angle based on value
  useEffect(() => {
    if (!isDragging) {
      const percentage = (value - min) / (max - min);
      setAngle(percentage * 360);
    }
  }, [value, min, max, isDragging]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    updateValueFromEvent(e.clientX, e.clientY);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      updateValueFromEvent(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const updateValueFromEvent = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    
    // Calculate angle in degrees (0 is top, clockwise)
    let newAngle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (newAngle < 0) newAngle += 360;
    
    setAngle(newAngle);
    
    const percentage = newAngle / 360;
    let newValue = min + percentage * (max - min);
    
    // Snap to step
    newValue = Math.round(newValue / step) * step;
    
    // Clamp
    newValue = Math.max(min, Math.min(max, newValue));
    
    onChange(newValue);
  };

  // Calculate knob position
  const radius = 112; // 128 (half of 256) - 16 (padding)
  const knobX = 128 + radius * Math.cos((angle - 90) * (Math.PI / 180));
  const knobY = 128 + radius * Math.sin((angle - 90) * (Math.PI / 180));

  return (
    <div className="relative w-64 h-64 mx-auto flex items-center justify-center select-none touch-none">
      <div 
        ref={containerRef}
        className="absolute inset-0 rounded-full border-[12px] border-white/5 shadow-inner cursor-pointer"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Track */}
        <svg className="absolute inset-[-12px] w-[calc(100%+24px)] h-[calc(100%+24px)] pointer-events-none" viewBox="0 0 280 280">
          <circle 
            cx="140" 
            cy="140" 
            r="112" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="12" 
            className="text-primary opacity-20"
          />
          <circle 
            cx="140" 
            cy="140" 
            r="112" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="12" 
            className="text-primary"
            strokeDasharray={`${(angle / 360) * 2 * Math.PI * 112} 1000`}
            strokeDashoffset="0"
            transform="rotate(-90 140 140)"
            strokeLinecap="round"
          />
        </svg>

        {/* Knob */}
        <div 
          className="absolute w-8 h-8 -ml-4 -mt-4 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)] border-4 border-primary pointer-events-none"
          style={{ 
            left: `${knobX}px`,
            top: `${knobY}px`
          }}
        ></div>
      </div>

      {/* Center Content */}
      <div className="relative z-10 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-6xl font-black text-white tracking-tighter tabular-nums">{value}</span>
        <span className="text-[10px] text-primary font-black uppercase tracking-[0.4em] mt-2">{label}</span>
      </div>
    </div>
  );
};

export default CircularSlider;
