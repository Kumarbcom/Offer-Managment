
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Customer, SalesPerson, Quotation, QuotationStatus, User } from '../types';
import { CustomerAddModal } from './CustomerAddModal';
import { QUOTATION_STATUSES } from '../constants';
import { getCustomersPaginated, upsertCustomer, deleteCustomer, addCustomersBatch, fetchAllCustomersForExport } from '../supabase';
import { useDebounce } from '../hooks/useDebounce';
import { calculateTotalAmount } from '../utils/calc';

declare var XLSX: any;

interface CustomerManagerProps {
  salesPersons: SalesPerson[] | null;
  quotations: Quotation[] | null;
  onFilterQuotations: (filter: { customerIds?: number[], status?: QuotationStatus }) => void;
  currentUser: User;
}

type SortByType = 'id' | 'name' | 'city' | 'pincode' | 'salesPerson' | 'salesPersonId';
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

const statusTheme: Record<string, { border: string; bg: string; dot: string; badge: string; valColor: string; pillBg: string; pillText: string }> = {
  'Open': { 
    border: 'border-blue-200 hover:border-blue-400', 
    bg: 'from-blue-50/70 to-blue-100/40 hover:to-blue-100/70', 
    dot: 'bg-blue-600', 
    badge: 'text-blue-700', 
    valColor: 'text-blue-900',
    pillBg: 'bg-blue-50 border-blue-200',
    pillText: 'text-blue-700'
  },
  'PO received': { 
    border: 'border-emerald-200 hover:border-emerald-400', 
    bg: 'from-emerald-50/70 to-emerald-100/40 hover:to-emerald-100/70', 
    dot: 'bg-emerald-600', 
    badge: 'text-emerald-700', 
    valColor: 'text-emerald-900',
    pillBg: 'bg-emerald-50 border-emerald-200',
    pillText: 'text-emerald-700'
  },
  'Partial PO Received': { 
    border: 'border-amber-200 hover:border-amber-400', 
    bg: 'from-amber-50/70 to-amber-100/40 hover:to-amber-100/70', 
    dot: 'bg-amber-600', 
    badge: 'text-amber-800', 
    valColor: 'text-amber-900',
    pillBg: 'bg-amber-50 border-amber-200',
    pillText: 'text-amber-800'
  },
  'Expired': { 
    border: 'border-yellow-200 hover:border-yellow-400', 
    bg: 'from-yellow-50/70 to-yellow-100/40 hover:to-yellow-100/70', 
    dot: 'bg-yellow-600', 
    badge: 'text-yellow-800', 
    valColor: 'text-yellow-900',
    pillBg: 'bg-yellow-50 border-yellow-200',
    pillText: 'text-yellow-800'
  },
  'Lost': { 
    border: 'border-rose-200 hover:border-rose-400', 
    bg: 'from-rose-50/70 to-rose-100/40 hover:to-rose-100/70', 
    dot: 'bg-rose-600', 
    badge: 'text-rose-700', 
    valColor: 'text-rose-900',
    pillBg: 'bg-rose-50 border-rose-200',
    pillText: 'text-rose-700'
  },
  'Under Review': { 
    border: 'border-indigo-200 hover:border-indigo-400', 
    bg: 'from-indigo-50/70 to-indigo-100/40 hover:to-indigo-100/70', 
    dot: 'bg-indigo-600', 
    badge: 'text-indigo-700', 
    valColor: 'text-indigo-900',
    pillBg: 'bg-indigo-50 border-indigo-200',
    pillText: 'text-indigo-700'
  },
  'Need Amendment': { 
    border: 'border-purple-200 hover:border-purple-400', 
    bg: 'from-purple-50/70 to-purple-100/40 hover:to-purple-100/70', 
    dot: 'bg-purple-600', 
    badge: 'text-purple-700', 
    valColor: 'text-purple-900',
    pillBg: 'bg-purple-50 border-purple-200',
    pillText: 'text-purple-700'
  },
};


// Module-level cache for instantaneous (0ms) tab switching without loading delays
let cachedCustomersList: Customer[] = [];
let cachedCustomersTotalCount = 0;

