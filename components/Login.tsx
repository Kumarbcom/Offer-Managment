import React, { useState } from 'react';
import type { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
  users: User[] | null;
  isLoading: boolean;
}

export const Login: React.FC<LoginProps> = ({ onLogin, users, isLoading }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [logoUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem('company_logo');
    } catch (e) {
      return null;
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!users) {
        setError('User data is not available. Please try again later.');
        return;
    }
    const user = users.find(u => u.name === username);
    if (user && user.password === password) {
      onLogin(user);
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background blobs for depth */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-900/20 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-purple-900/10 blur-[130px] pointer-events-none" />

      {/* Login Card Container */}
      <div className="max-w-md w-full bg-slate-900/40 backdrop-blur-xl p-8 rounded-2xl border border-slate-800/80 shadow-2xl shadow-slate-950/50 relative z-10">
        
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-6">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt="Siddhi Kabel Logo" 
              className="h-16 w-auto object-contain mb-3 drop-shadow-md rounded p-1 bg-white" 
            />
          ) : (
            <svg className="w-16 h-16 mb-3 drop-shadow-lg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="48" fill="url(#bgGrad)" stroke="url(#borderGrad)" strokeWidth="2.5"/>
              <path d="M30 40C30 30 45 25 55 25C65 25 70 30 70 35C70 45 30 45 30 55C30 65 45 75 55 75C65 75 70 68 70 60" stroke="url(#cableGradBlue)" strokeWidth="7" strokeLinecap="round" fill="none"/>
              <path d="M30 40C30 30 45 25 55 25C65 25 70 30 70 35C70 45 30 45 30 55C30 65 45 75 55 75C65 75 70 68 70 60" stroke="url(#cableGradAmber)" strokeWidth="3" strokeLinecap="round" fill="none"/>
              <defs>
                <linearGradient id="bgGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#1e293b"/>
                  <stop offset="1" stopColor="#0b0f19"/>
                </linearGradient>
                <linearGradient id="borderGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#4f46e5"/>
                  <stop offset="1" stopColor="#ec4899"/>
                </linearGradient>
                <linearGradient id="cableGradBlue" x1="30" y1="25" x2="70" y2="75" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3b82f6"/>
                  <stop offset="1" stopColor="#6366f1"/>
                </linearGradient>
                <linearGradient id="cableGradAmber" x1="30" y1="25" x2="70" y2="75" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#f59e0b"/>
                  <stop offset="1" stopColor="#ef4444"/>
                </linearGradient>
              </defs>
            </svg>
          )}
          
          <h1 className="text-lg font-black tracking-tight text-white uppercase text-center">
            Siddhi Kabel
          </h1>
          <h2 className="text-[10px] font-bold tracking-[0.25em] text-indigo-400 uppercase text-center mt-0.5">
            Corporation Pvt Ltd
          </h2>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">
            Offer Management Portal
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="username" className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
              Username
            </label>
            <select
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option value="" className="bg-slate-950 text-slate-400">Select User</option>
              {users?.map(u => <option key={u.name} value={u.name} className="bg-slate-950 text-slate-200">{u.name}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="password" a-label="true" className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs px-3 py-2 rounded-lg text-center font-medium">
              {error}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>

        <p className="text-[9px] text-center text-slate-500 mt-8 font-medium tracking-wide">
          &copy; 2026 Siddhi Kabel Corporation Pvt Ltd. All rights reserved.
        </p>
      </div>
    </div>
  );
};