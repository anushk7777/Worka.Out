import React, { useState } from 'react';

interface Props {
  beforeImage: string;
  afterImage: string;
  beforeDate: string;
  afterDate: string;
}

const ComparisonSlider: React.FC<Props> = ({ beforeImage, afterImage, beforeDate, afterDate }) => {
  const [sliderPosition, setSliderPosition] = useState(50);

  return (
    <div className="w-full aspect-[3/4] relative rounded-xl overflow-hidden select-none border border-gray-700 shadow-2xl">
      {/* Before Image (Base) */}
      <img 
        src={beforeImage} 
        alt="Before" 
        className="absolute top-0 left-0 w-full h-full object-cover"
      />
      <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm">
        {beforeDate}
      </div>

      {/* After Image (Clipped) */}
      <div 
        className="absolute top-0 left-0 w-full h-full overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <img 
            src={afterImage} 
            alt="After" 
            className="absolute top-0 left-0 w-full h-full object-cover"
        />
        <div className="absolute top-2 right-2 bg-primary text-black text-[10px] font-bold px-2 py-1 rounded shadow-lg">
            {afterDate}
        </div>
      </div>

      {/* Slider Control */}
      <input
        type="range"
        min="0"
        max="100"
        value={sliderPosition}
        onChange={(e) => setSliderPosition(parseInt(e.target.value))}
        className="absolute top-1/2 left-0 w-full z-20 opacity-0 cursor-ew-resize h-10 -translate-y-1/2"
      />

      {/* Visual Slider Handle */}
      <div 
        className="absolute top-0 bottom-0 w-1 bg-white z-10 pointer-events-none shadow-[0_0_10px_rgba(0,0,0,0.5)]"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg text-primary">
            <i className="fas fa-arrows-alt-h text-gray-800 text-xs"></i>
        </div>
      </div>
    </div>
  );
};

export default ComparisonSlider;