export const CustomerManager: React.FC<CustomerManagerProps> = ({ salesPersons, quotations, onFilterQuotations, currentUser }) => {
  const [displayedCustomers, setDisplayedCustomers] = useState<Customer[]>(cachedCustomersList);
  const [isLoading, setIsLoading] = useState(cachedCustomersList.length === 0);
  const [totalCount, setTotalCount] = useState(cachedCustomersTotalCount);
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
  const [activeDropdown, setActiveDropdown] = useState<'export' | 'update' | 'template' | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.toolbar-dropdown')) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const debouncedSearchCity = useDebounce(searchCity, 300);

  const totalPages = Math.ceil(totalCount / PAGE_LIMIT);

  const fetchCustomers = useCallback(async (page: number, showLoading = true) => {
    if (showLoading) setIsLoading(true);
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
        // Cache default page 1 results for instant tab switches
        if (page === 1 && !debouncedSearchTerm && !debouncedSearchCity && selectedSalesPersonId === 'all') {
            cachedCustomersList = result.customers;
            cachedCustomersTotalCount = result.count;
        }
    } catch (error) {
        console.error('Failed to fetch customers:', error);
    } finally {
        setIsLoading(false);
    }
  }, [sortBy, sortOrder, debouncedSearchTerm, debouncedSearchCity, selectedSalesPersonId]);
  
  const isInitialMount = useRef(true);

  // Triggered when filters or sorting change
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      // If we already have cached customers and no filters, revalidate quietly in background (no spinner)
      const hasInitialCache = cachedCustomersList.length > 0 && !debouncedSearchTerm && !debouncedSearchCity && selectedSalesPersonId === 'all';
      fetchCustomers(1, !hasInitialCache);
      return;
    }
    setCurrentPage(1);
    fetchCustomers(1, true);
  }, [debouncedSearchTerm, debouncedSearchCity, sortBy, sortOrder, selectedSalesPersonId]);

  // Triggered only when pagination page changes
  const prevPageRef = useRef(1);
  useEffect(() => {
    if (prevPageRef.current !== currentPage) {
      prevPageRef.current = currentPage;
      fetchCustomers(currentPage, true);
    }
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

  const formatCustomerForExport = (c: Customer) => ({
      "Customer ID": c.id,
      "Customer Name": c.name,
      "Address": c.address || '',
      "City": c.city || '',
      "Pincode": c.pincode || '',
      "Sales Person": getSalesPersonName(c.salesPersonId),
      "Single Core Discount (%)": c.discountStructure?.singleCore ?? 0,
      "Multi Core Discount (%)": c.discountStructure?.multiCore ?? 0,
      "Special Cable Discount (%)": c.discountStructure?.specialCable ?? 0,
      "Accessories Discount (%)": c.discountStructure?.accessories ?? 0,
  });

  const exportCustomersToExcel = (customerList: Customer[], filename: string) => {
      const dataToExport = customerList.map(formatCustomerForExport);
      const ws = XLSX.utils.json_to_sheet(dataToExport);

      // Auto-fit column widths for clean readability in Excel
      ws['!cols'] = [
          { wch: 14 }, // Customer ID
          { wch: 40 }, // Customer Name
          { wch: 45 }, // Address
          { wch: 20 }, // City
          { wch: 14 }, // Pincode
          { wch: 24 }, // Sales Person
          { wch: 24 }, // Single Core Discount (%)
          { wch: 24 }, // Multi Core Discount (%)
          { wch: 26 }, // Special Cable Discount (%)
          { wch: 24 }, // Accessories Discount (%)
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Customer Master");
      XLSX.writeFile(wb, filename);
  };

  const handleExportVisible = () => {
      exportCustomersToExcel(
          displayedCustomers,
          `Customer_Master_Visible_${new Date().toISOString().split('T')[0]}.xlsx`
      );
  };

  const handleExportTotalMaster = async () => {
      setIsUploading(true);
      setUploadProgress(`Exporting total customer master... Fetching all ${totalCount || ''} customers from database...`);
      try {
          const allCustomers = await fetchAllCustomersForExport();
          exportCustomersToExcel(
              allCustomers,
              `Customer_Master_Total_${new Date().toISOString().split('T')[0]}.xlsx`
          );
      } catch (error) {
          console.error("Failed to export customer master:", error);
          alert(error instanceof Error ? error.message : "Failed to export total customer master");
      } finally {
          setIsUploading(false);
          setUploadProgress('');
      }
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
                  const rawName = row.name ?? row['Customer Name'] ?? row['Customer'] ?? row['name'];
                  if (!rawName) return null;

                  const customer: Partial<Customer> = {
                      name: String(rawName),
                      address: String(row.address ?? row['Address'] ?? row['address'] ?? ''),
                      city: String(row.city ?? row['City'] ?? row['city'] ?? ''),
                      pincode: String(row.pincode ?? row['Pincode'] ?? row['pincode'] ?? ''),
                      salesPersonId: (() => {
                          // Check name-based fields first against live salesPersons list
                          const nameRaw = row['Sales Rep'] ?? row.salesPersonName ?? row['salesPersonName'] ?? row['Sales Person'] ?? row['salesPerson'] ?? row['sales_person'];
                          if (nameRaw !== undefined && nameRaw !== null && nameRaw !== '') {
                              const str = String(nameRaw).trim().toLowerCase();
                              // Try exact match or substring match against live staff
                              const found = salesPersons?.find(sp => {
                                  const spn = sp.name.toLowerCase();
                                  return spn === str || spn.includes(str) || str.includes(spn);
                              });
                              if (found) return found.id;

                              // Name aliases fallback
                              if (str.includes('vinay') || str.includes('ananth')) {
                                  const sp = salesPersons?.find(s => s.name.toLowerCase().includes('vinay'));
                                  return sp ? sp.id : 1;
                              }
                              if (str.includes('office')) {
                                  const sp = salesPersons?.find(s => s.name.toLowerCase().includes('office'));
                                  return sp ? sp.id : 2;
                              }
                              if (str.includes('giri')) {
                                  const sp = salesPersons?.find(s => s.name.toLowerCase().includes('giri'));
                                  return sp ? sp.id : 3;
                              }
                              if (str.includes('veeresh')) {
                                  const sp = salesPersons?.find(s => s.name.toLowerCase().includes('veeresh'));
                                  return sp ? sp.id : 4;
                              }
                          }

                          // Check numeric ID
                          const spRaw = row.salesPersonId ?? row.sales_person_id ?? row['SalesPersonId'];
                          if (spRaw !== undefined && spRaw !== null && spRaw !== '') {
                              const num = parseInt(String(spRaw), 10);
                              if (!isNaN(num) && num > 0) return num;
                          }
                          return 2; // Default to Office (ID 2)
                      })(),
                      discountStructure: {
                          singleCore: parseFloat(String(row.singleCoreDiscount ?? row['Single Core Discount (%)'] ?? row['Single Core Discount'] ?? 0)) || 0,
                          multiCore: parseFloat(String(row.multiCoreDiscount ?? row['Multi Core Discount (%)'] ?? row['Multi Core Discount'] ?? 0)) || 0,
                          specialCable: parseFloat(String(row.specialCableDiscount ?? row['Special Cable Discount (%)'] ?? row['Special Cable Discount'] ?? 0)) || 0,
                          accessories: parseFloat(String(row.accessoriesDiscount ?? row['Accessories Discount (%)'] ?? row['Accessories Discount'] ?? 0)) || 0,
                      }
                  };
                  
                  const idKey = Object.keys(row).find(key => key.toLowerCase().startsWith('id') || key.toLowerCase().includes('customer id'));
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
                  await addCustomersBatch(customersToUpsert, (done, total) => {
                      setUploadProgress(`Upserting customers: ${done} / ${total}...`);
                  });
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
      {/* Overall Quotation Summary - Dashboard Stat Cards */}
      <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shadow-2xs">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Overall Quotation Summary
              </h3>
              <p className="text-[11px] text-slate-500">
                Click any card to filter quotations instantly
              </p>
            </div>
          </div>
          <button
            onClick={() => onFilterQuotations({})}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
          >
            <span>View All ({allQuotationStats.total.count})</span>
            <span>→</span>
          </button>
        </div>

        {/* Dashboard Stat Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {/* Total Card */}
          <div
            onClick={() => onFilterQuotations({})}
            className="group cursor-pointer bg-gradient-to-br from-slate-50 to-blue-50/50 hover:to-blue-100/70 p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 transition-all duration-200 shadow-2xs hover:shadow-xs flex flex-col justify-between"
            title={`View all ${allQuotationStats.total.count} quotations`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Total</span>
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            </div>
            <div className="mt-1.5">
              <div className="text-base font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors">
                {allQuotationStats.total.count.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] font-semibold text-slate-600 truncate mt-0.5" title={formatCurrency(allQuotationStats.total.value)}>
                {formatCurrency(allQuotationStats.total.value)}
              </div>
            </div>
          </div>

          {/* Status Cards */}
          {QUOTATION_STATUSES.map(status => {
            const stats = allQuotationStats.byStatus[status] || { count: 0, value: 0 };
            const cfg = statusTheme[status] || { 
              border: 'border-slate-200 hover:border-slate-400',
              bg: 'from-slate-50 to-slate-100/50 hover:to-slate-100',
              dot: 'bg-slate-400',
              badge: 'text-slate-700',
              valColor: 'text-slate-700'
            };
            return (
              <div
                key={status}
                onClick={() => onFilterQuotations({ status })}
                className={`group cursor-pointer bg-gradient-to-br ${cfg.bg} p-2.5 rounded-lg border ${cfg.border} transition-all duration-200 shadow-2xs hover:shadow-xs flex flex-col justify-between`}
                title={`View ${stats.count} '${status}' quotations (${formatCurrency(stats.value)})`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-[11px] font-bold uppercase tracking-wider truncate ${cfg.badge}`} title={status}>
                    {status}
                  </span>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`}></span>
                </div>
                <div className="mt-1.5">
                  <div className="text-base font-extrabold text-slate-900 group-hover:scale-105 transition-transform origin-left">
                    {stats.count.toLocaleString('en-IN')}
                  </div>
                  <div className={`text-[11px] font-semibold truncate mt-0.5 ${cfg.valColor}`} title={formatCurrency(stats.value)}>
                    {formatCurrency(stats.value)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
         <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-black">Customers ({totalCount})</h2>
            {/* Mobile Actions: compact sequence */}
            <div className="flex md:hidden gap-1.5 flex-wrap">
                <button 
                    onClick={handleAddNew} 
                    disabled={isUploading}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2.5 py-1 rounded-lg text-xs font-bold shadow-xs disabled:opacity-50"
                >
                    + Add New
                </button>
                <button 
                    onClick={handleExportVisible} 
                    disabled={isUploading}
                    className="bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded-lg text-xs font-semibold shadow-2xs disabled:opacity-50"
                >
                    Export
                </button>
                <button 
                    onClick={handleUploadClick} 
                    disabled={isUploading}
                    className="bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded-lg text-xs font-semibold shadow-2xs disabled:opacity-50"
                >
                    Update
                </button>
                <button 
                    onClick={handleDownloadTemplate} 
                    disabled={isUploading}
                    className="bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded-lg text-xs font-semibold shadow-2xs disabled:opacity-50"
                >
                    Template
                </button>
            </div>

            {/* Desktop Actions matching Product Master: 1. Add Customer (New) -> 2. Export -> 3. Update -> 4. Template */}
            <div className="hidden md:flex flex-wrap gap-2 text-xs items-center">
                {/* 1. Add Customer (New) */}
                <button 
                    onClick={handleAddNew} 
                    disabled={isUploading} 
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-2 px-4 rounded-xl shadow-md shadow-blue-500/25 hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 text-xs cursor-pointer"
                >
                    <span className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                    </span>
                    <span className="tracking-wide">Add Customer (New)</span>
                </button>

                {/* 2. Export (Dropdown with Master and Visible Options) */}
                <div className="relative toolbar-dropdown">
                    <button 
                        type="button"
                        onClick={() => setActiveDropdown(prev => prev === 'export' ? null : 'export')}
                        disabled={isUploading} 
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                    >
                        <svg className="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        <span>Export</span>
                        <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {activeDropdown === 'export' && (
                        <div className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 text-xs animate-in fade-in zoom-in-95 duration-100">
                            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                                Customer Export Options
                            </div>
                            <button 
                                onClick={() => { setActiveDropdown(null); handleExportTotalMaster(); }} 
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-800 transition-colors flex flex-col"
                            >
                                <span className="font-semibold text-slate-900">📥 Export Total Master</span>
                                <span className="text-[10px] text-slate-500">ID, Customer Name, Sales Person name, Discounts & contacts</span>
                            </button>
                            <button 
                                onClick={() => { setActiveDropdown(null); handleExportVisible(); }} 
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-800 transition-colors flex flex-col border-t border-slate-50"
                            >
                                <span className="font-semibold text-slate-900">📄 Export Visible Customers</span>
                                <span className="text-[10px] text-slate-500">Only the currently filtered/searched customers</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* 3. Update (Dropdown: Upload Customer Updates) */}
                <div className="relative toolbar-dropdown">
                    <button 
                        type="button"
                        onClick={() => setActiveDropdown(prev => prev === 'update' ? null : 'update')}
                        disabled={isUploading} 
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                    >
                        <svg className="w-3.5 h-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                        <span>Update</span>
                        <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {activeDropdown === 'update' && (
                        <div className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 text-xs animate-in fade-in zoom-in-95 duration-100">
                            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                                Customer Updates
                            </div>
                            <button 
                                onClick={() => { setActiveDropdown(null); handleUploadClick(); }} 
                                className="w-full text-left px-3 py-2 hover:bg-amber-50 text-slate-800 transition-colors flex flex-col"
                            >
                                <span className="font-semibold text-slate-900">📤 Upload Customer Updates</span>
                                <span className="text-[10px] text-slate-500">Updates existing customers, sales persons & discounts from Excel</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* 4. Template (Dropdown: Download Template & Upload Filled Template) */}
                <div className="relative toolbar-dropdown">
                    <button 
                        type="button"
                        onClick={() => setActiveDropdown(prev => prev === 'template' ? null : 'template')}
                        disabled={isUploading} 
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                    >
                        <svg className="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        <span>Template</span>
                        <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {activeDropdown === 'template' && (
                        <div className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 text-xs animate-in fade-in zoom-in-95 duration-100">
                            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                                Customer Import Template
                            </div>
                            <button 
                                onClick={() => { setActiveDropdown(null); handleDownloadTemplate(); }} 
                                className="w-full text-left px-3 py-2 hover:bg-sky-50 text-slate-800 transition-colors flex flex-col"
                            >
                                <span className="font-semibold text-slate-900">📥 Download Customer Template</span>
                                <span className="text-[10px] text-slate-500">Blank spreadsheet with all required customer columns</span>
                            </button>
                            <button 
                                onClick={() => { setActiveDropdown(null); handleUploadClick(); }} 
                                className="w-full text-left px-3 py-2 hover:bg-sky-50 text-slate-800 transition-colors flex flex-col border-t border-slate-50"
                            >
                                <span className="font-semibold text-slate-900">📤 Upload Filled Template</span>
                                <span className="text-[10px] text-slate-500">Imports new customers into database</span>
                            </button>
                        </div>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls"/>
                </div>
            </div>
         </div>
         {isUploading && ( <div className="my-2 p-2 text-center text-sm font-semibold text-indigo-700 bg-indigo-100 rounded-md" role="status">{uploadProgress}</div> )}
         
         <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-4 pb-3 border-b border-slate-200">
            <div>
                <label htmlFor="searchTerm" className="block text-xs font-semibold text-slate-700">Search by Name</label>
                <input type="text" id="searchTerm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-200/90 rounded-xl shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs text-slate-900 bg-white" placeholder="e.g. ABC Corp" />
            </div>
            <div>
                <label htmlFor="searchCity" className="block text-xs font-semibold text-slate-700">Search by City</label>
                <input type="text" id="searchCity" value={searchCity} onChange={e => setSearchCity(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-200/90 rounded-xl shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs text-slate-900 bg-white" placeholder="e.g. Bangalore" />
            </div>
            <div>
                <label htmlFor="salesPersonFilter" className="block text-xs font-semibold text-slate-700">Filter by Sales Person</label>
                <select 
                    id="salesPersonFilter" 
                    value={selectedSalesPersonId} 
                    onChange={e => setSelectedSalesPersonId(e.target.value === 'all' ? 'all' : Number(e.target.value))} 
                    className="mt-1 block w-full px-3 py-2 border border-slate-200/90 rounded-xl shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs bg-white text-slate-900"
                >
                    <option value="all">All Sales Persons</option>
                    {salesPersons?.map(sp => (
                        <option key={sp.id} value={sp.id}>{sp.name}</option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="sortBy" className="block text-xs font-semibold text-slate-700">Sort By</label>
                <select id="sortBy" value={sortBy} onChange={e => setSortBy(e.target.value as SortByType)} className="mt-1 block w-full px-3 py-2 border border-slate-200/90 rounded-xl shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs bg-white text-slate-900">
                    <option value="id">ID</option>
                    <option value="name">Customer Name</option>
                    <option value="city">City</option>
                    <option value="pincode">Pincode</option>
                    <option value="salesPersonId">Sales Person</option>
                </select>
            </div>
            <div>
                <label className="block text-xs font-semibold text-slate-700">Order</label>
                <button type="button" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="mt-1 w-full bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2 px-3 border border-slate-200/90 rounded-xl shadow-2xs flex items-center justify-center text-xs transition-colors">
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
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {['ID', 'Customer Name', 'Address', 'City', 'Pincode', 'Sales Person', 'Quotations', 'Actions'].map(header => (
                            <th key={header} scope="col" className={`px-3 py-2 text-xs font-bold text-slate-800 uppercase tracking-wider ${header === 'Actions' ? 'text-center' : 'text-left'}`}>
                              {header}
                            </th>
                          ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {displayedCustomers.map(customer => (
                            <tr key={customer.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="px-3 py-2.5 whitespace-nowrap text-xs font-mono text-slate-500 align-top">#{customer.id}</td>
                                <td className="px-3 py-2.5 text-xs font-bold text-slate-900 align-top whitespace-normal break-words min-w-[160px] max-w-[240px] leading-snug">
                                    {customer.name}
                                </td>
                                <td className="px-3 py-2.5 text-xs text-slate-600 align-top whitespace-normal break-words min-w-[160px] max-w-[240px] leading-relaxed">
                                    {customer.address || <span className="text-slate-400 italic">—</span>}
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-700 align-top">{customer.city || '—'}</td>
                                <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-700 align-top">{customer.pincode || '—'}</td>
                                <td className="px-3 py-2.5 whitespace-nowrap text-xs font-semibold text-slate-800 align-top">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-semibold">
                                        {getSalesPersonName(customer.salesPersonId)}
                                    </span>
                                </td>
                                <td className="px-3 py-2.5 text-sm text-slate-800 align-top min-w-[280px]">
                                    {(() => {
                                        const customerQuotes = quotations?.filter(q => q.customerId === customer.id) || [];
                                        if (customerQuotes.length === 0) {
                                            return <span className="text-xs text-slate-400 italic">No quotations</span>;
                                        }

                                        const rows = QUOTATION_STATUSES.map(status => {
                                            const matched = customerQuotes.filter(q => q.status === status);
                                            if (matched.length === 0) return null;
                                            const totalVal = matched.reduce((sum, q) => sum + calculateTotalAmount(q), 0);
                                            const theme = statusTheme[status] || { pillBg: 'bg-slate-50 border-slate-200', pillText: 'text-slate-700' };
                                            return { status, count: matched.length, totalVal, theme };
                                        }).filter(Boolean);

                                        return (
                                            <div className="space-y-1">
                                                <div className="grid grid-cols-[115px_50px_1fr] text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-0.5 border-b border-slate-100">
                                                    <span>Status</span>
                                                    <span className="text-center">Offers</span>
                                                    <span className="text-right">Value</span>
                                                </div>
                                                {rows.map(row => (
                                                    <div
                                                        key={row!.status}
                                                        onClick={() => onFilterQuotations({ customerIds: [customer.id], status: row!.status })}
                                                        className="grid grid-cols-[115px_50px_1fr] items-center gap-1.5 py-0.5 px-1 rounded hover:bg-slate-100/70 cursor-pointer transition-colors group"
                                                        title={`View ${row!.count} '${row!.status}' quotation(s) for ${customer.name}`}
                                                    >
                                                        <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${row!.theme.pillBg} ${row!.theme.pillText} truncate`}>
                                                            {row!.status}
                                                        </span>
                                                        <span className="text-center text-xs font-bold text-slate-700 group-hover:text-blue-600">
                                                            {row!.count}
                                                        </span>
                                                        <span className="text-right text-xs font-semibold text-slate-900 font-mono">
                                                            {formatCurrency(row!.totalVal)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap text-center text-sm font-medium align-middle">
                                    <div className="inline-flex items-center justify-center gap-1.5">
                                        <button 
                                            onClick={() => handleEdit(customer)} 
                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-blue-600 hover:text-blue-800 bg-blue-50/70 hover:bg-blue-100 transition-colors border border-blue-200/60 cursor-pointer shadow-2xs"
                                            title="Edit Customer"
                                            aria-label="Edit Customer"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                            </svg>
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(customer.id)} 
                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-600 hover:text-rose-800 bg-rose-50/70 hover:bg-rose-100 transition-colors border border-rose-200/60 cursor-pointer shadow-2xs"
                                            title="Delete Customer"
                                            aria-label="Delete Customer"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6"/>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                                <line x1="10" y1="11" x2="10" y2="17"/>
                                                <line x1="14" y1="11" x2="14" y2="17"/>
                                            </svg>
                                        </button>
                                    </div>
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
        currentUser={currentUser}
      />
    </div>
  );
};
