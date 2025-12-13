
import React, { useState, useEffect } from 'react';
import type { PendingSO } from '../types';

interface PendingSOModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: PendingSO) => Promise<void>;
  itemToEdit?: PendingSO | null;
}

const emptyItem: Omit<PendingSO, 'id'> = {
  date: new Date().toISOString().split('T')[0],
  orderNo: '',
  partyName: '',
  itemName: '',
  materialCode: '',
  partNo: '',
  orderedQty: 0,
  balanceQty: 0,
  rate: 0,
  discount: 0,
  value: 0,
  dueOn: new Date().toISOString().split('T')[0],
};

export const PendingSOModal: React.FC<PendingSOModalProps> = ({ isOpen, onClose, onSave, itemToEdit }) => {
  const [formData, setFormData] = useState<Omit<PendingSO, 'id'> | PendingSO>(emptyItem);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(itemToEdit || emptyItem);
    }
  }, [isOpen, itemToEdit]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
        ...prev,
        [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
        await onSave(formData as PendingSO);
        onClose();
    } catch (error) {
        console.error(error);
        alert("Failed to save pending order");
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-800 mb-4">{itemToEdit ? 'Edit Pending Order' : 'Add Pending Order'}</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Date</label>
                <input type="date" name="date" value={formData.date} onChange={handleChange} required className="mt-1 w-full p-2 border rounded"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Due On</label>
                <input type="date" name="dueOn" value={formData.dueOn} onChange={handleChange} required className="mt-1 w-full p-2 border rounded"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Order No</label>
                <input type="text" name="orderNo" value={formData.orderNo} onChange={handleChange} required className="mt-1 w-full p-2 border rounded"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Party Name</label>
                <input type="text" name="partyName" value={formData.partyName} onChange={handleChange} required className="mt-1 w-full p-2 border rounded"/>
            </div>
            <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Item Name / Description</label>
                <input type="text" name="itemName" value={formData.itemName} onChange={handleChange} className="mt-1 w-full p-2 border rounded"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Part No</label>
                <input type="text" name="partNo" value={formData.partNo} onChange={handleChange} className="mt-1 w-full p-2 border rounded"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Material Code</label>
                <input type="text" name="materialCode" value={formData.materialCode} onChange={handleChange} className="mt-1 w-full p-2 border rounded"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Ordered Qty</label>
                <input type="number" step="0.01" name="orderedQty" value={formData.orderedQty} onChange={handleChange} className="mt-1 w-full p-2 border rounded"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Balance Qty</label>
                <input type="number" step="0.01" name="balanceQty" value={formData.balanceQty} onChange={handleChange} required className="mt-1 w-full p-2 border rounded"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Rate</label>
                <input type="number" step="0.01" name="rate" value={formData.rate} onChange={handleChange} className="mt-1 w-full p-2 border rounded"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Value</label>
                <input type="number" step="0.01" name="value" value={formData.value} onChange={handleChange} className="mt-1 w-full p-2 border rounded"/>
            </div>
            
            <div className="md:col-span-2 flex justify-end gap-2 pt-4 border-t mt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
                    {isSaving ? 'Saving...' : 'Save'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};
