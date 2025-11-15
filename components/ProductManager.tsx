import React, { useState, useMemo, useRef } from 'react';
import type { Product, PriceEntry } from '../types';
import { UOMS, PLANTS } from '../constants';
import { ProductAddModal } from './ProductAddModal';

declare var XLSX: any;

interface ProductManagerProps {
  products: Product[] | null;
  setProducts: (value: React.SetStateAction<Product[]>) => Promise<void>;
}

type SortByType = 'id' | 'partNo' | 'description' | 'lp' | 'sp' | 'uom' | 'plant' | 'hsnCode';
type SortOrderType = 'asc' | 'desc';

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

    // Fallback: If no price is currently valid, show the most recent past or current one.
    const pastOrCurrentPrices = product.prices.filter(p => new Date(p.validFrom) <= today);
    if(pastOrCurrentPrices.length > 0) {
        return pastOrCurrentPrices.sort((a,b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime())[0];
    }
    
    // Fallback 2: If all are in the future, show the nearest future one.
    return [...product.prices].sort((a,b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime())[0] || null;
};


export const ProductManager: React.FC<ProductManagerProps> = ({ products, setProducts }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDescription, setSearchDescription] = useState('');
  const [sortBy, setSortBy] = useState<SortByType>('id');
  const [sortOrder, setSortOrder] = useState<SortOrderType>('asc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredAndSortedProducts = useMemo(() => {
    if (!products) return [];
    return products
      .filter(product => {
        const termMatch = product.partNo.toLowerCase().includes(searchTerm.toLowerCase());
        const descriptionMatch = product.description.toLowerCase().includes(searchDescription.toLowerCase());
        return termMatch && descriptionMatch;
      })
      .sort((a, b) => {
        let comparison = 0;
        
        if (sortBy === 'lp' || sortBy === 'sp') {
            const priceA = getCurrentPrice(a);
            const priceB = getCurrentPrice(b);
            const valA = priceA ? priceA[sortBy] : 0;
            const valB = priceB ? priceB[sortBy] : 0;
            comparison = valA - valB;
        } else {
            const aVal = a[sortBy as keyof Omit<Product, 'prices'>] ?? '';
            const bVal = b[sortBy as keyof Omit<Product, 'prices'>] ?? '';

            if (typeof aVal === 'string' && typeof bVal === 'string') {
                comparison = aVal.localeCompare(bVal);
            } else if (typeof aVal === 'number' && typeof bVal === 'number') {
                comparison = aVal - bVal;
            }
        }

        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [products, searchTerm, searchDescription, sortBy, sortOrder]);

  const handleAddNew = () => {
    setProductToEdit(null);
    setIsModalOpen(true);
  };

  const handleEdit = (product: Product) => {
    setProductToEdit(product);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
        if (!products) return;
        await setProducts(products.filter(p => p.id !== id));
    }
  };

  const handleSaveProduct = async (product: Product) => {
    if (!products) return;
    await setProducts(prev => {
        const index = prev.findIndex(p => p.id === product.id);
        if (index > -1) {
            const newProducts = [...prev];
            newProducts[index] = product;
            return newProducts;
        } else {
            return [...prev, product];
        }
    });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setProductToEdit(null);
  };
  
  const handleDownloadTemplate = () => {
    const headers = ["PartNo", "Description", "HSNCode", "UOM", "Plant", "Weight", "LP", "SP", "ValidFrom", "ValidTo"];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "Product_Upload_Template.xlsx");
  };
  
  const handleExport = () => {
    if (!products) return;
    const dataToExport = products.flatMap(p => {
        if (p.prices && p.prices.length > 0) {
            return p.prices.map(price => ({
                ID: p.id,
                PartNo: p.partNo,
                Description: p.description,
                HSNCode: p.hsnCode,
                UOM: p.uom,
                Plant: p.plant,
                Weight: p.weight,
                LP: price.lp,
                SP: price.sp,
                ValidFrom: price.validFrom,
                ValidTo: price.validTo,
            }));
        }
        return [{ ID: p.id, PartNo: p.partNo, Description: p.description, HSNCode: p.hsnCode, UOM: p.uom, Plant: p.plant, Weight: p.weight, LP: 0, SP: 0, ValidFrom: '', ValidTo: '' }];
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "Products_Export.xlsx");
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
        if (!products) return;
        const data = e.target?.result;
        if (!data) return;

        try {
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json: any[] = XLSX.utils.sheet_to_json(worksheet);
            
            const productsByPartNo: Record<string, any[]> = {};
            json.forEach(row => {
                const partNo = String(row['PartNo'] || '').trim();
                if (partNo) {
                    if (!productsByPartNo[partNo]) productsByPartNo[partNo] = [];
                    productsByPartNo[partNo].push(row);
                }
            });

            const lastId = products.length > 0 ? Math.max(...products.map(p => p.id)) : 0;
            let newId = lastId;

            const newProducts: Product[] = Object.values(productsByPartNo).map((rows): Product | null => {
                const firstRow = rows[0];
                if (!firstRow['PartNo'] || !firstRow['Description']) {
                     console.warn(`Skipping product due to missing PartNo or Description.`);
                    return null;
                }
                newId++;

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

                const prices: PriceEntry[] = rows.map(row => {
                    const validFrom = parseExcelDate(row['ValidFrom']);
                    if (!validFrom) return null;
                    return { lp: parseFloat(row['LP']) || 0, sp: parseFloat(row['SP']) || 0, validFrom: validFrom, validTo: parseExcelDate(row['ValidTo']) || '9999-12-31' };
                }).filter((p): p is PriceEntry => p !== null);
                
                if (prices.length === 0) return null;
                prices.sort((a, b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime());

                return {
                    id: newId,
                    partNo: String(firstRow['PartNo']),
                    description: String(firstRow['Description']),
                    hsnCode: String(firstRow['HSNCode'] || ''),
                    prices: prices,
                    uom: (UOMS.find(u => u === firstRow['UOM']) || '') as Product['uom'],
                    plant: (PLANTS.find(p => p === firstRow['Plant']) || '') as Product['plant'],
                    weight: parseFloat(firstRow['Weight']) || 0,
                };
            }).filter((p): p is Product => p !== null);

            if (newProducts.length > 0) {
                await setProducts(prev => [...prev, ...newProducts]);
                alert(`${newProducts.length} products imported successfully!`);
            } else {
                alert('No valid products found in the file. Check column names (e.g., "PartNo", "Description", "ValidFrom").');
            }
        } catch (error) {
            console.error("Error parsing Excel file:", error);
            alert("Failed to import products. Please check the file format.");
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

  if (products === null) {
    return <div className="bg-white p-6 rounded-lg shadow-md text-center">Loading products...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-lg shadow-md">
         <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Products</h2>
            <div className="flex flex-wrap gap-2">
                <button onClick={handleExport} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">Export All</button>
                <button onClick={handleDownloadTemplate} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">Template</button>
                <div>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls"/>
                    <button onClick={handleUploadClick} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">Upload</button>
                </div>
                <button onClick={handleAddNew} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">Add New</button>
            </div>
         </div>
         
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 pb-4 border-b border-gray-200">
            <div>
                <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700">Search by Part No</label>
                <input type="text" id="searchTerm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. LAPP-123" />
            </div>
             <div>
                <label htmlFor="searchDescription" className="block text-sm font-medium text-gray-700">Search by Description</label>
                <input type="text" id="searchDescription" value={searchDescription} onChange={e => setSearchDescription(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. ÖLFLEX" />
            </div>
            <div>
                <label htmlFor="sortBy" className="block text-sm font-medium text-gray-700">Sort By</label>
                <select id="sortBy" value={sortBy} onChange={e => setSortBy(e.target.value as SortByType)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="id">ID</option>
                    <option value="partNo">Part No</option>
                    <option value="description">Description</option>
                    <option value="hsnCode">HSN Code</option>
                    <option value="lp">LP</option>
                    <option value="sp">SP</option>
                    <option value="uom">UOM</option>
                    <option value="plant">Plant</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Order</label>
                <button type="button" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="mt-1 w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold py-2 px-4 border border-gray-300 rounded-md shadow-sm flex items-center justify-center">
                    {sortOrder === 'asc' ? 'Ascending ▲' : 'Descending ▼'}
                </button>
            </div>
         </div>

        {filteredAndSortedProducts.length > 0 ? (
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                      {['ID', 'Part No', 'Description', 'HSN Code', 'Current LP', 'Current SP', 'UOM', 'Plant', 'Weight', 'Actions'].map(header => (
                        <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {header}
                        </th>
                      ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAndSortedProducts.map(product => {
                        const currentPrice = getCurrentPrice(product);
                        return (
                            <tr key={product.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.id}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.partNo}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">{product.description}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.hsnCode}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{currentPrice ? currentPrice.lp.toFixed(2) : 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{currentPrice ? currentPrice.sp.toFixed(2) : 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.uom}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.plant}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.weight}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <button onClick={() => handleEdit(product)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                    <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:text-red-900">Delete</button>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
                </table>
            </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            {products.length > 0 ? 'No products match your search criteria.' : 'No products found. Add one to get started.'}
        </p>
        )}
      </div>

      <ProductAddModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveProduct}
        products={products}
        productToEdit={productToEdit}
      />
    </div>
  );
};
