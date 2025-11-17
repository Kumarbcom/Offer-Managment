import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Customer, SalesPerson, Quotation, QuotationStatus } from '../types';
import { CustomerAddModal } from './CustomerAddModal';
import { QUOTATION_STATUSES } from '../constants';
import { DataActions } from '../hooks/useOnlineStorage';
import { getCustomersPaginated } from '../supabase';
import { useDebounce } from '../hooks/useDebounce';

declare var XLSX: any;

interface CustomerManagerProps {
  actions: DataActions<Customer>;
  salesPersons: SalesPerson[] | null;
  quotations: Quotation[] | null;
  onFilterQuotations: (filter: { customerIds: number[], status?: QuotationStatus }) => void;
}

type SortByType = 'id' | 'name' | 'city' | 'pincode'; // Removed 'salesPerson' as it's not a direct column
type SortOrderType = 'asc' | 'desc';

const PAGE_LIMIT = 25;

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


export const CustomerManager: React.FC<CustomerManagerProps> = ({ actions, salesPersons, quotations, onFilterQuotations }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [sortBy, setSortBy] = useState<SortByType>('id');
  const [sortOrder, setSortOrder] = useState<SortOrderType>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const debouncedSearchCity = useDebounce(searchCity, 300);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  
  const refetchData = () => setRefreshTrigger(c => c + 1);

  useEffect(() => {
    const fetchCustomers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, count } = await getCustomersPaginated({
          page: currentPage,
          limit: PAGE_LIMIT,
          searchTerm: debouncedSearchTerm,
          searchCity: debouncedSearchCity,
          sortBy,
          sortOrder,
        });
        setCustomers(data);
        setTotalCount(count);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCustomers();
  }, [debouncedSearchTerm, debouncedSearchCity, sortBy, sortOrder, currentPage, refreshTrigger]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, debouncedSearchCity, sortBy, sortOrder]);


  const getSalesPersonName = (id: number | null) => {
    if (id === null || !salesPersons) return 'N/A';
    return salesPersons.find(sp => sp.id === id)?.name || 'Unknown';
  };
  
  const totalPages = Math.ceil(totalCount / PAGE_LIMIT);

  const quotationStatsForVisibleCustomers = useMemo(() => {
    const initialStats = {
      total: { count: 0, value: 0 },
      byStatus: QUOTATION_STATUSES.reduce((acc, status) => {
        acc[status] = { count: 0, value: 0 };
        return acc;
      }, {} as Record<QuotationStatus, { count: number; value: number }>)
    };

    if (!quotations || customers.length === 0) return initialStats;

    const customerIdsInView = new Set(customers.map(c => c.id));
    const relevantQuotations = quotations.filter(q => customerIdsInView.has(q.customerId as number));

    return relevantQuotations.reduce((stats, q) => {
      const value = calculateTotalAmount(q.details);
      stats.total.count++;
      stats.total.value += value;
      if (stats.byStatus[q.status]) {
        stats.byStatus[q.status].count++;
        stats.byStatus[q.status].value += value;
      }
      return stats;
    }, initialStats);
  }, [customers, quotations]);

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
        await actions.remove([id]);
        refetchData();
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCustomerToEdit(null);
    refetchData();
  };
  
  const handleDownloadTemplate = () => {
    const headers = [
        "Name", "Address", "City", "Pincode", "SalesPersonName", 
        "SingleCoreDiscount", "MultiCoreDiscount", "SpecialCableDiscount", "AccessoriesDiscount"
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, "Customer_Upload_Template.xlsx");
  };

  const handleExport = () => {
    alert("Exporting all customers is not supported in paginated view. Please contact support for a full data export.");
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (!salesPersons) return;
      const data = e.target?.result;
      if (!data) return;
  
      setIsUploading(true);
      setUploadProgress('Reading and parsing file...');
      setUploadError(null);
  
      try {
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);
  
        if (json.length > 5000) {
          throw new Error(`File contains ${json.length} rows, which exceeds the limit of 5,000. Please split the file.`);
        }
  
        const newCustomers: Omit<Customer, 'id'>[] = json.map((row, index) => {
          if (!row['Name'] || !row['City']) {
            console.warn(`Skipping row ${index + 2} due to missing Name or City.`);
            return null;
          }
          const salesPersonName = String(row['SalesPersonName'] || '').trim();
          const salesPerson = salesPersons.find(sp => sp.name.toLowerCase() === salesPersonName.toLowerCase());
          
          return {
            name: String(row['Name']),
            address: String(row['Address'] || ''),
            city: String(row['City']),
            pincode: String(row['Pincode'] || ''),
            salesPersonId: salesPerson ? salesPerson.id! : null,
            discountStructure: {
              singleCore: parseFloat(row['SingleCoreDiscount']) || 0,
              multiCore: parseFloat(row['MultiCoreDiscount']) || 0,
              specialCable: parseFloat(row['SpecialCableDiscount']) || 0,
              accessories: parseFloat(row['AccessoriesDiscount']) || 0,
            },
          };
        }).filter((c): c is Omit<Customer, 'id'> => c !== null);
  
        if (newCustomers.length > 0) {
          setUploadProgress(`Uploading ${newCustomers.length} customers...`);
          await actions.bulkAdd(newCustomers);
          refetchData();
          alert(`${newCustomers.length} customers imported successfully!`);
        } else {
          setUploadError('No valid customers found in the file. Make sure columns are named correctly (e.g., "Name", "City").');
        }
      } catch (error: any) {
        console.error("Error parsing or uploading Excel file:", error);
        setUploadError(error.message || "An unknown error occurred.");
      } finally {
        setIsUploading(false);
        setUploadProgress('');
      }
    };
    reader.readAsArrayBuffer(file);
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
  
  const customerIdsInView = customers.map(c => c.id as number);

  if (salesPersons === null || quotations === null) {
    return <div className="bg-white p-6 rounded-lg shadow-md text-center">Loading dependencies...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 p-2 rounded-lg shadow-sm border border-slate-200">
        <h3 className="text-base font-semibold text-slate-800 mb-1">
            Quotation Summary for {customerIdsInView.length} Visible Customer{customerIdsInView.length !== 1 ? 's' : ''}
        </h3>
        <div className="flex flex-wrap gap-2 items-center">
            <div
                onClick={() => onFilterQuotations({ customerIds: customerIdsInView })}
                className="cursor-pointer text-blue-700 hover:text-blue-900 transition-colors text-sm font-semibold p-1 rounded-md hover:bg-blue-100/50"
                title={`View all ${quotationStatsForVisibleCustomers.total.count} quotations for visible customers`}
            >
                <span>Total Enquiries: </span>
                <span className="font-bold">{quotationStatsForVisibleCustomers.total.count}</span>
                <span className="text-slate-400 mx-1">|</span>
                <span className="font-bold">{formatCurrency(quotationStatsForVisibleCustomers.total.value)}</span>
            </div>
            {QUOTATION_STATUSES.map(status => {
                const stats = quotationStatsForVisibleCustomers.byStatus[status];
                if (stats.count === 0) return null;
                const colors = statusColors[status];
                return (
                    <div
                        key={status}
                        onClick={() => onFilterQuotations({ customerIds: customerIdsInView, status: status })}
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
            <h2 className="text-xl font-bold text-slate-800">Customers ({totalCount})</h2>
            <div className="flex flex-wrap gap-2 text-sm">
                <button
                    onClick={handleExport}
                    className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-1.5 px-3 rounded-md transition duration-300"
                >
                    Export All
                </button>
                <button
                    onClick={handleDownloadTemplate}
                    className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-1.5 px-3 rounded-md transition duration-300"
                >
                    Template
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".xlsx, .xls"
                />
                <button
                    onClick={handleUploadClick}
                    disabled={isUploading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1.5 px-3 rounded-md transition duration-300 disabled:opacity-50"
                >
                    {isUploading ? 'Uploading...' : 'Upload'}
                </button>
                <button
                    onClick={handleAddNew}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-3 rounded-md transition duration-300"
                >
                    Add New
                </button>
            </div>
         </div>
         {isUploading && ( <div className="my-2 p-2 text-center text-sm font-semibold text-indigo-700 bg-indigo-100 rounded-md" role="status">{uploadProgress}</div> )}
         {uploadError && (
          <div className="my-2 p-3 text-sm text-red-800 bg-red-100 border border-red-200 rounded-md" role="alert">
            <p className="font-bold">Import Failed</p>
            <p className="whitespace-pre-wrap">{uploadError}</p>
          </div>
        )}
         
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-4 pb-3 border-b border-slate-200">
            <div>
                <label htmlFor="searchTerm" className="block text-xs font-medium text-slate-600">Search by Name</label>
                <input type="text" id="searchTerm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="mt-1 block w-full px-3 py-1 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm" placeholder="e.g. ABC Corp" />
            </div>
            <div>
                <label htmlFor="searchCity" className="block text-xs font-medium text-slate-600">Search by City</label>
                <input type="text" id="searchCity" value={searchCity} onChange={e => setSearchCity(e.target.value)} className="mt-1 block w-full px-3 py-1 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm" placeholder="e.g. Bangalore" />
            </div>
            <div>
                <label htmlFor="sortBy" className="block text-xs font-medium text-slate-600">Sort By</label>
                <select id="sortBy" value={sortBy} onChange={e => setSortBy(e.target.value as SortByType)} className="mt-1 block w-full px-3 py-1 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm">
                    <option value="id">ID</option>
                    <option value="name">Customer Name</option>
                    <option value="city">City</option>
                    <option value="pincode">Pincode</option>
                </select>
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-600">Order</label>
                <button type="button" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="mt-1 w-full bg-white hover:bg-slate-50 text-slate-700 font-semibold py-1 px-4 border border-slate-300 rounded-md shadow-sm flex items-center justify-center text-sm">
                    {sortOrder === 'asc' ? 'Ascending ▲' : 'Descending ▼'}
                </button>
            </div>
         </div>
        
        {isLoading ? ( <div className="text-center py-8">Loading customers...</div>) : 
         error ? (<div className="text-center py-8 text-red-600">Error: {error}</div>) :
         customers.length > 0 ? (
            <>
                <div className="overflow-x-auto -mx-4">
                    <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                          {['ID', 'Customer Name', 'Address', 'City', 'Pincode', 'Sales Person', 'Quotations', 'Actions'].map(header => (
                            <th key={header} scope="col" className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              {header}
                            </th>
                          ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {customers.map(customer => (
                            <tr key={customer.id} onClick={() => handleEdit(customer)} className="hover:bg-slate-50/70 cursor-pointer">
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">{customer.id}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-slate-800">{customer.name}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600 max-w-xs truncate">{customer.address}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">{customer.city}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">{customer.pincode}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">{getSalesPersonName(customer.salesPersonId)}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1" onClick={e => e.stopPropagation()}>
                                        {QUOTATION_STATUSES.map(status => {
                                            const relevantQuotes = quotations?.filter(q => q.customerId === customer.id && q.status === status) || [];
                                            if (relevantQuotes.length === 0) return null;
                                            const totalValue = relevantQuotes.reduce((sum, q) => sum + calculateTotalAmount(q.details), 0);
                                            const colors = statusColors[status];
                                            return (
                                                <div
                                                    key={status}
                                                    onClick={() => onFilterQuotations({ customerIds: [customer.id!], status: status })}
                                                    className={`cursor-pointer ${colors.bg} ${colors.text} text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1`}
                                                    title={`View ${relevantQuotes.length} '${status}' quotation(s)`}
                                                >
                                                    <span>{status}</span>
                                                    <span className="font-bold bg-white/50 rounded-full px-1">{relevantQuotes.length}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium space-x-3" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => handleEdit(customer)} className="font-semibold text-blue-600 hover:text-blue-800 transition-colors">Edit</button>
                                    <button onClick={() => handleDelete(customer.id!)} className="font-semibold text-rose-600 hover:text-rose-800 transition-colors">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border border-slate-300 rounded-md bg-white hover:bg-slate-50 disabled:opacity-50">Previous</button>
                        <span>Page {currentPage} of {totalPages} ({totalCount} total)</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border border-slate-300 rounded-md bg-white hover:bg-slate-50 disabled:opacity-50">Next</button>
                    </div>
                )}
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
        actions={actions}
        salesPersons={salesPersons}
        customerToEdit={customerToEdit}
      />
    </div>
  );
};
