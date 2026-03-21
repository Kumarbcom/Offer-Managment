
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
    'Under Review': { bg: 'bg-amber-100', text: 'text-amber-700' },
    'Need Amendment': { bg: 'bg-violet-100', text: 'text-violet-700' },
    'Expired': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    'Lost': { bg: 'bg-rose-100', text: 'text-rose-700' },
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
            } catch (error) {
                alert(error instanceof Error ? error.message : 'Failed to delete customer');
            }
        }
    };

    const handleSaveCustomer = async (customer: Customer) => {
        try {
            await upsertCustomer(customer);
            fetchCustomers(currentPage);
        } catch (error) {
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
            <div className="bg-white/90 backdrop-blur-xl p-4 rounded-2xl shadow-lg border border-slate-100 relative overflow-hidden ring-1 ring-slate-900/5">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-400/10 to-emerald-400/10 blur-3xl rounded-full pointer-events-none"></div>
                
                <h3 className="text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 mb-3 tracking-tight flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    Overall Quotation Summary
                </h3>
                <div className="flex flex-wrap gap-3 items-center relative z-10">
                    <div
                        onClick={() => onFilterQuotations({})}
                        className="cursor-pointer bg-slate-100 hover:bg-white text-indigo-700 hover:text-indigo-800 transition-all text-sm shadow-sm hover:shadow-md p-2 rounded-xl flex items-center border border-slate-200/60"
                        title={`View all ${allQuotationStats.total.count} quotations`}
                    >
                        <span className="opacity-80">Total Enquiries: </span>
                        <span className="font-black ml-1 text-lg">{allQuotationStats.total.count}</span>
                        <span className="text-slate-300 mx-2">|</span>
                        <span className="font-black bg-indigo-100 px-2 py-0.5 rounded text-indigo-800">{formatCurrency(allQuotationStats.total.value)}</span>
                    </div>
                    {QUOTATION_STATUSES.map(status => {
                        const stats = allQuotationStats.byStatus[status];
                        if (stats.count === 0) return null;
                        const colors = statusColors[status];
                        return (
                            <div
                                key={status}
                                onClick={() => onFilterQuotations({ status: status })}
                                className={`cursor-pointer ${colors.bg} ${colors.text} hover:opacity-90 transition-all text-sm shadow-sm hover:shadow-md hover:-translate-y-0.5 p-2 rounded-xl flex items-center border border-white/40 ring-1 ring-black/5`}
                                title={`View ${stats.count} '${status}' quotations`}
                            >
                                <span className="opacity-90 font-semibold">{status}: </span>
                                <span className="font-black ml-1 text-lg">{stats.count}</span>
                                <span className="opacity-30 mx-2">|</span>
                                <span className="font-bold">{formatCurrency(stats.value)}</span>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="bg-white/90 backdrop-blur-xl p-4 md:p-6 rounded-2xl shadow-lg border border-slate-100 relative overflow-hidden">
                <div className="flex flex-wrap gap-4 justify-between items-center mb-6 pb-4 border-b border-slate-100">
                    <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500 tracking-tight">
                        Customers <span className="text-lg bg-slate-100 text-slate-600 px-3 py-1 rounded-full ml-1 align-middle">{totalCount}</span>
                    </h2>
                    <div className="flex flex-wrap gap-2 text-sm justify-end">
                        <button
                            onClick={handleExport}
                            disabled={isUploading}
                            className="bg-white border-2 border-slate-200 hover:border-teal-500 hover:text-teal-600 hover:bg-teal-50 text-slate-700 font-bold py-1.5 px-4 rounded-xl transition duration-300 disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Export
                        </button>
                        <button
                            onClick={handleDownloadTemplate}
                            disabled={isUploading}
                            className="bg-white border-2 border-slate-200 hover:border-sky-500 hover:text-sky-600 hover:bg-sky-50 text-slate-700 font-bold py-1.5 px-4 rounded-xl transition duration-300 disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            Template
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
                        <button
                            onClick={handleUploadClick}
                            disabled={isUploading}
                            className="bg-white border-2 border-slate-200 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 text-slate-700 font-bold py-1.5 px-4 rounded-xl transition duration-300 disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            {isUploading ? 'Uploading...' : 'Upload'}
                        </button>
                        <button
                            onClick={handleAddNew}
                            disabled={isUploading}
                            className="bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-1.5 px-5 rounded-xl shadow-lg ring-2 ring-blue-500/30 transition duration-300 disabled:opacity-50 flex items-center gap-1.5"
                        >
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"></path></svg>
                            Add New
                        </button>
                    </div>
                </div>
                {isUploading && (<div className="my-4 p-3 text-center text-sm font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl" role="status">{uploadProgress}</div>)}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-6 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
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
                                        <tr key={customer.id} className="hover:bg-indigo-50/40 transition-colors duration-200 group">
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 font-medium">#{customer.id}</td>
                                            <td className="px-4 py-3 text-sm font-bold text-slate-800">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm border border-indigo-200/50">
                                                        {customer.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="truncate max-w-[200px]" title={customer.name}>{customer.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-500 max-w-[200px] truncate" title={customer.address}>{customer.address}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 font-medium">{customer.city}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{customer.pincode}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700 font-semibold">{getSalesPersonName(customer.salesPersonId)}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">
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
                                                                className={`cursor-pointer group/stat hover:scale-105 transition-transform ${colors.bg} ${colors.text} text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded flex items-center shadow-sm w-max`}
                                                                title={`View ${relevantQuotes.length} '${status}' quotation(s)`}
                                                            >
                                                                <span>{status}: </span>
                                                                <span className="font-black ml-1">{relevantQuotes.length}</span>
                                                                <span className="opacity-40 mx-1.5">|</span>
                                                                <span className="font-bold border-l border-current/20 pl-1.5">{formatCurrency(totalValue)}</span>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEdit(customer)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-colors" title="Edit Customer">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                    </button>
                                                    <button onClick={() => handleDelete(customer.id)} className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded-lg transition-colors" title="Delete Customer">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
