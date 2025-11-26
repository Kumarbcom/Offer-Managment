
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Customer, SalesPerson, Quotation, QuotationStatus } from '../types';
import { CustomerAddModal } from './CustomerAddModal';
import { QUOTATION_STATUSES } from '../constants';
import { getCustomersPaginated, upsertCustomer, deleteCustomer, addCustomersBatch } from '../supabase';
import { useDebounce } from '../hooks/useDebounce';

declare var XLSX: any;

interface CustomerManagerProps {
  salesPersons: SalesPerson[] | null;
  quotations: Quotation[] | null;
  onFilterQuotations: (filter: { customerIds?: number[], status?: QuotationStatus }) => void;
}

type SortByType = 'id' | 'name' | 'city' | 'pincode' | 'salesPerson';
type SortOrderType = 'asc' | 'desc';

const PAGE_LIMIT = 50;

const calculateTotalAmount = (details: Quotation['details']): number => {
    return details.reduce((total, item) => {
        const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
        return total + (unitPrice * item.moq);
    }, 0);
}
const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const statusColors: Record<QuotationStatus, { bg: string, text: string }> = {
    'Open': { bg: 'bg-blue-100', text: 'text-blue-700' },
    'PO received': { bg: 'bg-green-100', text: 'text-green-700' },
    'Partial PO Received': { bg: 'bg-teal-100', text: 'text-teal-700' },
    'Expired': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    'Lost': { bg: 'bg-rose-100', text: 'text-rose-700' },
};


