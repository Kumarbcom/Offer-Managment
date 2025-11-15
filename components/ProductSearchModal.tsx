
import React, { useState, useMemo } from 'react';
import type { Product, PriceEntry } from '../types';

interface ProductSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSelect: (product: Product, discount: number) => void;
}

const getCurrentPriceForDate = (product: Product, date: string): PriceEntry | null => {
    if (!product.prices || product.prices.length === 0) return null;
    const targetDate = new Date(date);
    targetDate.setHours(0,0,0,0);
    
    const currentPrice = product.prices.find(p => {
      const from = new Date(p.validFrom);
      from.setHours(0,0,0,0);
      const to = new Date(p.validTo);
      to.setHours(23,59,59,999);
      return targetDate >= from && targetDate <= to;
    });

    if (currentPrice) return currentPrice;
    
    const pastOrCurrentPrices = product.prices.filter(p => new Date(p.validFrom) <= targetDate);
    if(pastOrCurrentPrices.length > 0) {
        return pastOrCurrentPrices.sort((a,b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime())[0];
    }
    
    return [...product.prices].sort((a,b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime())[0] || null;
};

export const ProductSearchModal: React.FC<ProductSearchModalProps> = ({ isOpen, onClose, products, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [discount, setDiscount] = useState('0');

  const filteredAndSortedProducts = useMemo(() => {
    return products
      .filter(product => {
        const term = searchTerm.toLowerCase();
        if (!term) return true;
        return product.partNo.toLowerCase().includes(term) || 
               product.description.toLowerCase().includes(term);
      })
      .sort((a, b) => a.partNo.localeCompare(b.partNo));
  }, [products, searchTerm]);

  const handleClear = () => {
    setSearchTerm('');
    setDiscount('0');
  };
  
  const handleSelect = (product: Product) => {
    onSelect(product, parseFloat(discount) || 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-start pt-16 p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Search Part No</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl font-bold">&times;</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 pb-4 border-b border-gray-200 items-end">
          <div className="md:col-span-2">
            <label htmlFor="searchModalTerm" className="block text-sm font-medium text-gray-700">Search</label>
            <input 
              type="text" 
              id="searchModalTerm" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
              placeholder="Enter Part No or Description..." 
            />
          </div>
          <div>
            <label htmlFor="discount" className="block text-sm font-medium text-gray-700">Discount</label>
            <div className="relative mt-1">
                <input 
                  type="text" 
                  id="discount" 
                  value={discount} 
                  onChange={e => setDiscount(e.target.value)} 
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500">%</span>
            </div>
          </div>
          <div>
            <button 
              type="button" 
              onClick={handleClear} 
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 border border-gray-300 rounded-md shadow-sm"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex-grow overflow-auto">
          {filteredAndSortedProducts.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Part No</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LP</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SP</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount Price</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedProducts.map(product => {
                    const today = new Date().toISOString().split('T')[0];
                    const currentPrice = getCurrentPriceForDate(product, today);
                    const discountValue = parseFloat(discount) || 0;
                    const priceToUse = currentPrice ? (currentPrice.lp > 0 ? currentPrice.lp : currentPrice.sp) : 0;
                    const discountPrice = priceToUse * (1 - discountValue / 100);

                    return (
                        <tr key={product.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.partNo}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">{product.description}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{currentPrice ? currentPrice.lp.toFixed(2) : 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{currentPrice ? currentPrice.sp.toFixed(2) : 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold">₹{discountPrice.toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                            <button onClick={() => handleSelect(product)} className="text-indigo-600 hover:text-indigo-900 bg-indigo-100 hover:bg-indigo-200 px-3 py-1 rounded-md">
                                Select
                            </button>
                            </td>
                        </tr>
                    );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No products match your search criteria.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
