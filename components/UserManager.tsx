import React, { useState } from 'react';
import type { User } from '../types';
import { SALES_PERSON_NAMES } from '../constants';
import { DataActions } from '../hooks/useOnlineStorage';

interface UserManagerProps {
  users: User[] | null;
  actions: DataActions<User>;
  currentUser: User;
}

const ROLES: User['role'][] = ['Admin', 'Sales Person', 'Management', 'SCM', 'Viewer'];
const ALL_USER_NAMES: User['name'][] = ['Kumar', 'Vandita', 'Ranjan', 'Gurudatta', 'Purshothama', 'DC Venugopal', 'Rachana', 'Mohan', 'Geetha', ...SALES_PERSON_NAMES];

export const UserManager: React.FC<UserManagerProps> = ({ users, actions, currentUser }) => {
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);

  const handleEdit = (user: User) => {
    setEditingUser({ ...user });
  };

  const handleSave = async () => {
    if (!editingUser || !editingUser.name || !editingUser.role) {
        alert("Username and Role are required.");
        return;
    }
    
    if (editingUser.password) { // This is an existing user being edited
        await actions.update(editingUser as User);
    } else { // This is a new user
        await actions.add({
            name: editingUser.name!,
            role: editingUser.role!,
            password: '123456'
        });
    }

    setEditingUser(null);
  };

  const handleDelete = async (userName: User['name']) => {
    if (userName === currentUser.name) {
      alert("You cannot delete your own account.");
      return;
    }
    if(window.confirm(`Are you sure you want to delete user "${userName}"?`)){
        await actions.remove([userName]);
    }
  };

  const handleAddNew = () => {
      setEditingUser({ role: 'Viewer' });
  }

  if (!users) return <div>Loading users...</div>;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">User Management</h2>
        <button onClick={handleAddNew} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md">
          Add New User
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map(user => (
              <tr key={user.name}>
                {editingUser && editingUser.name === user.name ? (
                  <>
                    <td className="px-6 py-4"><input type="text" value={editingUser.name} disabled className="p-1 border rounded w-full bg-gray-100"/></td>
                    <td className="px-6 py-4">
                      <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as User['role']})} className="p-1 border rounded w-full">
                        {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={handleSave} className="text-green-600 hover:text-green-900">Save</button>
                      <button onClick={() => setEditingUser(null)} className="text-gray-600 hover:text-gray-900">Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-6 py-4 font-medium">{user.name}</td>
                    <td className="px-6 py-4">{user.role}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => handleEdit(user)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                      <button onClick={() => handleDelete(user.name)} disabled={user.name === currentUser.name} className="text-red-600 hover:text-red-900 disabled:opacity-50">Delete</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {editingUser && !editingUser.name && (
                 <tr>
                    <td className="px-6 py-4">
                        <select value={editingUser.name || ''} onChange={e => setEditingUser({...editingUser, name: e.target.value as User['name']})} className="p-1 border rounded w-full">
                            <option value="">Select User Name</option>
                            {ALL_USER_NAMES.filter(name => !users.some(u => u.name === name)).map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </td>
                    <td className="px-6 py-4">
                      <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as User['role']})} className="p-1 border rounded w-full">
                        {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={handleSave} className="text-green-600 hover:text-green-900">Save</button>
                      <button onClick={() => setEditingUser(null)} className="text-gray-600 hover:text-gray-900">Cancel</button>
                    </td>
                 </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};