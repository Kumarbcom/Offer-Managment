






import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Product, PriceEntry, User } from '../types';
import { UOMS, PLANTS } from '../constants';
import { ProductAddModal } from './ProductAddModal';
import { getProductsPaginated, addProductsBatch, deleteProductsBatch, updateProduct, getProductsByPartNos, fetchAllProductsForExport } from '../supabase';

declare var XLSX: any;

interface ProductManagerProps {
    currentUser: User;
}

type SortByType = 'id' | 'partNo' | 'description' | 'hsnCode' | 'price';
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

const getEffectivePriceValue = (product: Product): number => {
    const price = getCurrentPrice(product);
    if (!price) return 0;
    return price.lp > 0 ? price.lp : price.sp;
};

// Memoized ProductRow component to prevent unnecessary re-renders
const ProductRow = React.memo(({ product, isSelected, onSelect, onEdit, onDelete }: { product: Product; isSelected: boolean; onSelect: (id: number) => void; onEdit: (product: Product) => void; onDelete: (id: number) => void; }) => {
    const currentPrice = getCurrentPrice(product);
    return (
        <tr className={`${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50/70'} text-sm`}>
            <td className="px-3 py-2"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={isSelected} onChange={() => onSelect(product.id)} aria-label={`Select product ${product.partNo}`}/></td>
            <td className="px-3 py-2 whitespace-nowrap text-black">{product.id}</td>
            <td className="px-3 py-2 whitespace-nowrap font-medium text-black">{product.partNo}</td>
            <td className="px-3 py-2 whitespace-nowrap text-black max-w-xs truncate">{product.description}</td>
            <td className="px-3 py-2 whitespace-nowrap text-black">{product.hsnCode}</td>
            <td className="px-3 py-2 whitespace-nowrap text-black text-right">{currentPrice ? currentPrice.lp.toFixed(2) : 'N/A'}</td>
            <td className="px-3 py-2 whitespace-nowrap text-black text-right">{currentPrice ? currentPrice.sp.toFixed(2) : 'N/A'}</td>
            <td className="px-3 py-2 whitespace-nowrap text-black">{product.uom}</td>
            <td className="px-3 py-2 whitespace-nowrap text-black">{product.plant}</td>
            <td className="px-3 py-2 whitespace-nowrap text-black text-right">{product.weight}</td>
            <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium space-x-3">
                <button onClick={() => onEdit(product)} className="font-semibold text-blue-600 hover:text-blue-800 transition-colors">Edit</button>
                <button onClick={() => onDelete(product.id)} className="font-semibold text-rose-600 hover:text-rose-800 transition-colors">Delete</button>
            </td>
        </tr>
    );
});


