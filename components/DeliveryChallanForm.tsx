import React, { useState, useEffect, useMemo } from 'react';
import type { DeliveryChallan, DeliveryChallanItem, Customer, Quotation, Product, View, UserRole } from '../types';
import { SearchableSelect } from './common/SearchableSelect';
import { useDebounce } from '../hooks/useDebounce';
import { getProductsByIds, searchCustomers } from '../supabase';


interface DeliveryChallanFormProps {
  challans: DeliveryChallan[] | null;
  setChallans: (value: React.SetStateAction<DeliveryChallan[]>) => Promise<void>;
  quotations: Quotation[] | null;
  setView: (view: View) => void;
  editingChallanId: number | null;
  setEditingChallanId: (id: number | null) => void;
  userRole: UserRole;
}

const createEmptyChallanItem = (): DeliveryChallanItem => ({
  productId: 0,
  partNo: '',
  description: '',
  hsnCode: '',
  dispatchedQty: 0,
  uom: '',
  remarks: '',
});

const getTodayDateString = () => new Date().toISOString().split('T')[0];

export const DeliveryChallanForm: React.FC<DeliveryChallanFormProps> = ({
  challans, setChallans, quotations, setView, editingChallanId, setEditingChallanId, userRole
}) => {
  const [formData, setFormData] = useState<Omit<DeliveryChallan, 'id'> | DeliveryChallan | null>(null);
  const [searchedCustomers, setSearchedCustomers] = useState<Customer[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  
  const isReadOnly = userRole !== 'Admin' && userRole !== 'SCM';

  const createNewChallan = (): Omit<DeliveryChallan, 'id'> => ({
      challanDate: getTodayDateString(),
      customerId: null,
      quotationId: null,
      vehicleNo: '',
      poNo: '',
      poDate: getTodayDateString(),
      items: [createEmptyChallanItem()],
  });

  useEffect(() => {
    if (editingChallanId !== null) {
      const challanToEdit = challans?.find(c => c.id === editingChallanId);
      setFormData(challanToEdit || createNewChallan());
    } else {
      setFormData(createNewChallan());
    }
  }, [editingChallanId, challans]);

  const customerQuotations = useMemo(() => {
    if (!formData?.customerId || !quotations) return [];
    return quotations.filter(q => q.customerId === formData.customerId);
  }, [formData?.customerId, quotations]);

  useEffect(() => {
    const syncQuotationItems = async () => {
        if (formData?.quotationId) {
          const quotation = quotations?.find(q => q.id === formData.quotationId);
          if (quotation) {
            const productIds = quotation.details.map(item => item.productId);
            const products = await getProductsByIds(productIds);
            const productMap = new Map(products.map(p => [p.id, p]));

            const newItems: DeliveryChallanItem[] = quotation.details.map(item => {
              const product = productMap.get(item.productId);
              return {
                productId: item.productId,
                partNo: item.partNo,
                description: item.description,
                hsnCode: product?.hsnCode || '',
                dispatchedQty: item.moq, // Default to MOQ
                uom: item.uom,
                remarks: '',
              };
            });
            setFormData(prev => prev ? { ...prev, items: newItems } : null);
          }
        }
    };
    syncQuotationItems();
  }, [formData?.quotationId, quotations]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const isNumericId = name === 'quotationId';
    setFormData(prev => prev ? { ...prev, [name]: isNumericId ? (value ? parseInt(value) : null) : value } : null);
  };

  const handleCustomerSearch = async (term: string) => {
    setIsSearchingCustomers(true);
    const results = await searchCustomers(term);
    setSearchedCustomers(results);
    setIsSearchingCustomers(false);
  }
  
  const handleItemChange = (index: number, field: keyof DeliveryChallanItem, value: any) => {
      setFormData(prev => {
        if (!prev) return null;
        const newItems = [...prev.items];
        (newItems[index] as any)[field] = value;
        return { ...prev, items: newItems };
      });
  }

  const handleRemoveItem = (index: number) => {
    setFormData(prev => prev && prev.items.length > 1 ? { ...prev, items: prev.items.filter((_, i) => i !== index) } : prev);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !formData) return;
    try {
        if ('id' in formData && formData.id) {
            await setChallans(prev => (prev || []).map(c => c.id === (formData as DeliveryChallan).id ? formData as DeliveryChallan : c));
        } else {
            const newId = (challans?.length ?? 0) > 0 ? Math.max(...challans!.map(c => c.id)) + 1 : 1;
            await setChallans(prev => [...(prev || []), { ...formData, id: newId } as DeliveryChallan]);
        }
        setView('delivery-challans');
    } catch(error) {
        alert(error instanceof Error ? error.message : `Failed to save challan.`);
    }
  };

  if (!formData) return <div>Loading...</div>;

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <header className="flex justify-between items-center mb-6 pb-4 border-b">
            <h1 className="text-2xl font-bold text-gray-800">
                {editingChallanId ? `Delivery Challan #${editingChallanId}` : 'Create New Delivery Challan'}
            </h1>
            <button onClick={() => setView('delivery-challans')} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded">
                Back to List
            </button>
        </header>

        <form onSubmit={handleSubmit}>
         <fieldset disabled={isReadOnly}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Challan ID</label>
                <div className="mt-1 p-2 bg-gray-100 rounded-md">{'id' in formData ? formData.id : 'NEW'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Challan Date</label>
                <input type="date" name="challanDate" value={formData.challanDate} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Customer</label>
                <SearchableSelect
                    options={searchedCustomers}
                    value={formData.customerId}
                    onChange={val => setFormData(prev => prev ? { ...prev, customerId: val as number | null } : null)}
                    idKey="id"
                    displayKey="name"
                    onSearch={handleCustomerSearch}
                    isLoading={isSearchingCustomers}
                    placeholder="Search for a customer..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Quotation ID</label>
                <select name="quotationId" value={formData.quotationId || ''} onChange={handleChange} className="mt-1 w-full p-2 border bg-white rounded-md">
                    <option value="">Select Quotation</option>
                    {customerQuotations.map(q => <option key={q.id} value={q.id}>{q.id}</option>)}
                </select>
              </div>
            </div>
             <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">PO Number</label>
                <input type="text" name="poNo" value={formData.poNo} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">PO Date</label>
                <input type="date" name="poDate" value={formData.poDate} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"/>
              </div>
            </div>
          </div>

          <h3 className="text-xl font-bold text-gray-800 mb-4">Items to Dispatch</h3>
          <div className="overflow-x-auto">
             <table className="min-w-full border">
                <thead className="bg-gray-100 text-sm">
                    <tr>
                        <th className="p-2 border">Part No</th>
                        <th className="p-2 border">Description</th>
                        <th className="p-2 border">HSN</th>
                        <th className="p-2 border">Dispatch Qty</th>
                        <th className="p-2 border">UOM</th>
                        <th className="p-2 border">Remarks</th>
                        <th className="p-2 border"></th>
                    </tr>
                </thead>
                <tbody>
                    {formData.items.map((item, index) => (
                        <tr key={index}>
                            <td className="p-1 border w-48 bg-gray-100">{item.partNo}</td>
                            <td className="p-1 border bg-gray-100">{item.description}</td>
                            <td className="p-1 border bg-gray-100">{item.hsnCode}</td>
                            <td className="p-1 border"><input type="number" value={item.dispatchedQty} onChange={e => handleItemChange(index, 'dispatchedQty', parseInt(e.target.value) || 0)} className="w-24 p-1 text-center"/></td>
                            <td className="p-1 border bg-gray-100 text-center">{item.uom}</td>
                            <td className="p-1 border"><input type="text" value={item.remarks} onChange={e => handleItemChange(index, 'remarks', e.target.value)} className="w-full p-1"/></td>
                            <td className="p-1 border text-center">
                                {!isReadOnly && (
                                    <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500 font-bold">✕</button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
             </table>
          </div>
          <div className="flex justify-end mt-4">
            {!isReadOnly && (
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md">
                    {editingChallanId ? 'Update Challan' : 'Save Challan'}
                </button>
            )}
          </div>
         </fieldset>
        </form>
      </div>
    </div>
  );
};