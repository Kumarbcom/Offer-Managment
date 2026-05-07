
import React, { useState, useMemo, useEffect } from 'react';
import type { Quotation, SalesPerson, QuotationStatus, User } from '../types';
import { QUOTATION_STATUSES } from '../constants';
import { getCustomersByIds } from '../supabase';
import { generateFormattedQuotationNumber } from '../utils/quotationNumber';

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

  const userRole = currentUser.role;

  useEffect(() => {
    if (quotations) {
      const customerIdsToFetch = [...new Set(quotations.map(q => q.customerId))]
        .filter((id): id is number => typeof id === 'number' && id > 0 && !customerMap.has(id));
      
      if (quotationFilter?.customerIds) {
          quotationFilter.customerIds.forEach(id => {
              if(!customerMap.has(id) && !customerIdsToFetch.includes(id)) {
                  customerIdsToFetch.push(id);
              }
          });
      }

      if (customerIdsToFetch.length > 0) {
        setIsLoadingCustomers(true);
        getCustomersByIds(customerIdsToFetch).then(customers => {
          setCustomerMap(prevMap => {
            const newMap = new Map(prevMap);
            customers.forEach(c => newMap.set(c.id, c.name));
            return newMap;
          });
          setIsLoadingCustomers(false);
        }).catch(error => {
            console.error("QuotationManager: Failed to fetch customer names:", error);
            setIsLoadingCustomers(false);
        });
      } else {
        setIsLoadingCustomers(false);
      }
    }
  }, [quotations, customerMap, quotationFilter]);

  const getCustomerName = (id: number | null): string => {
    if (id === null) return 'N/A';
    return customerMap.get(id) || 'Loading...';
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

    let currentSalesPersonId: number | undefined;
    if (userRole === 'Sales Person') {
        currentSalesPersonId = salesPersons?.find(sp => sp.name === currentUser.name)?.id;
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
        if (userRole === 'Sales Person' && currentSalesPersonId !== undefined) {
             if (q.salesPersonId !== currentSalesPersonId) return false;
        }

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
    } catch(error) {
      alert(error instanceof Error ? error.message : 'Failed to update comment.');
    }
  };

  const handleStatusChange = async (id: number, newStatus: QuotationStatus) => {
    try {
      await setQuotations(prev => (prev || []).map(q => q.id === id ? { ...q, status: newStatus } : q))
    } catch(error) {
      alert(error instanceof Error ? error.message : 'Failed to update status.');
    }
  };
  
  const handleExport = () => {
    if(!filteredAndSortedQuotations || filteredAndSortedQuotations.length === 0) { alert("No data to export."); return; }
    const dataToExport = filteredAndSortedQuotations.flatMap(q => {
        const quotationTotal = calculateTotalAmount(q.details);
        return (q.details || []).map(item => {
            const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
            return {
                'Quotation No': generateFormattedQuotationNumber(q, quotations || []), 'Date': q.quotationDate, 'Customer': getCustomerName(q.customerId), 'Contact Person': q.contactPerson, 'Contact No': q.contactNumber, 'Sales Person': getSalesPersonName(q.salesPersonId), 'Status': q.status, 'Total Amount': quotationTotal,
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
      const message = `*Quotation Details*\nQTN No: ${generateFormattedQuotationNumber(q, quotations || [])}\nDate: ${q.quotationDate}\nCustomer: ${getCustomerName(q.customerId)}\nValue: ₹${totalValue.toLocaleString('en-IN')}\nLink: ${appUrl}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleSelectOne = (id: number) => {
    setSelectedQuotationIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      return newSet;
    });
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedQuotationIds(new Set(filteredAndSortedQuotations.map(q => q.id)));
    else setSelectedQuotationIds(new Set());
  };

  const handleBulkStatusChange = async (status: QuotationStatus) => {
    if (selectedQuotationIds.size === 0) return;
    if (window.confirm(`Set status to "${status}" for ${selectedQuotationIds.size} item(s)?`)) {
      await setQuotations(prev => (prev || []).map(q => selectedQuotationIds.has(q.id) ? { ...q, status: status } : q));
      setSelectedQuotationIds(new Set());
    }
  };

  const toggleCommentSection = (id: number) => {
    setOpenCommentIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        return newSet;
    });
  };

  const isAllSelected = selectedQuotationIds.size > 0 && selectedQuotationIds.size === filteredAndSortedQuotations.length;
  const isCommentEditable = userRole === 'Admin' || userRole === 'Sales Person';
  const canEdit = userRole === 'Admin' || userRole === 'Sales Person';

  const SortableHeader: React.FC<{ title: string; sortKey: SortByType; className?: string }> = ({ title, sortKey, className = '' }) => (
    <th className={`px-2 py-1 text-left text-xs font-semibold text-black uppercase tracking-wider cursor-pointer hover:bg-slate-100 ${className}`} onClick={() => handleSort(sortKey)}>
        <div className="flex items-center"><span>{title}</span>{sortBy === sortKey && <span className="ml-1">{sortOrder === 'asc' ? '▲' : '▼'}</span>}</div>
    </th>
  );
  
  if (quotations === null || salesPersons === null || isLoadingCustomers) return <div className="bg-white p-6 rounded-lg shadow-md text-center text-black">Loading...</div>;

  return (
    <div className="bg-white p-2 md:p-3 rounded-lg shadow-sm border border-slate-200">
       <div className="flex flex-wrap gap-2 justify-between items-center pb-2 border-b border-slate-200">
        <h2 className="text-lg font-bold text-black">Quotations</h2>
        <div className="flex items-center gap-2 flex-grow sm:flex-grow-0 sm:w-auto w-full text-xs">
            <div className="relative flex-grow">
                <span className="absolute inset-y-0 left-0 flex items-center pl-2">
                    <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none"><path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                </span>
                <input type="text" className="block w-full pl-8 pr-2 py-1 border border-slate-300 rounded-md bg-white text-xs text-black" placeholder="Search..." value={universalSearchTerm} onChange={(e) => setUniversalSearchTerm(e.target.value)} />
            </div>
            <button onClick={handleExport} className="inline-flex items-center gap-1 px-2 py-1 bg-teal-600 text-white rounded-md text-xs font-semibold">Export</button>
            {(userRole === 'Admin' || userRole === 'Sales Person') && <button onClick={handleAddNew} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded-md text-xs font-semibold">New</button>}
        </div>
      </div>
      
      {quotationFilter && (
        <div className="text-xs text-black mt-2 flex items-center gap-2 bg-slate-50 p-1.5 rounded-md">
            <span className="font-medium">Filter active.</span>
            {onBackToCustomers && <button onClick={onBackToCustomers} className="text-blue-600 hover:underline font-semibold ml-auto">Back</button>}
        </div>
      )}

      {selectedQuotationIds.size > 0 && (
        <div className="my-2 p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-xs">
          <div className="font-semibold text-blue-800">{selectedQuotationIds.size} selected.</div>
          <div className="flex gap-1">
            {QUOTATION_STATUSES.map(status => <button key={status} onClick={() => handleBulkStatusChange(status)} className={`px-2 py-0.5 font-semibold rounded-md ${getStatusClass(status)}`}>{status}</button>)}
          </div>
        </div>
      )}
      
      {/* Mobile Card View */}
      <div className="block md:hidden mt-2 space-y-2">
         {filteredAndSortedQuotations.map(q => (
             <div key={q.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                 <div className="flex justify-between items-start mb-2">
                    <div>
                         <div className="text-sm font-bold text-indigo-600" onClick={() => handleEdit(q.id)}>{generateFormattedQuotationNumber(q, quotations || [])}</div>
                         <div className="text-sm font-semibold text-black">{getCustomerName(q.customerId)}</div>
                         <div className="text-xs text-slate-500">{q.quotationDate}</div>
                    </div>
                    <div className="text-right">
                         <div className="text-sm font-bold text-black">{calculateTotalAmount(q.details).toLocaleString('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 0})}</div>
                         <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold mt-1 inline-block ${getStatusClass(q.status)}`}>{q.status}</div>
                    </div>
                 </div>
                 <div className="flex justify-end gap-3 border-t pt-2 mt-2">
                     <button onClick={() => handleEdit(q.id)} className="text-indigo-600 font-semibold text-xs">Edit</button>
                     {userRole === 'Admin' && <button onClick={() => handleDelete(q.id)} className="text-rose-600 font-semibold text-xs">Delete</button>}
                 </div>
             </div>
         ))}
      </div>

      {/* Desktop Table View */}
      <div className="overflow-x-auto mt-2 -mx-2 hidden md:block">
        <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
                <tr>
                    <th className="px-2 py-1 w-8"><input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="h-3 w-3 rounded border-slate-300" /></th>
                    <SortableHeader title="Quotation No" sortKey="id" />
                    <SortableHeader title="Date" sortKey="quotationDate" />
                    <SortableHeader title="Customer" sortKey="customer" />
                    <SortableHeader title="Contact" sortKey="contactPerson" />
                    <SortableHeader title="Sales Person" sortKey="salesPerson" />
                    <SortableHeader title="Amount" sortKey="totalAmount" className="text-right" />
                    <SortableHeader title="Status" sortKey="status" />
                    <th className="px-2 py-1 text-left text-xs font-semibold text-black uppercase">Comments</th>
                    <th className="px-2 py-1 text-right text-xs font-semibold text-black uppercase">Actions</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
                {filteredAndSortedQuotations.map(q => {
                  const isSelected = selectedQuotationIds.has(q.id);
                  return (
                    <tr key={q.id} className={`${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'} transition-colors text-xs`}>
                        <td className="px-2 py-1"><input type="checkbox" checked={isSelected} onChange={() => handleSelectOne(q.id)} className="h-3 w-3 rounded border-slate-300" /></td>
                        <td className="px-2 py-1 font-bold text-black">{generateFormattedQuotationNumber(q, quotations || [])}</td>
                        <td className="px-2 py-1 text-black">
                            {(() => {
                                const parts = q.quotationDate.split('-');
                                return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : q.quotationDate;
                            })()}
                        </td>
                        <td className="px-2 py-1 font-semibold text-black truncate max-w-[150px]" title={getCustomerName(q.customerId)}>{getCustomerName(q.customerId)}</td>
                        <td className="px-2 py-1"><div className="font-medium text-black">{q.contactPerson}</div><div className="text-[10px] text-slate-500">{q.contactNumber}</div></td>
                        <td className="px-2 py-1 text-black">{getSalesPersonName(q.salesPersonId)}</td>
                        <td className="px-2 py-1 font-bold text-black text-right">{calculateTotalAmount(q.details).toLocaleString('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 0})}</td>
                        <td className="px-2 py-1">
                            <select value={q.status} onChange={(e) => handleStatusChange(q.id, e.target.value as QuotationStatus)} className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full border-0 focus:ring-1 ${getStatusClass(q.status)}`}>
                                {QUOTATION_STATUSES.map(s => <option key={s} value={s} className="bg-white text-black font-semibold">{s}</option>)}
                            </select>
                        </td>
                        <td className="px-2 py-1 truncate max-w-[120px]"><input type="text" defaultValue={q.comments || ''} onBlur={(e) => handleCommentChange(q.id, e.target.value)} className="w-full bg-transparent border-0 text-[10px] text-black" placeholder="..." /></td>
                        <td className="px-2 py-1 text-right">
                            <div className="flex justify-end gap-2">
                                <button onClick={() => handleWhatsAppShare(q)} className="text-green-600 hover:scale-110"><svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/></svg></button>
                                <button onClick={() => handleEdit(q.id)} className="text-indigo-600 hover:scale-110"><svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg></button>
                                {userRole === 'Admin' && <button onClick={() => handleDelete(q.id)} className="text-rose-600 hover:scale-110"><svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg></button>}
                            </div>
                        </td>
                    </tr>
                  );
                })}
            </tbody>
        </table>
      </div>
    </div>
  );
};
