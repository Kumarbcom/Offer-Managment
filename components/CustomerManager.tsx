import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { Customer, SalesPerson, Quotation, QuotationStatus } from '../types';
import { CustomerAddModal } from './CustomerAddModal';
import { QUOTATION_STATUSES } from '../constants';
import { getCustomersPaginated, upsertCustomer, deleteCustomer, addCustomersBatch } from '../supabase';
import { useDebounce } from '../hooks/useDebounce';

declare var XLSX: any;

interface CustomerManagerProps {
  salesPersons: SalesPerson[] | null;
  quotations: Quotation[] | null;
  onFilterQuotations: (filter: { customerIds: number[], status?: QuotationStatus }) => void;
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
  const [sortBy, setSortBy] = useState<SortByType>('id');
  const [sortOrder, setSortOrder] = useState<SortOrderType>('asc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const debouncedSearchCity = useDebounce(searchCity, 500);

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
            filters: { name: debouncedSearchTerm, city: debouncedSearchCity }
        });
        setDisplayedCustomers(result.customers);
        setTotalCount(result.count);
    } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to fetch customers');
    } finally {
        setIsLoading(false);
    }
  }, [sortBy, sortOrder, debouncedSearchTerm, debouncedSearchCity]);
  
  useEffect(() => {
    setCurrentPage(1);
    fetchCustomers(1);
  }, [debouncedSearchTerm, debouncedSearchCity, sortBy, sortOrder]);

  useEffect(() => {
    fetchCustomers(currentPage);
  }, [currentPage, fetchCustomers]);


  const getSalesPersonName = (id: number | null) => {
    if (id === null || !salesPersons) return 'N/A';
    return salesPersons.find(sp => sp.id === id)?.name || 'Unknown';
  };

  const quotationStatsForVisibleCustomers = useMemo(() => {
    const initialStats = {
      total: { count: 0, value: 0 },
      byStatus: QUOTATION_STATUSES.reduce((acc, status) => {
        acc[status] = { count: 0, value: 0 };
        return acc;
      }, {} as Record<QuotationStatus, { count: number; value: number }>)
    };

    if (!quotations || displayedCustomers.length === 0) return initialStats;

    const customerIdsInView = new Set(displayedCustomers.map(c => c.id));
    const relevantQuotations = quotations.filter(q => q.customerId !== null && customerIdsInView.has(q.customerId));

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
  }, [displayedCustomers, quotations]);

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
    if (typeof XLSX === 'undefined') {
        alert('Excel library is not available. Please check your connection.');
        return;
    }
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
    if (typeof XLSX === 'undefined') {
        alert('Excel library is not available. Please check your connection.');
        return;
    }
    if (!displayedCustomers) return;
    const dataToExport = displayedCustomers.map(customer => ({
      Name: customer.name,
      Address: customer.address,
      City: customer.city,
      Pincode: customer.pincode,
      SalesPersonName: getSalesPersonName(customer.salesPersonId),
      SingleCoreDiscount: customer.discountStructure.singleCore,
      MultiCoreDiscount: customer.discountStructure.multiCore,
      SpecialCableDiscount: customer.discountStructure.specialCable,
      AccessoriesDiscount: customer.discountStructure.accessories,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, "Customers_Export_Visible.xlsx");
  };

  const handleFileUpload = (file: File) => {
    if (typeof XLSX === 'undefined') {
        alert('Excel library is not available. Please check your connection.');
        return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
        if (!salesPersons) {
            alert("Sales person data is not loaded yet. Please try again in a moment.");
            return;
        }
        const data = e.target?.result;
        if (!data) return;

        try {
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

            if (json.length === 0) {
                alert("The uploaded file is empty or has no data rows.");
                return;
            }
            
            const CANONICAL_HEADERS = {
                NAME: "Name",
                ADDRESS: "Address",
                CITY: "City",
                PINCODE: "Pincode",
                SALES_PERSON_NAME: "SalesPersonName",
                SINGLE_CORE_DISCOUNT: "SingleCoreDiscount",
                MULTI_CORE_DISCOUNT: "MultiCoreDiscount",
                SPECIAL_CABLE_DISCOUNT: "SpecialCableDiscount",
                ACCESSORIES_DISCOUNT: "AccessoriesDiscount"
            };
            const REQUIRED_CANONICAL_HEADERS = [CANONICAL_HEADERS.NAME, CANONICAL_HEADERS.CITY];

            const fileHeaders = Object.keys(json[0]);
            const normalizedFileHeaderMap = new Map<string, string>();
            fileHeaders.forEach(h => normalizedFileHeaderMap.set(h.trim().toLowerCase(), h));
            
            const headerMap = new Map<string, string>();
            for (const key in CANONICAL_HEADERS) {
                const canonicalHeader = CANONICAL_HEADERS[key as keyof typeof CANONICAL_HEADERS];
                const normalizedCanonical = canonicalHeader.toLowerCase();
                if (normalizedFileHeaderMap.has(normalizedCanonical)) {
                    headerMap.set(canonicalHeader, normalizedFileHeaderMap.get(normalizedCanonical)!);
                }
            }
            
            const missingHeaders = REQUIRED_CANONICAL_HEADERS.filter(h => !headerMap.has(h));
            if (missingHeaders.length > 0) {
                alert(`Template mismatch. The following required columns are missing or misspelled: ${missingHeaders.join(', ')}. Please use the downloaded template for reference.`);
                return;
            }

            const getValue = (row: any, canonicalHeader: string): any => {
                const actualHeader = headerMap.get(canonicalHeader);
                return actualHeader ? row[actualHeader] : undefined;
            };
            
            const newCustomers: Omit<Customer, 'id'>[] = json.map((row, index) => {
                const name = String(getValue(row, CANONICAL_HEADERS.NAME) || '').trim();
                const city = String(getValue(row, CANONICAL_HEADERS.CITY) || '').trim();
                
                if (!name || !city) {
                    console.warn(`Skipping row ${index + 2} due to missing Name or City.`);
                    return null;
                }

                const salesPersonName = String(getValue(row, CANONICAL_HEADERS.SALES_PERSON_NAME) || '').trim();
                const salesPerson = salesPersons.find(sp => sp.name.toLowerCase() === salesPersonName.toLowerCase());
                const salesPersonId = salesPerson ? salesPerson.id : null;

                return {
                    name: name,
                    address: String(getValue(row, CANONICAL_HEADERS.ADDRESS) || ''),
                    city: city,
                    pincode: String(getValue(row, CANONICAL_HEADERS.PINCODE) || ''),
                    salesPersonId: salesPersonId,
                    discountStructure: {
                        singleCore: parseFloat(getValue(row, CANONICAL_HEADERS.SINGLE_CORE_DISCOUNT)) || 0,
                        multiCore: parseFloat(getValue(row, CANONICAL_HEADERS.MULTI_CORE_DISCOUNT)) || 0,
                        specialCable: parseFloat(getValue(row, CANONICAL_HEADERS.SPECIAL_CABLE_DISCOUNT)) || 0,
                        accessories: parseFloat(getValue(row, CANONICAL_HEADERS.ACCESSORIES_DISCOUNT)) || 0,
                    },
                };
            }).filter((c): c is Omit<Customer, 'id'> => c !== null);

            if (newCustomers.length > 0) {
                await addCustomersBatch(newCustomers);
                alert(`${newCustomers.length} customers imported successfully!`);
                fetchCustomers(1);
            } else {
                alert('No valid customers found in the file. Make sure required columns "Name" and "City" have values.');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : `An issue occurred during file processing. Please check the console for details.`;
            console.error("Error importing customers:", error);
            alert(`Failed to import customers.\n\nError: ${errorMessage}`);
        }
    };
    reader.onerror = (error) => {
        console.error("File reading error:", error);
        alert("Failed to read the file.");
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
  
  const customerIdsInView = displayedCustomers.map(c => c.id);

  if (salesPersons === null || quotations === null) {
    return <div className="bg-white p-6 rounded-lg shadow-md text-center">Loading data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 p-2 rounded-lg shadow-sm border border-slate-200">
        <h3 className="text-base font-semibold text-slate-800 mb-1">
            Quotation Summary for {customerIdsInView.length} Customer{customerIdsInView.length !== 1 ? 's' : ''} on this page
        </h3>
        <div className="flex flex-wrap gap-2 items-center">
            <div
                onClick={() => onFilterQuotations({ customerIds: customerIdsInView })}
                className="cursor-pointer text-blue-700 hover:text-blue-900 transition-colors text-sm font-semibold p-1 rounded-md hover:bg-blue-100/50"
                title={`View all ${quotationStatsForVisibleCustomers.total.count} quotations`}
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
                    Export Visible
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
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1.5 px-3 rounded-md transition duration-300"
                >
                    Upload
                </button>
                <button
                    onClick={handleAddNew}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-3 rounded-md transition duration-300"
                >
                    Add New
                </button>
            </div>
         </div>
         
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
                    <option value="salesPersonId">Sales Person</option>
                </select>
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-600">Order</label>
                <button type="button" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="mt-1 w-full bg-white hover:bg-slate-50 text-slate-700 font-semibold py-1 px-4 border border-slate-300 rounded-md shadow-sm flex items-center justify-center text-sm">
                    {sortOrder === 'asc' ? 'Ascending ▲' : 'Descending ▼'}
                </button>
            </div>
         </div>

        {isLoading ? (
            <p className="text-slate-500 text-center py-8">Loading customers...</p>
        ) : displayedCustomers.length > 0 ? (
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
                        {displayedCustomers.map(customer => (
                            <tr key={customer.id} className="hover:bg-slate-50/70">
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">{customer.id}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-slate-800">{customer.name}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600 max-w-xs truncate">{customer.address}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">{customer.city}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">{customer.pincode}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">{getSalesPersonName(customer.salesPersonId)}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">
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
                    <p className="text-slate-600">Showing {displayedCustomers.length} of {totalCount} customers</p>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border rounded-md disabled:opacity-50">Previous</button>
                        <span>Page {currentPage} of {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border rounded-md disabled:opacity-50">Next</button>
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
      />
    </div>
  );
};