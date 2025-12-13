
import React, { useState, useMemo } from 'react';
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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Merge DB users with Default users to ensure we have a robust list
  const availableUsers = useMemo(() => {
    const dbUsers = users || [];
    const mergedMap = new Map<string, User>();

    // 1. Add all Default Users first
    DEFAULT_USERS.forEach(u => mergedMap.set(u.name, u));

    // 2. Overlay DB Users (this ensures we get the latest Role/Data from DB)
    dbUsers.forEach(dbUser => {
        mergedMap.set(dbUser.name, dbUser);
    });

    return Array.from(mergedMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!availableUsers || availableUsers.length === 0) {
        setError('System Error: No user data available.');
        return;
    }

    const selectedUser = availableUsers.find(u => u.name === username);
    const defaultUser = DEFAULT_USERS.find(u => u.name === username);
    
    if (selectedUser) {
        const inputPwd = password.trim();
        const dbPwd = selectedUser.password ? selectedUser.password.trim() : '';
        const defaultPwd = defaultUser ? defaultUser.password.trim() : '';

        // LOGIN LOGIC:
        // 1. Check against the user record from the DB/State.
        // 2. FAILSAFE: Check against the hardcoded default password in auth.ts.
        //    This ensures that even if the DB password is lost, corrupted, or changed unexpectedly,
        //    the standard default password (123456) will still grant access.
        
        if ((dbPwd && inputPwd === dbPwd) || (defaultPwd && inputPwd === defaultPwd) || inputPwd === '123456') {
            // If logging in via failsafe default password, ensure we pass that awareness downstream 
            // if we want to force a password change, though current App.tsx handles '123456' check.
            onLogin(selectedUser);
        } else {
            console.warn(`Login failed for ${username}. Input matches neither DB nor Default.`);
            setError('Invalid password');
        }
    } else {
        setError('Invalid username');
    }
  };

  const isInteractionDisabled = availableUsers.length === 0;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
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
            <div className="relative mt-1 rounded-md shadow-sm">
                <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                disabled={isInteractionDisabled}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 pr-10"
                placeholder="Enter password"
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                    {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                            <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.742L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                    )}
                </button>
            </div>
          </div>
          
          {error && (
              <div className="rounded-md bg-red-50 p-4 border border-red-200">
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
              Sign in
            </button>
          </div>
        </form>
        
        {/* Status Indicator */}
        <div className="mt-6 text-center border-t pt-4">
            <p className="text-xs text-gray-400">Default Password: 123456</p>
            {isLoading && users === null ? (
                <p className="text-xs text-blue-600 animate-pulse mt-1">Connecting to database...</p>
            ) : !users || users.length === 0 ? (
                <p className="text-xs text-orange-600 mt-1">
                    Offline Mode enabled.
                </p>
            ) : (
                <p className="text-xs text-green-600 mt-1">
                    Database Connected.
                </p>
            )}
        </div>
      </div>
    </div>
  );
};
