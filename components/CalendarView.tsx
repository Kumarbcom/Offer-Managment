
import React, { useState, useMemo, useEffect } from 'react';
import type { Quotation, SalesPerson, User, QuotationStatus } from '../types';
import { getCustomersByIds } from '../supabase';
import { QUOTATION_STATUSES } from '../constants';

interface CalendarViewProps {
  quotations: Quotation[] | null;
  salesPersons: SalesPerson[] | null;
  currentUser: User;
  onSelectQuotation: (id: number) => void;
  setQuotations: (value: React.SetStateAction<Quotation[]>) => Promise<void>;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const getStatusClass = (status: QuotationStatus) => {
    switch (status) {
        case 'Open': return 'bg-blue-100 text-blue-800';
        case 'PO received': return 'bg-green-100 text-green-800';
        case 'Partial PO Received': return 'bg-teal-100 text-teal-800';
        case 'Expired': return 'bg-yellow-100 text-yellow-800';
        case 'Lost': return 'bg-rose-100 text-rose-800';
        default: return 'bg-slate-100 text-slate-800';
    }
}

export const CalendarView: React.FC<CalendarViewProps> = ({ quotations, salesPersons, currentUser, onSelectQuotation, setQuotations }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [customerMap, setCustomerMap] = useState<Map<number, string>>(new Map());
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(true);
  const [openCommentIds, setOpenCommentIds] = useState<Set<number>>(new Set());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const userRole = currentUser.role;

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
    setIsCalendarExpanded(true);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
    setIsCalendarExpanded(true);
  };

  const handleDayClick = (day: number) => {
      setSelectedDay(day);
      setIsCalendarExpanded(false); // Minimize calendar on selection
  };

  const calculateTotal = (q: Quotation) => {
      if (!q.details || !Array.isArray(q.details)) return 0;
      return q.details.reduce((acc, i) => acc + (i.price * (1-(parseFloat(String(i.discount))||0)/100) * i.moq), 0);
  }

  const handleStatusChange = async (id: number, newStatus: QuotationStatus) => {
    try {
      await setQuotations(prev => (prev || []).map(q => q.id === id ? { ...q, status: newStatus } : q))
    } catch(error) {
      alert(error instanceof Error ? error.message : 'Failed to update status.');
      console.error('Failed to update status:', error);
    }
  };

  const handleCommentChange = async (id: number, newComment: string) => {
    try {
      await setQuotations(prev => (prev || []).map(q => q.id === id ? { ...q, comments: newComment } : q))
    } catch(error) {
      alert(error instanceof Error ? error.message : 'Failed to update comment.');
      console.error('Failed to update comment:', error);
    }
  };

