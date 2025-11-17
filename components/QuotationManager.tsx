import React, { useState, useMemo, useEffect } from 'react';
import type { Quotation, Customer, SalesPerson, QuotationStatus, UserRole } from '../types';
import { QUOTATION_STATUSES } from '../constants';

declare var XLSX: any;

interface QuotationManagerProps {
  quotations: Quotation[] | null;
  customers: Customer[] | null;
  salesPersons: SalesPerson[] | null;
  setEditingQuotationId: (id: number | null) => void;
  setView: (view: 'quotation-form') => void;
  setQuotations: (value: React.SetStateAction<Quotation[]>) => Promise<void>;
  userRole: UserRole;
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

export const QuotationManager: React.FC<QuotationManagerProps> = ({ quotations, customers, salesPersons, setEditingQuotationId, setView, setQuotations, userRole, quotationFilter, onBackToCustomers }) => {
  const [universalSearchTerm, setUniversalSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortByType>('id');
  const [sortOrder, setSortOrder] = useState<SortOrderType>('desc');
  const [selectedQuotationIds, setSelectedQuotationIds] = useState<Set<number>>(new Set());

  const getCustomerName = (id: number | '') => customers?.find(c => c.id === id)?.name || 'N/A';
  const getSalesPersonName = (id: number | '') => salesPersons?.find(sp => sp.id === id)?.name || 'N/A';
  
  const calculateTotalAmount = (details: Quotation['details']): number => {
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
    const preFilteredQuotations = quotationFilter
      ? quotations.filter(q => {
          const customerMatch = !quotationFilter.customerIds || quotationFilter.customerIds.includes(q.customerId as number);
          const statusMatch = !quotationFilter.status || q.status === quotationFilter.status;
          return customerMatch && statusMatch;
        })
      : quotations;
    return preFilteredQuotations
      .filter(q => {
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
  }, [quotations, universalSearchTerm, customers, salesPersons, sortBy, sortOrder, quotationFilter]);

  useEffect(() => {
    setSelectedQuotationIds(new Set());
  }, [filteredAndSortedQuotations]);

  const handleAddNew = () => { setEditingQuotationId(null); setView('quotation-form'); };
  const handleEdit = (id: number) => { setEditingQuotationId(id); setView('quotation-form'); };
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
      console.error('Failed to update comment:', error);
    }
  };
  
  const handleExport = () => {
    if(!filteredAndSortedQuotations || filteredAndSortedQuotations.length === 0) { alert("No data to export."); return; }
    const dataToExport = filteredAndSortedQuotations.flatMap(q => {
        const quotationTotal = calculateTotalAmount(q.details);
        return q.details.map(item => {
            const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
            return {
                'Quotation ID': q.id, 'Date': new Date(q.quotationDate).toLocaleDateString(), 'Customer': getCustomerName(q.customerId), 'Contact Person': q.contactPerson, 'Contact No': q.contactNumber, 'Sales Person': getSalesPersonName(q.salesPersonId), 'Status': q.status, 'Total Amount': quotationTotal,
                'Part No': item.partNo, 'Description': item.description, 'MOQ': item.moq, 'REQ': item.req, 'Price Source': item.priceSource, 'Base Price': item.price, 'Discount %': item.discount, 'Unit Price': unitPrice, 'Item Amount': unitPrice * item.moq, 'Stock Status': item.stockStatus,
            };
        });
    });
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Quotations");
    XLSX.writeFile(wb, "Quotations_Export.xlsx");
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

  const isAllSelected = selectedQuotationIds.size > 0 && selectedQuotationIds.size === filteredAndSortedQuotations.length;
  const isCommentEditable = userRole === 'Admin' || userRole === 'Sales Person';
  const canEdit = userRole === 'Admin' || userRole === 'Sales Person';

  const SortableHeader: React.FC<{ title: string; sortKey: SortByType; className?: string }> = ({ title, sortKey, className = '' }) => (
    <th className={`px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 ${className}`} onClick={() => handleSort(sortKey)}>
        <div className="flex items-center"><span>{title}</span>{sortBy === sortKey && <span className="ml-1 text-slate-800">{sortOrder === 'asc' ? '▲' : '▼'}</span>}</div>
    </th>
  );
  
  const filterDescription = useMemo(() => {
    if (!quotationFilter) return '';
    const { customerIds, status } = quotationFilter;
    let desc = "Showing ";
    desc += status ? `'${status}' quotations ` : "all quotations ";
    if (customerIds && customerIds.length > 0) desc += customerIds.length === 1 ? `for ${customers?.find(c => c.id === customerIds[0])?.name}` : `for ${customerIds.length} customers`;
    return desc + ".";
  }, [quotationFilter, customers]);

  if (quotations === null || customers === null || salesPersons === null) return <div className="bg-white p-6 rounded-lg shadow-md text-center">Loading quotations...</div>;

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
       <div className="flex flex-wrap gap-4 justify-between items-center pb-3 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-800">Quotations</h2>
        <div className="flex items-center gap-2 flex-grow sm:flex-grow-0 sm:w-auto w-full">
            <div className="relative flex-grow">
                <span className="absolute inset-y-0 left-0 flex items-center pl-2">
                    <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none">
                        <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                </span>
                <input 
                    type="text" 
                    id="universalSearch" 
                    className="block w-full pl-9 pr-3 py-1 border border-slate-300 rounded-md leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                    placeholder="Search..." 
                    value={universalSearchTerm} 
                    onChange={(e) => setUniversalSearchTerm(e.target.value)}
                />
            </div>
            <button onClick={handleExport} className="inline-flex items-center gap-2 justify-center px-3 py-1.5 border border-transparent text-sm font-semibold rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                <span>Export</span>
            </button>
            {userRole === 'Admin' && (
                <button onClick={handleAddNew} className="inline-flex items-center gap-2 justify-center px-3 py-1.5 border border-transparent text-sm font-semibold rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    <span>Add New</span>
                </button>
            )}
        </div>
      </div>
      
      {quotationFilter && (
        <div className="text-sm text-slate-600 mt-2 flex items-center gap-4 bg-slate-50 p-2 rounded-md" role="alert">
            <span className="font-medium">Filter Applied:</span>
            <span>{filterDescription}</span>
            {onBackToCustomers && <button onClick={onBackToCustomers} className="text-blue-600 hover:underline font-semibold ml-auto">Back to Customers</button>}
        </div>
      )}

      {selectedQuotationIds.size > 0 && (
        <div className="my-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex flex-wrap items-center gap-4">
          <div className="font-semibold text-blue-800">
            {selectedQuotationIds.size} quotation{selectedQuotationIds.size > 1 ? 's' : ''} selected.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Change status to:</span>
            {QUOTATION_STATUSES.map(status => (
              <button
                key={status}
                onClick={() => handleBulkStatusChange(status)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${getStatusClass(status)} hover:opacity-80`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      )}
      
      <div className="overflow-x-auto mt-4 -mx-4">
        {filteredAndSortedQuotations.length > 0 ? (
            <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
                <tr>
                    <th className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                        aria-label="Select all quotations"
                      />
                    </th>
                    <SortableHeader title="ID" sortKey="id" className="w-16" />
                    <SortableHeader title="Date" sortKey="quotationDate" />
                    <SortableHeader title="Customer" sortKey="customer" />
                    <SortableHeader title="Contact Details" sortKey="contactPerson" />
                    <SortableHeader title="Sales Person" sortKey="salesPerson" />
                    <SortableHeader title="Amount" sortKey="totalAmount" className="text-right" />
                    <SortableHeader title="Status" sortKey="status" />
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Comments</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
                {filteredAndSortedQuotations.map(q => {
                  const isSelected = selectedQuotationIds.has(q.id);
                  return (
                    <tr key={q.id} className={`${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50/70'} text-sm`}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={isSelected}
                            onChange={() => handleSelectOne(q.id)}
                            aria-label={`Select quotation ${q.id}`}
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-600">{q.id}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-600">{new Date(q.quotationDate).toLocaleDateString()}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-800">{getCustomerName(q.customerId)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                            <div className="text-sm text-slate-800">{q.contactPerson}</div>
                            <div className="text-xs text-slate-500">{q.contactNumber}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-600">{getSalesPersonName(q.salesPersonId)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-600 text-right">{calculateTotalAmount(q.details).toLocaleString('en-IN', {style: 'currency', currency: 'INR'})}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(q.status)}`}>
                                {q.status}
                            </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-600 w-48">
                            <input 
                                type="text" 
                                value={q.comments || ''} 
                                onBlur={(e) => handleCommentChange(q.id, e.target.value)}
                                onChange={(e) => {
                                  // This is a controlled-uncontrolled component. We update on blur.
                                  // We only need to provide an onChange to avoid React warnings.
                                  // The state will be updated locally by the browser until blur.
                                }}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                defaultValue={q.comments || ''}
                                className="w-full p-1 border border-transparent hover:border-slate-300 focus:border-slate-300 rounded-md text-sm focus:outline-none disabled:bg-transparent disabled:border-transparent" 
                                placeholder="Add comment..." 
                                disabled={!isCommentEditable}
                            />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                                <button onClick={() => handleEdit(q.id)} className="text-slate-400 hover:text-blue-600 transition-colors" title={canEdit ? 'Edit' : 'View'}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                                        <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                                    </svg>
                                </button>
                                {userRole === 'Admin' && (
                                    <button onClick={() => handleDelete(q.id)} className="text-slate-400 hover:text-rose-600 transition-colors" title="Delete">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </td>
                    </tr>
                )})}
            </tbody>
            </table>
        ) : ( 
            <p className="text-slate-500 text-center py-8">{quotations.length > 0 ? 'No quotations match your search criteria.' : 'No quotations found.'}</p> 
        )}
      </div>
    </div>
  );
};