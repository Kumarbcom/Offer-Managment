import React, { useState, useEffect } from 'react';
import type { Product, PriceEntry } from '../types';
import { UOMS, PLANTS } from '../constants';
import { DataActions } from '../hooks/useOnlineStorage';

interface ProductAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  actions: DataActions<Product>;
  productToEdit?: Product | null;
}

const emptyProductData: Omit<Product, 'id'> = {
  partNo: '',
  description: '',
  hsnCode: '',
  prices: [{ lp: 0, sp: 0, validFrom: new Date().toISOString().split('T')[0], validTo: '9999-12-31' }],
  uom: '',
  plant: '',
  weight: 0,
};

export const ProductAddModal: React.FC<ProductAddModalProps> = ({ isOpen, onClose, actions, productToEdit }) => {
  const [formData, setFormData] = useState<Omit<Product, 'id'> | Product>(emptyProductData);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (productToEdit) {
        // Sort prices on load to ensure they are in chronological order for editing
        const sortedProduct = { ...productToEdit, prices: [...productToEdit.prices].sort((a,b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime()) };
        setFormData(sortedProduct);
      } else {
        setFormData(emptyProductData);
      }
    }
  }, [isOpen, productToEdit]);

  if (!isOpen) return null;

  const handleGeneralChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
        ...prev,
        [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handlePriceChange = (index: number, field: keyof PriceEntry, value: string) => {
    const newPrices = [...formData.prices];
    const priceEntry = { ...newPrices[index] };
    
    if (field === 'lp' || field === 'sp') {
        const numValue = parseFloat(value) || 0;
        priceEntry[field] = numValue;
        if (field === 'lp' && numValue > 0) {
            priceEntry.sp = 0; // If LP has a value, SP must be 0
        }
         if (field === 'sp' && numValue > 0) {
            priceEntry.lp = 0; // If SP has a value, LP must be 0
        }
    } else {
        priceEntry[field] = value;
    }
    
    newPrices[index] = priceEntry;
    setFormData(prev => ({ ...prev, prices: newPrices }));
  };

  const handleAddPriceRow = () => {
    const today = new Date().toISOString().split('T')[0];
    const newPrice: PriceEntry = { lp: 0, sp: 0, validFrom: today, validTo: '9999-12-31' };
    setFormData(prev => ({ ...prev, prices: [...prev.prices, newPrice] }));
  };
  
  const handleRemovePriceRow = (index: number) => {
    if (formData.prices.length <= 1) return;
    setFormData(prev => ({ ...prev, prices: prev.prices.filter((_, i) => i !== index) }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.partNo || !formData.description) {
      alert('Part No and Description are required.');
      return;
    }

    setIsSaving(true);
    
    try {
        // Process prices before saving to set validTo dates correctly
        let processedPrices = [...formData.prices]
          .sort((a, b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime());

        for (let i = 0; i < processedPrices.length - 1; i++) {
            const nextValidFrom = new Date(processedPrices[i + 1].validFrom);
            nextValidFrom.setDate(nextValidFrom.getDate() - 1);
            processedPrices[i].validTo = nextValidFrom.toISOString().split('T')[0];
        }
        if (processedPrices.length > 0) {
           processedPrices[processedPrices.length - 1].validTo = '9999-12-31';
        }
    
        const productToSave = { ...formData, prices: processedPrices };
        
        if ('id' in productToSave && productToSave.id) {
          await actions.update(productToSave as Product);
        } else {
          await actions.add(productToSave);
        }
        onClose();

    } catch (error) {
        alert('Failed to save product. Please try again.');
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-5xl max-h-full flex flex-col">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">{productToEdit ? 'Edit Product' : 'Add New Product'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4 flex-grow overflow-y-auto pr-2">
          <fieldset disabled={isSaving}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                  <label htmlFor="partNo" className="block text-sm font-medium text-gray-700">Part No</label>
                  <input type="text" name="partNo" id="partNo" value={formData.partNo} onChange={handleGeneralChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
              </div>
               <div>
                  <label htmlFor="hsnCode" className="block text-sm font-medium text-gray-700">HSN Code</label>
                  <input type="text" name="hsnCode" id="hsnCode" value={formData.hsnCode || ''} onChange={handleGeneralChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
              </div>
              <div className="md:col-span-2 lg:col-span-1">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                  <input type="text" name="description" id="description" value={formData.description} onChange={handleGeneralChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
              </div>
              <div>
                  <label htmlFor="uom" className="block text-sm font-medium text-gray-700">UOM</label>
                  <select name="uom" id="uom" value={formData.uom} onChange={handleGeneralChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                      <option value="">Select UOM</option>
                      {UOMS.map(uom => <option key={uom} value={uom}>{uom}</option>)}
                  </select>
              </div>
              <div>
                  <label htmlFor="plant" className="block text-sm font-medium text-gray-700">Plant</label>
                  <select name="plant" id="plant" value={formData.plant} onChange={handleGeneralChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                      <option value="">Select Plant</option>
                      {PLANTS.map(plant => <option key={plant} value={plant}>{plant}</option>)}
                  </select>
              </div>
              <div>
                  <label htmlFor="weight" className="block text-sm font-medium text-gray-700">Weight (kg/m)</label>
                  <input type="number" step="0.001" name="weight" id="weight" value={formData.weight} onChange={handleGeneralChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
              </div>
            </div>
            
            <div className="col-span-1 md:col-span-2 lg:col-span-3 mt-4">
                <fieldset className="border p-4 rounded-md">
                    <legend className="text-lg font-medium text-gray-800 px-2">Price Details</legend>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {formData.prices.map((price, index) => (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end p-2 border-b last:border-b-0">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">LP (List Price)</label>
                                    <input type="number" step="0.01" value={price.lp} onChange={(e) => handlePriceChange(index, 'lp', e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">SP (Special Price)</label>
                                    <input type="number" step="0.01" value={price.sp} onChange={(e) => handlePriceChange(index, 'sp', e.target.value)} disabled={price.lp > 0} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Valid From</label>
                                    <input type="date" value={price.validFrom} onChange={(e) => handlePriceChange(index, 'validFrom', e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Valid To</label>
                                    <input type="date" value={price.validTo} disabled className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm"/>
                                </div>
                                <div className="flex justify-center">
                                    <button type="button" onClick={() => handleRemovePriceRow(index)} disabled={formData.prices.length <= 1} className="text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xl">
                                      &times;
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={handleAddPriceRow} className="mt-4 bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 text-sm rounded">
                        + Add New Price Entry
                    </button>
                </fieldset>
            </div>

          </fieldset>
        </form>
        <div className="flex justify-end space-x-4 mt-auto pt-4">
            <button type="button" onClick={onClose} disabled={isSaving} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" onClick={handleSubmit} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:opacity-50">
              {isSaving ? 'Saving...' : productToEdit ? 'Update Product' : 'Save Product'}
            </button>
        </div>
      </div>
    </div>
  );
};