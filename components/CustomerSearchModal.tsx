import React, { useState, useEffect, useMemo } from 'react';
import type { Customer, SalesPerson } from '../types';
import { useDebounce } from '../hooks/useDebounce';
import { searchCustomers, customerCache } from '../supabase';

interface CustomerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (customer: Customer) => void;
  customers?: Customer[];
  salesPersons?: SalesPerson[];
}

export const CustomerSearchModal: React.FC<CustomerSearchModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  customers = [],
  salesPersons = [],
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedSalesPersonId, setSelectedSalesPersonId] = useState<string>('all');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Available cities list for quick filtering
  const allKnownCustomers = useMemo(() => {
    const map = new Map<number, Customer>();
    if (customers && customers.length > 0) {
      customers.forEach(c => map.set(c.id, c));
    }
    for (const c of customerCache.values()) {
      map.set(c.id, c);
    }
    for (const c of searchResults) {
      map.set(c.id, c);
    }
    return Array.from(map.values());
  }, [customers, searchResults]);

  const availableCities = useMemo(() => {
    const cities = new Set<string>();
    allKnownCustomers.forEach(c => {
      if (c.city && c.city.trim()) cities.add(c.city.trim());
    });
    return Array.from(cities).sort();
  }, [allKnownCustomers]);

  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;
    const performSearch = async () => {
      setIsLoading(true);
      try {
        const results = await searchCustomers(debouncedSearchTerm);
        if (!isCancelled) {
          setSearchResults(results);
        }
      } catch (err) {
        console.error('CustomerSearchModal: search error', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    performSearch();
    return () => { isCancelled = true; };
  }, [debouncedSearchTerm, isOpen]);

  // Combined in-memory filtered display list
  const filteredResults = useMemo(() => {
    let list = searchResults.length > 0 ? searchResults : allKnownCustomers.slice(0, 50);

    if (searchTerm && searchTerm.trim()) {
      const words = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
      list = allKnownCustomers.filter(c => {
        const name = (c.name || '').toLowerCase();
        const city = (c.city || '').toLowerCase();
        const idStr = String(c.id || '');
        return words.every(w => name.includes(w) || city.includes(w) || idStr.includes(w));
      });
    }

    if (selectedCity) {
      list = list.filter(c => c.city?.toLowerCase() === selectedCity.toLowerCase());
    }

    if (selectedSalesPersonId !== 'all') {
      const spId = Number(selectedSalesPersonId);
      list = list.filter(c => c.salesPersonId === spId);
    }

    return list.slice(0, 50);
  }, [searchResults, allKnownCustomers, searchTerm, selectedCity, selectedSalesPersonId]);

  const handleClear = () => {
    setSearchTerm('');
    setSelectedCity('');
    setSelectedSalesPersonId('all');
  };

  const getSalesPersonName = (spId: number | null | undefined) => {
    if (!spId || !salesPersons) return '—';
    const found = salesPersons.find(sp => sp.id === spId);
    return found ? found.name : `SP #${spId}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-start pt-12 p-4 backdrop-blur-xs">
      <div className="bg-white p-5 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-slate-200">
        {/* Header */}
        <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏢</span>
            <h2 className="text-lg font-bold text-slate-800">Search Customer Directory</h2>
            <span className="text-xs text-slate-500 font-medium">({filteredResults.length} matches)</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl font-bold leading-none px-2 py-0.5 rounded transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3 pb-3 border-b border-slate-100 items-end">
          <div className="md:col-span-2">
            <label htmlFor="customerSearchInput" className="block text-xs font-bold text-slate-700 mb-1">
              Customer Name, City or ID
            </label>
            <input
              type="text"
              id="customerSearchInput"
              autoFocus
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md shadow-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900"
              placeholder="Type to search (e.g. ABB, Siemens, Mumbai)..."
            />
          </div>

          <div>
            <label htmlFor="cityFilter" className="block text-xs font-bold text-slate-700 mb-1">
              City
            </label>
            <select
              id="cityFilter"
              value={selectedCity}
              onChange={e => setSelectedCity(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md shadow-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800"
            >
              <option value="">All Cities</option>
              {availableCities.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-1.5">
            <div className="flex-1">
              <label htmlFor="spFilter" className="block text-xs font-bold text-slate-700 mb-1">
                Sales Person
              </label>
              <select
                id="spFilter"
                value={selectedSalesPersonId}
                onChange={e => setSelectedSalesPersonId(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md shadow-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800"
              >
                <option value="all">All Staff</option>
                {salesPersons.map(sp => (
                  <option key={sp.id} value={sp.id}>{sp.name}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-1.5 rounded-md text-xs border border-slate-300 self-end transition-colors"
              title="Clear search"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Results Table */}
        <div className="flex-1 overflow-auto border border-slate-200 rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-500 text-xs">
              <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
              <span>Searching directory...</span>
            </div>
          ) : filteredResults.length > 0 ? (
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 select-none">
                <tr className="text-left font-bold text-slate-600">
                  <th className="px-3 py-2 w-12 text-center">ID</th>
                  <th className="px-3 py-2">Customer Name</th>
                  <th className="px-3 py-2">City</th>
                  <th className="px-3 py-2">Address</th>
                  <th className="px-3 py-2">Sales Person</th>
                  <th className="px-3 py-2 text-center w-20">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredResults.map(customer => (
                  <tr key={customer.id} className="hover:bg-indigo-50/50 transition-colors">
                    <td className="px-3 py-2 text-center text-slate-400 font-mono text-[11px]">
                      #{customer.id}
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-900">
                      {customer.name}
                    </td>
                    <td className="px-3 py-2 text-slate-700 font-medium">
                      {customer.city ? `📍 ${customer.city}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-500 max-w-xs truncate" title={customer.address}>
                      {customer.address ? `${customer.address}${customer.pincode ? ` - ${customer.pincode}` : ''}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {getSalesPersonName(customer.salesPersonId)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(customer);
                          onClose();
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2.5 py-1 rounded text-[11px] shadow-xs transition-colors"
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-12 text-center text-slate-500 text-xs">
              {searchTerm ? `No customers match "${searchTerm}".` : 'No customers found.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
