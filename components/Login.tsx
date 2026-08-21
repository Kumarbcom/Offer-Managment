import React, { useState } from 'react';
import type { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
  users: User[] | null;
  isLoading: boolean;
}

export const Login: React.FC<LoginProps> = ({ onLogin, users, isLoading }) => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!users) return;
    const user = users.find(u => u.name === username && u.password === password);
    if (user) {
      onLogin(user);
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen flex bg-[#f8f9fc]">
      
      {/* Left Column - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-24 relative">
        {/* Subtle background gradient for depth like the mockup */}
        <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-orange-50/50 -z-10" />
        
        <div className="w-full max-w-md space-y-8">
          
          <div className="text-center space-y-4">
            <img 
              src="https://siddhikabel.com/images/favicon.png" 
              alt="Siddhi Kabel Logo" 
              className="h-16 mx-auto mb-4"
            />
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome back</h2>
            <p className="text-slate-500 text-sm">Please enter your details to access your account.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 mt-10">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-sm text-center font-medium">
                {error}
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 ml-1">Username</label>
              <div className="relative">
                <select 
                  value={username} 
                  onChange={e => setUsername(e.target.value)}
                  className="block w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm shadow-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-slate-900 appearance-none transition-colors"
                  required
                >
                  <option value="" disabled className="text-slate-400">Select User...</option>
                  {users?.map(u => (
                    <option key={u.name} value={u.name}>{u.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 ml-1">Password</label>
              <input 
                type="password" 
                placeholder="••••••••"
                value={password} 
                onChange={e => setPassword(e.target.value)}
                className="block w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm shadow-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-slate-900 transition-colors placeholder:text-slate-300"
                required
              />
            </div>
            
            <div className="pt-2">
              <button 
                type="submit" 
                disabled={isLoading || !users}
                className="w-full flex justify-center py-3.5 px-4 rounded-2xl shadow-sm text-sm font-bold text-white bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-all transform hover:-translate-y-0.5"
              >
                {isLoading ? 'Loading...' : 'Sign In'}
              </button>
            </div>
          </form>

          <p className="text-center text-xs text-slate-400 mt-8">
            © {new Date().getFullYear()} Siddhi Kabel Corporation Pvt Ltd.
          </p>
        </div>
      </div>

      {/* Right Column - Image & Slogan */}
      <div className="hidden lg:flex w-1/2 relative bg-slate-900 m-4 rounded-3xl overflow-hidden shadow-2xl">
        <img 
          src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&q=80" 
          alt="Team Collaboration" 
          className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent" />
        
        {/* Floating Glass Card */}
        <div className="absolute bottom-12 left-12 right-12 p-8 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 text-white">
          <div className="inline-block px-3 py-1 bg-red-600/20 text-red-100 rounded-full text-xs font-bold tracking-wider uppercase mb-4 border border-red-500/30">
            Industrial Electrical Solutions
          </div>
          <h1 className="text-4xl font-bold mb-4 leading-tight">
            Dependable Solutions for your Industrial Requirements
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed max-w-xl">
            Authorised Distributors, Dealers, Importers, Suppliers, Channel Partners and Integrators of world class Industrial Electrical, Automation & Safety Products.
          </p>
          
          <div className="mt-8 flex items-center gap-4">
             <div className="flex -space-x-3">
                <img className="w-10 h-10 rounded-full border-2 border-slate-800" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" alt="" />
                <img className="w-10 h-10 rounded-full border-2 border-slate-800" src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" alt="" />
                <img className="w-10 h-10 rounded-full border-2 border-slate-800" src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" alt="" />
             </div>
             <div className="text-sm font-medium text-slate-300">
               Trusted by thousands of businesses
             </div>
          </div>
        </div>
      </div>
      
    </div>
  );
};
