
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Customer, SalesPerson, Quotation, QuotationStatus, User } from '../types';
import { CustomerAddModal } from './CustomerAddModal';
import { QUOTATION_STATUSES } from '../constants';
import { getCustomersPaginated, upsertCustomer, deleteCustomer, addCustomersBatch } from '../supabase';
import { useDebounce } from '../hooks/useDebounce';

declare var XLSX: any;

interface CustomerManagerProps {
  salesPersons: SalesPerson[] | null;
  quotations: Quotation[] | null;
  onFilterQuotations: (filter: { customerIds?: number[], status?: QuotationStatus }) => void;
  currentUser: User;
}

type SortByType = 'id' | 'name' | 'city' | 'pincode' | 'salesPerson';
type SortOrderType = 'asc' | 'desc';

const PAGE_LIMIT = 50;

const calculateTotalAmount = (details: Quotation['details'] | undefined): number => {
    if (!details || !Array.isArray(details)) return 0;
    return details.reduce((total, item) => {
        const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
        return total + (unitPrice * item.moq);
    }, 0);
}
const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const statusColors: Record<string, { bg: string, text: string }> = {
    'Open': { bg: 'bg-blue-100', text: 'text-blue-700' },
    'PO received': { bg: 'bg-green-100', text: 'text-green-700' },
    'Partial PO Received': { bg: 'bg-teal-100', text: 'text-teal-700' },
    'Expired': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    'Lost': { bg: 'bg-rose-100', text: 'text-rose-700' },
    'Under Review': { bg: 'bg-indigo-100', text: 'text-indigo-700' },
    'Need Amendment': { bg: 'bg-purple-100', text: 'text-purple-700' },
};


