
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAlerts } from '../contexts/AlertContext';

const Profile: React.FC = () => {
  const { user } = useAuth();
  const { alerts } = useAlerts();

  const activityCount = alerts.filter(a => a.reviewed).length;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Profile Header */}
      <div className="relative">
        <div className="h-48 w-full bg-gradient-to-r from-blue-600 to-indigo-900 rounded-3xl"></div>
        <div className="absolute -bottom-12 left-8 flex items-end gap-6">
          <div className="relative">
            <img 
              src={user?.photoURL || ''} 
              alt="Profile" 
              className="w-32 h-32 rounded-full border-4 border-white shadow-xl bg-gray-200 object-cover"
            />
            <button className="absolute bottom-1 right-1 bg-white p-2 rounded-full shadow-md hover:bg-gray-50 transition-colors text-blue-600 border border-gray-100">
              <i className="fas fa-camera text-xs"></i>
            </button>
          </div>
          <div className="mb-2">
            <h1 className="text-2xl font-bold text-white drop-shadow-sm">{user?.displayName}</h1>
            <p className="text-blue-100 font-medium opacity-90">System Administrator • Sentinel HQ</p>
          </div>
        </div>
      </div>

      <div className="pt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Account Stats</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Alerts Reviewed</span>
                <span className="font-bold text-blue-600">{activityCount}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Access Level</span>
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-black uppercase">Root Admin</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Last Login</span>
                <span className="text-gray-900 font-medium">Just now</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">System Access</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <i className="fas fa-fingerprint text-emerald-500"></i>
                <span className="text-xs font-medium text-gray-600">Biometric Verified</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <i className="fas fa-shield-alt text-blue-500"></i>
                <span className="text-xs font-medium text-gray-600">2FA Enabled</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Profile Settings */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold">Personal Information</h3>
              <button className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">
                <i className="far fa-edit mr-2"></i>Edit Profile
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Full Name</label>
                <p className="font-medium text-gray-900 border-b border-gray-100 pb-2">{user?.displayName}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Email Address</label>
                <p className="font-medium text-gray-900 border-b border-gray-100 pb-2">{user?.email}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Phone Number</label>
                <p className="font-medium text-gray-900 border-b border-gray-100 pb-2">+1 (555) 012-3456</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Work Shift</label>
                <p className="font-medium text-gray-900 border-b border-gray-100 pb-2">Day Monitoring (08:00 - 17:00)</p>
              </div>
            </div>

            <div className="mt-10">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-3">Professional Bio</label>
              <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">
                Senior security architect with 10+ years of experience in physical security systems and digital surveillance. Currently leading the Sentinel AI initiative at Central Plaza.
              </p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold mb-6">Security Settings</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                    <i className="fas fa-key"></i>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Change Password</p>
                    <p className="text-xs text-gray-500">Update your credentials regularly for better security</p>
                  </div>
                </div>
                <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold hover:bg-gray-50 transition-all">
                  Update
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <i className="fas fa-mobile-alt"></i>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Two-Step Verification</p>
                    <p className="text-xs text-gray-500">Add an extra layer of security to your account</p>
                  </div>
                </div>
                <div className="w-12 h-6 bg-emerald-500 rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
