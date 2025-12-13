
import React, { useState, useRef } from 'react';
import type { PendingSO } from '../types';
import { PendingSOModal } from './PendingSOModal';
import { clearTable } from '../supabase';

declare var XLSX: any;

interface PendingSOManagerProps {
  pendingSOs: PendingSO[] | null;
  setPendingSOs: (value: React.SetStateAction<PendingSO[]>) => Promise<void>;
}

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const isUuid = (id: string | number): boolean => {
    if (typeof id !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

const safeFloat = (val: any) => {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
};

export const PendingSOManager: React.FC<PendingSOManagerProps> = ({ pendingSOs, setPendingSOs }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<PendingSO | null>(null);

  const filteredSOs = (pendingSOs || []).filter(item => 
    (item.partyName && item.partyName.toLowerCase().includes(searchTerm.toLowerCase())) || 
    (item.orderNo && item.orderNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.partNo && item.partNo.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = evt.target?.result;
      if (!data) return;

      setIsUploading(true);
      try {
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        const parseDate = (val: any) => {
            if (!val) return new Date().toISOString().split('T')[0];
            if (typeof val === 'number') {
                 // Excel date serial
                 const date = new Date(Date.UTC(1900, 0, val - 1));
                 return date.toISOString().split('T')[0];
            }
            const d = new Date(val);
            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
            return new Date().toISOString().split('T')[0];
        }

        const newItems: PendingSO[] = json.map((row) => {
            const orderNo = row['Order'] || row['Order No'] || '';
            if (!orderNo) return null;
            
            return {
                id: generateUUID(),
                date: parseDate(row['Date']),
                orderNo: String(orderNo),
                partyName: String(row["Party's Name"] || row['Party Name'] || ''),
                itemName: String(row['Name of Item'] || row['Item Name'] || ''),
                materialCode: String(row['Material Code'] || ''),
                partNo: String(row['Part No'] || ''),
                orderedQty: safeFloat(row['Ordered']),
                balanceQty: safeFloat(row['Balance']),
                rate: safeFloat(row['Rate']),
                discount: safeFloat(row['Discount']),
                value: safeFloat(row['Value']),
                dueOn: parseDate(row['Due on'] || row['Due Date']),
            };
        }).filter((i): i is PendingSO => i !== null);

        if (newItems.length > 0) {
            await setPendingSOs(prev => [...(prev || []), ...newItems]);
            alert(`Successfully loaded ${newItems.length} pending orders.`);
        } else {
            alert('No valid data found. Please check Excel headers.');
        }

      } catch (error) {
        console.error("SO upload error:", error);
        alert("Failed to parse Excel file.");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to delete ALL pending sales orders? This action cannot be undone.')) {
        setIsClearing(true);
        try {
            await clearTable('pendingSOs');
            await setPendingSOs([]);
            alert("Pending orders cleared successfully.");
        } catch (e) {
            console.error(e);
            alert(`Failed to clear pending orders: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setIsClearing(false);
        }
    }
  };

  const handleDownloadTemplate = () => {
      const headers = ['Date', 'Order', "Party's Name", 'Name of Item', 'Material Code', 'Part No', 'Ordered', 'Balance', 'Rate', 'Discount', 'Value', 'Due on'];
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "PendingSO");
      XLSX.writeFile(wb, "Pending_SO_Template.xlsx");
  }

  const handleAddNew = () => {
      setItemToEdit(null);
      setIsModalOpen(true);
  };

  const handleEdit = (item: PendingSO) => {
      setItemToEdit(item);
      setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
      if(window.confirm("Delete this pending order?")) {
          await setPendingSOs(prev => (prev || []).filter(i => i.id !== id));
      }
  };

  const handleSaveItem = async (item: PendingSO) => {
      await setPendingSOs(prev => {
          const currentList = prev || [];
          if (itemToEdit) {
              const isLegacy = !isUuid(item.id);
              const idToUse = isLegacy ? generateUUID() : item.id;
              const updatedItem = { ...item, id: idToUse };
              return currentList.map(i => i.id === item.id ? updatedItem : i);
          } else {
              const newItem = { ...item, id: generateUUID() };
              return [...currentList, newItem];
          }
      });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Pending Sales Orders</h2>
        <div className="flex flex-wrap gap-2 text-sm">
            <button 
                onClick={handleAddNew}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold"
            >
                Add Order
            </button>
            <div className="h-8 border-l border-gray-300 mx-1 hidden md:block"></div>
            <button 
                onClick={handleClearAll} 
                disabled={!pendingSOs || pendingSOs.length === 0 || isClearing}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isClearing ? 'Clearing...' : 'Clear All'}
            </button>
            <button onClick={handleDownloadTemplate} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-bold">Template</button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx, .xls" />
            <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isUploading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded font-bold disabled:opacity-50"
            >
                {isUploading ? 'Uploading...' : 'Upload Excel'}
            </button>
        </div>
      </div>

      <div className="mb-4">
        <input 
            type="text" 
            placeholder="Search Order, Party, or Item..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full md:w-1/3 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
                <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Party</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due On</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {filteredSOs.length > 0 ? filteredSOs.map((item, idx) => {
                    const isOverdue = new Date(item.dueOn) < new Date();
                    return (
                        <tr key={item.id || idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{new Date(item.date).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">{item.orderNo}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 truncate max-w-xs">{item.partyName}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 truncate max-w-xs">{item.partNo || item.itemName}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right">{item.balanceQty}</td>
                            <td className={`px-4 py-3 text-sm font-semibold ${isOverdue ? 'text-red-600' : 'text-green-600'}`}>
                                {new Date(item.dueOn).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-right space-x-2">
                                <button onClick={() => handleEdit(item)} className="text-indigo-600 hover:text-indigo-900 font-medium">Edit</button>
                                <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900 font-medium">Delete</button>
                            </td>
                        </tr>
                    );
                }) : (
                    <tr>
                        <td colSpan={7} className="px-6 py-10 text-center text-gray-500">No pending orders found. Add or upload data.</td>
                    </tr>
                )}
            </tbody>
        </table>
      </div>
      
      <PendingSOModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSaveItem} 
        itemToEdit={itemToEdit} 
      />
    </div>
  );
};
