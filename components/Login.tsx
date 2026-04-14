import React, { useState } from 'react';
import type { User } from '../types';
import { USERS } from '../auth';
import { supabase } from '../supabaseClient';

interface LoginProps {
  onLogin: (user: User) => void;
  users: User[] | null;
  isLoading: boolean;
}

export const Login: React.FC<LoginProps> = ({ onLogin, users, isLoading }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 1. Try Supabase-loaded users first
    if (users) {
      const user = users.find(u => u.name === username);
      if (user && user.password === password) {
        onLogin(user);
        return;
      }
    }

    // 2. Fallback: check against hardcoded auth.ts list (in case Supabase has stale/corrupted data)
    const fallbackUser = USERS.find(u => u.name === username);
    if (fallbackUser && fallbackUser.password === password) {
      // Merge with any Supabase role info if available, otherwise use auth.ts role
      const mergedUser = users?.find(u => u.name === username) || fallbackUser;
      onLogin({ ...mergedUser, password });
      return;
    }

    setError('Invalid username or password');
  };

  // Emergency: reseed Supabase users table without needing login
  const handleResetPasswords = async () => {
    if (!window.confirm(
      'This will reset ALL user passwords to "123456" in the cloud database.\n\nProceed?'
    )) return;

    setIsResetting(true);
    try {
      if (!supabase) throw new Error('Supabase not configured');
      const payload = USERS.map(u => ({ name: u.name, password: u.password, role: u.role }));
      const { error } = await supabase.from('users').upsert(payload, { onConflict: 'name' });
      if (error) throw new Error(error.message);
      alert('✅ Passwords reset to 123456 for all users. Please sign in now.');
      window.location.reload();
    } catch (e) {
      alert('❌ Reset failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Login</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Username
            </label>
            <select
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="">Select User</option>
              {/* Always show auth.ts users list so login is never empty */}
              {(users && users.length > 0 ? users : USERS).map(u => (
                <option key={u.name} value={u.name}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
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
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Password"
            />
          </div>
          {error && (
            <div className="space-y-2">
              <p className="text-red-500 text-sm text-center">{error}</p>
              <button
                type="button"
                onClick={handleResetPasswords}
                disabled={isResetting}
                className="w-full text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md py-1.5 hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                {isResetting ? 'Resetting...' : '🔑 Reset all passwords to 123456'}
              </button>
            </div>
          )}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};