export const ProductManager: React.FC<ProductManagerProps> = ({ currentUser }) => {
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchDescription, setSearchDescription] = useState('');
  // Default sort to 'price' as requested for searches, though we default the UI to 'lp' behavior manually
  const [sortBy, setSortBy] = useState<SortByType>('price'); 
  const [sortOrder, setSortOrder] = useState<SortOrderType>('asc');
  const [discount, setDiscount] = useState<string>('0'); // Mobile discount state
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const priceUpdateInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const canManageProducts = currentUser.role !== 'Sales Person';

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchProducts = useCallback(async (isLoadMore = false) => {
    if (isLoadMore) {
        if (!hasMore || isLoadingMore) return;
        setIsLoadingMore(true);
    } else {
        setIsLoading(true);
        setCurrentPage(1);
    }

    try {
        const pageToFetch = isLoadMore ? currentPage + 1 : 1;
        const offset = (pageToFetch - 1) * PAGE_LIMIT;

        // If sorting by price, we fall back to ID sorting on backend and sort client-side 
        // because price is nested in a JSON array.
        const backendSortBy = sortBy === 'price' ? 'id' : sortBy;
        
        const filters: any = {};
        if (isMobile) {
            // In mobile, the single 'searchTerm' input acts as a universal fuzzy search
            if (searchTerm) filters.universal = searchTerm;
        } else {
            if (searchTerm) filters.partNo = searchTerm;
            if (searchDescription) filters.description = searchDescription;
        }

        const result = await getProductsPaginated({
            pageLimit: PAGE_LIMIT,
            startAfterDoc: offset,
            sortBy: backendSortBy,
            sortOrder,
            filters: filters
        });
        
        setDisplayedProducts(prev => {
            const combined = isLoadMore ? [...prev, ...result.products] : result.products;
            // Client-side sort for price if selected
            if (sortBy === 'price') {
                return combined.sort((a, b) => {
                    const priceA = getEffectivePriceValue(a);
                    const priceB = getEffectivePriceValue(b);
                    return sortOrder === 'asc' ? priceA - priceB : priceB - priceA;
                });
            }
            return combined;
        });

        setCurrentPage(pageToFetch);
        setHasMore(result.products.length === PAGE_LIMIT);

    } catch (error) {
        console.error("Failed to fetch products:", error);
        alert(error instanceof Error ? error.message : "Error fetching products. See console for details.");
    } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
    }
  }, [sortBy, sortOrder, searchTerm, searchDescription, hasMore, isLoadingMore, currentPage, isMobile]);


  useEffect(() => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => {
      fetchProducts(false);
    }, 300); 

    return () => { if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current) };
  }, [searchTerm, searchDescription, sortBy, sortOrder, isMobile]);


  const handleAddNew = useCallback(() => { setProductToEdit(null); setIsModalOpen(true); }, []);
  const handleEdit = useCallback((product: Product) => { setProductToEdit(product); setIsModalOpen(true); }, []);

  const handleDelete = useCallback(async (id: number) => {
    if (window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
        await deleteProductsBatch([id]);
        setDisplayedProducts(prev => prev.filter(p => p.id !== id));
    }
  }, []);

  const handleSaveProduct = useCallback(async (product: Product) => {
    if (productToEdit) {
      await updateProduct(product);
    } else {
      await addProductsBatch([product]);
    }
    fetchProducts(false); // Refetch from page 1 to see changes
  }, [productToEdit, fetchProducts]);
  
  const handleCloseModal = useCallback(() => { setIsModalOpen(false); setProductToEdit(null); }, []);
  
  const handleDownloadTemplate = () => {
    const headers = ["PartNo", "Description", "HSNCode", "UOM", "Plant", "Weight", "LP", "SP", "ValidFrom", "ValidTo"];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "Product_Upload_Template.xlsx");
  };
  
  const handleExport = () => {
    const dataToExport = displayedProducts.flatMap(product => {
      if (product.prices.length === 0) {
        return [{ PartNo: product.partNo, Description: product.description, HSNCode: product.hsnCode, UOM: product.uom, Plant: product.plant, Weight: product.weight, LP: 0, SP: 0, ValidFrom: '', ValidTo: '' }];
      }
      return product.prices.map(price => ({
        PartNo: product.partNo, Description: product.description, HSNCode: product.hsnCode, UOM: product.uom, Plant: product.plant, Weight: product.weight, LP: price.lp, SP: price.sp, ValidFrom: price.validFrom, ValidTo: price.validTo
      }));
    });
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "Products_Export.xlsx");
  };

  const handleExportPriceList = async () => {
      setIsUploading(true);
      setUploadProgress('Fetching all products for export...');
      try {
          const allProducts = await fetchAllProductsForExport();
          const dataToExport = allProducts.map(product => {
              const currentPrice = getCurrentPrice(product);
              const nextValidFrom = new Date();
              return {
                  'Part No': product.partNo,
                  'Description': product.description,
                  'Current LP': currentPrice ? currentPrice.lp : 0,
                  'Current SP': currentPrice ? currentPrice.sp : 0,
                  'New LP': '',
                  'New SP': '',
                  'New Valid From': nextValidFrom.toISOString().split('T')[0],
                  'New Valid To': '9999-12-31'
              };
          });
          const ws = XLSX.utils.json_to_sheet(dataToExport);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Price_Update_Template");
          XLSX.writeFile(wb, "Full_Price_List_Update.xlsx");
      } catch (error) {
          alert(error instanceof Error ? error.message : "Failed to export price list");
      } finally {
          setIsUploading(false);
          setUploadProgress('');
      }
  };

  const handlePriceUpdateUpload = (file: File) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
          const data = e.target?.result;
          if (!data) return;
          setIsUploading(true);
          setUploadProgress('Analyzing price updates...');
          
          try {
              const workbook = XLSX.read(data, { type: 'array' });
              const sheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[sheetName];
              const json: any[] = XLSX.utils.sheet_to_json(worksheet);
              
              // Identify rows with price updates
              const rowsWithUpdates = json.filter(row => {
                  const newLP = parseFloat(row['New LP']);
                  const newSP = parseFloat(row['New SP']);
                  return (!isNaN(newLP) && newLP > 0) || (!isNaN(newSP) && newSP > 0);
              });
              
              if (rowsWithUpdates.length === 0) {
                  alert("No valid price updates found in the file. Please ensure 'New LP' or 'New SP' columns are filled.");
                  setIsUploading(false);
                  setUploadProgress('');
                  return;
              }

              // Collect PartNos to fetch existing products
              const partNos = rowsWithUpdates.map(row => String(row['Part No']).trim()).filter(Boolean);
              
              // Chunk requests to avoid query limits
              const CHUNK_SIZE = 100;
              let updatedCount = 0;
              
              for (let i = 0; i < partNos.length; i += CHUNK_SIZE) {
                  const chunkPartNos = partNos.slice(i, i + CHUNK_SIZE);
                  setUploadProgress(`Processing products ${i+1} to ${Math.min(i+CHUNK_SIZE, partNos.length)}...`);
                  
                  const products = await getProductsByPartNos(chunkPartNos);
                  const productsToUpdate: Product[] = [];
                  
                  for (const product of products) {
                      const row = rowsWithUpdates.find(r => String(r['Part No']).trim() === product.partNo);
                      if (!row) continue;
                      
                      const newLP = parseFloat(row['New LP']) || 0;
                      const newSP = parseFloat(row['New SP']) || 0;
                      let validFrom = row['New Valid From'];
                      let validTo = row['New Valid To'] || '9999-12-31';
                      
                      // Date parsing logic for Excel formats
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
                      
                      validFrom = parseExcelDate(validFrom);
                      validTo = parseExcelDate(validTo);
                      
                      if (!validFrom) validFrom = new Date().toISOString().split('T')[0];

                      const newPriceEntry: PriceEntry = { lp: newLP, sp: newSP, validFrom, validTo };
                      const newPrices = [...product.prices, newPriceEntry];
                      
                      // Sort and adjust dates
                      newPrices.sort((a, b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime());
                      
                      for (let j = 0; j < newPrices.length - 1; j++) {
                          const nextDate = new Date(newPrices[j+1].validFrom);
                          nextDate.setDate(nextDate.getDate() - 1);
                          newPrices[j].validTo = nextDate.toISOString().split('T')[0];
                      }
                      newPrices[newPrices.length - 1].validTo = '9999-12-31';
                      
                      productsToUpdate.push({ ...product, prices: newPrices });
                  }
                  
                  if (productsToUpdate.length > 0) {
                      await addProductsBatch(productsToUpdate);
                      updatedCount += productsToUpdate.length;
                  }
              }
              
              alert(`Successfully updated prices for ${updatedCount} products.`);
              fetchProducts(false); // Refresh grid
              
          } catch(error) {
              console.error("Price update error:", error);
              alert(error instanceof Error ? error.message : "Failed to process price updates.");
          } finally {
              setIsUploading(false);
              setUploadProgress('');
          }
      };
      reader.readAsArrayBuffer(file);
  }

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

        const productsByPartNo: Record<string, any[]> = {};
        json.forEach(row => {
          const partNo = String(row['PartNo'] || '').trim();
          if (partNo) {
            if (!productsByPartNo[partNo]) productsByPartNo[partNo] = [];
            productsByPartNo[partNo].push(row);
          }
        });

        const lastIdResult = await getProductsPaginated({ pageLimit: 1, startAfterDoc: 0, sortBy: 'id', sortOrder: 'desc', filters: {} });
        const lastId = lastIdResult.products.length > 0 ? lastIdResult.products[0].id : 0;
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
          const CHUNK_SIZE = 400;
          for (let i = 0; i < newProducts.length; i += CHUNK_SIZE) {
            const chunk = newProducts.slice(i, i + CHUNK_SIZE);
            setUploadProgress(`Uploading products ${i + 1} to ${Math.min(i + CHUNK_SIZE, newProducts.length)} of ${newProducts.length}...`);
            await addProductsBatch(chunk);
          }
          alert(`${newProducts.length} products imported successfully!`);
          fetchProducts(false);
        } else {
          alert('No valid products found in the file. Check column names (e.g., "PartNo", "Description", "ValidFrom").');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : `An issue occurred during file processing. Please check the console for details.`;
        console.error("Error importing products:", error);
        alert(`Failed to import products.\n\nError: ${errorMessage}`);
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
  
  const handleUploadClick = () => { fileInputRef.current?.click(); };
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
      event.target.value = '';
    }
  };
  
  const handlePriceUpdateUploadClick = () => { priceUpdateInputRef.current?.click(); };
  const handlePriceUpdateFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          handlePriceUpdateUpload(file);
          event.target.value = '';
      }
  }

  const handleSelectOne = useCallback((id: number) => {
    setSelectedProductIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      return newSet;
    });
  }, []);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedProductIds(new Set(displayedProducts.map(p => p.id)));
    } else {
      setSelectedProductIds(new Set());
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedProductIds.size === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedProductIds.size} selected product(s)?`)) {
      await deleteProductsBatch(Array.from(selectedProductIds));
      setDisplayedProducts(prev => prev.filter(p => !selectedProductIds.has(p.id)));
      setSelectedProductIds(new Set());
    }
  };

  const isAllSelected = selectedProductIds.size > 0 && selectedProductIds.size === displayedProducts.length;

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
         <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-black">Products</h2>
            {/* Mobile-only Upload/Add buttons compact row */}
            {canManageProducts && (
            <div className="flex md:hidden gap-2">
                <button onClick={handleAddNew} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold">Add</button>
                <button onClick={handleUploadClick} className="bg-emerald-600 text-white px-3 py-1 rounded text-xs font-bold">Upload</button>
            </div>
            )}
            
            {/* Desktop Buttons */}
            <div className="hidden md:flex flex-wrap gap-2 text-sm">
                {canManageProducts && (
                    <div className="flex gap-2 border-r border-slate-300 pr-2 mr-2">
                        <button onClick={handleExportPriceList} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-1.5 px-3 rounded-md transition duration-300">
                            Export Full Price List
                        </button>
                        <input type="file" ref={priceUpdateInputRef} onChange={handlePriceUpdateFileChange} className="hidden" accept=".xlsx, .xls"/>
                        <button onClick={handlePriceUpdateUploadClick} disabled={isUploading} className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-1.5 px-3 rounded-md transition duration-300 disabled:opacity-50">
                            Import Price Updates
                        </button>
                    </div>
                )}
                
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
         
         {selectedProductIds.size > 0 && (
            <div className="my-3 p-3 bg-rose-50 border border-rose-200 rounded-lg flex flex-wrap items-center gap-4">
              <div className="font-semibold text-rose-800">{selectedProductIds.size} product{selectedProductIds.size > 1 ? 's' : ''} selected.</div>
              <button onClick={handleDeleteSelected} className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-1.5 px-3 rounded-md transition duration-300 text-sm">Delete Selected</button>
            </div>
         )}
         
         {/* Mobile Search and Discount */}
         <div className="block md:hidden space-y-3 mb-4 border-b pb-4 border-slate-100">
             <div>
                <label className="text-xs font-bold text-black uppercase">Universal Search</label>
                <input 
                    type="text" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="w-full mt-1 p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-black"
                    placeholder="Search Part No or Description..."
                />
             </div>
             <div>
                <label className="text-xs font-bold text-black uppercase">Discount %</label>
                <div className="relative">
                    <input 
                        type="number" 
                        value={discount} 
                        onChange={e => setDiscount(e.target.value)} 
                        className="w-full mt-1 p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-black"
                        placeholder="0"
                    />
                    <span className="absolute right-3 top-3 text-black text-sm">%</span>
                </div>
             </div>
         </div>

         {/* Desktop Filters */}
         <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-4 pb-3 border-b border-slate-200">
            <div>
                <label htmlFor="searchTerm" className="block text-xs font-medium text-black">Search Part No (use * for OR)</label>
                <input type="text" id="searchTerm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="mt-1 block w-full px-3 py-1 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm text-black" placeholder="e.g. OLFLEX*UNITRONIC" />
            </div>
             <div>
                <label htmlFor="searchDescription" className="block text-xs font-medium text-black">Search Description (use * for OR)</label>
                <input type="text" id="searchDescription" value={searchDescription} onChange={e => setSearchDescription(e.target.value)} className="mt-1 block w-full px-3 py-1 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm text-black" placeholder="e.g. CABLE*POWER" />
            </div>
            <div>
                <label htmlFor="sortBy" className="block text-xs font-medium text-black">Sort By</label>
                <select id="sortBy" value={sortBy} onChange={e => setSortBy(e.target.value as SortByType)} className="mt-1 block w-full px-3 py-1 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm text-black">
                    <option value="price">Price (LP)</option>
                    <option value="id">ID</option>
                    <option value="partNo">Part No</option>
                    <option value="description">Description</option>
                    <option value="hsnCode">HSN Code</option>
                </select>
            </div>
            <div>
                <label className="block text-xs font-medium text-black">Order</label>
                <button type="button" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="mt-1 w-full bg-white hover:bg-slate-50 text-black font-semibold py-1 px-4 border border-slate-300 rounded-md shadow-sm flex items-center justify-center text-sm">
                    {sortOrder === 'asc' ? 'Ascending ▲' : 'Descending ▼'}
                </button>
            </div>
         </div>

        {/* Mobile Card View */}
        <div className="block md:hidden space-y-3">
            {displayedProducts.map(product => {
                const currentPrice = getCurrentPrice(product);
                const lp = currentPrice?.lp || 0;
                const sp = currentPrice?.sp || 0;
                const basePrice = lp > 0 ? lp : sp;
                const discountVal = parseFloat(discount) || 0;
                const discountedPrice = basePrice * (1 - discountVal / 100);
                
                return (
                    <div key={product.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                        <div className="flex justify-between items-start">
                            <h3 className="text-sm font-bold text-indigo-700">{product.partNo}</h3>
                            <div className="text-xs text-black">#{product.id}</div>
                        </div>
                        <p className="text-xs text-black mt-1 line-clamp-2">{product.description}</p>
                        
                        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2">
                            <div>
                                <p className="text-[10px] text-black uppercase">Standard Price</p>
                                <div className="flex gap-2 text-xs font-medium">
                                    <span className={lp > 0 ? "text-black" : "text-slate-400"}>LP: {lp > 0 ? lp.toFixed(2) : '-'}</span>
                                    <span className={sp > 0 ? "text-black" : "text-slate-400"}>SP: {sp > 0 ? sp.toFixed(2) : '-'}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-black uppercase">Discounted Price</p>
                                <p className="text-sm font-bold text-green-600">
                                    {discountedPrice.toLocaleString('en-IN', {style: 'currency', currency: 'INR'})}
                                </p>
                            </div>
                        </div>
                        {canManageProducts && (
                        <div className="flex justify-end gap-3 mt-2 pt-2 border-t border-slate-50">
                            <button onClick={() => handleEdit(product)} className="text-indigo-600 text-xs font-semibold">Edit</button>
                            <button onClick={() => handleDelete(product.id)} className="text-rose-600 text-xs font-semibold">Delete</button>
                        </div>
                        )}
                    </div>
                );
            })}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto -mx-4">
            <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
                <tr>
                    <th className="px-3 py-2"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={isAllSelected} onChange={handleSelectAll} aria-label="Select all products"/></th>
                    {['ID', 'Part No', 'Description', 'HSN Code', 'Current LP', 'Current SP', 'UOM', 'Plant', 'Weight', 'Actions'].map(header => (
                    <th key={header} scope="col" className={`px-3 py-2 text-left text-xs font-semibold text-black uppercase tracking-wider ${['Current LP', 'Current SP', 'Weight', 'Actions'].includes(header) ? 'text-right' : ''}`}>{header}</th>
                    ))}
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
                {displayedProducts.map(product => (
                    <ProductRow
                        key={product.id}
                        product={product}
                        isSelected={selectedProductIds.has(product.id)}
                        onSelect={handleSelectOne}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                    />
                ))}
            </tbody>
            </table>
        </div>
        {isLoading && <p className="text-black text-center py-8">Loading products...</p>}
        {!isLoading && displayedProducts.length === 0 && (
          <p className="text-black text-center py-8">
            No products match your search criteria.
        </p>
        )}
        {!isLoading && hasMore && (
            <div className="mt-4 text-center">
                <button
                    onClick={() => fetchProducts(true)}
                    disabled={isLoadingMore}
                    className="bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2 px-4 rounded-md transition duration-300 disabled:opacity-50"
                >
                    {isLoadingMore ? 'Loading...' : 'Load More'}
                </button>
            </div>
        )}
      </div>

      <ProductAddModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveProduct}
        productToEdit={productToEdit}
      />
    </div>
  );
};