export const CustomerManager: React.FC<CustomerManagerProps> = ({ salesPersons, quotations, onFilterQuotations }) => {
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
          singleCoreDiscount: c.discountStructure.singleCore,
          multiCoreDiscount: c.discountStructure.multiCore,
          specialCableDiscount: c.discountStructure.specialCable,
          accessoriesDiscount: c.discountStructure.accessories,
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
        <h3 className="text-base font-semibold text-black mb-1">
            Overall Quotation Summary
        </h3>
        <div className="flex flex-wrap gap-2 items-center">
            <div
                onClick={() => onFilterQuotations({ })}
                className="cursor-pointer text-blue-700 hover:text-blue-900 transition-colors text-sm font-semibold p-1 rounded-md hover:bg-blue-100/50"
                title={`View all ${allQuotationStats.total.count} quotations`}
            >
                <span>Total Enquiries: </span>
                <span className="font-bold">{allQuotationStats.total.count}</span>
                <span className="text-slate-400 mx-1">|</span>
                <span className="font-bold">{formatCurrency(allQuotationStats.total.value)}</span>
            </div>
            {QUOTATION_STATUSES.map(status => {
                const stats = allQuotationStats.byStatus[status];
                if (stats.count === 0) return null;
                const colors = statusColors[status];
                return (
                    <div
                        key={status}
                        onClick={() => onFilterQuotations({ status: status })}
                        className={`cursor-pointer ${colors.text} hover:bg-opacity-80 transition-opacity text-sm font-semibold p-1 rounded-md hover:bg-current/10`}
                        title={`View ${stats.count} '${status}' quotations`}
                    >
                        <span>{status}: </span>
                        <span className="font-bold">{stats.count}</span>
                        <span className="text-slate-400 mx-1">|</span>
                        <span className="font-bold">{formatCurrency(stats.value)}</span>
                    </div>
                )
            })}
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
         <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-black">Customers ({totalCount})</h2>
            <div className="flex flex-wrap gap-2 text-sm">
                <button
                    onClick={handleExport}
                    disabled={isUploading}
                    className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-1.5 px-3 rounded-md transition duration-300 disabled:opacity-50"
                >
                    Export Visible
                </button>
                <button
                    onClick={handleDownloadTemplate}
                    disabled={isUploading}
                    className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-1.5 px-3 rounded-md transition duration-300 disabled:opacity-50"
                >
                    Template
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls"/>
                <button
                    onClick={handleUploadClick}
                    disabled={isUploading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1.5 px-3 rounded-md transition duration-300 disabled:opacity-50"
                >
                    {isUploading ? 'Uploading...' : 'Upload'}
                </button>
                <button
                    onClick={handleAddNew}
                    disabled={isUploading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-3 rounded-md transition duration-300 disabled:opacity-50"
                >
                    Add New
                </button>
            </div>
         </div>
         {isUploading && ( <div className="my-2 p-2 text-center text-sm font-semibold text-indigo-700 bg-indigo-100 rounded-md" role="status">{uploadProgress}</div> )}
         
         <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2 mb-4 pb-3 border-b border-slate-200">
            <div>
                <label htmlFor="searchTerm" className="block text-xs font-medium text-black">Search by Name</label>
                <input type="text" id="searchTerm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="mt-1 block w-full px-3 py-1 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm text-black" placeholder="e.g. ABC Corp" />
            </div>
            <div>
                <label htmlFor="searchCity" className="block text-xs font-medium text-black">Search by City</label>
                <input type="text" id="searchCity" value={searchCity} onChange={e => setSearchCity(e.target.value)} className="mt-1 block w-full px-3 py-1 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm text-black" placeholder="e.g. Bangalore" />
            </div>
            <div>
                <label htmlFor="salesPersonFilter" className="block text-xs font-medium text-black">Filter by Sales Person</label>
                <select 
                    id="salesPersonFilter" 
                    value={selectedSalesPersonId} 
                    onChange={e => setSelectedSalesPersonId(e.target.value === 'all' ? 'all' : Number(e.target.value))} 
                    className="mt-1 block w-full px-3 py-1 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-black"
                >
                    <option value="all">All Sales Persons</option>
                    {salesPersons?.map(sp => (
                        <option key={sp.id} value={sp.id}>{sp.name}</option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="sortBy" className="block text-xs font-medium text-black">Sort By</label>
                <select id="sortBy" value={sortBy} onChange={e => setSortBy(e.target.value as SortByType)} className="mt-1 block w-full px-3 py-1 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-black">
                    <option value="id">ID</option>
                    <option value="name">Customer Name</option>
                    <option value="city">City</option>
                    <option value="pincode">Pincode</option>
                    <option value="salesPersonId">Sales Person</option>
                </select>
            </div>
            <div>
                <label className="block text-xs font-medium text-black">Order</label>
                <button type="button" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="mt-1 w-full bg-white hover:bg-slate-50 text-black font-semibold py-1 px-4 border border-slate-300 rounded-md shadow-sm flex items-center justify-center text-sm">
                    {sortOrder === 'asc' ? 'Ascending ▲' : 'Descending ▼'}
                </button>
            </div>
         </div>

        {isLoading ? (
            <p className="text-black text-center py-8">Loading customers...</p>
        ) : displayedCustomers.length > 0 ? (
            <>
                <div className="overflow-x-auto -mx-4">
                    <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                          {['ID', 'Customer Name', 'Address', 'City', 'Pincode', 'Sales Person', 'Quotations', 'Actions'].map(header => (
                            <th key={header} scope="col" className="px-3 py-2 text-left text-xs font-semibold text-black uppercase tracking-wider">
                              {header}
                            </th>
                          ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {displayedCustomers.map(customer => (
                            <tr key={customer.id} className="hover:bg-slate-50/70">
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-black">{customer.id}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-black">{customer.name}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-black max-w-xs truncate">{customer.address}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-black">{customer.city}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-black">{customer.pincode}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-black">{getSalesPersonName(customer.salesPersonId)}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-black">
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
                                                    className={`cursor-pointer hover:underline ${colors.text} text-xs font-semibold`}
                                                    title={`View ${relevantQuotes.length} '${status}' quotation(s)`}
                                                >
                                                    <span>{status}: </span>
                                                    <span className="font-bold">{relevantQuotes.length}</span>
                                                    <span className="text-slate-400 mx-1">|</span>
                                                    <span className="font-bold">{formatCurrency(totalValue)}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium space-x-3">
                                    <button onClick={() => handleEdit(customer)} className="font-semibold text-blue-600 hover:text-blue-800 transition-colors">Edit</button>
                                    <button onClick={() => handleDelete(customer.id)} className="font-semibold text-rose-600 hover:text-rose-800 transition-colors">Delete</button>
                                </td>
                            </tr>
                        ))}
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
      />
    </div>
  );
};
