import React, { useState, useMemo, useRef } from 'react';
import type { Customer, SalesPerson, Quotation, QuotationStatus } from '../types';
import { CustomerAddModal } from './CustomerAddModal';
import { QUOTATION_STATUSES } from '../constants';

declare var XLSX: any;

interface CustomerManagerProps {
  customers: Customer[] | null;
  setCustomers: (value: React.SetStateAction<Customer[]>) => Promise<void>;
  salesPersons: SalesPerson[] | null;
  quotations: Quotation[] | null;
  onFilterQuotations: (filter: { customerIds: number[], status?: QuotationStatus }) => void;
}

type SortByType = 'id' | 'name' | 'city' | 'pincode' | 'salesPerson';
type SortOrderType = 'asc' | 'desc';

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
    'Lost': { bg: 'bg-red-100', text: 'text-red-700' },
};


export const CustomerManager: React.FC<CustomerManagerProps> = ({ customers, setCustomers, salesPersons, quotations, onFilterQuotations }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [sortBy, setSortBy] = useState<SortByType>('id');
  const [sortOrder, setSortOrder] = useState<SortOrderType>('asc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getSalesPersonName = (id: number | '') => {
    if (id === '' || !salesPersons) return 'N/A';
    return salesPersons.find(sp => sp.id === id)?.name || 'Unknown';
  };

  const filteredAndSortedCustomers = useMemo(() => {
    if (!customers) return [];
    return customers
      .filter(customer => {
        const nameMatch = customer.name.toLowerCase().includes(searchTerm.toLowerCase());
        const cityMatch = customer.city.toLowerCase().includes(searchCity.toLowerCase());
        return nameMatch && cityMatch;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'id':
            comparison = a.id - b.id;
            break;
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'city':
            comparison = a.city.localeCompare(b.city);
            break;
          case 'pincode':
            comparison = a.pincode.localeCompare(b.pincode);
            break;
          case 'salesPerson':
            comparison = getSalesPersonName(a.salesPersonId).localeCompare(getSalesPersonName(b.salesPersonId));
            break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [customers, searchTerm, searchCity, sortBy, sortOrder, salesPersons]);

  const quotationStatsForVisibleCustomers = useMemo(() => {
    const initialStats = {
      total: { count: 0, value: 0 },
      byStatus: QUOTATION_STATUSES.reduce((acc, status) => {
        acc[status] = { count: 0, value: 0 };
        return acc;
      }, {} as Record<QuotationStatus, { count: number; value: number }>)
    };

    if (!quotations || filteredAndSortedCustomers.length === 0) return initialStats;

    const customerIdsInView = new Set(filteredAndSortedCustomers.map(c => c.id));
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
  }, [filteredAndSortedCustomers, quotations]);

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
        if (!customers) return;
        await setCustomers(customers.filter(c => c.id !== id));
    }
  };

  const handleSaveCustomer = async (customer: Customer) => {
    if (!customers) return;
    await setCustomers(prev => {
        const index = prev.findIndex(c => c.id === customer.id);
        if (index > -1) {
            const newCustomers = [...prev];
            newCustomers[index] = customer;
            return newCustomers;
        } else {
            return [...prev, customer];
        }
    });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCustomerToEdit(null);
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
    if (!customers) return;
    const dataToExport = customers.map(customer => ({
      ID: customer.id,
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
    XLSX.writeFile(wb, "Customers_Export.xlsx");
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
        if (!customers || !salesPersons) return;
        const data = e.target?.result;
        if (!data) return;

        try {
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json: any[] = XLSX.utils.sheet_to_json(worksheet);
            
            const lastId = customers.length > 0 ? Math.max(...customers.map(c => c.id)) : 0;
            let newId = lastId;

            const newCustomers: Customer[] = json.map((row, index) => {
                if (!row['Name'] || !row['City']) {
                    console.warn(`Skipping row ${index + 2} due to missing Name or City.`);
                    return null;
                }

                const salesPersonName = String(row['SalesPersonName'] || '').trim();
                const salesPerson = salesPersons.find(sp => sp.name.toLowerCase() === salesPersonName.toLowerCase());
                const salesPersonId = salesPerson ? salesPerson.id : '';

                newId++;
                return {
                    id: newId,
                    name: String(row['Name']),
                    address: String(row['Address'] || ''),
                    city: String(row['City']),
                    pincode: String(row['Pincode'] || ''),
                    salesPersonId: salesPersonId,
                    discountStructure: {
                        singleCore: parseFloat(row['SingleCoreDiscount']) || 0,
                        multiCore: parseFloat(row['MultiCoreDiscount']) || 0,
                        specialCable: parseFloat(row['SpecialCableDiscount']) || 0,
                        accessories: parseFloat(row['AccessoriesDiscount']) || 0,
                    },
                };
            }).filter((c): c is Customer => c !== null);

            if (newCustomers.length > 0) {
                await setCustomers(prev => [...prev, ...newCustomers]);
                alert(`${newCustomers.length} customers imported successfully!`);
            } else {
                alert('No valid customers found in the file. Make sure columns are named correctly (e.g., "Name", "City").');
            }
        } catch (error) {
            console.error("Error parsing Excel file:", error);
            alert("Failed to import customers. Please check the file format and content.");
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
  
  const customerIdsInView = filteredAndSortedCustomers.map(c => c.id);

  if (customers === null || salesPersons === null || quotations === null) {
    return <div className="bg-white p-6 rounded-lg shadow-md text-center">Loading customers...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="bg-white p-4 rounded-lg shadow-md">
        <h3 className="text-lg font-bold text-gray-800 mb-3">
            Quotation Summary for {customerIdsInView.length} Customer{customerIdsInView.length !== 1 ? 's' : ''}
        </h3>
        <div className="flex flex-wrap gap-x-4 gap-y-1 items-center">
            <div
                onClick={() => onFilterQuotations({ customerIds: customerIdsInView })}
                className="cursor-pointer text-indigo-700 hover:text-indigo-900 hover:underline transition-colors text-sm font-semibold p-1"
                title={`View all ${quotationStatsForVisibleCustomers.total.count} quotations`}
            >
                <span>Total Enquiries: </span>
                <span className="font-bold">{quotationStatsForVisibleCustomers.total.count}</span>
                <span className="text-gray-400 mx-1">|</span>
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
                        className={`cursor-pointer ${colors.text} hover:opacity-70 transition-opacity text-sm font-semibold p-1`}
                        title={`View ${stats.count} '${status}' quotations`}
                    >
                        <span>{status}: </span>
                        <span className="font-bold">{stats.count}</span>
                        <span className="text-gray-400 mx-1">|</span>
                        <span className="font-bold">{formatCurrency(stats.value)}</span>
                    </div>
                )
            })}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
         <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Customers</h2>
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={handleExport}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-md transition duration-300"
                >
                    Export All
                </button>
                <button
                    onClick={handleDownloadTemplate}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300"
                >
                    Template
                </button>
                <div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".xlsx, .xls"
                    />
                    <button
                        onClick={handleUploadClick}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition duration-300"
                    >
                        Upload
                    </button>
                </div>
                <button
                    onClick={handleAddNew}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition duration-300"
                >
                    Add New
                </button>
            </div>
         </div>
         
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 pb-4 border-b border-gray-200">
            <div>
                <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700">Search by Name</label>
                <input type="text" id="searchTerm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. ABC Corp" />
            </div>
            <div>
                <label htmlFor="searchCity" className="block text-sm font-medium text-gray-700">Search by City</label>
                <input type="text" id="searchCity" value={searchCity} onChange={e => setSearchCity(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. Bangalore" />
            </div>
            <div>
                <label htmlFor="sortBy" className="block text-sm font-medium text-gray-700">Sort By</label>
                <select id="sortBy" value={sortBy} onChange={e => setSortBy(e.target.value as SortByType)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="id">ID</option>
                    <option value="name">Customer Name</option>
                    <option value="city">City</option>
                    <option value="pincode">Pincode</option>
                    <option value="salesPerson">Sales Person</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Order</label>
                <button type="button" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="mt-1 w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold py-2 px-4 border border-gray-300 rounded-md shadow-sm flex items-center justify-center">
                    {sortOrder === 'asc' ? 'Ascending ▲' : 'Descending ▼'}
                </button>
            </div>
         </div>

        {filteredAndSortedCustomers.length > 0 ? (
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                      {['ID', 'Customer Name', 'Address', 'City', 'Pincode', 'Sales Person', 'Quotations', 'Actions'].map(header => (
                        <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {header}
                        </th>
                      ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAndSortedCustomers.map(customer => (
                        <tr key={customer.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{customer.id}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{customer.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">{customer.address}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{customer.city}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{customer.pincode}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getSalesPersonName(customer.salesPersonId)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
                                                <span className="text-gray-400 mx-1">|</span>
                                                <span className="font-bold">{formatCurrency(totalValue)}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                <button onClick={() => handleEdit(customer)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                <button onClick={() => handleDelete(customer.id)} className="text-red-600 hover:text-red-900">Delete</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
                </table>
            </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            {customers.length > 0 ? 'No customers match your search criteria.' : 'No customers found. Add one to get started.'}
        </p>
        )}
      </div>

      <CustomerAddModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveCustomer}
        salesPersons={salesPersons}
        customers={customers}
        customerToEdit={customerToEdit}
      />
    </div>
  );
};
