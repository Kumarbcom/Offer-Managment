import React, { useState, useMemo } from 'react';
import type { Quotation, Customer, SalesPerson, QuotationStatus, UserRole } from '../types';

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

export const QuotationManager: React.FC<QuotationManagerProps> = ({ quotations, customers, salesPersons, setEditingQuotationId, setView, setQuotations, userRole, quotationFilter, onBackToCustomers }) => {
  const [universalSearchTerm, setUniversalSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortByType>('id');
  const [sortOrder, setSortOrder] = useState<SortOrderType>('desc');

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

  const handleAddNew = () => { setEditingQuotationId(null); setView('quotation-form'); };
  const handleEdit = (id: number) => { setEditingQuotationId(id); setView('quotation-form'); };
  const handleDelete = async (id: number) => { if (window.confirm("Are you sure?") && quotations) await setQuotations(quotations.filter(q => q.id !== id)); }
  const handleCommentChange = async (id: number, newComment: string) => {
    if(!quotations) return;
    await setQuotations(quotations.map(q => q.id === id ? { ...q, comments: newComment } : q))
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

  const isCommentEditable = userRole === 'Admin' || userRole === 'Sales Person';
  const canEdit = userRole === 'Admin' || userRole === 'Sales Person';

  const SortableHeader: React.FC<{ title: string; sortKey: SortByType; className?: string }> = ({ title, sortKey, className = '' }) => (
    <th className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 ${className}`} onClick={() => handleSort(sortKey)}>
        <div className="flex items-center"><span>{title}</span>{sortBy === sortKey && <span className="ml-1 text-gray-900">{sortOrder === 'asc' ? '▲' : '▼'}</span>}</div>
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
    <div className="bg-white p-6 rounded-lg shadow-md">
      {quotationFilter && (
        <div className="bg-indigo-100 border-l-4 border-indigo-500 text-indigo-800 p-4 mb-4 rounded-md flex justify-between items-center" role="alert">
          <div><p className="font-bold">Filtered View</p><p className="text-sm">{filterDescription}</p></div>
          {onBackToCustomers && <button onClick={onBackToCustomers} className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-md transition duration-300 text-sm">Back to Customers</button>}
        </div>
      )}
      <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Manage Quotations</h2>
        <div className="flex items-center space-x-2">
            <button onClick={handleExport} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">Export</button>
            {userRole === 'Admin' && <button onClick={handleAddNew} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">Add New</button>}
        </div>
      </div>
      <div className="mb-4 pb-4 border-b border-gray-200"><div className="max-w-md"><label htmlFor="universalSearch" className="block text-sm font-medium text-gray-700 mb-1">Search Quotations</label><input type="text" id="universalSearch" className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md" placeholder="Search ID, Customer, Contact..." value={universalSearchTerm} onChange={(e) => setUniversalSearchTerm(e.target.value)}/></div></div>
      
      {filteredAndSortedQuotations.length > 0 ? (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr><SortableHeader title="ID" sortKey="id" /><SortableHeader title="Date" sortKey="quotationDate" /><SortableHeader title="Customer" sortKey="customer" /><SortableHeader title="Contact" sortKey="contactPerson" /><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact No</th><SortableHeader title="Sales Person" sortKey="salesPerson" /><SortableHeader title="Amount" sortKey="totalAmount" /><SortableHeader title="Status" sortKey="status" /><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comments</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th></tr></thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedQuotations.map(q => (<tr key={q.id} className="hover:bg-gray-50"><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{q.id}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(q.quotationDate).toLocaleDateString()}</td><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{getCustomerName(q.customerId)}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{q.contactPerson}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{q.contactNumber}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getSalesPersonName(q.salesPersonId)}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{calculateTotalAmount(q.details).toLocaleString('en-IN', {style: 'currency', currency: 'INR'})}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${q.status.includes('PO') ? 'bg-green-100 text-green-800' : q.status === 'Open' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>{q.status}</span></td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><input type="text" value={q.comments || ''} onChange={(e) => handleCommentChange(q.id, e.target.value)} className="w-full p-1 border border-gray-300 rounded-md shadow-sm text-sm" placeholder="Add comment..." disabled={!isCommentEditable}/></td><td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2"><button onClick={() => handleEdit(q.id)} className="text-indigo-600 hover:text-indigo-900">{canEdit ? 'Edit' : 'View'}</button>{userRole === 'Admin' && <button onClick={() => handleDelete(q.id)} className="text-red-600 hover:text-red-900">Delete</button>}</td></tr>))}
            </tbody></table>
        </div>
      ) : ( <p className="text-gray-500 text-center py-8">{quotations.length > 0 ? 'No quotations match search.' : 'No quotations found.'}</p> )}
    </div>
  );
};
