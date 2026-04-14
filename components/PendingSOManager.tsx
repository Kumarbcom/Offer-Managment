
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

// Helper to normalize keys to lower case for insensitive matching
const normalizeKeys = (obj: any) => {
    const newObj: any = {};
    Object.keys(obj).forEach(key => {
        newObj[key.toLowerCase().trim().replace(/\s+/g, '')] = obj[key];
    });
    return newObj;
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
    (item.partNo && item.partNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.itemName && item.itemName.toLowerCase().includes(searchTerm.toLowerCase()))
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

        const newItems: PendingSO[] = json.map((rawRow): PendingSO | null => {
            const row = normalizeKeys(rawRow); // Normalize keys: 'Name of Item' -> 'nameofitem'
            
            const orderNo = row['order'] || row['orderno'] || row['orderno.'] || '';
            if (!orderNo) return null;
            
            return {
                id: generateUUID(),
                date: parseDate(row['date']),
                orderNo: String(orderNo),
                partyName: String(row["party'sname"] || row['partyname'] || row['customername'] || ''),
                // Prioritize 'description' but keep fallbacks
                itemName: String(row['description'] || row['nameofitem'] || row['itemname'] || row['materialdescription'] || ''),
                materialCode: String(row['materialcode'] || row['material'] || ''),
                partNo: String(row['partno'] || row['partnumber'] || ''),
                orderedQty: safeFloat(row['ordered'] || row['orderedqty']),
                balanceQty: safeFloat(row['balance'] || row['balanceqty']),
                rate: safeFloat(row['rate']),
                discount: safeFloat(row['discount']),
                value: safeFloat(row['value']),
                dueOn: parseDate(row['dueon'] || row['duedate']),
            };
        }).filter((i): i is PendingSO => i !== null);

        if (newItems.length > 0) {
            await setPendingSOs(prev => [...(prev || []), ...newItems]);
            alert(`Successfully loaded ${newItems.length} pending orders.`);
        } else {
            alert('No valid data found. Please check Excel headers (e.g., Order, Party Name, Description).');
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
    if (window.confirm('Are you sure you want to CLEAR the entire Pending SO Report? This cannot be undone.')) {
        setIsClearing(true);
        try {
            await clearTable('pendingSOs');
            await setPendingSOs([]);
            alert("Pending Sales Order Report cleared successfully.");
        } catch (e) {
            console.error(e);
            alert(`Failed to clear pending orders: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setIsClearing(false);
        }
    }
  };

  const handleDownloadTemplate = () => {
      // Changed 'Name of Item' to 'Description'
      const headers = ['Date', 'Order', "Party's Name", 'Description', 'Material Code', 'Part No', 'Ordered', 'Balance', 'Rate', 'Discount', 'Value', 'Due on'];
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "PendingSO");
      XLSX.writeFile(wb, "Pending_SO_Report_Template.xlsx");
  }

  const handleAddNew = () => {
      setItemToEdit(null);
      setIsModalOpen(true);
  };

  const handleEdit = (item: PendingSO) => {
      setItemToEdit(item);
      setIsModalOpen(true);
  };

  const handleDelete = async (id: string | number) => {
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
        <h2 className="text-2xl font-bold text-gray-800">Pending Sales Order Report</h2>
        <div className="flex flex-wrap gap-2 text-sm">
            <button 
                onClick={handleAddNew}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold"
            >
                Add Manual
            </button>
            <div className="h-8 border-l border-gray-300 mx-1 hidden md:block"></div>
            <button 
                onClick={handleClearAll} 
                disabled={isClearing}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isClearing ? 'Clearing...' : 'Clear Total Report'}
            </button>
            <button onClick={handleDownloadTemplate} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-bold">Template</button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx, .xls" />
            <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isUploading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded font-bold disabled:opacity-50"
            >
                {isUploading ? 'Uploading...' : 'Upload from Excel'}
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
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Order</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Party's Name</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Description</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Material Code</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Part No</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Ordered</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Balance</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Rate</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Discount</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Value</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Due on</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {filteredSOs.length > 0 ? filteredSOs.map((item, idx) => {
                    const isOverdue = new Date(item.dueOn) < new Date();
                    return (
                        <tr key={item.id || idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-xs text-gray-900 whitespace-nowrap">{new Date(item.date).toLocaleDateString()}</td>
                            <td className="px-3 py-2 text-xs text-gray-900 font-medium whitespace-nowrap">{item.orderNo}</td>
                            <td className="px-3 py-2 text-xs text-gray-900 whitespace-nowrap max-w-[150px] truncate" title={item.partyName}>{item.partyName}</td>
                            <td className="px-3 py-2 text-xs text-gray-900 whitespace-nowrap max-w-[150px] truncate" title={item.itemName}>{item.itemName}</td>
                            <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{item.materialCode}</td>
                            <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{item.partNo}</td>
                            <td className="px-3 py-2 text-xs text-gray-900 text-right whitespace-nowrap">{item.orderedQty}</td>
                            <td className="px-3 py-2 text-xs text-gray-900 text-right font-bold whitespace-nowrap">{item.balanceQty}</td>
                            <td className="px-3 py-2 text-xs text-gray-900 text-right whitespace-nowrap">{item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-xs text-gray-900 text-right whitespace-nowrap">{item.discount}%</td>
                            <td className="px-3 py-2 text-xs text-gray-900 text-right whitespace-nowrap">{item.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className={`px-3 py-2 text-xs font-semibold whitespace-nowrap ${isOverdue ? 'text-red-600' : 'text-green-600'}`}>
                                {new Date(item.dueOn).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-2 text-xs text-right whitespace-nowrap space-x-2">
                                <button onClick={() => handleEdit(item)} className="text-indigo-600 hover:text-indigo-900 font-medium">Edit</button>
                                <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900 font-medium">Delete</button>
                            </td>
                        </tr>
                    );
                }) : (
                    <tr>
                        <td colSpan={13} className="px-6 py-10 text-center text-gray-500">No pending orders found. Add or upload data.</td>
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
