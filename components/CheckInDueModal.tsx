import React from 'react';

interface Props {
  onConfirm: () => void;
  onDismiss: () => void;
}

const CheckInDueModal: React.FC<Props> = ({ onConfirm, onDismiss }) => {
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div className="bg-secondary border border-primary/50 rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl relative overflow-hidden animate-fade-in-up">
        {/* Glow effect */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent"></div>
        
        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <i className="fas fa-calendar-check text-3xl text-primary"></i>
        </div>
        
        <h2 className="text-xl font-bold text-white mb-2">Check-in Required</h2>
        <p className="text-gray-400 text-sm mb-6">
          It has been 2 weeks since your last update. To keep your AI plan accurate, we need a fresh body composition scan.
        </p>
        
        <div className="space-y-3">
          <button 
            onClick={onConfirm}
            className="w-full bg-primary hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center shadow-lg shadow-primary/20"
          >
            <i className="fas fa-camera mr-2"></i> Scan & Log Now
          </button>
          
          <button 
            onClick={onDismiss}
            className="text-gray-500 text-xs hover:text-gray-300 underline"
          >
            Remind me later
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckInDueModal;