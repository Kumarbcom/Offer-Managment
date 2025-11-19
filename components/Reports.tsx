import React, { useState, useEffect, useMemo } from 'react';
import type { Quotation, SalesPerson, User } from '../types';
import { getCustomersByIds } from '../supabase';

interface ReportsProps {
  quotations: Quotation[] | null;
  salesPersons: SalesPerson[] | null;
  currentUser: User;
}

type DateRange = 'today' | 'week' | 'month';

export const Reports: React.FC<ReportsProps> = ({ quotations, salesPersons, currentUser }) => {
  const [selectedSalesPersonId, setSelectedSalesPersonId] = useState<number | 'all'>('all');
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [customerMap, setCustomerMap] = useState<Map<number, string>>(new Map());

  // Initialize selected Sales Person based on logged-in user
  useEffect(() => {
    if (currentUser.role === 'Sales Person' && salesPersons) {
      const me = salesPersons.find(sp => sp.name === currentUser.name);
      if (me) {
        setSelectedSalesPersonId(me.id);
      }
    }
  }, [currentUser, salesPersons]);

  // Filter Quotations
  const filteredQuotations = useMemo(() => {
    if (!quotations) return [];
    
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    let startDate = new Date(startOfDay);

    if (dateRange === 'week') {
      startDate.setDate(today.getDate() - 7); // Last 7 days
    } else if (dateRange === 'month') {
      startDate.setDate(1); // Start of current month
    }

    return quotations.filter(q => {
      // Sales Person Filter
      if (selectedSalesPersonId !== 'all' && q.salesPersonId !== selectedSalesPersonId) {
        return false;
      }
      if (currentUser.role === 'Sales Person' && selectedSalesPersonId === 'all') {
         // Safety fallback: if logged in as SP but somehow 'all' selected, enforce filtering
         // Note: The useEffect above attempts to set the ID, but this is a hard check.
         const me = salesPersons?.find(sp => sp.name === currentUser.name);
         if (me && q.salesPersonId !== me.id) return false;
      }

      // Date Filter
      const qDate = new Date(q.quotationDate);
      return qDate >= startDate && qDate <= today;
    }).sort((a, b) => b.id - a.id);
  }, [quotations, selectedSalesPersonId, dateRange, currentUser, salesPersons]);

  // Fetch Customer Names
  useEffect(() => {
    const idsToFetch = [...new Set(filteredQuotations.map(q => q.customerId).filter(id => id !== null && !customerMap.has(id)))] as number[];
    if (idsToFetch.length > 0) {
      getCustomersByIds(idsToFetch).then(customers => {
        setCustomerMap(prev => {
          const next = new Map(prev);
          customers.forEach(c => next.set(c.id, c.name));
          return next;
        });
      });
    }
  }, [filteredQuotations, customerMap]);

  const calculateTotal = (q: Quotation) => {
    return q.details.reduce((sum, item) => {
      const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
      return sum + (unitPrice * item.moq);
    }, 0);
  };

  const totalValue = useMemo(() => filteredQuotations.reduce((sum, q) => sum + calculateTotal(q), 0), [filteredQuotations]);

  const handleWhatsAppShare = () => {
    if (selectedSalesPersonId === 'all') {
        alert("Please select a specific Sales Person to send the report.");
        return;
    }
    const sp = salesPersons?.find(s => s.id === selectedSalesPersonId);
    if (!sp || !sp.mobile) {
        alert("Sales Person mobile number not found.");
        return;
    }

    let message = `*Sales Report - ${sp.name}*\n`;
    message += `Period: ${dateRange.toUpperCase()}\n`;
    message += `------------------------\n`;
    
    if (filteredQuotations.length === 0) {
        message += "No quotations found for this period.\n";
    } else {
        filteredQuotations.forEach((q, index) => {
            const custName = customerMap.get(q.customerId!) || 'Unknown';
            const val = calculateTotal(q);
            message += `${index + 1}. ${q.quotationDate} | QTN:${q.id}\n`;
            message += `   ${custName}\n`;
            message += `   ${q.contactPerson} (${q.contactNumber})\n`;
            message += `   Val: ₹${val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}\n\n`;
        });
    }
    
    message += `------------------------\n`;
    message += `*Total Value: ₹${totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}*`;

    let phone = sp.mobile.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md min-h-[80vh]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Sales Reports</h2>
        
        <div className="flex flex-wrap gap-3 items-center">
             {/* Sales Person Selector */}
             <div className="w-full md:w-auto">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sales Person</label>
                <select
                    value={selectedSalesPersonId}
                    onChange={e => setSelectedSalesPersonId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    disabled={currentUser.role === 'Sales Person'}
                    className="block w-full md:w-64 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                    <option value="all">All Sales Persons</option>
                    {salesPersons?.map(sp => (
                        <option key={sp.id} value={sp.id}>{sp.name}</option>
                    ))}
                </select>
            </div>

            {/* Date Range Selector */}
             <div className="w-full md:w-auto">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Time Period</label>
                <div className="flex bg-gray-100 rounded-md p-1">
                    {(['today', 'week', 'month'] as DateRange[]).map(range => (
                        <button
                            key={range}
                            onClick={() => setDateRange(range)}
                            className={`px-4 py-1.5 text-sm font-medium rounded transition-colors capitalize ${
                                dateRange === range 
                                ? 'bg-white text-indigo-600 shadow-sm' 
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                            }`}
                        >
                            {range === 'today' ? 'Today' : range === 'week' ? 'Week' : 'Month'}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex justify-end mb-4">
          <button
            onClick={handleWhatsAppShare}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
            title="Send report via WhatsApp"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
            </svg>
            Share Report on WhatsApp
          </button>
      </div>

      {/* Grid View */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">QTN No</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Contact Details</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Sales Person</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Value (₹)</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredQuotations.length > 0 ? (
                filteredQuotations.map(q => (
                <tr key={q.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{new Date(q.quotationDate).toLocaleDateString('en-GB')}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800">{q.id}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{customerMap.get(q.customerId!) || 'Loading...'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        <div className="font-medium">{q.contactPerson}</div>
                        <div className="text-xs text-gray-500">{q.contactNumber}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                         {salesPersons?.find(sp => sp.id === q.salesPersonId)?.name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-800 text-right">
                        {calculateTotal(q).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </td>
                </tr>
                ))
            ) : (
                <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
                        No quotations found for the selected period.
                    </td>
                </tr>
            )}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
                <td colSpan={5} className="px-4 py-3 text-right text-sm font-bold text-gray-700">Total Value</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-indigo-700">
                    ₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
