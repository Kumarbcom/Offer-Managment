
import React, { useState, useMemo, useEffect } from 'react';
import type { Quotation, SalesPerson, QuotationStatus, User } from '../types';
import { QUOTATION_STATUSES } from '../constants';
import { get } from '../supabase';
import { getQuotationDisplayNumber } from '../utils/quotationNumber';

declare var XLSX: any;

interface QuotationManagerProps {
  quotations: Quotation[] | null;
  salesPersons: SalesPerson[] | null;
  setEditingQuotationId: (id: number | null) => void;
  setView: (view: 'quotation-form') => void;
  setQuotations: (value: React.SetStateAction<Quotation[]>) => Promise<void>;
  currentUser: User;
  quotationFilter: { customerIds?: number[], status?: QuotationStatus } | null;
  onBackToCustomers?: () => void;
}

type SortByType = 'id' | 'quotationDate' | 'customer' | 'contactPerson' | 'salesPerson' | 'totalAmount' | 'status';
type SortOrderType = 'asc' | 'desc';

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

export const QuotationManager: React.FC<QuotationManagerProps> = ({ quotations, salesPersons, setEditingQuotationId, setView, setQuotations, currentUser, quotationFilter, onBackToCustomers }) => {
  const [universalSearchTerm, setUniversalSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortByType>('id');
  const [sortOrder, setSortOrder] = useState<SortOrderType>('desc');
  const [selectedQuotationIds, setSelectedQuotationIds] = useState<Set<number>>(new Set());
  const [customerMap, setCustomerMap] = useState<Map<number, string>>(new Map());
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [openCommentIds, setOpenCommentIds] = useState<Set<number>>(new Set());
  const [isCustomersLoaded, setIsCustomersLoaded] = useState(false);

  const userRole = currentUser.role;

  useEffect(() => {
    if (!isCustomersLoaded) {
      setIsLoadingCustomers(true);
      get('customers').then(customers => {
        setCustomerMap(prevMap => {
          const newMap = new Map(prevMap);
          customers.forEach((c: any) => newMap.set(c.id, c.name));
          return newMap;
        });
        setIsLoadingCustomers(false);
        setIsCustomersLoaded(true);
      }).catch(err => {
        console.error("QuotationManager full customer load error:", err);
        setIsLoadingCustomers(false);
      });
    }
  }, [isCustomersLoaded]);

  const getCustomerName = (id: number | null): string => {
    if (id === null) return 'N/A';
    return customerMap.get(Number(id)) || 'Loading...';
  };

  const getSalesPersonName = (id: number | null) => salesPersons?.find(sp => sp.id === id)?.name || 'N/A';

  const calculateTotalAmount = (details: Quotation['details'] | undefined): number => {
    if (!details || !Array.isArray(details)) return 0;
    return details.reduce((total, item) => {
      const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
      return total + (unitPrice * item.moq);
    }, 0);
  }

  const handleSort = (newSortBy: SortByType) => {
    setSortBy(newSortBy);
    setSortOrder(prev => sortBy === newSortBy && prev === 'asc' ? 'desc' : 'asc');
  };

  const filteredAndSortedQuotations = useMemo(() => {
    if (!quotations) return [];

    // 1. Identify Current Sales Person ID if applicable
    let currentSalesPersonId: number | undefined;
    let currentUserHasSalesPersonRecord = false;
    if (userRole === 'Sales Person') {
      const matchedSP = salesPersons?.find(sp => sp.name === currentUser.name);
      if (matchedSP) {
        currentSalesPersonId = matchedSP.id;
        currentUserHasSalesPersonRecord = true;
      }
    }

    const preFilteredQuotations = quotationFilter
      ? quotations.filter(q => {
        const customerMatch = !quotationFilter.customerIds || (q.customerId !== null && quotationFilter.customerIds.includes(q.customerId));
        const statusMatch = !quotationFilter.status || q.status === quotationFilter.status;
        return customerMatch && statusMatch;
      })
      : quotations;

    return preFilteredQuotations
      .filter(q => {
        // 2. Role-Based Restriction
        if (userRole === 'Sales Person') {
          if (currentUserHasSalesPersonRecord) {
            // User has a salesPerson record — filter by salesPersonId only,
            // EXCEPT if they prepared it themselves (fix for disappearing quotations).
            if (q.salesPersonId !== currentSalesPersonId && q.preparedBy !== currentUser.name) return false;
          }
          // else: Sales Person user with no salesPerson record (e.g., Vandita)
          // — show ALL quotations, no filtering applied
        }

        // 3. Search Logic
        if (!universalSearchTerm) return true;
        const term = universalSearchTerm.toLowerCase();
        return String(q.id).includes(term)
          || getCustomerName(q.customerId).toLowerCase().includes(term)
          || q.contactPerson.toLowerCase().includes(term)
          || getSalesPersonName(q.salesPersonId).toLowerCase().includes(term)
          || q.status.toLowerCase().includes(term)
          || q.contactNumber.toLowerCase().includes(term);
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'id': comparison = a.id - b.id; break;
          case 'quotationDate': comparison = new Date(a.quotationDate).getTime() - new Date(b.quotationDate).getTime(); break;
          case 'customer': comparison = getCustomerName(a.customerId).localeCompare(getCustomerName(b.customerId)); break;
          case 'contactPerson': comparison = a.contactPerson.localeCompare(b.contactPerson); break;
          case 'salesPerson': comparison = getSalesPersonName(a.salesPersonId).localeCompare(getSalesPersonName(b.salesPersonId)); break;
          case 'totalAmount': comparison = calculateTotalAmount(a.details) - calculateTotalAmount(b.details); break;
          case 'status': comparison = a.status.localeCompare(b.status); break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [quotations, universalSearchTerm, customerMap, salesPersons, sortBy, sortOrder, quotationFilter, userRole, currentUser]);

  useEffect(() => {
    setSelectedQuotationIds(new Set());
  }, [filteredAndSortedQuotations]);

  const handleAddNew = () => { setEditingQuotationId(null); setView('quotation-form'); };
  const handleEdit = (id: number) => {
    setEditingQuotationId(id);
    // Add ID to URL so a refresh keeps the user on this quotation
    const url = new URL(window.location.href);
    url.searchParams.set('id', String(id));
    window.history.pushState({}, '', url);
    setView('quotation-form');
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure?")) {
      await setQuotations(prev => (prev || []).filter(q => q.id !== id));
    }
  }
  const handleCommentChange = async (id: number, newComment: string) => {
    try {
      await setQuotations(prev => (prev || []).map(q => q.id === id ? { ...q, comments: newComment } : q))
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update comment.');
      console.error('Failed to update comment:', error);
    }
  };

  const handleStatusChange = async (id: number, newStatus: QuotationStatus) => {
    try {
      await setQuotations(prev => (prev || []).map(q => q.id === id ? { ...q, status: newStatus } : q))
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update status.');
      console.error('Failed to update status:', error);
    }
  };

  const handleExport = () => {
    if (!filteredAndSortedQuotations || filteredAndSortedQuotations.length === 0) { alert("No data to export."); return; }
    const dataToExport = filteredAndSortedQuotations.flatMap(q => {
      const quotationTotal = calculateTotalAmount(q.details);
      return (q.details || []).map(item => {
        const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
        return {
          'Quotation ID': getQuotationDisplayNumber(q, quotations), 'Date': new Date(q.quotationDate).toLocaleDateString(), 'Customer': getCustomerName(q.customerId), 'Contact Person': q.contactPerson, 'Contact No': q.contactNumber, 'Sales Person': getSalesPersonName(q.salesPersonId), 'Status': q.status, 'Total Amount': quotationTotal,
          'Part No': item.partNo, 'Description': item.description, 'MOQ': item.moq, 'REQ': item.req, 'Price Source': item.priceSource, 'Base Price': item.price, 'Discount %': item.discount, 'Unit Price': unitPrice, 'Item Amount': unitPrice * item.moq, 'Stock Status': item.stockStatus,
        };
      });
    });
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Quotations");
    XLSX.writeFile(wb, "Quotations_Export.xlsx");
  };

  const handleWhatsAppShare = (q: Quotation) => {
    const totalValue = calculateTotalAmount(q.details);
    const appUrl = `${window.location.origin}${window.location.pathname}?id=${q.id}`;

    const message =
      `*Quotation Details*\n` +
      `QTN No: ${getQuotationDisplayNumber(q, quotations)}\n` +
      `Date: ${q.quotationDate}\n` +
      `Customer: ${getCustomerName(q.customerId)}\n` +
      `Contact: ${q.contactPerson} (${q.contactNumber})\n` +
      `Value: ₹${totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}\n` +
      `Link: ${appUrl}`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  const handleSelectOne = (id: number) => {
    setSelectedQuotationIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(filteredAndSortedQuotations.map(q => q.id));
      setSelectedQuotationIds(allIds);
    } else {
      setSelectedQuotationIds(new Set());
    }
  };

  const handleBulkStatusChange = async (status: QuotationStatus) => {
    if (selectedQuotationIds.size === 0) return;
    if (window.confirm(`Are you sure you want to change the status of ${selectedQuotationIds.size} quotation(s) to "${status}"?`)) {
      await setQuotations(prev =>
        (prev || []).map(q =>
          selectedQuotationIds.has(q.id) ? { ...q, status: status } : q
        )
      );
      setSelectedQuotationIds(new Set());
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

  const isAllSelected = selectedQuotationIds.size > 0 && selectedQuotationIds.size === filteredAndSortedQuotations.length;
  const isCommentEditable = userRole === 'Admin' || userRole === 'Sales Person';
  const canEdit = userRole === 'Admin' || userRole === 'Sales Person';

  const SortableHeader: React.FC<{ title: string; sortKey: SortByType; className?: string }> = ({ title, sortKey, className = '' }) => (
    <th className={`px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${className}`} onClick={() => handleSort(sortKey)}>
      <div className="flex items-center gap-1">
        <span>{title}</span>
        {sortBy === sortKey && <span className="text-indigo-600 text-[10px]">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
      </div>
    </th>
  );

  const getInitials = (name: string) => name.charAt(0).toUpperCase() || '?';
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-gradient-to-br from-amber-400 to-orange-500 text-white border-white shadow-md',
      'bg-gradient-to-br from-blue-400 to-indigo-600 text-white border-white shadow-md',
      'bg-gradient-to-br from-emerald-400 to-teal-600 text-white border-white shadow-md',
      'bg-gradient-to-br from-indigo-400 to-purple-600 text-white border-white shadow-md',
      'bg-gradient-to-br from-rose-400 to-pink-600 text-white border-white shadow-md',
      'bg-gradient-to-br from-fuchsia-400 to-purple-600 text-white border-white shadow-md',
      'bg-gradient-to-br from-cyan-400 to-blue-600 text-white border-white shadow-md'
    ];
    const sum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[sum % colors.length];
  };

  const filterDescription = useMemo(() => {
    if (!quotationFilter) return '';
    const { customerIds, status } = quotationFilter;
    let desc = "Showing ";
    desc += status ? `'${status}' quotations ` : "all quotations ";
    if (customerIds && customerIds.length > 0) {
      const customerName = customerIds.length === 1 ? getCustomerName(customerIds[0]) : '';
      desc += customerIds.length === 1 ? `for ${customerName}` : `for ${customerIds.length} customers`;
    }
    return desc + ".";
  }, [quotationFilter, customerMap]);

  if (quotations === null || salesPersons === null || isLoadingCustomers) return <div className="bg-white p-6 rounded-lg shadow-md text-center text-black">Loading...</div>;

  return (
    <div className="bg-white/90 backdrop-blur-xl p-4 md:p-6 rounded-2xl shadow-xl border border-white relative overflow-hidden ring-1 ring-slate-900/5">
      {/* Decorative gradient blobs */}
      <div className="absolute top-0 right-0 w-[40rem] h-[40rem] -mr-40 -mt-40 bg-gradient-to-br from-indigo-400/20 to-fuchsia-400/20 blur-3xl rounded-full pointer-events-none z-0"></div>
      <div className="absolute bottom-0 left-0 w-[40rem] h-[40rem] -ml-40 -mb-40 bg-gradient-to-tr from-emerald-400/20 to-cyan-400/20 blur-3xl rounded-full pointer-events-none z-0"></div>
      
      <div className="relative z-10">
        <div className="flex flex-wrap gap-4 justify-between items-center pb-4 border-b border-slate-200/60 mb-2">
          <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 tracking-tight">Quotations</h2>
          <div className="flex items-center gap-3 flex-grow sm:flex-grow-0 sm:w-auto w-full text-xs">
          <div className="relative flex-grow">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2">
              <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none">
                <path d="M21 21L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                <path d="M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </span>
            <input
              type="text"
              id="universalSearch"
              className="block w-full pl-8 pr-2 py-1 border border-slate-300 rounded-md leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs text-black"
              placeholder="Search..."
              value={universalSearchTerm}
              onChange={(e) => setUniversalSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={handleExport} className="inline-flex items-center gap-1 justify-center px-2 py-1 border border-transparent text-xs font-semibold rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 hidden md:inline-flex">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            <span>Export</span>
          </button>
          {/* NEW BUTTON VISIBILITY: Only Admin or current Sales Person can create new */}
          {(userRole === 'Admin' || userRole === 'Sales Person') && (
            <button onClick={handleAddNew} className="inline-flex items-center gap-1 justify-center px-2 py-1 border border-transparent text-xs font-semibold rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
              <span>New</span>
            </button>
          )}
        </div>
      </div>

      {quotationFilter && (
        <div className="text-xs text-black mt-2 flex items-center gap-2 bg-slate-50 p-1.5 rounded-md" role="alert">
          <span className="font-medium">Filter:</span>
          <span>{filterDescription}</span>
          {onBackToCustomers && <button onClick={onBackToCustomers} className="text-blue-600 hover:underline font-semibold ml-auto">Back</button>}
        </div>
      )}

      {selectedQuotationIds.size > 0 && (
        <div className="my-2 p-2 bg-blue-50 border border-blue-200 rounded-lg flex flex-wrap items-center gap-2 text-xs">
          <div className="font-semibold text-blue-800">
            {selectedQuotationIds.size} selected.
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-medium text-black">Set status:</span>
            {QUOTATION_STATUSES.map(status => (
              <button
                key={status}
                onClick={() => handleBulkStatusChange(status)}
                className={`px-2 py-0.5 font-semibold rounded-md transition-colors ${getStatusClass(status)} hover:opacity-80`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mobile Card View */}
      <div className="block md:hidden mt-2 space-y-3 pb-8">
        {filteredAndSortedQuotations.map(q => {
          const customerName = getCustomerName(q.customerId);
          return (
            <div key={q.id} className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-4 shadow-sm transition-all">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 pr-2">
                  <div className="flex items-center gap-2 mb-1.5 align-middle">
                    <div className="text-sm font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md cursor-pointer hover:bg-indigo-100 transition-colors" onClick={() => handleEdit(q.id)}>
                      {getQuotationDisplayNumber(q, quotations)}
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md">{new Date(q.quotationDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-1 pl-0.5">
                    <div className={`h-6 w-6 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm ${getAvatarColor(customerName)}`}>
                      {getInitials(customerName)}
                    </div>
                    <div className="text-sm font-bold text-slate-800 leading-tight">{customerName}</div>
                  </div>
                  <div className="text-xs text-slate-600 font-medium pl-[34px]">{q.contactPerson}</div>
                  <div className="text-[10.px] text-slate-400 font-medium pl-[34px]">{q.contactNumber}</div>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-2">
                  <div className="text-sm font-black text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
                    {calculateTotalAmount(q.details).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                  </div>
                  <div className="relative inline-block w-full max-w-[120px]">
                    {canEdit ? (
                      <>
                        <select
                          value={q.status}
                          onChange={(e) => handleStatusChange(q.id, e.target.value as QuotationStatus)}
                          onClick={(e) => e.stopPropagation()}
                          className={`w-full appearance-none pl-3 pr-6 py-1 text-[10px] uppercase tracking-wide font-black rounded-md border shadow-sm cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors ${getStatusClass(q.status)}`}
                          style={{ borderWidth: '1px' }}
                        >
                          {QUOTATION_STATUSES.map(status => (
                            <option key={status} value={status} className="bg-white text-slate-800 font-semibold py-1">
                              {status}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 opacity-60">
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </div>
                      </>
                    ) : (
                      <div className={`text-[10px] text-center px-2.5 py-1 uppercase tracking-wide rounded-md border shadow-sm font-black w-full ${getStatusClass(q.status)}`}>{q.status}</div>
                    )}
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md mt-1 border border-slate-100 uppercase tracking-widest">{getSalesPersonName(q.salesPersonId)}</div>
                </div>
              </div>

              {/* Comment Section for Mobile */}
              <div className="border-t border-slate-100 pt-3 mt-1">
                <div className="flex justify-between items-center mb-1">
                  {isCommentEditable ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleCommentSection(q.id); }}
                      className="text-[11px] text-indigo-600 font-bold flex items-center gap-1 hover:text-indigo-800 transition-colors uppercase tracking-wider"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                      {q.comments ? 'Edit Comment' : 'Add Comment'}
                    </button>
                  ) : (
                    q.comments && <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1 uppercase tracking-wider"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>Comment</span>
                  )}
                </div>

                {/* Comment Input / Display */}
                {(openCommentIds.has(q.id) && isCommentEditable) ? (
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    <textarea
                      defaultValue={q.comments || ''}
                      onBlur={(e) => handleCommentChange(q.id, e.target.value)}
                      className="w-full p-2.5 text-xs font-medium border border-indigo-200 rounded-lg bg-indigo-50/30 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 placeholder-slate-400"
                      rows={2}
                      placeholder="Type your comment..."
                      autoFocus
                    />
                  </div>
                ) : (
                  q.comments && (
                    <div className="mt-1.5 text-xs text-slate-700 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      {q.comments}
                    </div>
                  )
                )}
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-3">
                <button onClick={() => handleWhatsAppShare(q)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[11px] rounded-lg transition-colors uppercase tracking-wider">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z" />
                  </svg>
                  Share
                </button>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(q.id)} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-[11px] rounded-lg transition-colors uppercase tracking-wider">
                    {canEdit ? 'Edit' : 'View'}
                  </button>
                  {userRole === 'Admin' && <button onClick={() => handleDelete(q.id)} className="px-3 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-[11px] rounded-lg transition-colors uppercase tracking-wider">Delete</button>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white/60 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200/60 overflow-hidden mt-6">
        <div className="overflow-x-auto">
          {filteredAndSortedQuotations.length > 0 ? (
            <table className="min-w-full divide-y divide-slate-200/60">
              <thead className="bg-gradient-to-r from-slate-50 to-indigo-50/40 border-b-2 border-slate-200/60">
                <tr>
                  <th className="px-4 py-3 w-10 text-center">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <SortableHeader title="ID" sortKey="id" className="w-16" />
                  <SortableHeader title="Date" sortKey="quotationDate" />
                  <SortableHeader title="Customer" sortKey="customer" />
                  <SortableHeader title="Contact" sortKey="contactPerson" />
                  <SortableHeader title="Sales Person" sortKey="salesPerson" />
                  <SortableHeader title="Amount" sortKey="totalAmount" className="text-right" />
                  <SortableHeader title="Status" sortKey="status" />
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Comments</th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white/40 divide-y divide-slate-100/60">
                {filteredAndSortedQuotations.map(q => {
                  const isSelected = selectedQuotationIds.has(q.id);
                  const customerName = getCustomerName(q.customerId);
                  return (
                    <tr key={q.id} className={`${isSelected ? 'bg-indigo-50/80 shadow-inner' : 'hover:bg-white/80 hover:shadow-sm'} transition-all duration-300 group`}>
                      <td className="px-4 py-3 text-center align-middle">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          checked={isSelected}
                          onChange={() => handleSelectOne(q.id)}
                          aria-label={`Select quotation ${q.id}`}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-bold text-indigo-600 text-xs">{getQuotationDisplayNumber(q, quotations)}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-[11px] font-medium">
                        {new Date(q.quotationDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={`h-6 w-6 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm ${getAvatarColor(customerName)}`}>
                            {getInitials(customerName)}
                          </div>
                          <div className="font-bold text-slate-800 text-xs truncate max-w-[200px]" title={customerName}>
                            {customerName}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-700 text-xs truncate max-w-[140px]" title={q.contactPerson}>{q.contactPerson}</div>
                        <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                          {q.contactNumber}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 text-xs font-medium">
                        {getSalesPersonName(q.salesPersonId)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="font-bold text-slate-800 text-xs bg-slate-100 inline-block px-2 py-1 rounded-lg">
                          {calculateTotalAmount(q.details).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {canEdit ? (
                          <div className="relative inline-block w-full max-w-[130px]">
                            <div className={`absolute inset-0 pointer-events-none flex items-center px-3 py-1 rounded-md border text-[10px] font-bold ${getStatusClass(q.status)}`}>
                              {q.status}
                            </div>
                            <select
                              value={q.status}
                              onChange={(e) => handleStatusChange(q.id, e.target.value as QuotationStatus)}
                              onClick={(e) => e.stopPropagation()}
                              className="relative w-full appearance-none pl-3 pr-6 py-1 text-[10px] leading-4 font-bold rounded-md border shadow-sm cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors bg-transparent text-transparent"
                              style={{ borderWidth: '1px' }}
                              aria-label={`Change status`}
                            >
                              {QUOTATION_STATUSES.map(status => (
                                <option key={status} value={status} className="bg-white text-slate-800 font-semibold py-1">
                                  {status}
                                </option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 opacity-60">
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </div>
                          </div>
                        ) : (
                          <span className={`text-[10px] px-2.5 py-1 rounded-md border font-bold inline-block shadow-sm ${getStatusClass(q.status)}`}>{q.status}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-800 max-w-[140px]">
                        <input
                          type="text"
                          defaultValue={q.comments || ''}
                          onBlur={(e) => handleCommentChange(q.id, e.target.value)}
                          onChange={() => { }}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                          className="w-full px-2 py-1 border border-transparent hover:border-slate-200 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 rounded-md text-[11px] bg-transparent hover:bg-slate-50 focus:bg-white transition-all outline-none truncate placeholder-slate-300"
                          placeholder="Add comment..."
                          disabled={!isCommentEditable}
                          title={q.comments || ''}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end space-x-1.5 opacity-60 hover:opacity-100 transition-opacity">
                          <button onClick={() => handleWhatsAppShare(q)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors" title="Share via WhatsApp">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z" />
                            </svg>
                          </button>
                          <button onClick={() => handleEdit(q.id)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors" title={canEdit ? 'Edit' : 'View'}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                              <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                            </svg>
                          </button>
                          {userRole === 'Admin' && (
                            <button onClick={() => handleDelete(q.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors" title="Delete">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="bg-slate-100 text-slate-400 p-4 rounded-full mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="text-slate-500 font-bold text-sm tracking-wide">{quotations.length > 0 ? 'No quotations match your filters.' : 'No quotations found.'}</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};
