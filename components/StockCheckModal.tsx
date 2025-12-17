
import React, { useState, useMemo } from 'react';
import type { StockItem, PendingSO } from '../types';

interface StockCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockStatements: StockItem[] | null;
  pendingSOs: PendingSO[] | null;
}

interface ProcessedStockItem extends StockItem {
    dueOrdersQty: number;      // Immediate Demand (<= 30 days)
    scheduledOrdersQty: number; // Future Demand (> 30 days)
    freeStock: number;         // Physical - DueOrders
    shortage: number;          // If FreeStock < 0
    orders: Array<PendingSO & { status: string, isDueImmediate: boolean }>;
}

// Strict normalization: removes special chars, spaces, and converts to lowercase
const normalizeString = (str: string | null | undefined) => {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
};

export const StockCheckModal: React.FC<StockCheckModalProps> = ({ isOpen, onClose, stockStatements, pendingSOs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRowId, setExpandedRowId] = useState<string | number | null>(null);

  const processedData = useMemo(() => {
      if (!stockStatements) return [];
      
      const lowerSearchTerm = searchTerm.toLowerCase();
      
      // 1. Filter Stock based on search input (visual filter)
      let filteredStock = stockStatements;
      if (searchTerm) {
          filteredStock = filteredStock.filter(s => s.description && s.description.toLowerCase().includes(lowerSearchTerm));
      }

      // 2. Date Logic for Due Orders vs Scheduled
      const today = new Date();
      const dueLimit = new Date(today);
      dueLimit.setDate(today.getDate() + 30); // Today + 30 Days

      // 3. Pre-process Pending SOs for efficient matching
      const preparedOrders = (pendingSOs || []).map(so => {
          const itemName = so.itemName || '';
          const partNo = so.partNo || '';
          const materialCode = so.materialCode || '';
          
          const normItemName = normalizeString(itemName);
          const normPartNo = normalizeString(partNo);
          const normMaterialCode = normalizeString(materialCode);

          const dueDateObj = so.dueOn ? new Date(so.dueOn) : new Date('9999-12-31');
          const isDueImmediate = dueDateObj <= dueLimit;

          return {
            ...so,
            normItemName,
            normPartNo,
            normMaterialCode,
            isDueImmediate,
            status: isDueImmediate ? 'Due Order' : 'Scheduled',
            balanceQty: typeof so.balanceQty === 'number' ? so.balanceQty : parseFloat(String(so.balanceQty)) || 0
          };
      });

      return filteredStock.map(stock => {
          const stockDesc = stock.description || '';
          const normStockDesc = normalizeString(stockDesc);
          
          // 4. Matching Logic: Lookup Stock Description in Pending Orders
          const relevantOrders = preparedOrders.filter(so => {
              // 1. Match by Item Name (Mutual inclusion)
              if (so.normItemName && (normStockDesc.includes(so.normItemName) || so.normItemName.includes(normStockDesc))) return true;
              
              // 2. Match by Part Number
              if (so.normPartNo && so.normPartNo.length > 2 && normStockDesc.includes(so.normPartNo)) return true;
              
              // 3. Match by Material Code
              if (so.normMaterialCode && so.normMaterialCode.length > 2 && normStockDesc.includes(so.normMaterialCode)) return true;
              
              return false;
          });

          // 5. Calculate Quantities
          const dueOrdersQty = relevantOrders
              .filter(o => o.isDueImmediate)
              .reduce((sum, o) => sum + o.balanceQty, 0);
          
          const scheduledOrdersQty = relevantOrders
              .filter(o => !o.isDueImmediate)
              .reduce((sum, o) => sum + o.balanceQty, 0);

          // Formula: Free Stock = Physical Stock - Due Orders
          const netStock = stock.quantity - dueOrdersQty;
          
          const freeStock = netStock > 0 ? netStock : 0;
          const shortage = netStock < 0 ? Math.abs(netStock) : 0;

          return {
              ...stock,
              dueOrdersQty,
              scheduledOrdersQty,
              freeStock,
              shortage,
              orders: relevantOrders
          } as ProcessedStockItem;
      });

  }, [stockStatements, pendingSOs, searchTerm]);

  const totalShortage = useMemo(() => {
      return processedData.reduce((acc, item) => acc + item.shortage, 0);
  }, [processedData]);

  const toggleRow = (id: string | number) => {
      setExpandedRowId(prev => prev === id ? null : id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
            <div>
                <h2 className="text-2xl font-bold text-gray-800">Stock Availability Check</h2>
                <p className="text-xs text-gray-500">Calculates Free Stock based on Physical Stock vs Due Orders (≤ 30 Days).</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl font-bold">&times;</button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-grow">
                <input 
                    type="text" 
                    placeholder="Search Part No / Description..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                />
            </div>
            <div className="bg-red-50 border border-red-200 px-4 py-2 rounded-md flex items-center gap-2 whitespace-nowrap min-w-[200px] justify-center">
                <span className="text-xs font-bold text-red-600 uppercase">Total Shortage:</span>
                <span className="text-lg font-bold text-red-800">{totalShortage.toLocaleString()}</span>
            </div>
        </div>

        <div className="overflow-auto flex-grow border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase w-10"></th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase w-1/3">Description</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">Physical Stock</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-orange-600 uppercase bg-orange-50 border-l border-orange-100">Due Orders<br/><span className="text-[10px] font-normal text-gray-500">(&le; 30 Days)</span></th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-blue-600 uppercase bg-blue-50 border-l border-blue-100">Scheduled Orders<br/><span className="text-[10px] font-normal text-gray-500">(&gt; 30 Days)</span></th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-green-600 uppercase bg-green-50 border-l border-green-100">Free Stock</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-red-600 uppercase bg-red-50 border-l border-red-100">Shortage</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {processedData.length > 0 ? processedData.map(item => (
                        <React.Fragment key={item.id}>
                            <tr className={`hover:bg-gray-50 transition-colors ${expandedRowId === item.id ? 'bg-indigo-50 hover:bg-indigo-50' : ''}`} onClick={() => toggleRow(item.id)}>
                                <td className="px-4 py-3 text-center cursor-pointer">
                                    {item.orders.length > 0 && (
                                        <span className="text-gray-500 font-bold text-xs">{expandedRowId === item.id ? '▼' : '▶'}</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 font-medium cursor-pointer">
                                    {item.description}
                                    {item.orders.length > 0 && <span className="ml-2 text-[10px] text-gray-500">({item.orders.length} orders)</span>}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">{item.quantity.toLocaleString()}</td>
                                <td className={`px-4 py-3 text-sm text-right font-bold border-l border-orange-50 ${item.dueOrdersQty > 0 ? 'text-orange-700 bg-orange-50/30' : 'text-gray-400'}`}>
                                    {item.dueOrdersQty > 0 ? item.dueOrdersQty.toLocaleString() : '-'}
                                </td>
                                <td className={`px-4 py-3 text-sm text-right font-bold border-l border-blue-50 ${item.scheduledOrdersQty > 0 ? 'text-blue-700 bg-blue-50/30' : 'text-gray-400'}`}>
                                    {item.scheduledOrdersQty > 0 ? item.scheduledOrdersQty.toLocaleString() : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-green-700 font-bold text-right bg-green-50/30 border-l border-green-50">{item.freeStock.toLocaleString()}</td>
                                <td className="px-4 py-3 text-sm text-red-700 font-bold text-right bg-red-50/30 border-l border-red-50">{item.shortage > 0 ? item.shortage.toLocaleString() : '-'}</td>
                            </tr>
                            {expandedRowId === item.id && item.orders.length > 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                                        <div className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide ml-8">Order Details:</div>
                                        <table className="w-full text-xs text-left ml-8 mb-2 border border-gray-200 bg-white rounded-md overflow-hidden">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="p-2 border-r">Date</th>
                                                    <th className="p-2 border-r">Customer (Party Name)</th>
                                                    <th className="p-2 border-r">PO No</th>
                                                    <th className="p-2 border-r text-right">Balance Qty</th>
                                                    <th className="p-2 text-center">Due Date</th>
                                                    <th className="p-2 text-center">Type</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {item.orders.map((order, oIdx) => (
                                                    <tr key={oIdx} className="border-b last:border-0">
                                                        <td className="p-2 border-r">{new Date(order.date).toLocaleDateString()}</td>
                                                        <td className="p-2 border-r">{order.partyName}</td>
                                                        <td className="p-2 border-r">{order.orderNo}</td>
                                                        <td className="p-2 border-r text-right font-mono font-bold">{order.balanceQty}</td>
                                                        <td className={`p-2 text-center font-bold ${order.isDueImmediate ? 'text-orange-600' : 'text-blue-600'}`}>
                                                            {new Date(order.dueOn).toLocaleDateString()}
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] text-white ${order.isDueImmediate ? 'bg-orange-500' : 'bg-blue-500'}`}>
                                                                {order.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    )) : (
                        <tr>
                            <td colSpan={7} className="text-center p-12 text-gray-500">
                                {stockStatements && stockStatements.length > 0 
                                    ? <p>No items match your search.</p>
                                    : "No stock data available. Please upload a stock statement in Dashboard."}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};
