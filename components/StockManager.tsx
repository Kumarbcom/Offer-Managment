
import React, { useState, useRef, useMemo } from 'react';
import type { StockItem, PendingSO } from '../types';

declare var XLSX: any;

interface StockManagerProps {
  stockStatements: StockItem[] | null;
  setStockStatements: (value: React.SetStateAction<StockItem[]>) => Promise<void>;
  pendingSOs?: PendingSO[] | null;
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

const normalizeString = (str: string | null | undefined) => {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
};

export const StockManager: React.FC<StockManagerProps> = ({ stockStatements, setStockStatements, pendingSOs }) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRowId, setExpandedRowId] = useState<string | number | null>(null);

  const processedData = useMemo(() => {
      const currentStock = stockStatements || [];
      const orders = pendingSOs || [];
      const today = new Date();
      const dueLimit = new Date(today);
      dueLimit.setDate(today.getDate() + 30); // Immediate Demand = Due within 30 Days

      // Pre-process Pending SOs for efficient matching
      const preparedOrders = orders.map(so => {
          const normItemName = normalizeString(so.itemName);
          const normPartNo = normalizeString(so.partNo);
          const normMaterialCode = normalizeString(so.materialCode);
          
          const dueDateObj = so.dueOn ? new Date(so.dueOn) : new Date('9999-12-31');
          const isDueImmediate = dueDateObj <= dueLimit;

          return {
            ...so,
            normItemName,
            normPartNo,
            normMaterialCode,
            isDueImmediate,
            balanceQty: typeof so.balanceQty === 'number' ? so.balanceQty : parseFloat(String(so.balanceQty)) || 0
          };
      });

      return currentStock.map(item => {
          const normDesc = normalizeString(item.description);
          
          const relevantOrders = preparedOrders.filter(so => {
              // 1. Match by Item Name (Mutual inclusion)
              if (so.normItemName && (normDesc.includes(so.normItemName) || so.normItemName.includes(normDesc))) return true;
              
              // 2. Match by Part Number
              if (so.normPartNo && so.normPartNo.length > 2 && normDesc.includes(so.normPartNo)) return true;
              
              // 3. Match by Material Code
              if (so.normMaterialCode && so.normMaterialCode.length > 2 && normDesc.includes(so.normMaterialCode)) return true;
              
              return false;
          });

          const dueOrders = relevantOrders
              .filter(o => o.isDueImmediate)
              .reduce((sum, o) => sum + o.balanceQty, 0);
          
          const scheduledOrders = relevantOrders
              .filter(o => !o.isDueImmediate)
              .reduce((sum, o) => sum + o.balanceQty, 0);

          const freeStock = item.quantity - dueOrders;

          return {
              ...item,
              dueOrders,
              scheduledOrders,
              freeStock,
              orders: relevantOrders
          };
      });
  }, [stockStatements, pendingSOs]);

  const filteredStock = processedData.filter(item => 
    item.description.toLowerCase().includes(searchTerm.toLowerCase())
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

        const newItems: StockItem[] = json.map((row): StockItem | null => {
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

  const toggleRow = (id: string | number) => {
      setExpandedRowId(prev => prev === id ? null : id);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Stock Statement</h2>
        <div className="flex flex-wrap gap-2">
            <button 
                onClick={handleClearAll} 
                disabled={!stockStatements || stockStatements.length === 0}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Clear All Data
            </button>
            <div className="h-8 border-l border-gray-300 mx-1 hidden md:block"></div>
            <button onClick={handleDownloadTemplate} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm font-bold">Template</button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx, .xls" />
            <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isUploading}
                className="bg-indigo-600 hover:bg-indigo-7