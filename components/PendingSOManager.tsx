
import React, { useState, useRef } from 'react';
import type { PendingSO } from '../types';

declare var XLSX: any;

interface PendingSOManagerProps {
  pendingSOs: PendingSO[] | null;
  setPendingSOs: (value: React.SetStateAction<PendingSO[]>) => Promise<void>;
}

export const PendingSOManager: React.FC<PendingSOManagerProps> = ({ pendingSOs, setPendingSOs }) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSOs = (pendingSOs || []).filter(item => 
    item.partyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.orderNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.partNo.toLowerCase().includes(searchTerm.toLowerCase())
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

        // Map Excel headers to interface
        // Date, Order, Party's Name, Name of Item, Material Code, Part No, Ordered, Balance, Rate, Discount, Value, Due on
        
        let currentId = (pendingSOs && pendingSOs.length > 0) ? Math.max(...pendingSOs.map(s => s.id)) : 0;

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
            currentId++;
            return {
                id: currentId,
                date: parseDate(row['Date']),
                orderNo: String(orderNo),
                partyName: String(row["Party's Name"] || row['Party Name'] || ''),
                itemName: String(row['Name of Item'] || row['Item Name'] || ''),
                materialCode: String(row['Material Code'] || ''),
                partNo: String(row['Part No'] || ''),
                orderedQty: parseFloat(row['Ordered'] || 0),
                balanceQty: parseFloat(row['Balance'] || 0),
                rate: parseFloat(row['Rate'] || 0),
                discount: parseFloat(row['Discount'] || 0),
                value: parseFloat(row['Value'] || 0),
                dueOn: parseDate(row['Due on'] || row['Due Date']),
                // overdue: false // Removed as it is derived and not part of PendingSO interface
            };
        }).filter((i): i is PendingSO => i !== null);

        if (newItems.length > 0) {
            await setPendingSOs(newItems);
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

  const handleDownloadTemplate = () => {
      const headers = ['Date', 'Order', "Party's Name", 'Name of Item', 'Material Code', 'Part No', 'Ordered', 'Balance', 'Rate', 'Discount', 'Value', 'Due on'];
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "PendingSO");
      XLSX.writeFile(wb, "Pending_SO_Template.xlsx");
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Pending Sales Orders</h2>
        <div className="flex gap-2">
            <button onClick={handleDownloadTemplate} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm font-bold">Template</button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx, .xls" />
            <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isUploading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm font-bold disabled:opacity-50"
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
                        </tr>
                    );
                }) : (
                    <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-gray-500">No pending orders found. Upload data.</td>
                    </tr>
                )}
            </tbody>
        </table>
      </div>
    </div>
  );
};
