
import React, { useState, useMemo } from 'react';
import type { StockItem, PendingSO } from '../types';

interface StockCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockStatements: StockItem[] | null;
  pendingSOs: PendingSO[] | null;
}

// Advanced Tokenizer for Technical Specifications
const tokenize = (str: string | undefined | null): string[] => {
    if (!str) return [];
    let s = str.toLowerCase();
    
    // 1. Normalize separators
    s = s.replace(/[-_/,|]/g, ' '); 

    // 2. Normalize decimal commas (2,5 -> 2.5)
    s = s.replace(/(\d),(\d)/g, '$1.$2');

    // 3. Normalize dimensions: Handle "x", "g", "*" between numbers (3x2.5 -> 3 2.5)
    // This is critical for matching "3G2.5" with "3x2.5"
    s = s.replace(/(\d)\s*[xXgG*]\s*(\d)/g, '$1 $2');
    
    // 4. Separate numbers from letters (100m -> 100 m, 3C -> 3 c)
    s = s.replace(/(\d)([a-z])/g, '$1 $2');
    s = s.replace(/([a-z])(\d)/g, '$1 $2');

    // 5. Clean up multiple spaces
    s = s.replace(/\s+/g, ' ').trim();

    // 6. Split by space
    const tokens = s.split(' ');

    // 7. Filter out generic stop words that might confuse matching (optional, but safer to keep most)
    // We keep numbers and technical terms.
    return tokens.filter(t => t.length > 0 && t !== '.');
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
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string | number>>(new Set());
  const [showAllStock, setShowAllStock] = useState(false);

  const toggleRow = (id: string | number) => {
      setExpandedRowIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(id)) newSet.delete(id);
          else newSet.add(id);
          return newSet;
      });
  };

  const processedData = useMemo(() => {
      if (!stockStatements) return [];
      
      const lowerTerm = searchTerm.toLowerCase();
      
      // 1. Filter Stock first based on search
      let filteredStock = stockStatements;
      if (searchTerm) {
          filteredStock = filteredStock.filter(s => s.description && s.description.toLowerCase().includes(lowerTerm));
      }

      const today = new Date();
      const dueLimit = new Date(today);
      dueLimit.setDate(today.getDate() + 30); // Immediate Demand = Due within 30 Days

      // 2. Pre-process Pending SOs for performance
      const preparedOrders = (pendingSOs || []).map(so => {
          // Priority: Part No > Item Name
          const mainText = so.partNo || so.itemName || '';
          const tokens = tokenize(mainText);
          
          // Extract purely numeric tokens for strict dimension matching
          const numericTokens = new Set(tokens.filter(t => /^[\d.]+$/.test(t)));

          return {
            ...so,
            tokens,
            numericTokens,
            mainTextLower: mainText.toLowerCase().replace(/[^a-z0-9.]/g, ''), // Normalized for substring check
            isDueImmediate: so.dueOn ? new Date(so.dueOn) <= dueLimit : true,
            status: (so.dueOn && new Date(so.dueOn) <= dueLimit) ? 'Immediate' : 'Scheduled'
          };
      });

      const result = filteredStock.map(stock => {
          const stockTokensArr = tokenize(stock.description);
          const stockTokens = new Set(stockTokensArr);
          const stockNumericTokens = new Set(stockTokensArr.filter(t => /^[\d.]+$/.test(t)));
          const stockDescNormalized = (stock.description || '').toLowerCase().replace(/[^a-z0-9.]/g, '');
          
          // Find matching orders
          const relevantOrders = preparedOrders.filter(so => {
              if (!stock.description) return false;

              // --- STRATEGY 1: Exact Substring Match ---
              // If cleaned SO string is inside cleaned Stock string
              if (so.mainTextLower.length > 4 && stockDescNormalized.includes(so.mainTextLower)) {
                  return true;
              }

              // --- STRATEGY 2: Smart Token Matching ---
              if (so.tokens.length === 0) return false;

              // A. Numeric Constraint:
              // For a match, ALL numbers in the SO Item (e.g. 3, 2.5) must basically exist in Stock.
              // We allow ONE missing number if it's large (likely length like 100m), but dimensions must match.
              let missingNumbers = 0;
              for (const num of so.numericTokens) {
                  if (!stockNumericTokens.has(num)) {
                      missingNumbers++;
                  }
              }
              // If dimensions mismatch significantly, reject.
              // Heuristic: If > 1 number is missing, or if strict 100% fail on small items.
              if (so.numericTokens.size > 0) {
                  if (so.numericTokens.size <= 2 && missingNumbers > 0) return false; // Strict for small specs like "3x2.5"
                  if (missingNumbers > 1) return false; // Too many mismatches
              }

              // B. Text Token Overlap
              // How many of SO's words are in Stock?
              let matches = 0;
              for (const token of so.tokens) {
                  if (stockTokens.has(token)) matches++;
              }
              
              const matchRatio = matches / so.tokens.length;

              // If it's a short description (e.g. "Cable 2.5"), we need high match.
              // If it's long ("Lapp Olflex Classic 110..."), we accept lower ratio (ignoring "Classic", "110", etc if missing)
              if (so.tokens.length <= 3) return matchRatio >= 0.9; // Almost exact
              if (so.tokens.length <= 6) return matchRatio >= 0.6; // Moderate
              return matchRatio >= 0.5; // Loose for long descriptions
          });

          const immediateDemand = relevantOrders
              .filter(o => o.isDueImmediate)
              .reduce((sum, o) => sum + (o.balanceQty || 0), 0);
          
          const scheduledDemand = relevantOrders
              .filter(o => !o.isDueImmediate)
              .reduce((sum, o) => sum + (o.balanceQty || 0), 0);

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
      
      // If NOT showing all, filter to show only items with ACTION needed (Shortage) or Activity (Demand)
      if (!showAllStock && !searchTerm) {
          return result.filter(item => item.immediateDemand > 0 || item.scheduledDemand > 0 || item.shortage > 0);
      }
      
      return result;

  }, [stockStatements, pendingSOs, searchTerm, showAllStock]);

  const totalShortage = useMemo(() => {
      return processedData.reduce((acc, item) => acc + item.shortage, 0);
  }, [processedData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
            <div>
                <h2 className="text-2xl font-bold text-gray-800">Stock Availability Check</h2>
                <p className="text-xs text-gray-500">Matches Stock Description with Pending Order Item/Part No.</p>
            </div>
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
            <div className="flex items-center gap-2">
                <input 
                    type="checkbox" 
                    id="showAll" 
                    checked={showAllStock} 
                    onChange={e => setShowAllStock(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="showAll" className="text-sm font-medium text-gray-700 whitespace-nowrap select-none cursor-pointer">Show All Items</label>
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
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase w-1/3">Description</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">Physical Stock</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-orange-600 uppercase bg-orange-50">Immediate Demand</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-blue-600 uppercase bg-blue-50">Scheduled Demand</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-green-600 uppercase bg-green-50">Free Stock</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-red-600 uppercase bg-red-50">Shortage</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Details</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {processedData.length > 0 ? processedData.map(item => (
                        <React.Fragment key={item.id}>
                            <tr className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 text-sm text-gray-900 font-medium">{item.description}</td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">{item.quantity.toLocaleString()}</td>
                                <td className="px-4 py-3 text-sm text-orange-700 font-bold text-right bg-orange-50/50">{item.immediateDemand > 0 ? item.immediateDemand.toLocaleString() : '-'}</td>
                                <td className="px-4 py-3 text-sm text-blue-700 font-bold text-right bg-blue-50/50">{item.scheduledDemand > 0 ? item.scheduledDemand.toLocaleString() : '-'}</td>
                                <td className="px-4 py-3 text-sm text-green-700 font-bold text-right bg-green-50/50">{item.freeStock.toLocaleString()}</td>
                                <td className="px-4 py-3 text-sm text-red-700 font-bold text-right bg-red-50/50">{item.shortage > 0 ? item.shortage.toLocaleString() : '-'}</td>
                                <td className="px-4 py-3 text-center">
                                    {item.orders.length > 0 ? (
                                        <button 
                                            onClick={() => toggleRow(item.id)}
                                            className="text-indigo-600 hover:text-indigo-900 text-xs font-bold underline focus:outline-none"
                                        >
                                            {expandedRowIds.has(item.id) ? 'Hide Orders' : `Show ${item.orders.length} Order(s)`}
                                        </button>
                                    ) : (
                                        <span className="text-gray-400 text-xs">-</span>
                                    )}
                                </td>
                            </tr>
                            {expandedRowIds.has(item.id) && item.orders.length > 0 && (
                                <tr>
                                    <td colSpan={7} className="bg-indigo-50/50 p-4 shadow-inner">
                                        <div className="text-xs font-bold text-indigo-800 mb-2 uppercase flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                            Allocated Orders
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs bg-white rounded border border-indigo-100">
                                                <thead className="bg-indigo-100 text-indigo-900">
                                                    <tr>
                                                        <th className="p-2 text-left">Order No</th>
                                                        <th className="p-2 text-left">Customer / Party</th>
                                                        <th className="p-2 text-left">Item / Part No</th>
                                                        <th className="p-2 text-right">Balance Qty</th>
                                                        <th className="p-2 text-right">Value (₹)</th>
                                                        <th className="p-2 text-center">Due Date</th>
                                                        <th className="p-2 text-center">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-indigo-50">
                                                    {item.orders.map((order, idx) => (
                                                        <tr key={`${item.id}-${order.id || idx}`} className="hover:bg-indigo-50/30">
                                                            <td className="p-2 font-medium text-gray-800">{order.orderNo}</td>
                                                            <td className="p-2 text-gray-700">{order.partyName}</td>
                                                            <td className="p-2 text-gray-600 max-w-xs truncate" title={order.itemName || order.partNo}>{order.itemName || order.partNo}</td>
                                                            <td className="p-2 text-right font-bold text-gray-800">{order.balanceQty}</td>
                                                            <td className="p-2 text-right text-gray-600">{(order.value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                                                            <td className="p-2 text-center text-gray-600">{new Date(order.dueOn).toLocaleDateString()}</td>
                                                            <td className="p-2 text-center">
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold text-white ${order.isDueImmediate ? 'bg-orange-500' : 'bg-blue-500'}`}>
                                                                    {order.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    )) : (
                        <tr>
                            <td colSpan={7} className="text-center p-12 text-gray-500">
                                {stockStatements && stockStatements.length > 0 
                                    ? (showAllStock ? 
                                        <div className="flex flex-col items-center">
                                            <p className="text-lg font-semibold">No items match your search.</p>
                                            <p className="text-sm">Try a different keyword.</p>
                                        </div> : 
                                        <div className="flex flex-col items-center">
                                            <p className="text-lg font-semibold text-green-600">All Clear!</p>
                                            <p className="text-sm">No items found with shortage or pending demand.</p>
                                            <button onClick={() => setShowAllStock(true)} className="mt-4 text-indigo-600 hover:underline">Show All Stock Items</button>
                                        </div>)
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
