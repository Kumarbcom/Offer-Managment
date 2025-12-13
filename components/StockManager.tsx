
import React, { useState, useRef } from 'react';
import type { StockItem } from '../types';
import { StockItemModal } from './StockItemModal';

declare var XLSX: any;

interface StockManagerProps {
  stockStatements: StockItem[] | null;
  setStockStatements: (value: React.SetStateAction<StockItem[]>) => Promise<void>;
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

export const StockManager: React.FC<StockManagerProps> = ({ stockStatements, setStockStatements }) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<StockItem | null>(null);

  const filteredStock = (stockStatements || []).filter(item => 
    item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase())
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

        const newItems: StockItem[] = json.map((row) => {
            const desc = row['Description'] || row['description'] || '';
            if (!desc) return null;
            return {
                id: generateUUID(),
                description: String(desc),
                quantity: parseFloat(row['Quantity'] || row['quantity'] || 0),
                rate: parseFloat(row['Rate'] || row['rate'] || 0),
                value: parseFloat(row['Value'] || row['value'] || 0)
            };
        }).filter((i): i is StockItem => i !== null);

        if (newItems.length > 0) {
            await setStockStatements(prev => [...(prev || []), ...newItems]);
            alert(`Successfully loaded ${newItems.length} stock items.`);
        } else {
            alert('No valid stock data found. Check headers: Description, Quantity, Rate, Value');
        }

      } catch (error) {
        console.error("Stock upload error:", error);
        alert("Failed to parse Excel file.");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to delete ALL stock data? This action cannot be undone.')) {
        await setStockStatements([]);
    }
  };

  const handleDownloadTemplate = () => {
      const ws = XLSX.utils.aoa_to_sheet([['Description', 'Quantity', 'Rate', 'Value']]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Stock");
      XLSX.writeFile(wb, "Stock_Statement_Template.xlsx");
  }

  const handleAddNew = () => {
      setItemToEdit(null);
      setIsModalOpen(true);
  };

  const handleEdit = (item: StockItem) => {
      setItemToEdit(item);
      setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
      if(window.confirm("Delete this stock item?")) {
          await setStockStatements(prev => (prev || []).filter(i => i.id !== id));
      }
  };

  const handleSaveItem = async (item: StockItem | Omit<StockItem, 'id'>) => {
      await setStockStatements(prev => {
          const currentList = prev || [];
          // If the item passed already has an ID, it's an update.
          if ('id' in item && item.id) {
              return currentList.map(i => i.id === item.id ? item as StockItem : i);
          } else {
              // Otherwise, generate a new UUID.
              const newItem = { ...item, id: generateUUID() } as StockItem;
              return [...currentList, newItem];
          }
      });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Stock Statement</h2>
        <div className="flex flex-wrap gap-2 text-sm">
            <button 
                onClick={handleAddNew}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold"
            >
                Add Item
            </button>
            <div className="h-8 border-l border-gray-300 mx-1 hidden md:block"></div>
            <button 
                onClick={handleClearAll} 
                disabled={!stockStatements || stockStatements.length === 0}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Clear All
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
            placeholder="Search Description..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full md:w-1/3 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {filteredStock.length > 0 ? filteredStock.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">{item.description}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right">{item.quantity}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right">{item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right">{item.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-6 py-4 text-sm text-right space-x-2">
                            <button onClick={() => handleEdit(item)} className="text-indigo-600 hover:text-indigo-900 font-medium">Edit</button>
                            <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900 font-medium">Delete</button>
                        </td>
                    </tr>
                )) : (
                    <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-gray-500">No stock items found. Add or upload data.</td>
                    </tr>
                )}
            </tbody>
        </table>
      </div>
      
      <StockItemModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSaveItem} 
        itemToEdit={itemToEdit} 
      />
    </div>
  );
};
