
import React, { useState, useMemo } from 'react';
import type { StockItem, PendingSO } from '../types';

interface StockCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockStatements: StockItem[] | null;
  pendingSOs: PendingSO[] | null;
}

// Safety check: if str is undefined/null, return empty string to prevent crash
const normalize = (str: string | undefined | null) => {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
};

interface ProcessedStockItem extends StockItem {
    immediateDemand: number;
    scheduledDemand: number;
    freeStock: number;
    shortage: number;
    orders: Array<PendingSO & { status: string, isDueImmediate: boolean }>;
}

export const StockCheckModal: React.FC<StockCheckModalProps> = ({ isOpen, onClose, stockStatements, pendingSOs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRowIds, setExpandedRowIds] = useState<Set<number>>(new Set());

  // Helper to toggle row expansion
  const toggleRow = (id: number) => {
      setExpandedRowIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(id)) newSet.delete(id);
          else newSet.add(id);
          return newSet;
      });
  };

  const processedData = useMemo(() => {
      if (!stockStatements || !pendingSOs) return [];

      const lowerTerm = searchTerm.toLowerCase();
      // Filter first for performance
      const filteredStock = searchTerm 
        ? stockStatements.filter(s => s.description && s.description.toLowerCase().includes(lowerTerm))
        : stockStatements;

      const today = new Date();
      const dueLimit = new Date(today);
      dueLimit.setDate(today.getDate() + 30); // Today + 30 Days

      return filteredStock.map(stock => {
          const normDesc = normalize(stock.description);
          
          // Find matching orders
          const relevantOrders = pendingSOs.filter(so => {
              const normPart = normalize(so.partNo);
              const normItem = normalize(so.itemName);
              
              if (!normDesc) return false;
              
              // Basic matching heuristics
              const matchPart = normPart && normPart.length > 2 && normDesc.includes(normPart);
              const matchItem = normItem && normItem.length > 2 && normDesc.includes(normItem);
              
              return matchPart || matchItem;
          }).map(so => {
              let dueDate = new Date();
              if (so.dueOn) {
                  dueDate = new Date(so.dueOn);
              }
              
              const isDueImmediate = dueDate <= dueLimit;
              const status = isDueImmediate ? 'Immediate' : 'Scheduled';
              return { ...so, status, isDueImmediate };
          });

          const immediateDemand = relevantOrders
              .filter(o => o.isDueImmediate)
              .reduce((sum, o) => sum + o.balanceQty, 0);
          
          const scheduledDemand = relevantOrders
              .filter(o => !o.isDueImmediate)
              .reduce((sum, o) => sum + o.balanceQty, 0);

          const freeStock = stock.quantity - immediateDemand;
          const shortage = freeStock < 0 ? Math.abs(freeStock) : 0;

          return {
              ...stock,
              immediateDemand,
              scheduledDemand,
              freeStock: freeStock > 0 ? freeStock : 0,
              shortage,
              orders: relevantOrders
          } as ProcessedStockItem;
      });
  }, [stockStatements, pendingSOs, searchTerm]);

  // Calculate total shortage across filtered items
  const totalShortage = useMemo(() => {
      return processedData.reduce((acc, item) => acc + item.shortage, 0);
  }, [processedData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Stock Availability Check</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl font-bold">&times;</button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-grow">
                <input 
                    type="text" 
                    placeholder="Search Stock Description..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                />
            </div>
            <div className="bg-red-50 border border-red-200 px-4 py-2 rounded-md flex items-center gap-2 whitespace-nowrap">
                <span className="text-xs font-bold text-red-600 uppercase">Total Shortage:</span>
                <span className="text-lg font-bold text-red-800">{totalShortage.toLocaleString()}</span>
            </div>
        </div>

        <div className="overflow-auto flex-grow">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Description</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Physical Stock</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase text-orange-600">Immediate Demand</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase text-blue-600">Scheduled Demand</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase text-green-600">Free Stock</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase text-red-600">Shortage</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Details</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {processedData.length > 0 ? processedData.map(item => (
                        <React.Fragment key={item.id}>
                            <tr className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-900 font-medium">{item.description}</td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right">{item.quantity}</td>
                                <td className="px-4 py-3 text-sm text-orange-600 font-bold text-right">{item.immediateDemand}</td>
                                <td className="px-4 py-3 text-sm text-blue-600 font-bold text-right">{item.scheduledDemand}</td>
                                <td className="px-4 py-3 text-sm text-green-600 font-bold text-right">{item.freeStock}</td>
                                <td className="px-4 py-3 text-sm text-red-600 font-bold text-right">{item.shortage > 0 ? item.shortage : '-'}</td>
                                <td className="px-4 py-3 text-center">
                                    {item.orders.length > 0 && (
                                        <button 
                                            onClick={() => toggleRow(item.id)}
                                            className="text-indigo-600 hover:text-indigo-800 text-xs font-bold underline"
                                        >
                                            {expandedRowIds.has(item.id) ? 'Hide' : 'Show Orders'}
                                        </button>
                                    )}
                                </td>
                            </tr>
                            {expandedRowIds.has(item.id) && item.orders.length > 0 && (
                                <tr>
                                    <td colSpan={7} className="bg-indigo-50 p-4 shadow-inner">
                                        <div className="text-xs font-bold text-indigo-800 mb-2 uppercase">Allocated Orders</div>
                                        <table className="w-full text-xs bg-white rounded border border-indigo-100">
                                            <thead className="bg-indigo-100">
                                                <tr>
                                                    <th className="p-2 text-left">Order No</th>
                                                    <th className="p-2 text-left">Customer</th>
                                                    <th className="p-2 text-right">Balance Qty</th>
                                                    <th className="p-2 text-center">Due Date</th>
                                                    <th className="p-2 text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {item.orders.map(order => (
                                                    <tr key={`${item.id}-${order.id}`} className="border-b last:border-0 border-indigo-50">
                                                        <td className="p-2 font-medium">{order.orderNo}</td>
                                                        <td className="p-2">{order.partyName}</td>
                                                        <td className="p-2 text-right">{order.balanceQty}</td>
                                                        <td className="p-2 text-center">{new Date(order.dueOn).toLocaleDateString()}</td>
                                                        <td className="p-2 text-center">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] text-white ${order.isDueImmediate ? 'bg-orange-500' : 'bg-blue-500'}`}>
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
                            <td colSpan={7} className="text-center p-8 text-gray-500">
                                {stockStatements && stockStatements.length > 0 ? "No matching stock items found." : "No stock data available. Please upload a stock statement in Dashboard."}
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
