
import React from 'react';
import { useAlerts } from '../contexts/AlertContext';
import { useEmployees } from '../hooks/useEmployees';
import { CONFIG } from '../config';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const data = [
  { name: '08:00', alerts: 2, employees: 12 },
  { name: '10:00', alerts: 5, employees: 15 },
  { name: '12:00', alerts: 1, employees: 20 },
  { name: '14:00', alerts: 8, employees: 18 },
  { name: '16:00', alerts: 3, employees: 15 },
  { name: '18:00', alerts: 12, employees: 10 },
  { name: '20:00', alerts: 4, employees: 4 },
];

const Dashboard: React.FC = () => {
  const { unreadCount, alerts, simulateAlert } = useAlerts();
  const { employees } = useEmployees();

  const StatCard: React.FC<{ icon: string, label: string, value: string | number, color: string, trend?: string }> = ({ icon, label, value, color, trend }) => (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
          <h3 className="text-3xl font-bold text-gray-900 mt-2">{value}</h3>
          {trend && (
            <p className={`text-xs mt-2 font-medium flex items-center gap-1 ${trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
              <i className={`fas fa-arrow-${trend.startsWith('+') ? 'up' : 'down'}`}></i>
              {trend} from yesterday
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${color}`}>
          <i className={`fas ${icon}`}></i>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Control Center</h1>
          <p className="text-gray-500">Monitoring status for {CONFIG.app.companyName}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={simulateAlert}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg shadow-red-500/20 transition-all"
          >
            <i className="fas fa-biohazard"></i>
            Simulate Alert
          </button>
          <div className="h-8 w-px bg-gray-200 mx-2 hidden sm:block"></div>
          <div className="flex -space-x-3 overflow-hidden">
            {employees.slice(0, 4).map(e => (
              <img key={e.id} src={e.photoUrl} className="inline-block h-10 w-10 rounded-full ring-2 ring-white" />
            ))}
          </div>
          <span className="text-sm text-gray-500 font-medium hidden sm:block">+{employees.length} active staff</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon="fa-bell" 
          label="Unreviewed Alerts" 
          value={unreadCount} 
          color="bg-red-50 text-red-600" 
          trend="+12%" 
        />
        <StatCard 
          icon="fa-users" 
          label="Active Staff" 
          value={employees.filter(e => e.active).length} 
          color="bg-blue-50 text-blue-600" 
          trend="+2%" 
        />
        <StatCard 
          icon="fa-shield-check" 
          label="Secure Zones" 
          value="14/15" 
          color="bg-green-50 text-green-600" 
        />
        <StatCard 
          icon="fa-clock" 
          label="Uptime" 
          value="99.9%" 
          color="bg-indigo-50 text-indigo-600" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold">Activity Analytics</h3>
            <select className="bg-gray-50 border border-gray-200 text-sm rounded-lg px-3 py-1 outline-none">
              <option>Last 24 Hours</option>
              <option>Last 7 Days</option>
            </select>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorAlerts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Area type="monotone" dataKey="alerts" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorAlerts)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold mb-6">Critical Alerts</h3>
          <div className="space-y-6">
            {alerts.slice(0, 5).map(alert => (
              <div key={alert.id} className="flex gap-4">
                <div className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center ${alert.status === 'MATCH' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  <i className={`fas ${alert.status === 'MATCH' ? 'fa-user-check' : 'fa-user-secret'}`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {alert.status === 'MATCH' ? `Staff: ${alert.matchedWith}` : 'Unknown Intrusion'}
                  </p>
                  <p className="text-xs text-gray-500">{CONFIG.app.monitoringZone} • Just now</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-400">{(alert.distance * 100).toFixed(0)}% Dist</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-8 py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold rounded-xl transition-all text-sm">
            View All Logs
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
