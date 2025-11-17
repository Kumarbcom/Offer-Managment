import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Product, PriceEntry } from '../types';
import { UOMS, PLANTS } from '../constants';
import { ProductAddModal } from './ProductAddModal';
import { DataActions } from '../hooks/useOnlineStorage';

declare var XLSX: any;

interface ProductManagerProps {
  products: Product[] | null; 
  actions: DataActions<Product>;
  refetch: () => Promise<void>;
}

type SortByType = 'id' | 'partNo' | 'description' | 'hsnCode';
type SortOrderType = 'asc' | 'desc';

const PAGE_LIMIT = 50;

const getCurrentPrice = (product: Product): PriceEntry | null => {
    if (!product.prices || product.prices.length === 0) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
  
    const currentPrice = product.prices.find(p => {
      const from = new Date(p.validFrom);
      const to = new Date(p.validTo);
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      return today >= from && today <= to;
    });
    
    if (currentPrice) return currentPrice;

    const pastOrCurrentPrices = product.prices.filter(p => new Date(p.validFrom) <= today);
    if(pastOrCurrentPrices.length > 0) {
        return pastOrCurrentPrices.sort((a,b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime())[0];
    }
    
    return [...product.prices].sort((a,b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime())[0] || null;
};

export const ProductManager: React.FC<ProductManagerProps> = ({ products: initialProducts, actions, refetch }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDescription, setSearchDescription] = useState('');
  const [sortBy, setSortBy] = useState<SortByType>('id');
  const [sortOrder, setSortOrder] = useState<SortOrderType>('asc');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  const filteredAndSortedProducts = useMemo(() => {
    if (!initialProducts) return [];
    
    const filtered = initialProducts.filter(product => {
        const partNoMatch = searchTerm ? product.partNo.toLowerCase().startsWith(searchTerm.toLowerCase()) : true;
        const descriptionMatch = searchDescription ? product.description.toLowerCase().startsWith(searchDescription.toLowerCase()) : true;
        return partNoMatch && descriptionMatch;
    });

    return filtered.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'id': comparison = (a.id ?? 0) - (b.id ?? 0); break;
          case 'partNo': comparison = a.partNo.localeCompare(b.partNo); break;
          case 'description': comparison = a.description.localeCompare(b.description); break;
          case 'hsnCode': comparison = (a.hsnCode || '').localeCompare(b.hsnCode || ''); break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [initialProducts, searchTerm, searchDescription, sortBy, sortOrder]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, searchDescription, sortBy, sortOrder]);
  
  const totalPages = Math.ceil(filteredAndSortedProducts.length / PAGE_LIMIT);
  const paginatedProducts = filteredAndSortedProducts.slice((currentPage - 1) * PAGE_LIMIT, currentPage * PAGE_LIMIT);


  const handleAddNew = () => { setProductToEdit(null); setIsModalOpen(true); };
  const handleEdit = (product: Product) => { setProductToEdit(product); setIsModalOpen(true); };

  const handleDeleteSelected = async () => {
    if (selectedProductIds.size === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedProductIds.size} selected product(s)?`)) {
        await actions.remove(Array.from(selectedProductIds));
        setSelectedProductIds(new Set());
    }
  };
  
  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
        await actions.remove([id]);
    }
  };

  const handleCloseModal = () => { setIsModalOpen(false); setProductToEdit(null); };
  
  const handleDownloadTemplate = () => {
    const headers = ["PartNo", "Description", "HSNCode", "UOM", "Plant", "Weight", "LP", "SP", "ValidFrom", "ValidTo"];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "Product_Upload_Template.xlsx");
  };
  
  const handleExport = () => {
     if (!filteredAndSortedProducts || filteredAndSortedProducts.length === 0) {
        alert("No data to export based on current filters.");
        return;
    }
    const dataToExport = filteredAndSortedProducts.map(product => {
        const currentPrice = getCurrentPrice(product);
        return {
            ID: product.id,
            PartNo: product.partNo,
            Description: product.description,
            HSNCode: product.hsnCode,
            UOM: product.uom,
            Plant: product.plant,
            Weight: product.weight,
            CurrentLP: currentPrice?.lp ?? 'N/A',
            CurrentSP: currentPrice?.sp ?? 'N/A',
        };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products_Export.xlsx");
    XLSX.writeFile(wb, "Products_Export.xlsx");
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
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
  
        if (json.length > 100000) {
          throw new Error(`File contains ${json.length} rows, which exceeds the limit of 100,000. Please split the file.`);
        }
  
        const productsByPartNo: Record<string, any[]> = {};
        json.forEach(row => {
          const partNo = String(row['PartNo'] || '').trim();
          if (partNo) {
            if (!productsByPartNo[partNo]) productsByPartNo[partNo] = [];
            productsByPartNo[partNo].push(row);
          }
        });
  
        const parseExcelDate = (excelDate: any): string => {
          if (!excelDate) return '';
          if (typeof excelDate === 'number' && excelDate > 1) {
            const date = new Date(Date.UTC(1900, 0, excelDate - 1));
            return date.toISOString().split('T')[0];
          }
          if (typeof excelDate === 'string') {
            const parsedDate = new Date(excelDate);
            if (!isNaN(parsedDate.getTime())) return parsedDate.toISOString().split('T')[0];
            return excelDate;
          }
          return '';
        };
  
        const parsedProducts: Omit<Product, 'id'>[] = Object.values(productsByPartNo).map((rows): Omit<Product, 'id'> | null => {
          const firstRow = rows[0];
          if (!firstRow['PartNo'] || !firstRow['Description']) {
            console.warn(`Skipping product due to missing PartNo or Description.`);
            return null;
          }
  
          const prices: PriceEntry[] = rows.map(row => {
            const validFrom = parseExcelDate(row['ValidFrom']);
            if (!validFrom) return null;
            return {
              lp: parseFloat(row['LP']) || 0,
              sp: parseFloat(row['SP']) || 0,
              validFrom: validFrom,
              validTo: parseExcelDate(row['ValidTo']) || '9999-12-31',
            };
          }).filter((p): p is PriceEntry => p !== null);
  
          if (prices.length === 0) return null;
          prices.sort((a, b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime());
  
          return {
            partNo: String(firstRow['PartNo']),
            description: String(firstRow['Description']),
            hsnCode: String(firstRow['HSNCode'] || ''),
            prices: prices,
            uom: (UOMS.find(u => u === firstRow['UOM']) || '') as Product['uom'],
            plant: (PLANTS.find(p => p === firstRow['Plant']) || '') as Product['plant'],
            weight: parseFloat(firstRow['Weight']) || 0,
          };
        }).filter((p): p is Omit<Product, 'id'> => p !== null);
  
        if (parsedProducts.length > 0) {
          setUploadProgress(`Uploading ${parsedProducts.length} products...`);
          await actions.bulkAdd(parsedProducts);
          await refetch();
          alert(`${parsedProducts.length} products imported successfully!`);
        } else {
          setUploadError('No valid products found in the file. Check column names (e.g., "PartNo", "Description", "ValidFrom").');
        }
  
      } catch (error: any) {
        console.error("Error parsing or uploading Excel file:", error);
        let errorMessage = "An unknown error occurred. Please check the file format and content.";
        // Check for Supabase error structure
        if (error && typeof error === 'object' && error.message) {
            errorMessage = `Error: ${error.message}`;
            if (error.details) errorMessage += `\nDetails: ${error.details}`;
            if (error.hint) errorMessage += `\nHint: ${error.hint}`;
        } else if (error instanceof Error) {
            // Check for standard JS Error
            errorMessage = error.message;
        }
        setUploadError(errorMessage);
      } finally {
        setIsUploading(false);
        setUploadProgress('');
      }
    };
    reader.onerror = (error) => {
      console.error("File reading error:", error);
      setUploadError("Failed to read the file.");
      setIsUploading(false);
    };
    reader.readAsArrayBuffer(file);
  };
  
  const handleUploadClick = () => { fileInputRef.current?.click(); };
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
      event.target.value = '';
    }
  };

  const handleSelectOne = (id: number) => {
    setSelectedProductIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      return newSet;
    });
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedProductIds(new Set(paginatedProducts.map(p => p.id as number)));
    } else {
      setSelectedProductIds(new Set());
    }
  };

  const isAllSelectedOnPage = selectedProductIds.size > 0 && paginatedProducts.every(p => selectedProductIds.has(p.id as number));

  if (initialProducts === null) {
      return (
          <div className="flex items-center justify-center min-h-[50vh]">
              <div className="text-center">
                  <p className="text-lg text-gray-600">Loading products...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
         <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-slate-800">Products</h2>
            <div className="flex flex-wrap gap-2 text-sm">
                <button onClick={handleExport} disabled={isUploading} className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-1.5 px-3 rounded-md transition duration-300 disabled:opacity-50">Export Visible</button>
                <button onClick={handleDownloadTemplate} disabled={isUploading} className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-1.5 px-3 rounded-md transition duration-300 disabled:opacity-50">Template</button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls"/>
                <button onClick={handleUploadClick} disabled={isUploading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1.5 px-3 rounded-md transition duration-300 disabled:opacity-50">
                    {isUploading ? 'Uploading...' : 'Upload'}
                </button>
                <button onClick={handleAddNew} disabled={isUploading} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-3 rounded-md transition duration-300 disabled:opacity-50">Add New</button>
            </div>
         </div>

         {isUploading && ( <div className="my-2 p-2 text-center text-sm font-semibold text-indigo-700 bg-indigo-100 rounded-md" role="status">{uploadProgress}</div> )}
         {uploadError && (
          <div className="my-2 p-3 text-sm text-red-800 bg-red-100 border border-red-200 rounded-md" role="alert">
            <p className="font-bold">Import Failed</p>
            <p className="whitespace-pre-wrap">{uploadError}</p>
          </div>
        )}
         
         {selectedProductIds.size > 0 && (
            <div className="my-3 p-3 bg-rose-50 border border-rose-200 rounded-lg flex flex-wrap items-center gap-4">
              <div className="font-semibold text-rose-800">{selectedProductIds.size} product{selectedProductIds.size > 1 ? 's' : ''} selected.</div>
              <button onClick={handleDeleteSelected} className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-1.5 px-3 rounded-md transition duration-300 text-sm">Delete Selected</button>
            </div>
         )}
         
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-4 pb-3 border-b border-slate-200">
            <div>
                <label htmlFor="searchTerm" className="block text-xs font-medium text-slate-600">Search by Part No (starts with)</label>
                <input type="text" id="searchTerm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="mt-1 block w-full px-3 py-1 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm" placeholder="e.g. OLFLEX" />
            </div>
             <div>
                <label htmlFor="searchDescription" className="block text-xs font-medium text-slate-600">Search by Description (starts with)</label>
                <input type="text" id="searchDescription" value={searchDescription} onChange={e => setSearchDescription(e.target.value)} className="mt-1 block w-full px-3 py-1 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm" placeholder="e.g. Cable" />
            </div>
            <div>
                <label htmlFor="sortBy" className="block text-xs font-medium text-slate-600">Sort By</label>
                <select id="sortBy" value={sortBy} onChange={e => setSortBy(e.target.value as SortByType)} className="mt-1 block w-full px-3 py-1 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm">
                    <option value="id">ID</option>
                    <option value="partNo">Part No</option>
                    <option value="description">Description</option>
                    <option value="hsnCode">HSN Code</option>
                </select>
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-600">Order</label>
                <button type="button" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="mt-1 w-full bg-white hover:bg-slate-50 text-slate-700 font-semibold py-1 px-4 border border-slate-300 rounded-md shadow-sm flex items-center justify-center text-sm">
                    {sortOrder === 'asc' ? 'Ascending ▲' : 'Descending ▼'}
                </button>
            </div>
         </div>

        <div className="overflow-x-auto -mx-4">
            <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
                <tr>
                    <th className="px-3 py-2"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={isAllSelectedOnPage} onChange={handleSelectAll} aria-label="Select all products on this page"/></th>
                    {['ID', 'Part No', 'Description', 'HSN Code', 'Current LP', 'Current SP', 'UOM', 'Plant', 'Weight', 'Actions'].map(header => (
                    <th key={header} scope="col" className={`px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider ${['Current LP', 'Current SP', 'Weight', 'Actions'].includes(header) ? 'text-right' : ''}`}>{header}</th>
                    ))}
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
                {paginatedProducts.map(product => {
                    const currentPrice = getCurrentPrice(product);
                    const isSelected = selectedProductIds.has(product.id!);
                    return (
                        <tr key={product.id} className={`${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50/70'} text-sm`}>
                            <td className="px-3 py-2"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={isSelected} onChange={() => handleSelectOne(product.id!)} aria-label={`Select product ${product.partNo}`}/></td>
                            <td className="px-3 py-2 whitespace-nowrap text-slate-600">{product.id}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-800">{product.partNo}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-slate-600 max-w-xs truncate">{product.description}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-slate-600">{product.hsnCode}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-slate-600 text-right">{currentPrice ? currentPrice.lp.toFixed(2) : 'N/A'}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-slate-600 text-right">{currentPrice ? currentPrice.sp.toFixed(2) : 'N/A'}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-slate-600">{product.uom}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-slate-600">{product.plant}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-slate-600 text-right">{product.weight}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium space-x-3">
                                <button onClick={() => handleEdit(product)} className="font-semibold text-blue-600 hover:text-blue-800 transition-colors">Edit</button>
                                <button onClick={() => handleDelete(product.id!)} className="font-semibold text-rose-600 hover:text-rose-800 transition-colors">Delete</button>
                            </td>
                        </tr>
                    )
                })}
            </tbody>
            </table>
        </div>
        
        {paginatedProducts.length === 0 && (
          <p className="text-slate-500 text-center py-8">
            {initialProducts.length > 0 ? 'No products match your search criteria.' : 'No products found. Add one to get started.'}
          </p>
        )}
        
        {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border border-slate-300 rounded-md bg-white hover:bg-slate-50 disabled:opacity-50">Previous</button>
                <span>Page {currentPage} of {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border border-slate-300 rounded-md bg-white hover:bg-slate-50 disabled:opacity-50">Next</button>
            </div>
        )}
      </div>

      <ProductAddModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        actions={actions}
        productToEdit={productToEdit}
      />
    </div>
  );
};