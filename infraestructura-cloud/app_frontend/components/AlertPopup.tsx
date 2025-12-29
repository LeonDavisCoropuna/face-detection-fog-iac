
import React, { useEffect } from 'react';
import { useAlerts } from '../contexts/AlertContext';
import { useNavigate } from 'react-router-dom';

const AlertPopup: React.FC = () => {
  const { activePopup, dismissPopup } = useAlerts();
  const navigate = useNavigate();

  useEffect(() => {
    if (activePopup) {
      // Automatically hide after 5 seconds as requested
      const timer = setTimeout(() => {
        dismissPopup(); 
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activePopup, dismissPopup]);

  if (!activePopup) return null;

  const handleCardClick = () => {
    navigate('/alerts');
    dismissPopup();
  };

  return (
    <div className="fixed top-6 right-6 z-[9999] w-full max-w-sm animate-in slide-in-from-right-10 duration-500">
      <div 
        onClick={handleCardClick}
        className={`
          relative overflow-hidden bg-white border-2 rounded-2xl shadow-2xl shadow-red-500/20 cursor-pointer group transition-transform hover:scale-[1.02]
          ${activePopup.status === 'UNKNOWN' ? 'border-red-500' : 'border-blue-500'}
        `}
      >
        {/* Flashing header bar */}
        <div className={`
          px-4 py-2 flex items-center justify-between text-white font-black text-[10px] tracking-widest uppercase animate-pulse
          ${activePopup.status === 'UNKNOWN' ? 'bg-red-600' : 'bg-blue-600'}
        `}>
          <div className="flex items-center gap-2">
            <i className="fas fa-triangle-exclamation"></i>
            <span>Sistema en Alerta</span>
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              dismissPopup();
            }} 
            className="hover:opacity-70 p-1"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-4 flex gap-4">
          <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
            <img src={activePopup.croppedFaceUrl} className="w-full h-full object-cover" alt="Face" />
            <div className="absolute inset-0 ring-1 ring-inset ring-black/10"></div>
          </div>
          
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <h4 className="font-bold text-gray-900 truncate text-sm">
              {activePopup.status === 'UNKNOWN' ? 'Persona No Identificada' : `Staff Detectado: ${activePopup.matchedWith}`}
            </h4>
            <p className="text-xs text-gray-500 mt-1">
              Detección en tiempo real: <span className="font-bold text-gray-700">CAM-04</span>
            </p>
            <p className="text-[10px] text-blue-600 font-bold mt-2 flex items-center gap-1">
              Haga clic para ver detalles <i className="fas fa-external-link-alt text-[8px]"></i>
            </p>
          </div>
        </div>

        {/* Scan effect progress bar (visual timer) */}
        <div className="absolute bottom-0 left-0 h-1 bg-gray-100 w-full">
           <div className={`
            h-full transition-all duration-[5000ms] ease-linear
            ${activePopup.status === 'UNKNOWN' ? 'bg-red-500' : 'bg-blue-500'}
          `} style={{ width: '0%', animation: 'shrinkWidth 5s linear forwards' }}></div>
        </div>
      </div>
      <style>{`
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export default AlertPopup;
