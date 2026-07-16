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
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="p-8 bg-white rounded-lg shadow-md w-96 space-y-4">
        <h2 className="text-2xl font-bold text-center text-slate-800">Siddhi Kabel Login</h2>
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <div>
          <label className="block text-sm font-medium text-slate-700">Username</label>
          <select 
            value={username} 
            onChange={e => setUsername(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-black"
            required
          >
            <option value="">Select User</option>
            {users?.map(u => (
              <option key={u.name} value={u.name}>{u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Password</label>
          <input 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-black"
            required
          />
        </div>
        <button 
          type="submit" 
          disabled={isLoading || !users}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Login'}
        </button>
      </form>
    </div>
  );
};
