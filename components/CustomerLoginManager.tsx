import React, { useState, useMemo } from 'react';
import type { User, Customer } from '../types';
import { SearchableSelect } from './common/SearchableSelect';

interface CustomerLoginManagerProps {
  users: User[] | null;
  setUsers: (users: React.SetStateAction<User[]>) => Promise<void>;
  customers: Customer[];
  currentUser: User;
}

export const CustomerLoginManager: React.FC<CustomerLoginManagerProps> = ({ users, setUsers, customers, currentUser }) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [customerSearchTerm, setCustomerSearchTerm] = useState('');

  // 1. Sort customers alphabetically
  const sortedCustomers = useMemo(() => {
    return [...customers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [customers]);

  const searchedCustomers = useMemo(() => {
    if (!customerSearchTerm) return sortedCustomers;
    const lowerTerm = customerSearchTerm.toLowerCase();
    return sortedCustomers.filter(c => c.name?.toLowerCase().includes(lowerTerm) || c.contactPerson?.toLowerCase().includes(lowerTerm));
  }, [sortedCustomers, customerSearchTerm]);

  if (!users) return <div>Loading users...</div>;

  const customerUsers = selectedCustomerId 
    ? users.filter(u => u.role === 'Customer' && u.customerId === selectedCustomerId)
    : [];

  const handleAddUser = async () => {
    if (!selectedCustomerId || !newEmail || !newPassword) return;
    
    // Check if username already exists
    if (users.some(u => u.name.toLowerCase() === newEmail.toLowerCase())) {
        alert("This email/username is already in use.");
        return;
    }

    const newUser: User = {
        name: newEmail,
        role: 'Customer',
        password: newPassword,
        customerId: selectedCustomerId
    };

    await setUsers(prev => [...prev, newUser]);
    setNewEmail('');
    setNewPassword('');
  };

  const handleDeleteUser = async (username: string) => {
    if (window.confirm(`Are you sure you want to delete the login for ${username}?`)) {
        await setUsers(prev => prev.filter(u => u.name !== username));
    }
  };

  const selectedCustomerObj = customers.find(c => c.id === selectedCustomerId);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Customer Logins</h2>
      
      <div className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Select a Customer to Manage Logins</label>
          <div className="w-full max-w-md h-10 border border-slate-300 rounded shadow-sm bg-white">
              <SearchableSelect<Customer> 
                  options={searchedCustomers} 
                  value={selectedCustomerId} 
                  onChange={val => setSelectedCustomerId(val as number | null)} 
                  idKey="id" 
                  displayKey="name" 
                  placeholder="Search customer alphabetically..." 
                  onSearch={setCustomerSearchTerm}
              />
          </div>
          {selectedCustomerObj && (
              <div className="mt-2 text-sm text-slate-600">
                  {selectedCustomerObj.address && <p>{selectedCustomerObj.address}, {selectedCustomerObj.city}</p>}
                  {selectedCustomerObj.contactPerson && <p>Contact: {selectedCustomerObj.contactPerson} ({selectedCustomerObj.contactNumber})</p>}
              </div>
          )}
      </div>

      {selectedCustomerId && (
          <div>
              <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Logins for {selectedCustomerObj?.name}</h3>
              
              <div className="overflow-x-auto mb-6">
                <table className="min-w-full divide-y divide-gray-200 border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email / Username</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Password</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                      {customerUsers.length === 0 ? (
                          <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500 italic">No logins created for this customer yet.</td></tr>
                      ) : (
                          customerUsers.map(user => (
                            <tr key={user.name}>
                                <td className="px-4 py-3 font-medium text-slate-800">{user.name}</td>
                                <td className="px-4 py-3 text-slate-500">{user.password}</td>
                                <td className="px-4 py-3 text-right">
                                  <button onClick={() => handleDeleteUser(user.name)} className="text-red-600 hover:text-red-900 text-sm font-medium">Delete</button>
                                </td>
                            </tr>
                          ))
                      )}
                  </tbody>
                </table>
              </div>

              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 w-full">
                      <label className="block text-xs font-semibold text-indigo-900 mb-1">New Email / Username</label>
                      <input type="text" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full p-2 border border-indigo-200 rounded focus:ring-1 focus:ring-indigo-500 outline-none" placeholder="customer@example.com"/>
                  </div>
                  <div className="flex-1 w-full">
                      <label className="block text-xs font-semibold text-indigo-900 mb-1">Password</label>
                      <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full p-2 border border-indigo-200 rounded focus:ring-1 focus:ring-indigo-500 outline-none" placeholder="Enter password"/>
                  </div>
                  <button onClick={handleAddUser} disabled={!newEmail || !newPassword} className="w-full md:w-auto px-6 py-2 bg-indigo-600 text-white font-bold rounded shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                      Add Login
                  </button>
              </div>
              <p className="text-xs text-slate-500 mt-2 ml-1">You can assign multiple logins to the same customer.</p>
          </div>
      )}
    </div>
  );
};