export const CustomerManager: React.FC<CustomerManagerProps> = ({ salesPersons, quotations, onFilterQuotations, currentUser }) => {
  const [displayedCustomers, setDisplayedCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [selectedSalesPersonId, setSelectedSalesPersonId] = useState<'all' | number>('all');
  const [sortBy, setSortBy] = useState<SortByType>('id');
  const [sortOrder, setSortOrder] = useState<SortOrderType>('asc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const debouncedSearchCity = useDebounce(searchCity, 300);

  const totalPages = Math.ceil(totalCount / PAGE_LIMIT);

  const fetchCustomers = useCallback(async (page: number) => {
    setIsLoading(true);
    try {
        const offset = (page - 1) * PAGE_LIMIT;
        const result = await getCustomersPaginated({
            pageLimit: PAGE_LIMIT,
            startAfterDoc: offset,
            sortBy,
            sortOrder,
            filters: { 
                name: debouncedSearchTerm, 
                city: debouncedSearchCity,
                salesPersonId: selectedSalesPersonId === 'all' ? undefined : selectedSalesPersonId
            }
        });
        setDisplayedCustomers(result.customers);
        setTotalCount(result.count);
    } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to fetch customers');
    } finally {
        setIsLoading(false);
    }
  }, [sortBy, sortOrder, debouncedSearchTerm, debouncedSearchCity, selectedSalesPersonId]);
  
  useEffect(() => {
    setCurrentPage(1);
    fetchCustomers(1);
  }, [debouncedSearchTerm, debouncedSearchCity, sortBy, sortOrder, selectedSalesPersonId]);

  useEffect(() => {
    fetchCustomers(currentPage);
  }, [currentPage, fetchCustomers]);


  const getSalesPersonName = (id: number | null) => {
    if (id === null || !salesPersons) return 'N/A';
    return salesPersons.find(sp => sp.id === id)?.name || 'Unknown';
  };

  const allQuotationStats = useMemo(() => {
    const initialStats = {
      total: { count: 0, value: 0 },
      byStatus: QUOTATION_STATUSES.reduce((acc, status) => {
        acc[status] = { count: 0, value: 0 };
        return acc;
      }, {} as Record<QuotationStatus, { count: number; value: number }>)
    };

    if (!quotations) return initialStats;

    return quotations.reduce((stats, q) => {
      const value = calculateTotalAmount(q.details);
      stats.total.count++;
      stats.total.value += value;
      if (stats.byStatus[q.status]) {
        stats.byStatus[q.status].count++;
        stats.byStatus[q.status].value += value;
      }
      return stats;
    }, initialStats);
  }, [quotations]);

  const handleAddNew = () => {
    setCustomerToEdit(null);
    setIsModalOpen(true);
  };

  const handleEdit = (customer: Customer) => {
    setCustomerToEdit(customer);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
        try {
            await deleteCustomer(id);
            fetchCustomers(currentPage);
        } catch(error) {
            alert(error instanceof Error ? error.message : 'Failed to delete customer');
        }
    }
  };

  const handleSaveCustomer = async (customer: Customer) => {
    try {
        await upsertCustomer(customer);
        fetchCustomers(currentPage);
    } catch(error) {
        alert(error instanceof Error ? error.message : 'Failed to save customer');
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCustomerToEdit(null);
  };

  const handleDownloadTemplate = () => {
    const headers = ["id (for updates only)", "name", "address", "city", "pincode", "salesPersonId", "singleCoreDiscount", "multiCoreDiscount", "specialCableDiscount", "accessoriesDiscount"];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, "Customer_Upload_Template.xlsx");
  };

  const handleExport = () => {
      const dataToExport = displayedCustomers.map(c => ({
          id: c.id,
          name: c.name,
          address: c.address,
          city: c.city,
          pincode: c.pincode,
          salesPersonId: c.salesPersonId,
          singleCoreDiscount: c.discountStructure?.singleCore || 0,
          multiCoreDiscount: c.discountStructure?.multiCore || 0,
          specialCableDiscount: c.discountStructure?.specialCable || 0,
          accessoriesDiscount: c.discountStructure?.accessories || 0,
      }));
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Customers");
      XLSX.writeFile(wb, "Customers_Export.xlsx");
  };

  const handleUploadClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        handleFileUpload(file);
        event.target.value = '';
      }
  };

  const handleFileUpload = (file: File) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
          const data = e.target?.result;
          if (!data) return;

          setIsUploading(true);
          setUploadProgress('Reading and parsing file...');

          try {
              const workbook = XLSX.read(data, { type: 'array' });
              const sheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[sheetName];
              const json: any[] = XLSX.utils.sheet_to_json(worksheet);

              const lastIdResult = await getCustomersPaginated({ pageLimit: 1, startAfterDoc: 0, sortBy: 'id', sortOrder: 'desc', filters: {} });
              let lastId = lastIdResult.customers.length > 0 ? lastIdResult.customers[0].id : 0;
              
              const customersToUpsert: Customer[] = json.map(row => {
                  if (!row.name) return null;

                  const customer: Partial<Customer> = {
                      name: String(row.name),
                      address: String(row.address || ''),
                      city: String(row.city || ''),
                      pincode: String(row.pincode || ''),
                      salesPersonId: row.salesPersonId ? parseInt(String(row.salesPersonId), 10) : null,
                      discountStructure: {
                          singleCore: parseFloat(String(row.singleCoreDiscount)) || 0,
                          multiCore: parseFloat(String(row.multiCoreDiscount)) || 0,
                          specialCable: parseFloat(String(row.specialCableDiscount)) || 0,
                          accessories: parseFloat(String(row.accessoriesDiscount)) || 0,
                      }
                  };
                  
                  const idKey = Object.keys(row).find(key => key.toLowerCase().startsWith('id'));
                  const rowId = idKey ? row[idKey] : undefined;

                  if (rowId && !isNaN(parseInt(String(rowId), 10))) {
                      customer.id = parseInt(String(rowId), 10);
                  } else {
                      lastId++;
                      customer.id = lastId;
                  }

                  return customer as Customer;
              }).filter((c): c is Customer => c !== null);

              if (customersToUpsert.length > 0) {
                  setUploadProgress(`Upserting ${customersToUpsert.length} customers...`);
                  await addCustomersBatch(customersToUpsert);
                  alert(`${customersToUpsert.length} customers processed successfully!`);
                  fetchCustomers(1);
              } else {
                  alert('No valid customer data found in the file.');
              }
          } catch (error) {
              const errorMessage = error instanceof Error ? error.message : `An issue occurred during file processing.`;
              console.error("Error importing customers:", error);
              alert(`Failed to import customers.\n\nError: ${errorMessage}`);
          } finally {
              setIsUploading(false);
              setUploadProgress('');
          }
      };
      reader.onerror = (error) => {
          console.error("File reading error:", error);
          alert("Failed to read the file.");
          setIsUploading(false);
          setUploadProgress('');
      };
      reader.readAsArrayBuffer(file);
  };
  
  if (salesPersons === null || quotations === null) {
    return <div className="bg-white p-6 rounded-lg shadow-md text-center">Loading data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Overall Quotation Summary - Modern Gradient KPI Cards */}
      <div className="bg-gradient-to-r from-slate-50 via-white to-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <h3 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
            Overall Quotation Summary
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">Click card to filter</span>
        </div>
        
        <div className="flex overflow-x-auto gap-2.5 pb-1 scrollbar-thin">
            {/* Total Enquiries Hero Card */}
            <div
                onClick={() => onFilterQuotations({ })}
                className="cursor-pointer bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white px-3.5 py-2.5 rounded-xl shadow-md shadow-indigo-950/20 hover:shadow-lg hover:scale-[1.02] transition-all min-w-[145px] flex-shrink-0"
                title={`View all ${allQuotationStats.total.count} quotations`}
            >
                <div className="text-indigo-200 text-[10px] font-bold uppercase tracking-wider mb-0.5">Total enquiries</div>
                <div className="text-xl font-black text-white font-mono leading-tight tracking-tight">{allQuotationStats.total.count.toLocaleString()}</div>
                <div className="text-[11px] text-indigo-300 font-mono mt-0.5">{formatCurrency(allQuotationStats.total.value)}</div>
            </div>

            {QUOTATION_STATUSES.map(status => {
                const stats = allQuotationStats.byStatus[status];
                if (stats.count === 0) return null;
                const colors = statusColors[status];
                return (
                    <div
                        key={status}
                        onClick={() => onFilterQuotations({ status: status })}
                        className={`cursor-pointer ${colors?.bg || 'bg-slate-50'} px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all min-w-[140px] flex-shrink-0`}
                        title={`View ${stats.count} '${status}' quotations`}
                    >
                        <div className={`${colors?.text || 'text-slate-600'} text-[10px] font-bold uppercase tracking-wider mb-0.5 whitespace-nowrap`}>{status}</div>
                        <div className={`text-xl font-black ${colors?.text || 'text-slate-900'} font-mono leading-tight tracking-tight`}>{stats.count.toLocaleString()}</div>
                        <div className={`text-[11px] font-mono font-medium ${colors?.text || 'text-slate-500'} opacity-80 mt-0.5`}>{formatCurrency(stats.value)}</div>
                    </div>
                )
            })}
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
         <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Customers</h2>
              <span className="bg-indigo-50 text-indigo-700 font-mono text-xs font-bold px-2.5 py-0.5 rounded-full border border-indigo-100">
                {totalCount.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-wrap gap-2.5 text-sm items-center">
                <button
                    onClick={handleExport}
                    disabled={isUploading}
                    className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2 px-3.5 border border-slate-200/90 rounded-xl shadow-2xs hover:border-slate-300 transition-all disabled:opacity-50 cursor-pointer"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    Export
                </button>
                <button
                    onClick={handleDownloadTemplate}
                    disabled={isUploading}
                    className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2 px-3.5 border border-slate-200/90 rounded-xl shadow-2xs hover:border-slate-300 transition-all disabled:opacity-50 cursor-pointer"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Template
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls"/>
                <button
                    onClick={handleUploadClick}
                    disabled={isUploading}
                    className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2 px-3.5 border border-slate-200/90 rounded-xl shadow-2xs hover:border-slate-300 transition-all disabled:opacity-50 cursor-pointer"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                    {isUploading ? 'Uploading...' : 'Upload'}
                </button>
                <button
                    onClick={handleAddNew}
                    disabled={isUploading}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white font-bold py-2 px-4 rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add new
                </button>
            </div>
         </div>
         {isUploading && ( <div className="my-2 p-2.5 text-center text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl" role="status">{uploadProgress}</div> )}
         
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
                <input type="text" id="searchTerm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-xs font-medium text-slate-800 transition-all shadow-2xs" placeholder="Search by name, e.g. ABC" />
            </div>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <input type="text" id="searchCity" value={searchCity} onChange={e => setSearchCity(e.target.value)} className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-xs font-medium text-slate-800 transition-all shadow-2xs" placeholder="Search by city" />
            </div>
            <div>
                <select 
                    id="salesPersonFilter" 
                    value={selectedSalesPersonId} 
                    onChange={e => setSelectedSalesPersonId(e.target.value === 'all' ? 'all' : Number(e.target.value))} 
                    className="block w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-xs font-semibold text-slate-700 transition-all shadow-2xs cursor-pointer"
                >
                    <option value="all">All sales persons</option>
                    {salesPersons?.map(sp => (
                        <option key={sp.id} value={sp.id}>{sp.name}</option>
                    ))}
                </select>
            </div>
            <div>
                <select id="sortBy" value={sortBy} onChange={e => {
                    const val = e.target.value;
                    const isDesc = val.endsWith('_desc');
                    setSortOrder(isDesc ? 'desc' : 'asc');
                    setSortBy(val.replace('_desc', '') as SortByType);
                }} className="block w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-xs font-semibold text-slate-700 transition-all shadow-2xs cursor-pointer">
                    <option value="id">Sort: ID, ascen</option>
                    <option value="id_desc">Sort: ID, descen</option>
                    <option value="name">Sort: Name, ascen</option>
                    <option value="name_desc">Sort: Name, descen</option>
                </select>
            </div>
         </div>

        {isLoading ? (
            <p className="text-black text-center py-8">Loading customers...</p>
        ) : displayedCustomers.length > 0 ? (
            <>
                <div className="overflow-x-auto max-h-[72vh] overflow-y-auto border border-slate-200/90 rounded-xl bg-white shadow-xs">
                    <table className="table-fixed w-full text-sm text-left">
                    <thead className="sticky top-0 z-20 bg-[#f8fafc] border-b-2 border-slate-200 shadow-xs">
                        <tr>
                            <th scope="col" className="w-[30%] min-w-[260px] px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider bg-[#f8fafc]">
                                Customer
                            </th>
                            <th scope="col" className="w-[30%] min-w-[260px] px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider bg-[#f8fafc]">
                                Address
                            </th>
                            <th scope="col" className="w-[16%] min-w-[140px] px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider bg-[#f8fafc]">
                                Sales person
                            </th>
                            <th scope="col" className="w-[16%] min-w-[150px] px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider bg-[#f8fafc]">
                                Quotations
                            </th>
                            <th scope="col" className="w-[8%] min-w-[90px] px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider text-center bg-[#f8fafc]">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {displayedCustomers.map(customer => {
                            const initials = customer.name.substring(0, 2).toUpperCase();
                            return (
                            <tr key={customer.id} className="group hover:bg-indigo-50/30 transition-colors">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs tracking-wider">
                                            {initials}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-sm truncate" title={customer.name}>
                                                {customer.name}
                                            </div>
                                            <div className="inline-flex items-center gap-1 mt-0.5">
                                                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200/60">
                                                    ID #{customer.id}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-col gap-1">
                                        <div className="text-slate-700 text-xs font-normal leading-relaxed whitespace-pre-wrap">
                                            {customer.address || '—'}
                                        </div>
                                        {(customer.city || customer.pincode) && (
                                            <div className="inline-flex items-center gap-1.5 flex-wrap mt-0.5">
                                                {customer.city && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/60">
                                                        <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                                                        {customer.city}
                                                    </span>
                                                )}
                                                {customer.pincode && (
                                                    <span className="text-[11px] font-mono text-slate-500">
                                                        {customer.pincode}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-700">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                        <span className="truncate">{getSalesPersonName(customer.salesPersonId) || 'Unassigned'}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-col items-start gap-1">
                                        {QUOTATION_STATUSES.map(status => {
                                            const relevantQuotes = quotations?.filter(q => q.customerId === customer.id && q.status === status) || [];
                                            if (relevantQuotes.length === 0) return null;
                                            const totalValue = relevantQuotes.reduce((sum, q) => sum + calculateTotalAmount(q.details), 0);
                                            const colors = statusColors[status];
                                            return (
                                                <div
                                                    key={status}
                                                    onClick={() => onFilterQuotations({ customerIds: [customer.id], status: status })}
                                                    className={`cursor-pointer inline-flex items-center gap-1.5 ${colors?.bg || 'bg-slate-100'} ${colors?.text || 'text-slate-700'} border border-slate-200/60 rounded-lg px-2.5 py-0.5 text-[11px] font-bold shadow-2xs hover:shadow-xs hover:scale-[1.02] transition-all`}
                                                    title={`View ${relevantQuotes.length} '${status}' quotation(s)`}
                                                >
                                                    <span>{status}: {relevantQuotes.length}</span>
                                                    <span className="opacity-40">·</span>
                                                    <span className="font-mono">{formatCurrency(totalValue)}</span>
                                                </div>
                                            )
                                        })}
                                        {quotations?.filter(q => q.customerId === customer.id).length === 0 && (
                                            <span className="text-xs text-slate-400 italic">No quotations</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <button 
                                            onClick={() => handleEdit(customer)} 
                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 transition-all shadow-2xs hover:scale-105 cursor-pointer" 
                                            title="Edit Customer"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(customer.id)} 
                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-500 hover:text-rose-600 bg-rose-50 hover:bg-rose-100/80 transition-all shadow-2xs hover:scale-105 cursor-pointer" 
                                            title="Delete Customer"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            )
                        })}
                    </tbody>
                    </table>
                </div>
                <div className="flex flex-wrap justify-between items-center gap-3 mt-4 text-xs font-medium text-slate-600">
                    <p>Showing <span className="font-bold text-slate-900 font-mono">{displayedCustomers.length}</span> of <span className="font-bold text-slate-900 font-mono">{totalCount.toLocaleString()}</span> customers</p>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                            disabled={currentPage === 1} 
                            className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 transition-colors shadow-2xs cursor-pointer"
                        >
                            Previous
                        </button>
                        <span className="font-mono text-slate-600 px-1">Page {currentPage} of {totalPages}</span>
                        <button 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                            disabled={currentPage === totalPages} 
                            className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 transition-colors shadow-2xs cursor-pointer"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </>
        ) : (
          <p className="text-slate-500 text-center py-8">
            {totalCount > 0 ? 'No customers match your search criteria.' : 'No customers found. Add one to get started.'}
        </p>
        )}
      </div>

      <CustomerAddModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveCustomer}
        salesPersons={salesPersons}
        customerToEdit={customerToEdit}
        currentUser={currentUser}
      />
    </div>
  );
};
