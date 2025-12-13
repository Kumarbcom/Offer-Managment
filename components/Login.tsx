
import React, { useState } from 'react';
import type { User } from '../types';
import { USERS as DEFAULT_USERS } from '../auth';

interface LoginProps {
  onLogin: (user: User) => void;
  users: User[] | null;
  isLoading: boolean;
}

export const Login: React.FC<LoginProps> = ({ onLogin, users, isLoading }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Always have a list of users to select from, falling back to local defaults
  const availableUsers = (users && users.length > 0) ? users : DEFAULT_USERS;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!availableUsers || availableUsers.length === 0) {
        setError('System Error: No user data available.');
        return;
    }

    const user = availableUsers.find(u => u.name === username);
    
    if (user) {
        if (user.password === password) {
            onLogin(user);
        } else {
            setError('Invalid password');
        }
    } else {
        setError('Invalid username');
    }
  };

  // Determine if interaction should be disabled
  // We allow interaction even if "isLoading" is true, as long as we have availableUsers (fallback)
  const isInteractionDisabled = !availableUsers || availableUsers.length === 0;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg">
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800">Siddhi Kabel Corp</h2>
            <p className="text-gray-500 mt-2">Offer Management System</p>
        </div>
        
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
              disabled={isInteractionDisabled}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white disabled:bg-gray-100"
            >
              <option value="">Select User</option>
              {availableUsers.map(u => (
                  <option key={u.name} value={u.name}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="password" a-label="true" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={isInteractionDisabled}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
              placeholder="Enter password"
            />
          </div>
          
          {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">{error}</h3>
                    </div>
                </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isInteractionDisabled}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading && users === null ? 'Loading (Offline Mode)...' : 'Sign in'}
            </button>
          </div>
        </form>
        
        {/* Status Indicator */}
        <div className="mt-4 text-center">
            {isLoading && users === null ? (
                <p className="text-xs text-blue-600 animate-pulse">Connecting to database...</p>
            ) : !users || users.length === 0 ? (
                <p className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded border border-yellow-200">
                    Offline Mode: Database unreachable. Using default accounts.
                </p>
            ) : null}
        </div>
      </div>
    </div>
  );
};
