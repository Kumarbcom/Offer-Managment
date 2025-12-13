
import React, { useState, useEffect } from 'react';
import type { StockItem } from '../types';

interface StockItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: StockItem) => Promise<void>;
  itemToEdit?: StockItem | null;
}

const emptyItem: Omit<StockItem, 'id'> = {
  description: '',
  quantity: 0,
  rate: 0,
  value: 0
};

export const StockItemModal: React.FC<StockItemModalProps> = ({ isOpen, onClose, onSave, itemToEdit }) => {
  const [formData, setFormData] = useState<Omit<StockItem, 'id'> | StockItem>(emptyItem);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(itemToEdit || emptyItem);
    }
  }, [isOpen, itemToEdit]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value) || 0;
    
    setFormData(prev => {
        const newData = { ...prev, [name]: name === 'description' ? value : numValue };
        
        if (name === 'quantity' || name === 'rate') {
            const qty = name === 'quantity' ? numValue : (prev as any).quantity;
            const rate = name === 'rate' ? numValue : (prev as any).rate;
            (newData as any).value = qty * rate;
        }
        return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
        await onSave(formData as StockItem);
        onClose();
    } catch (error) {
        console.error(error);
        alert("Failed to save stock item");
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold text-gray-800 mb-4">{itemToEdit ? 'Edit Stock Item' : 'Add Stock Item'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <input type="text" name="description" value={formData.description} onChange={handleChange} required className="mt-1 w-full p-2 border rounded"/>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Quantity</label>
                    <input type="number" step="0.01" name="quantity" value={formData.quantity} onChange={handleChange} required className="mt-1 w-full p-2 border rounded"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Rate</label>
                    <input type="number" step="0.01" name="rate" value={formData.rate} onChange={handleChange} required className="mt-1 w-full p-2 border rounded"/>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Value (Auto-calculated)</label>
                <input type="number" step="0.01" name="value" value={formData.value} onChange={handleChange} className="mt-1 w-full p-2 border rounded bg-gray-100" />
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
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
