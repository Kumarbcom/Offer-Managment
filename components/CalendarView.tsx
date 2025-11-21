
import React, { useState, useMemo, useEffect } from 'react';
import type { Quotation, SalesPerson, User } from '../types';
import { getCustomersByIds } from '../supabase';

interface CalendarViewProps {
  quotations: Quotation[] | null;
  salesPersons: SalesPerson[] | null;
  currentUser: User;
  onSelectQuotation: (id: number) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const CalendarView: React.FC<CalendarViewProps> = ({ quotations, salesPersons, currentUser, onSelectQuotation }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [customerMap, setCustomerMap] = useState<Map<number, string>>(new Map());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  // Determine which sales person's data to show
  const filteredQuotations = useMemo(() => {
    if (!quotations) return [];
    return quotations.filter(q => {
      if (currentUser.role === 'Sales Person') {
         const sp = salesPersons?.find(p => p.name === currentUser.name);
         return sp ? q.salesPersonId === sp.id : false;
      }
      return true; 
    });
  }, [quotations, currentUser, salesPersons]);

  // Fetch customer names for visible quotations
  useEffect(() => {
    if (filteredQuotations.length > 0) {
        const customerIdsToFetch = [...new Set(filteredQuotations.map(q => q.customerId))]
            .filter((id): id is number => id !== null && !customerMap.has(id));
        
        if (customerIdsToFetch.length > 0) {
            getCustomersByIds(customerIdsToFetch).then(customers => {
                setCustomerMap(prev => {
                    const newMap = new Map(prev);
                    customers.forEach(c => newMap.set(c.id, c.name));
                    return newMap;
                });
            }).catch(err => console.error("Failed to fetch customers for calendar", err));
        }
    }
  }, [filteredQuotations, customerMap]);

  const calendarData = useMemo(() => {
    const data: Record<number, { quotes: Quotation[], reminders: Quotation[] }> = {};
    
    filteredQuotations.forEach(q => {
      const qDate = new Date(q.quotationDate);
      if (isNaN(qDate.getTime())) return; // Skip invalid dates

      const day = qDate.getDate();
      const qMonth = qDate.getMonth();
      const qYear = qDate.getFullYear();

      // Add to creation date
      if (qMonth === month && qYear === year) {
        if (!data[day]) data[day] = { quotes: [], reminders: [] };
        data[day].quotes.push(q);
      }

      // Add reminder (Date + 5 days)
      const reminderDate = new Date(qDate);
      reminderDate.setDate(qDate.getDate() + 5);
      
      if (reminderDate.getMonth() === month && reminderDate.getFullYear() === year) {
        const rDay = reminderDate.getDate();
        if (!data[rDay]) data[rDay] = { quotes: [], reminders: [] };
        data[rDay].reminders.push(q);
      }
    });
    return data;
  }, [filteredQuotations, month, year]);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  };

  const calculateTotal = (q: Quotation) => {
      if (!q.details || !Array.isArray(q.details)) return 0;
      return q.details.reduce((acc, i) => acc + (i.price * (1-(parseFloat(String(i.discount))||0)/100) * i.moq), 0);
  }

  const selectedDateData = selectedDay ? calendarData[selectedDay] : null;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden min-h-[80vh] flex flex-col">
      {/* Calendar Header */}
      <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
        <button onClick={prevMonth} className="p-1 hover:bg-slate-700 rounded">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-bold">{MONTHS[month]} {year}</h2>
        <button onClick={nextMonth} className="p-1 hover:bg-slate-700 rounded">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Days Header */}
      <div className="grid grid-cols-7 text-center bg-gray-100 border-b border-gray-200">
        {DAYS.map(day => (
          <div key={day} className="py-2 text-xs font-bold text-gray-500 uppercase">{day}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 auto-rows-fr bg-white flex-grow">
        {/* Empty cells for previous month */}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="border-b border-r border-gray-100 bg-gray-50/30 min-h-[80px]"></div>
        ))}

        {/* Days */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const data = calendarData[day];
          const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
          const isSelected = selectedDay === day;

          return (
            <div 
              key={day} 
              onClick={() => setSelectedDay(day)}
              className={`min-h-[80px] border-b border-r border-gray-100 p-1 relative cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-400' : 'hover:bg-gray-50'} ${isToday ? 'bg-yellow-50' : ''}`}
            >
              <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600 font-bold' : 'text-gray-700'}`}>{day}</div>
              
              <div className="flex flex-col gap-1">
                {/* Quote Indicators */}
                {data?.quotes.length > 0 && (
                  <div className="flex items-center gap-1 bg-green-100 text-green-800 text-[10px] px-1.5 py-0.5 rounded-full w-fit">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                    <span className="font-semibold">{data.quotes.length} Qtn</span>
                  </div>
                )}
                
                {/* Reminder Indicators */}
                {data?.reminders.length > 0 && (
                  <div className="flex items-center gap-1 bg-orange-100 text-orange-800 text-[10px] px-1.5 py-0.5 rounded-full w-fit">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                    </svg>
                    <span className="font-semibold">{data.reminders.length} Follow-up</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Details Panel for Selected Day */}
      {selectedDay && selectedDateData && (selectedDateData.quotes.length > 0 || selectedDateData.reminders.length > 0) && (
        <div className="bg-slate-50 p-4 border-t border-slate-200 max-h-[300px] overflow-y-auto">
          <h3 className="font-bold text-slate-800 mb-3 sticky top-0 bg-slate-50 pb-2 border-b">
            Activity for {MONTHS[month]} {selectedDay}, {year}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedDateData.quotes.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-green-700 uppercase mb-2">Quotations Created</h4>
                <ul className="space-y-2">
                  {selectedDateData.quotes.map(q => (
                     <li key={q.id} onClick={() => onSelectQuotation(q.id)} className="bg-white p-2 rounded shadow-sm border-l-4 border-green-500 cursor-pointer hover:shadow-md">
                        <div className="flex justify-between">
                            <span className="font-bold text-sm text-gray-800">#{q.id}</span>
                            <span className="text-xs text-gray-500 font-mono">₹{calculateTotal(q).toLocaleString('en-IN', {maximumFractionDigits:0})}</span>
                        </div>
                        <div className="text-xs text-gray-600 truncate">{q.customerId ? (customerMap.get(q.customerId) || `Customer #${q.customerId}`) : 'No Customer'}</div> 
                     </li>
                  ))}
                </ul>
              </div>
            )}
            
            {selectedDateData.reminders.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-orange-700 uppercase mb-2 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>
                    Follow-up Due (Expiring Soon)
                </h4>
                <ul className="space-y-2">
                   {selectedDateData.reminders.map(q => (
                     <li key={q.id} onClick={() => onSelectQuotation(q.id)} className="bg-white p-2 rounded shadow-sm border-l-4 border-orange-500 cursor-pointer hover:shadow-md">
                        <div className="flex justify-between">
                            <span className="font-bold text-sm text-gray-800">#{q.id}</span>
                            <span className="text-xs text-orange-600 font-semibold">Created: {new Date(q.quotationDate).toLocaleDateString()}</span>
                        </div>
                         <div className="text-xs text-gray-600 truncate mb-1">{q.customerId ? (customerMap.get(q.customerId) || `Customer #${q.customerId}`) : 'No Customer'}</div> 
                        <div className="text-[10px] text-gray-500">Valid till: {new Date(new Date(q.quotationDate).setDate(new Date(q.quotationDate).getDate() + 7)).toLocaleDateString()}</div>
                     </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
