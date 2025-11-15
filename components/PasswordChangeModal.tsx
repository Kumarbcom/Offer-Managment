import React, { useState } from 'react';

interface PasswordChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newPassword: string) => Promise<void>;
  isForced: boolean;
}

export const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({ isOpen, onClose, onSave, isForced }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length !== 6) {
      setError('Password must be exactly 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword === '123456') {
        setError('New password cannot be the default password.');
        return;
    }

    setIsSaving(true);
    try {
        await onSave(newPassword);
        setNewPassword('');
        setConfirmPassword('');
    } catch (apiError) {
        setError('Failed to save password. Please try again.');
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleWrapperClick = () => {
    if (!isForced && !isSaving) {
        onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={handleWrapperClick}>
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">{isForced ? 'Please Set a New Password' : 'Change Your Password'}</h2>
        {isForced && <p className="text-sm text-gray-600 mb-4">For security, you must change your password from the default before you can proceed.</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={isSaving}>
            <div>
              <label className="block text-sm font-medium text-gray-700">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                autoComplete="new-password"
                placeholder="6 characters long"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                autoComplete="new-password"
              />
            </div>
          </fieldset>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end space-x-4 pt-2">
            {!isForced && (
              <button type="button" onClick={onClose} disabled={isSaving} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md disabled:opacity-50">
                Cancel
              </button>
            )}
            <button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md disabled:opacity-50">
              {isSaving ? 'Saving...' : 'Save Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};