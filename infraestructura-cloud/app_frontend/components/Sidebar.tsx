
import React from 'react';
import { NavLink } from 'react-router-dom';
import { CONFIG } from '../config';

const Sidebar: React.FC = () => {
  const menuItems = [
    { icon: 'fa-chart-line', label: 'Dashboard', path: '/' },
    { icon: 'fa-users', label: 'Employees', path: '/employees' },
    { icon: 'fa-bell', label: 'Alerts', path: '/alerts' },
    { icon: 'fa-cog', label: 'Settings', path: '/settings' },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white flex-shrink-0 hidden md:flex flex-col">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
          <i className="fas fa-shield-halved text-xl"></i>
        </div>
        <span className="text-xl font-bold tracking-tight">{CONFIG.app.name}</span>
      </div>
      
      <nav className="flex-1 mt-6">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex items-center gap-4 px-6 py-4 transition-colors
              ${isActive ? 'bg-blue-600/10 text-blue-400 border-r-4 border-blue-500' : 'text-gray-400 hover:text-white hover:bg-white/5'}
            `}
          >
            <i className={`fas ${item.icon} w-5 text-center`}></i>
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-6 border-t border-gray-800">
        <div className="bg-gray-800/50 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Status</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-sm">System Online</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
