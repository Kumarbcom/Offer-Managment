
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
      <div className="bg-slate-50 p-2 rounded-lg shadow-sm border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-500 mb-3">Overall quotation summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div
                onClick={() => onFilterQuotations({ })}
                className="cursor-pointer bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
                title={`View all ${allQuotationStats.total.count} quotations`}
            >
                <div className="text-slate-500 text-sm mb-1">Total enquiries</div>
                <div className="text-2xl font-bold text-slate-900">{allQuotationStats.total.count.toLocaleString()}</div>
                <div className="text-xs text-slate-500 mt-1">{formatCurrency(allQuotationStats.total.value)}</div>
            </div>
            {QUOTATION_STATUSES.map(status => {
                const stats = allQuotationStats.byStatus[status];
                if (stats.count === 0) return null;
                const colors = statusColors[status];
                return (
                    <div
                        key={status}
                        onClick={() => onFilterQuotations({ status: status })}
                        className={`cursor-pointer ${colors?.bg || 'bg-slate-50'} p-4 rounded-xl border border-slate-100/50 shadow-sm hover:shadow-md transition-shadow`}
                        title={`View ${stats.count} '${status}' quotations`}
                    >
                        <div className={`${colors?.text || 'text-slate-600'} text-sm mb-1`}>{status}</div>
                        <div className={`text-2xl font-bold ${colors?.text || 'text-slate-900'}`}>{stats.count.toLocaleString()}</div>
                        <div className={`text-xs ${colors?.text || 'text-slate-500'} mt-1`}>{formatCurrency(stats.value)}</div>
                    </div>
                )
            })}
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200">
         <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-slate-900">Customers <span className="text-slate-500 font-normal">({totalCount.toLocaleString()})</span></h2>
            <div className="flex flex-wrap gap-3 text-sm">
                <button
                    onClick={handleExport}
                    disabled={isUploading}
                    className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 border border-slate-200 rounded-lg transition duration-300 disabled:opacity-50"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    Export
                </button>
                <button
                    onClick={handleDownloadTemplate}
                    disabled={isUploading}
                    className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 border border-slate-200 rounded-lg transition duration-300 disabled:opacity-50"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Template
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls"/>
                <button
                    onClick={handleUploadClick}
                    disabled={isUploading}
                    className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 border border-slate-200 rounded-lg transition duration-300 disabled:opacity-50"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                    {isUploading ? 'Uploading...' : 'Upload'}
                </button>
                <button
                    onClick={handleAddNew}
                    disabled={isUploading}
                    className="flex items-center gap-2 bg-[#d97736] hover:bg-[#c2652a] text-white font-semibold py-2 px-4 rounded-lg transition duration-300 disabled:opacity-50 shadow-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
                    Add new
                </button>
            </div>
         </div>
         {isUploading && ( <div className="my-2 p-2 text-center text-sm font-semibold text-indigo-700 bg-indigo-100 rounded-md" role="status">{uploadProgress}</div> )}
         
         <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-[200px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
                <input type="text" id="searchTerm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-300 focus:ring-0 text-sm text-slate-700" placeholder="Search by name, e.g. ABC" />
            </div>
            <div className="relative flex-1 min-w-[200px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <input type="text" id="searchCity" value={searchCity} onChange={e => setSearchCity(e.target.value)} className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-300 focus:ring-0 text-sm text-slate-700" placeholder="Search by city" />
            </div>
            <div className="flex-1 min-w-[150px]">
                <select 
                    id="salesPersonFilter" 
                    value={selectedSalesPersonId} 
                    onChange={e => setSelectedSalesPersonId(e.target.value === 'all' ? 'all' : Number(e.target.value))} 
                    className="block w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-300 focus:ring-0 text-sm bg-white text-slate-700"
                >
                    <option value="all">All sales persons</option>
                    {salesPersons?.map(sp => (
                        <option key={sp.id} value={sp.id}>{sp.name}</option>
                    ))}
                </select>
            </div>
            <div className="flex-1 min-w-[150px]">
                <select id="sortBy" value={sortBy} onChange={e => {
                    const val = e.target.value;
                    const isDesc = val.endsWith('_desc');
                    setSortOrder(isDesc ? 'desc' : 'asc');
                    setSortBy(val.replace('_desc', '') as SortByType);
                }} className="block w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-300 focus:ring-0 text-sm bg-white text-slate-700">
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
                <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white mt-2">
                    <table className="min-w-full text-sm text-left">
                    <thead className="bg-white border-b border-slate-200">
                        <tr>
                          {['Customer', 'Address', 'City / pincode', 'Sales person', 'Quotations', 'Actions'].map(header => (
                            <th key={header} scope="col" className={`px-4 py-4 text-xs font-bold text-slate-500 ${header === 'Actions' ? 'text-right' : ''}`}>
                              {header}
                            </th>
                          ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {displayedCustomers.map(customer => {
                            const initials = customer.name.substring(0, 2).toUpperCase();
                            return (
                            <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[#fde9df] text-[#b35728] flex items-center justify-center font-bold text-sm shrink-0">
                                            {initials}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-blue-700">{customer.name}</div>
                                            <div className="text-xs text-slate-400 mt-0.5">ID {customer.id}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-slate-600 max-w-[200px] whitespace-normal">{customer.address}</td>
                                <td className="px-4 py-3">
                                    <div className="font-semibold text-slate-900">{customer.city}</div>
                                    <div className="text-xs text-slate-400 mt-0.5">{customer.pincode}</div>
                                </td>
                                <td className="px-4 py-3 text-slate-600">{getSalesPersonName(customer.salesPersonId)}</td>
                                <td className="px-4 py-3 text-slate-600">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {QUOTATION_STATUSES.map(status => {
                                            const relevantQuotes = quotations?.filter(q => q.customerId === customer.id && q.status === status) || [];
                                            if (relevantQuotes.length === 0) return null;
                                            const totalValue = relevantQuotes.reduce((sum, q) => sum + calculateTotalAmount(q.details), 0);
                                            const colors = statusColors[status];
                                            return (
                                                <div
                                                    key={status}
                                                    onClick={() => onFilterQuotations({ customerIds: [customer.id], status: status })}
                                                    className={`cursor-pointer flex items-center gap-1 ${colors?.bg || 'bg-slate-100'} ${colors?.text || 'text-slate-600'} rounded-full px-3 py-1 text-xs font-semibold hover:opacity-80 transition-opacity`}
                                                    title={`View ${relevantQuotes.length} '${status}' quotation(s)`}
                                                >
                                                    <span>{status}: {relevantQuotes.length}</span>
                                                    <span>·</span>
                                                    <span>{formatCurrency(totalValue)}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </td>
                                <td className="px-4 py-3 border-b border-slate-100 text-right space-x-4">
                                    <button onClick={() => handleEdit(customer)} className="text-slate-400 hover:text-slate-600 transition-colors" title="Edit">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                    </button>
                                    <button onClick={() => handleDelete(customer.id)} className="text-rose-400 hover:text-rose-600 transition-colors" title="Delete">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                    </button>
                                </td>
                            </tr>
                            )
                        })}
                    </tbody>
                    </table>
                </div>
                <div className="flex justify-between items-center mt-4 text-sm">
                    <p className="text-black">Showing {displayedCustomers.length} of {totalCount} customers</p>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border rounded-md disabled:opacity-50 text-black">Previous</button>
                        <span className="text-black">Page {currentPage} of {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border rounded-md disabled:opacity-50 text-black">Next</button>
                    </div>
                </div>
            </>
        ) : (
          <p className="text-black text-center py-8">
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
