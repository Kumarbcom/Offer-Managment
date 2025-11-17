import React, { useState, useEffect } from 'react';
import type { Customer, SalesPerson } from '../types';
import { getCustomersPaginated } from '../supabase';

interface CustomerAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customer: Customer) => Promise<void>;
  salesPersons: SalesPerson[] | null;
  customerToEdit?: Customer | null;
}

const emptyCustomer: Omit<Customer, 'id'> = {
  name: '',
  address: '',
  city: '',
  pincode: '',
  salesPersonId: null,
  discountStructure: { singleCore: 0, multiCore: 0, specialCable: 0, accessories: 0 },
};

export const CustomerAddModal: React.FC<CustomerAddModalProps> = ({ isOpen, onClose, onSave, salesPersons, customerToEdit }) => {
  const [formData, setFormData] = useState<Omit<Customer, 'id'> | Customer>(emptyCustomer);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (customerToEdit) {
        setFormData(customerToEdit);
      } else {
        setFormData(emptyCustomer);
      }
    }
  }, [isOpen, customerToEdit]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('discountStructure.')) {
        const field = name.split('.')[1] as keyof Customer['discountStructure'];
        setFormData(prev => ({
            ...prev,
            discountStructure: {
                ...prev.discountStructure,
                [field]: parseFloat(value) || 0
            }
        }));
    } else {
        const isNumericId = name === 'salesPersonId';
        setFormData(prev => ({
            ...prev,
            [name]: isNumericId ? (value ? parseInt(value) : null) : value
        }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      alert('Customer Name is required.');
      return;
    }
    
    setIsSaving(true);
    try {
        let customerToSave: Customer;

        if (customerToEdit) {
          customerToSave = formData as Customer;
        } else {
          // Fetch last ID to generate a new one safely.
          const lastIdResult = await getCustomersPaginated({ pageLimit: 1, startAfterDoc: 0, sortBy: 'id', sortOrder: 'desc', filters: {} });
          const lastId = lastIdResult.customers.length > 0 ? lastIdResult.customers[0].id : 0;
          const newId = lastId + 1;
          customerToSave = { ...formData, id: newId } as Customer;
        }
        await onSave(customerToSave);
        onClose();
    } catch (error) {
        alert(error instanceof Error ? error.message : 'An unknown error occurred while saving the customer.');
        console.error('Failed to save customer:', error);
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-3xl max-h-full overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">{customerToEdit ? 'Edit Customer' : 'Add New Customer'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={isSaving}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Customer Name</label>
                <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
              </div>
              <div>
                <label htmlFor="salesPersonId" className="block text-sm font-medium text-gray-700">Sales Person</label>
                <select name="salesPersonId" id="salesPersonId" value={formData.salesPersonId || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="">Select Sales Person</option>
                  {salesPersons?.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">Address</label>
              <textarea name="address" id="address" value={formData.address} onChange={handleChange} rows={3} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm resize-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"></textarea>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700">City</label>
                  <input type="text" name="city" id="city" value={formData.city} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
              </div>
              <div>
                  <label htmlFor="pincode" className="block text-sm font-medium text-gray-700">Pincode</label>
                  <input type="text" name="pincode" id="pincode" value={formData.pincode} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
              </div>
            </div>
            <fieldset className="border p-4 rounded-md mt-4">
              <legend className="text-lg font-medium text-gray-800 px-2">Discount Structure</legend>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Single Core (%)</label>
                  <input type="number" step="0.01" name="discountStructure.singleCore" value={formData.discountStructure.singleCore} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Multi Core (%)</label>
                  <input type="number" step="0.01" name="discountStructure.multiCore" value={formData.discountStructure.multiCore} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Special Cable (%)</label>
                  <input type="number" step="0.01" name="discountStructure.specialCable" value={formData.discountStructure.specialCable} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Accessories (%)</label>
                  <input type="number" step="0.01" name="discountStructure.accessories" value={formData.discountStructure.accessories} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
              </div>
            </fieldset>
          </fieldset>
          <div className="flex justify-end space-x-4 pt-4">
            <button type="button" onClick={onClose} disabled={isSaving} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:opacity-50">
              {isSaving ? 'Saving...' : customerToEdit ? 'Update Customer' : 'Save Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};