
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Customer, SalesPerson, Quotation, QuotationStatus, User } from '../types';
import { CustomerAddModal } from './CustomerAddModal';
import { QUOTATION_STATUSES } from '../constants';
import { getCustomersPaginated, upsertCustomer, deleteCustomer, addCustomersBatch } from '../supabase';
import { useDebounce } from '../hooks/useDebounce';
import { calculateTotalAmount } from '../utils/calc';

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
      const value = calculateTotalAmount(q);
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
    <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-200/80 space-y-6">
      
      {/* 1. Header with 3D Blue Icon, Title, and Subtitle */}
      <div className="flex flex-wrap gap-4 justify-between items-center pb-2">
         <div className="flex items-center gap-3.5">
            {/* 3D Isometric Blue Customer/Team Icon */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25 shrink-0">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
               </svg>
            </div>
            <div>
               <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Customer Master</h2>
               <p className="text-xs text-slate-400 font-medium">Manage your customer database</p>
            </div>
         </div>

         {/* Compact Secondary Tools (Export, Template, Upload) */}
         <div className="flex items-center gap-2 text-xs">
            <button
                onClick={handleExport}
                disabled={isUploading}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold border border-slate-200 rounded-xl shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                title="Export Customers to Excel"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="12" x2="12" y2="3"/></svg>
                <span>Export</span>
            </button>
            <button
                onClick={handleDownloadTemplate}
                disabled={isUploading}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold border border-slate-200 rounded-xl shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                title="Download Customer Template"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span>Template</span>
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls"/>
            <button
                onClick={handleUploadClick}
                disabled={isUploading}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold border border-slate-200 rounded-xl shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                title="Upload Customers Excel"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span>{isUploading ? 'Uploading...' : 'Upload'}</span>
            </button>
         </div>
      </div>

      {isUploading && ( <div className="p-2.5 text-center text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl" role="status">{uploadProgress}</div> )}

      {/* 2. KPI Cards Row matching Mockup */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
         {/* Total Customers (Dark Navy Card) */}
         <div 
            onClick={() => { setSearchTerm(''); setSearchCity(''); setSelectedSalesPersonId('all'); }}
            className="bg-[#0f233d] text-white p-3.5 rounded-2xl shadow-md relative overflow-hidden flex flex-col justify-between cursor-pointer hover:scale-[1.02] transition-transform"
         >
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
               <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
               <span>Total Customers</span>
            </div>
            <div className="text-2xl font-black font-mono text-white mt-2 leading-none">
               {totalCount.toLocaleString()}
            </div>
            {/* Faint background decorative icon */}
            <div className="absolute right-2 bottom-1 opacity-10 pointer-events-none">
               <svg width="42" height="42" viewBox="0 0 24 24" fill="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            </div>
         </div>

         {/* Open Quotations (Soft Blue Card) */}
         <div 
            onClick={() => onFilterQuotations({ status: 'Open' })}
            className="bg-blue-50/80 border border-blue-200/80 p-3.5 rounded-2xl shadow-2xs relative flex flex-col justify-between cursor-pointer hover:shadow-xs hover:-translate-y-0.5 transition-all"
         >
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700">
               <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">✓</span>
               <span>Open</span>
            </div>
            <div className="flex items-baseline justify-between mt-2">
               <span className="text-2xl font-black font-mono text-slate-900 leading-none">
                  {(allQuotationStats.byStatus['Open']?.count || 0).toLocaleString()}
               </span>
               <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
               </div>
            </div>
         </div>

         {/* PO Received (Soft Emerald Card) */}
         <div 
            onClick={() => onFilterQuotations({ status: 'PO received' })}
            className="bg-emerald-50/80 border border-emerald-200/80 p-3.5 rounded-2xl shadow-2xs relative flex flex-col justify-between cursor-pointer hover:shadow-xs hover:-translate-y-0.5 transition-all"
         >
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
               <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">✓</span>
               <span>PO Received</span>
            </div>
            <div className="flex items-baseline justify-between mt-2">
               <span className="text-2xl font-black font-mono text-slate-900 leading-none">
                  {(allQuotationStats.byStatus['PO received']?.count || 0).toLocaleString()}
               </span>
               <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
               </div>
            </div>
         </div>

         {/* Invoiced / Partial PO (Soft Amber Card) */}
         <div 
            onClick={() => onFilterQuotations({ status: 'Partial PO Received' })}
            className="bg-amber-50/80 border border-amber-200/80 p-3.5 rounded-2xl shadow-2xs relative flex flex-col justify-between cursor-pointer hover:shadow-xs hover:-translate-y-0.5 transition-all"
         >
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700">
               <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-mono">₹</span>
               <span>Invoiced</span>
            </div>
            <div className="flex items-baseline justify-between mt-2">
               <span className="text-2xl font-black font-mono text-slate-900 leading-none">
                  {(allQuotationStats.byStatus['Partial PO Received']?.count || allQuotationStats.byStatus['Expired']?.count || 0).toLocaleString()}
               </span>
               <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
               </div>
            </div>
         </div>

         {/* Lost (Soft Rose Card) */}
         <div 
            onClick={() => onFilterQuotations({ status: 'Lost' })}
            className="bg-rose-50/80 border border-rose-200/80 p-3.5 rounded-2xl shadow-2xs relative flex flex-col justify-between cursor-pointer hover:shadow-xs hover:-translate-y-0.5 transition-all"
         >
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700">
               <span className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px]">!</span>
               <span>Lost</span>
            </div>
            <div className="flex items-baseline justify-between mt-2">
               <span className="text-2xl font-black font-mono text-slate-900 leading-none">
                  {(allQuotationStats.byStatus['Lost']?.count || 0).toLocaleString()}
               </span>
               <div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
               </div>
            </div>
         </div>

         {/* Need Amendment (Soft Purple Card) */}
         <div 
            onClick={() => onFilterQuotations({ status: 'Need Amendment' })}
            className="bg-purple-50/80 border border-purple-200/80 p-3.5 rounded-2xl shadow-2xs relative flex flex-col justify-between cursor-pointer hover:shadow-xs hover:-translate-y-0.5 transition-all"
         >
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-700">
               <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
               <span>Need Amendment</span>
            </div>
            <div className="flex items-baseline justify-between mt-2">
               <span className="text-2xl font-black font-mono text-slate-900 leading-none">
                  {(allQuotationStats.byStatus['Need Amendment']?.count || allQuotationStats.byStatus['Under Review']?.count || 0).toLocaleString()}
               </span>
               <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
               </div>
            </div>
         </div>
      </div>

      {/* 3. Search & Filter Bar matching Mockup */}
      <div className="flex flex-wrap items-center gap-3">
         {/* Search by Name */}
         <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
               <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
            <input 
               type="text" 
               id="searchTerm" 
               value={searchTerm} 
               onChange={e => setSearchTerm(e.target.value)} 
               placeholder="Search by Name, e.g. ABC" 
               className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs" 
            />
         </div>

         {/* Search by City */}
         <div className="relative flex-1 min-w-[160px]">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
               <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <input 
               type="text" 
               id="searchCity" 
               value={searchCity} 
               onChange={e => setSearchCity(e.target.value)} 
               placeholder="Search by City" 
               className="w-full pl-9 pr-8 py-2.5 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs" 
            />
         </div>

         {/* Sales Persons Select */}
         <div className="relative flex-1 min-w-[170px]">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
               <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <select 
               id="salesPersonFilter" 
               value={selectedSalesPersonId} 
               onChange={e => setSelectedSalesPersonId(e.target.value === 'all' ? 'all' : Number(e.target.value))} 
               className="w-full pl-9 pr-8 py-2.5 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs cursor-pointer appearance-none"
            >
               <option value="all">All Sales Persons</option>
               {salesPersons?.map(sp => (
                  <option key={sp.id} value={sp.id}>{sp.name}</option>
               ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
               <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
         </div>

         {/* Sort By Select */}
         <div className="relative flex-1 min-w-[160px]">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
               ⇅
            </div>
            <select 
               id="sortBy" 
               value={sortOrder} 
               onChange={e => setSortOrder(e.target.value as SortOrderType)} 
               className="w-full pl-9 pr-8 py-2.5 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs cursor-pointer appearance-none"
            >
               <option value="asc">Sort By : Ascending</option>
               <option value="desc">Sort By : Descending</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
               <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
         </div>

         {/* Reset Button */}
         <button 
            type="button" 
            onClick={() => { setSearchTerm(''); setSearchCity(''); setSelectedSalesPersonId('all'); setSortOrder('asc'); }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 shadow-2xs transition-all cursor-pointer shrink-0"
         >
            <svg className="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
            <span>Reset</span>
         </button>

         {/* + Add New Button */}
         <button
            onClick={handleAddNew}
            disabled={isUploading}
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-2.5 px-5 rounded-2xl shadow-md shadow-blue-500/25 hover:shadow-lg transition-all active:scale-[0.98] text-xs cursor-pointer shrink-0 disabled:opacity-50"
         >
            <span className="text-base font-bold leading-none">+</span>
            <span>Add New</span>
         </button>
      </div>

      {/* 4. Table matching Mockup */}
      {isLoading ? (
          <p className="text-slate-500 text-center py-10 font-medium">Loading customers...</p>
      ) : displayedCustomers.length > 0 ? (
          <>
              <div className="overflow-x-auto max-h-[72vh] overflow-y-auto border border-slate-200/80 rounded-2xl bg-white shadow-sm">
                  <table className="table-fixed w-full text-xs text-left border-collapse">
                  <thead className="sticky top-0 z-20 shadow-md select-none bg-[#0866dc]">
                      <tr className="bg-gradient-to-r from-[#0356c9] via-[#0866dc] to-[#044db9] text-white font-bold uppercase text-[11px] tracking-wider">
                          <th scope="col" className="w-[25%] min-w-[200px] px-4 py-3.5 bg-transparent text-white">
                              Customer
                          </th>
                          <th scope="col" className="w-[32%] min-w-[240px] px-4 py-3.5 bg-transparent text-white">
                              Address
                          </th>
                          <th scope="col" className="w-[18%] min-w-[140px] px-4 py-3.5 bg-transparent text-white">
                              Sales Person
                          </th>
                          <th scope="col" className="w-[18%] min-w-[180px] px-4 py-3.5 bg-transparent text-white">
                              Quotations
                          </th>
                          <th scope="col" className="w-[7%] min-w-[85px] px-4 py-3.5 text-center bg-transparent text-white">
                              Actions
                          </th>
                      </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                      {displayedCustomers.map(customer => {
                          return (
                          <tr key={customer.id} className="hover:bg-blue-50/20 transition-colors group">
                              {/* Customer Name */}
                              <td className="px-4 py-3">
                                  <div 
                                      onClick={() => handleEdit(customer)}
                                      className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-xs sm:text-sm cursor-pointer"
                                      title={customer.name}
                                  >
                                      {customer.name}
                                  </div>
                              </td>

                              {/* Address */}
                              <td className="px-4 py-3">
                                  <div className="flex items-start gap-2">
                                      <svg className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                                          <circle cx="12" cy="10" r="3"/>
                                      </svg>
                                      <div className="flex flex-col">
                                          <div className="text-slate-700 text-xs font-normal leading-relaxed">
                                              {customer.address || '—'}
                                          </div>
                                          {(customer.city || customer.pincode) && (
                                              <div className="text-slate-500 font-medium text-[11px] mt-0.5">
                                                  {customer.city}{customer.city && customer.pincode ? ' – ' : ''}{customer.pincode}
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              </td>

                              {/* Sales Person */}
                              <td className="px-4 py-3">
                                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                      <span className="truncate">{getSalesPersonName(customer.salesPersonId) || 'Unassigned'}</span>
                                  </div>
                              </td>

                              {/* Quotations Status Pills */}
                              <td className="px-4 py-3">
                                  <div className="flex flex-col gap-1.5 w-full">
                                      {QUOTATION_STATUSES.map(status => {
                                          const relevantQuotes = quotations?.filter(q => q.customerId === customer.id && q.status === status) || [];
                                          if (relevantQuotes.length === 0) return null;
                                          const totalValue = relevantQuotes.reduce((sum, q) => sum + calculateTotalAmount(q), 0);
                                          
                                          // Color styling matching Mockup pills
                                          let pillColors = 'bg-blue-50 text-blue-700 border-blue-200/70';
                                          if (status === 'PO received') pillColors = 'bg-emerald-50 text-emerald-700 border-emerald-200/70';
                                          else if (status === 'Partial PO Received' || status === 'Expired') pillColors = 'bg-amber-50 text-amber-700 border-amber-200/70';
                                          else if (status === 'Lost') pillColors = 'bg-rose-50 text-rose-700 border-rose-200/70';
                                          else if (status === 'Need Amendment' || status === 'Under Review') pillColors = 'bg-purple-50 text-purple-700 border-purple-200/70';

                                          return (
                                              <div
                                                  key={status}
                                                  onClick={() => onFilterQuotations({ customerIds: [customer.id], status: status })}
                                                  className={`cursor-pointer inline-flex items-center justify-between gap-1.5 ${pillColors} border rounded-lg px-2.5 py-1 text-[11px] font-semibold shadow-2xs hover:shadow-xs hover:scale-[1.01] transition-all`}
                                                  title={`View ${relevantQuotes.length} '${status}' quotation(s)`}
                                              >
                                                  <div className="flex items-center gap-1.5 truncate">
                                                      <svg className="w-3 h-3 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                                      <span>{status === 'Open' ? 'Open' : status === 'PO received' ? 'PO Received' : status} : {relevantQuotes.length}</span>
                                                  </div>
                                                  <div className="flex items-center gap-1 shrink-0 font-mono font-bold">
                                                      <span>{formatCurrency(totalValue)}</span>
                                                      <span className="opacity-50 text-[10px]">›</span>
                                                  </div>
                                              </div>
                                          )
                                      })}
                                      {quotations?.filter(q => q.customerId === customer.id).length === 0 && (
                                          <span className="text-[11px] text-slate-400 italic">No quotations</span>
                                      )}
                                  </div>
                              </td>

                              {/* Actions (Squircle Blue Edit & Red Delete) */}
                              <td className="px-4 py-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                      <button 
                                          onClick={() => handleEdit(customer)} 
                                          className="w-8 h-8 rounded-xl flex items-center justify-center text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 transition-all shadow-2xs hover:scale-105 cursor-pointer" 
                                          title="Edit Customer"
                                      >
                                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                      </button>
                                      <button 
                                          onClick={() => handleDelete(customer.id)} 
                                          className="w-8 h-8 rounded-xl flex items-center justify-center text-rose-500 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 transition-all shadow-2xs hover:scale-105 cursor-pointer" 
                                          title="Delete Customer"
                                      >
                                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                      </button>
                                  </div>
                              </td>
                          </tr>
                          )
                      })}
                  </tbody>
                  </table>
              </div>

              {/* 5. Footer with Pill Stats & Circular Pagination matching Mockup */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 shadow-2xs">
                          <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">i</span>
                          <span>Total Customers : <strong className="font-mono">{totalCount.toLocaleString()}</strong></span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-2xs">
                          <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                          <span>Showing {totalCount === 0 ? 0 : (currentPage - 1) * PAGE_LIMIT + 1}-{Math.min(currentPage * PAGE_LIMIT, totalCount)} of {totalCount.toLocaleString()}</span>
                      </span>
                  </div>

                  {/* Circular Pagination Controls */}
                  <div className="flex items-center gap-1.5 text-xs">
                      <button 
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                          className="w-7 h-7 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                          title="First Page"
                      >
                          «
                      </button>
                      <button 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="w-7 h-7 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                          title="Previous Page"
                      >
                          ‹
                      </button>
                      
                      {/* Page number circles */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const pageNum = i + 1;
                          const isActive = pageNum === currentPage;
                          return (
                              <button
                                  key={pageNum}
                                  onClick={() => setCurrentPage(pageNum)}
                                  className={`w-7 h-7 rounded-full font-bold flex items-center justify-center transition-all cursor-pointer ${
                                      isActive 
                                          ? 'bg-blue-600 text-white shadow-xs' 
                                          : 'text-slate-700 hover:bg-slate-100'
                                  }`}
                              >
                                  {pageNum}
                              </button>
                          );
                      })}

                      <button 
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="w-7 h-7 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                          title="Next Page"
                      >
                          ›
                      </button>
                      <button 
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage === totalPages}
                          className="w-7 h-7 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                          title="Last Page"
                      >
                          »
                      </button>
                  </div>
              </div>
          </>
      ) : (
        <p className="text-slate-500 text-center py-10 font-medium">
          {totalCount > 0 ? 'No customers match your search criteria.' : 'No customers found. Add one to get started.'}
        </p>
      )}

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
