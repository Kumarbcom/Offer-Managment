import React from 'react';
import type { DeliveryChallan, Quotation, Customer, View, UserRole } from '../types';

interface DeliveryChallanManagerProps {
  deliveryChallans: DeliveryChallan[] | null;
  setDeliveryChallans: (challans: React.SetStateAction<DeliveryChallan[]>) => Promise<void>;
  quotations: Quotation[] | null;
  customers: Customer[] | null;
  setView: (view: View) => void;
  setEditingChallanId: (id: number | null) => void;
  userRole: UserRole;
}

export const DeliveryChallanManager: React.FC<DeliveryChallanManagerProps> = ({
  deliveryChallans,
  setDeliveryChallans,
  quotations,
  customers,
  setView,
  setEditingChallanId,
  userRole,
}) => {

  const canEdit = userRole === 'Admin' || userRole === 'SCM';

  const handleAddNew = () => {
    setEditingChallanId(null);
    setView('delivery-challan-form');
  };

  const handleEdit = (id: number) => {
    setEditingChallanId(id);
    setView('delivery-challan-form');
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this challan?')) {
      if (!deliveryChallans) return;
      await setDeliveryChallans(deliveryChallans.filter(c => c.id !== id));
    }
  };
  
  const getCustomerName = (id: number | '') => customers?.find(c => c.id === id)?.name || 'N/A';

  if (!deliveryChallans || !quotations || !customers) {
    return <div>Loading challan data...</div>;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Delivery Challans</h2>
        {canEdit && (
            <button onClick={handleAddNew} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md">
              Create New Challan
            </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Challan ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quotation ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO No.</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {deliveryChallans.map(challan => (
              <tr key={challan.id}>
                <td className="px-6 py-4">{challan.id}</td>
                <td className="px-6 py-4">{new Date(challan.challanDate).toLocaleDateString()}</td>
                <td className="px-6 py-4 font-medium">{getCustomerName(challan.customerId)}</td>
                <td className="px-6 py-4">{challan.quotationId}</td>
                <td className="px-6 py-4">{challan.poNo}</td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button onClick={() => handleEdit(challan.id)} className="text-indigo-600 hover:text-indigo-900">{canEdit ? 'Edit' : 'View'}</button>
                  {canEdit && (
                    <button onClick={() => handleDelete(challan.id)} className="text-red-600 hover:text-red-900">Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
