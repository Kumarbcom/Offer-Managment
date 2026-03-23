






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

const ProductRow = React.memo(({ product, isSelected, onSelect, onEdit, onDelete, canManage }: { product: Product; isSelected: boolean; onSelect: (id: number) => void; onEdit: (product: Product) => void; onDelete: (id: number) => void; canManage: boolean; }) => {
    const currentPrice = getCurrentPrice(product);
    const hasPrice = currentPrice !== null;
    const initials = product.partNo.slice(0, 2).toUpperCase();
    const avatarColors = [
        'bg-gradient-to-br from-indigo-400 to-purple-600',
        'bg-gradient-to-br from-emerald-400 to-teal-600',
        'bg-gradient-to-br from-amber-400 to-orange-500',
        'bg-gradient-to-br from-rose-400 to-pink-600',
        'bg-gradient-to-br from-cyan-400 to-blue-600',
        'bg-gradient-to-br from-fuchsia-400 to-purple-600',
    ];
    const avatarColor = avatarColors[product.id % avatarColors.length];
    return (
        <tr className={`${isSelected ? 'bg-indigo-50/80 shadow-inner' : 'hover:bg-white/80 hover:shadow-sm'} transition-all duration-200 group`}>
            <td className="px-3 py-2"><input type="checkbox" className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" checked={isSelected} onChange={() => onSelect(product.id)} aria-label={`Select product ${product.partNo}`}/></td>
            <td className="px-3 py-2 whitespace-nowrap text-[11px] text-slate-500 font-medium">#{product.id}</td>
            <td className="px-3 py-2 whitespace-nowrap text-[11px] font-bold text-slate-800">
                <div className="flex items-center gap-2">
                    <div className={`h-6 w-6 rounded-lg flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-sm ${avatarColor}`}>{initials}</div>
                    <span>{product.partNo}</span>
                </div>
            </td>
            <td className="px-3 py-2 text-[11px] text-slate-600 max-w-[220px] break-words leading-relaxed">{product.description}</td>
            <td className="px-3 py-2 whitespace-nowrap text-[11px] text-slate-500">{product.hsnCode}</td>
            <td className="px-3 py-2 whitespace-nowrap text-[11px] text-right font-semibold">
                {hasPrice && currentPrice!.lp > 0
                    ? <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold">â‚¹{currentPrice!.lp.toFixed(2)}</span>
                    : <span className="text-slate-300">â€”</span>}
            </td>
            <td className="px-3 py-2 whitespace-nowrap text-[11px] text-right font-semibold">
                {hasPrice && currentPrice!.sp > 0
                    ? <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold">â‚¹{currentPrice!.sp.toFixed(2)}</span>
                    : <span className="text-slate-300">â€”</span>}
            </td>
            <td className="px-3 py-2 whitespace-nowrap text-[11px] text-slate-500">{product.uom}</td>
            <td className="px-3 py-2 whitespace-nowrap text-[11px] text-slate-500">{product.plant}</td>
            <td className="px-3 py-2 whitespace-nowrap text-[11px] text-right text-slate-500">{product.weight}</td>
            {canManage && (
            <td className="px-3 py-2 whitespace-nowrap text-right text-[11px] font-medium">
                <div className="flex justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(product)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-colors" title="Edit Product">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button onClick={() => onDelete(product.id)} className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded-lg transition-colors" title="Delete Product">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            </td>
            )}
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

  // Compute summary stats from displayed products
  const summaryStats = useMemo(() => {
    const totalProducts = displayedProducts.length;
    const withPrice = displayedProducts.filter(p => getCurrentPrice(p) !== null).length;
    const withoutPrice = totalProducts - withPrice;
    const avgLP = displayedProducts.reduce((sum, p) => {
        const cp = getCurrentPrice(p);
        return sum + (cp?.lp || 0);
    }, 0) / (withPrice || 1);
    const plants = new Set(displayedProducts.map(p => p.plant).filter(Boolean));
    return { totalProducts, withPrice, withoutPrice, avgLP, plantCount: plants.size };
  }, [displayedProducts]);

  return (
    <div className="space-y-6">

      {/* Summary Labels */}
      <div className="bg-white/90 backdrop-blur-xl p-4 rounded-2xl shadow-lg border border-slate-100 relative overflow-hidden ring-1 ring-slate-900/5">
        <div className="absolute top-0 left-0 w-96 h-40 bg-gradient-to-br from-indigo-400/10 to-fuchsia-400/10 blur-3xl rounded-full pointer-events-none"></div>
        <h3 className="text-base font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500 mb-3 tracking-tight flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            Product Catalog Overview
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 relative z-10">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-3 rounded-2xl flex flex-col shadow-md border border-indigo-400 relative overflow-hidden group cursor-default">
                <div className="absolute top-0 right-0 w-12 h-12 bg-white/10 rounded-bl-full group-hover:scale-110 transition-transform"></div>
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 mb-1">Loaded Products</span>
                <span className="font-extrabold text-2xl leading-none">{summaryStats.totalProducts}</span>
                <span className="text-[10px] mt-auto pt-1 opacity-70">Showing on page</span>
            </div>
            <div className="bg-gradient-to-br from-emerald-400 to-teal-600 text-white p-3 rounded-2xl flex flex-col shadow-md border border-emerald-300 relative overflow-hidden group cursor-default">
                <div className="absolute top-0 right-0 w-12 h-12 bg-white/10 rounded-bl-full group-hover:scale-110 transition-transform"></div>
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 mb-1">With Active Price</span>
                <span className="font-extrabold text-2xl leading-none">{summaryStats.withPrice}</span>
                <span className="text-[10px] mt-auto pt-1 opacity-70">LP / SP configured</span>
            </div>
            <div className="bg-gradient-to-br from-rose-400 to-pink-600 text-white p-3 rounded-2xl flex flex-col shadow-md border border-rose-300 relative overflow-hidden group cursor-default">
                <div className="absolute top-0 right-0 w-12 h-12 bg-white/10 rounded-bl-full group-hover:scale-110 transition-transform"></div>
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 mb-1">No Price Set</span>
                <span className="font-extrabold text-2xl leading-none">{summaryStats.withoutPrice}</span>
                <span className="text-[10px] mt-auto pt-1 opacity-70">Needs attention</span>
            </div>
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white p-3 rounded-2xl flex flex-col shadow-md border border-amber-300 relative overflow-hidden group cursor-default">
                <div className="absolute top-0 right-0 w-12 h-12 bg-white/10 rounded-bl-full group-hover:scale-110 transition-transform"></div>
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 mb-1">Avg List Price</span>
                <span className="font-extrabold text-xl leading-none">â‚¹{summaryStats.avgLP.toFixed(0)}</span>
                <span className="text-[10px] mt-auto pt-1 opacity-70">Average LP</span>
            </div>
            <div className="bg-gradient-to-br from-cyan-400 to-blue-600 text-white p-3 rounded-2xl flex flex-col shadow-md border border-cyan-300 relative overflow-hidden group cursor-default">
                <div className="absolute top-0 right-0 w-12 h-12 bg-white/10 rounded-bl-full group-hover:scale-110 transition-transform"></div>
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 mb-1">Plants</span>
                <span className="font-extrabold text-2xl leading-none">{summaryStats.plantCount}</span>
                <span className="text-[10px] mt-auto pt-1 opacity-70">Unique plants</span>
            </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white/90 backdrop-blur-xl p-4 md:p-6 rounded-2xl shadow-lg border border-slate-100 relative overflow-hidden">
         <div className="flex flex-wrap gap-4 justify-between items-center mb-6 pb-4 border-b border-slate-100">
            <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500 tracking-tight">
                Products <span className="text-lg bg-slate-100 text-slate-600 px-3 py-1 rounded-full ml-1 align-middle">{summaryStats.totalProducts}</span>
            </h2>

            {/* Mobile-only Upload/Add buttons */}
            {canManageProducts && (
            <div className="flex md:hidden gap-2">
                <button onClick={handleAddNew} className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"></path></svg>Add
                </button>
                <button onClick={handleUploadClick} className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>Upload
                </button>
            </div>
            )}

            {/* Desktop Buttons */}
            <div className="hidden md:flex flex-wrap gap-2 text-sm">
                {canManageProducts && (
                    <div className="flex gap-2 border-r border-slate-200 pr-3 mr-1">
                        <button onClick={handleExportPriceList} disabled={isUploading} className="bg-white border-2 border-amber-400 hover:bg-amber-50 text-amber-700 font-bold py-1.5 px-3 rounded-xl transition duration-300 disabled:opacity-50 flex items-center gap-1.5 shadow-sm">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Price List
                        </button>
                        <input type="file" ref={priceUpdateInputRef} onChange={handlePriceUpdateFileChange} className="hidden" accept=".xlsx, .xls"/>
                        <button onClick={handlePriceUpdateUploadClick} disabled={isUploading} className="bg-white border-2 border-orange-400 hover:bg-orange-50 text-orange-700 font-bold py-1.5 px-3 rounded-xl transition duration-300 disabled:opacity-50 flex items-center gap-1.5 shadow-sm">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            Import Prices
                        </button>
                    </div>
                )}
                <button onClick={handleExport} disabled={isUploading} className="bg-white border-2 border-slate-200 hover:border-teal-500 hover:text-teal-600 hover:bg-teal-50 text-slate-700 font-bold py-1.5 px-3 rounded-xl transition duration-300 disabled:opacity-50 flex items-center gap-1.5 shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Export
                </button>
                <button onClick={handleDownloadTemplate} disabled={isUploading} className="bg-white border-2 border-slate-200 hover:border-sky-500 hover:text-sky-600 hover:bg-sky-50 text-slate-700 font-bold py-1.5 px-3 rounded-xl transition duration-300 disabled:opacity-50 flex items-center gap-1.5 shadow-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    Template
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls"/>
                <button onClick={handleUploadClick} disabled={isUploading} className="bg-white border-2 border-slate-200 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 text-slate-700 font-bold py-1.5 px-3 rounded-xl transition duration-300 disabled:opacity-50 flex items-center gap-1.5 shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    {isUploading ? 'Uploading...' : 'Upload'}
                </button>
                {canManageProducts && (
                <button onClick={handleAddNew} disabled={isUploading} className="bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-1.5 px-5 rounded-xl shadow-lg ring-2 ring-blue-500/30 transition duration-300 disabled:opacity-50 flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"></path></svg>
                    Add New
                </button>
                )}
            </div>
         </div>

         {isUploading && ( <div className="my-4 p-3 text-center text-sm font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl" role="status">{uploadProgress}</div> )}

         {selectedProductIds.size > 0 && (
            <div className="my-3 p-3 bg-rose-50 border-2 border-rose-200 rounded-xl flex flex-wrap items-center gap-4">
              <div className="font-bold text-rose-800 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  {selectedProductIds.size} product{selectedProductIds.size > 1 ? 's' : ''} selected
              </div>
              <button onClick={handleDeleteSelected} className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-1.5 px-4 rounded-xl transition duration-300 text-sm flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Delete Selected
              </button>
            </div>
         )}

         {/* Mobile Search and Discount */}
         <div className="block md:hidden space-y-3 mb-4 bg-slate-50/60 p-3 rounded-xl border border-slate-100">
             <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Universal Search</label>
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full mt-1 p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" placeholder="Search Part No or Description..."/>
             </div>
             <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Discount %</label>
                <div className="relative">
                    <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} className="w-full mt-1 p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" placeholder="0"/>
                    <span className="absolute right-3 top-3 text-slate-400 text-sm">%</span>
                </div>
             </div>
         </div>

         {/* Desktop Filters */}
         <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
            <div>
                <label htmlFor="searchTerm" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Search Part No</label>
                <input type="text" id="searchTerm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="block w-full px-3 py-1.5 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-[11px]" placeholder="e.g. OLFLEX*UNITRONIC" />
            </div>
             <div>
                <label htmlFor="searchDescription" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Search Description</label>
                <input type="text" id="searchDescription" value={searchDescription} onChange={e => setSearchDescription(e.target.value)} className="block w-full px-3 py-1.5 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-[11px]" placeholder="e.g. CABLE*POWER" />
            </div>
            <div>
                <label htmlFor="sortBy" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sort By</label>
                <select id="sortBy" value={sortBy} onChange={e => setSortBy(e.target.value as SortByType)} className="block w-full px-3 py-1.5 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-[11px] bg-white">
                    <option value="price">Price (LP)</option>
                    <option value="id">ID</option>
                    <option value="partNo">Part No</option>
                    <option value="description">Description</option>
                    <option value="hsnCode">HSN Code</option>
                </select>
            </div>
            <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Order</label>
                <button type="button" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="w-full bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-bold py-1.5 px-4 border border-slate-200 rounded-xl shadow-sm flex items-center justify-center text-[11px] transition-colors">
                    {sortOrder === 'asc' ? 'â–² Ascending' : 'â–¼ Descending'}
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
                const avatarColors = ['from-indigo-400 to-purple-600','from-emerald-400 to-teal-600','from-amber-400 to-orange-500','from-rose-400 to-pink-600','from-cyan-400 to-blue-600'];
                const avatarColor = avatarColors[product.id % avatarColors.length];
                return (
                    <div key={product.id} className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                                <div className={`h-8 w-8 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center text-[10px] font-black text-white shadow`}>{product.partNo.slice(0,2).toUpperCase()}</div>
                                <div>
                                    <h3 className="text-xs font-bold text-indigo-700">{product.partNo}</h3>
                                    <div className="text-[10px] text-slate-400">#{product.id}</div>
                                </div>
                            </div>
                            {currentPrice ? (
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">Priced</span>
                            ) : (
                                <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full">No Price</span>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-relaxed">{product.description}</p>
                        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-50 pt-2">
                            <div>
                                <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold mb-1">Standard Price</p>
                                <div className="flex gap-2 text-xs font-bold">
                                    <span className={lp > 0 ? "text-emerald-600" : "text-slate-300"}>LP: {lp > 0 ? `â‚¹${lp.toFixed(2)}` : 'â€”'}</span>
                                    <span className={sp > 0 ? "text-blue-600" : "text-slate-300"}>SP: {sp > 0 ? `â‚¹${sp.toFixed(2)}` : 'â€”'}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold mb-1">After Discount</p>
                                <p className="text-sm font-black text-indigo-600">{discountedPrice.toLocaleString('en-IN', {style: 'currency', currency: 'INR'})}</p>
                            </div>
                        </div>
                        {canManageProducts && (
                        <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-slate-50">
                            <button onClick={() => handleEdit(product)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Edit">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button onClick={() => handleDelete(product.id)} className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors" title="Delete">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                        )}
                    </div>
                );
            })}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto -mx-4">
            <table className="min-w-full">
            <thead className="bg-gradient-to-r from-slate-50 to-indigo-50/40 border-b-2 border-slate-200/60">
                <tr>
                    <th className="px-3 py-3"><input type="checkbox" className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={isAllSelected} onChange={handleSelectAll} aria-label="Select all products"/></th>
                    {['ID', 'Part No', 'Description', 'HSN Code', 'Current LP', 'Current SP', 'UOM', 'Plant', 'Weight', ...(canManageProducts ? ['Actions'] : [])].map(header => (
                    <th key={header} scope="col" className={`px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider ${['Current LP', 'Current SP', 'Weight', 'Actions'].includes(header) ? 'text-right' : ''}`}>{header}</th>
                    ))}
                </tr>
            </thead>
            <tbody className="bg-white/40 divide-y divide-slate-100/60">
                {displayedProducts.map(product => (
                    <ProductRow
                        key={product.id}
                        product={product}
                        isSelected={selectedProductIds.has(product.id)}
                        onSelect={handleSelectOne}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        canManage={canManageProducts}
                    />
                ))}
            </tbody>
            </table>
        </div>
        {isLoading && <p className="text-slate-500 text-center py-8 text-sm">Loading products...</p>}
        {!isLoading && displayedProducts.length === 0 && (
          <p className="text-slate-500 text-center py-8 text-sm">No products match your search criteria.</p>
        )}
        {!isLoading && hasMore && (
            <div className="mt-6 text-center">
                <button onClick={() => fetchProducts(true)} disabled={isLoadingMore} className="bg-gradient-to-br from-slate-500 to-slate-700 hover:from-slate-600 hover:to-slate-800 text-white font-bold py-2 px-6 rounded-xl transition duration-300 disabled:opacity-50 shadow-md">
                    {isLoadingMore ? 'Loading...' : 'Load More Products'}
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