  const toggleCommentSection = (id: number) => {
    setOpenCommentIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
    });
  };

  const canEdit = userRole === 'Admin' || userRole === 'Sales Person';
  const isCommentEditable = canEdit;

  // Reusable Card Renderer for List View
  const renderQuotationCard = (q: Quotation, key: string, isReminder: boolean = false) => (
     <div key={key} className={`bg-white border ${isReminder ? 'border-orange-300 bg-orange-50' : 'border-slate-200'} rounded-lg p-3 shadow-sm mb-2`}>
        <div className="flex justify-between items-start mb-2">
            <div>
                    <div className="text-sm font-bold text-indigo-600 flex items-center gap-2" onClick={() => onSelectQuotation(q.id)}>
                    #{q.id} <span className="text-xs text-slate-400 font-normal">{new Date(q.quotationDate).toLocaleDateString()}</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-800">{q.customerId ? customerMap.get(q.customerId) || 'Loading...' : 'N/A'}</div>
                    <div className="text-xs text-slate-500">{q.contactPerson}</div>
                    <div className="text-xs text-slate-500">{q.contactNumber}</div>
            </div>
            <div className="text-right">
                    <div className="text-sm font-bold text-slate-800">{calculateTotal(q).toLocaleString('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 0})}</div>
                    <div className="mt-1">
                    {canEdit ? (
                        <select
                            value={q.status}
                            onChange={(e) => handleStatusChange(q.id, e.target.value as QuotationStatus)}
                            onClick={(e) => e.stopPropagation()}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full border-0 cursor-pointer focus:ring-1 focus:ring-blue-500 focus:outline-none ${getStatusClass(q.status)} max-w-[100px]`}
                        >
                            {QUOTATION_STATUSES.map(status => (
                                <option key={status} value={status} className="bg-white text-black font-semibold">
                                    {status}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold inline-block ${getStatusClass(q.status)}`}>{q.status}</div>
                    )}
                    </div>
            </div>
        </div>

        {/* Comment Section */}
        <div className="border-t border-slate-200/50 pt-2 mt-2">
            <div className="flex justify-between items-center">
                    {isCommentEditable ? (
                        <button 
                        onClick={(e) => { e.stopPropagation(); toggleCommentSection(q.id); }}
                        className="text-xs text-blue-600 font-medium flex items-center gap-1 hover:underline"
                        >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                        {q.comments ? 'Edit Comment' : 'Add Comment'}
                        </button>
                    ) : (
                    q.comments && <span className="text-xs text-slate-500 italic flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>Comment</span>
                    )}
            </div>
            
            {(openCommentIds.has(q.id) && isCommentEditable) ? (
                <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    <textarea
                        defaultValue={q.comments || ''}
                        onBlur={(e) => handleCommentChange(q.id, e.target.value)}
                        className="w-full p-2 text-xs border border-slate-300 rounded bg-slate-50 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        rows={3}
                        placeholder="Enter quotation comments here..."
                        autoFocus
                    />
                </div>
            ) : (
                q.comments && (
                    <div className="mt-1 text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 italic">
                        "{q.comments}"
                    </div>
                )
            )}
        </div>

        <div className="flex justify-end items-center pt-2 border-t border-slate-200/50 mt-2">
            <div className="flex gap-3">
                    <button onClick={() => onSelectQuotation(q.id)} className="text-indigo-600 font-semibold text-xs">
                    {userRole === 'Sales Person' ? 'View Details' : 'Edit'}
                    </button>
            </div>
        </div>
        </div>
  );

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
        <div className="flex flex-col items-center">
            <h2 className="text-lg font-bold">{MONTHS[month]} {year}</h2>
            {!isCalendarExpanded && selectedDay && (
                <button 
                    onClick={() => setIsCalendarExpanded(true)} 
                    className="text-xs bg-slate-700 px-2 py-1 rounded mt-1 hover:bg-slate-600 flex items-center gap-1"
                >
                    <span>Show Calendar</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>
            )}
        </div>
        <button onClick={nextMonth} className="p-1 hover:bg-slate-700 rounded">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Calendar Grid - Only visible if expanded */}
      {isCalendarExpanded && (
        <>
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
                    onClick={() => handleDayClick(day)}
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
                            <span className="font-semibold">{data.reminders.length} Due</span>
                        </div>
                        )}
                    </div>
                    </div>
                );
                })}
            </div>
        </>
      )}

      {/* Details Panel - List view of cards when a day is selected */}
      {selectedDay && selectedDateData && (selectedDateData.quotes.length > 0 || selectedDateData.reminders.length > 0) && (
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex-grow overflow-y-auto">
          <h3 className="font-bold text-slate-800 mb-3 sticky top-0 bg-slate-50 pb-2 border-b z-10">
            {MONTHS[month]} {selectedDay}, {year}
          </h3>
          
          <div className="flex flex-col gap-4">
            {selectedDateData.quotes.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-green-700 uppercase mb-2">Quotations Created</h4>
                <div className="space-y-2">
                  {selectedDateData.quotes.map(q => (
                      renderQuotationCard(q, `quote-${q.id}`)
                  ))}
                </div>
              </div>
            )}
            
            {selectedDateData.reminders.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-orange-700 uppercase mb-2 flex items-center gap-1 mt-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>
                    Follow-up Due (Expiring Soon)
                </h4>
                <div className="space-y-2">
                   {selectedDateData.reminders.map(q => (
                       renderQuotationCard(q, `reminder-${q.id}`, true)
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Empty State for Details */}
      {selectedDay && (!selectedDateData || (selectedDateData.quotes.length === 0 && selectedDateData.reminders.length === 0)) && (
         <div className="flex-grow flex flex-col items-center justify-center p-8 text-slate-400">
             <p>No activity on {MONTHS[month]} {selectedDay}</p>
         </div>
      )}
    </div>
  );
};
