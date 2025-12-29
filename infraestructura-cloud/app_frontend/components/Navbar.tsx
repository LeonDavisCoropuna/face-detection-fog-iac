
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAlerts } from '../contexts/AlertContext';

const Navbar: React.FC = () => {
  const { user, signOut } = useAuth();
  const { unreadCount } = useAlerts();
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 flex-shrink-0 z-30">
      <div className="flex items-center gap-4">
        <button className="md:hidden text-gray-500">
          <i className="fas fa-bars text-xl"></i>
        </button>
        <h2 className="text-lg font-semibold text-gray-800 hidden sm:block">
          Security Control Panel
        </h2>
      </div>

      <div className="flex items-center gap-6">
        <div 
          onClick={() => navigate('/alerts')}
          className="relative cursor-pointer group"
          title="View Alerts"
        >
          <div className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <i className={`far fa-bell text-xl ${unreadCount > 0 ? 'text-blue-600' : 'text-gray-600'}`}></i>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white animate-pulse">
                {unreadCount}
              </span>
            )}
          </div>
        </div>

        <div className="relative">
          <button 
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-3 hover:bg-gray-50 p-1 pr-3 rounded-full transition-colors"
          >
            <img 
              src={user?.photoURL || ''} 
              alt="Avatar" 
              className="w-8 h-8 rounded-full border border-gray-200 object-cover"
            />
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-gray-700 leading-none">{user?.displayName}</p>
              <p className="text-xs text-gray-500 mt-1">Administrator</p>
            </div>
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-2 animate-in fade-in slide-in-from-top-2">
              <div className="px-4 py-2 border-b border-gray-100 mb-1 sm:hidden">
                <p className="text-sm font-bold truncate">{user?.displayName}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <button 
                onClick={() => {
                  navigate('/profile');
                  setShowDropdown(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <i className="fas fa-user-circle"></i> Profile
              </button>
              <button 
                onClick={() => {
                  navigate('/settings');
                  setShowDropdown(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <i className="fas fa-shield-alt"></i> Security
              </button>
              <button 
                onClick={signOut}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-gray-100 mt-1"
              >
                <i className="fas fa-sign-out-alt"></i> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
