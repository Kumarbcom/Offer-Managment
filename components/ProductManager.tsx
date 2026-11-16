






import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Product, PriceEntry, User } from '../types';
import { UOMS, PLANTS } from '../constants';
import { ProductAddModal } from './ProductAddModal';
import { ImageZoomModal } from './ImageZoomModal';
import { getProductsPaginated, addProductsBatch, deleteProductsBatch, updateProduct, getProductsByPartNos, fetchAllProductsForExport, getNextProductId } from '../supabase';

declare var XLSX: any;

interface ProductManagerProps {
    currentUser: User;
}

type SortByType = 'id' | 'partNo' | 'description' | 'hsnCode' | 'price';
type SortOrderType = 'asc' | 'desc';

const PAGE_LIMIT = 50;

const parseProductDate = (dateStr: any): Date => {
    if (!dateStr) return new Date(NaN);
    if (dateStr instanceof Date) return dateStr;
    const s = String(dateStr).trim();
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
        const [d, m, y] = s.split('.');
        return new Date(Number(y), Number(m) - 1, Number(d));
    }
    if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
        const [d, m, y] = s.split('-');
        return new Date(Number(y), Number(m) - 1, Number(d));
    }
    return new Date(s);
};

const getCurrentPrice = (product: Product): PriceEntry | null => {
    if (!product.prices || product.prices.length === 0) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
  
    // 1. Check exact bracket
    for (const p of product.prices) {
        const from = parseProductDate(p.validFrom);
        const to = parseProductDate(p.validTo);
        if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
            from.setHours(0, 0, 0, 0);
            to.setHours(23, 59, 59, 999);
            if (today >= from && today <= to) {
                return p;
            }
        }
    }

    // 2. Filter past or current, sort descending by validFrom
    const validPrices = product.prices
        .map(p => ({ p, from: parseProductDate(p.validFrom) }))
        .filter(item => !isNaN(item.from.getTime()));

    const past = validPrices.filter(item => item.from <= today);
    if (past.length > 0) {
        past.sort((a, b) => b.from.getTime() - a.from.getTime());
        return past[0].p;
    }

    // 3. Fallback to latest price
    if (validPrices.length > 0) {
        validPrices.sort((a, b) => b.from.getTime() - a.from.getTime());
        return validPrices[0].p;
    }
    
    return product.prices[product.prices.length - 1] || null;
};

const getEffectivePriceValue = (product: Product): number => {
    const price = getCurrentPrice(product);
    if (!price) return 0;
    return price.lp > 0 ? price.lp : price.sp;
};

// Memoized ModernProductRow component (Modern Stripe/Shopify-style Product Table)
const ModernProductRow = React.memo(({ 
    product, 
    isSelected, 
    onSelect, 
    onEdit, 
    onDelete, 
    onZoomImage 
}: { 
    product: Product; 
    isSelected: boolean; 
    onSelect: (id: number) => void; 
    onEdit: (product: Product) => void; 
    onDelete: (id: number) => void; 
    onZoomImage?: (p: Product) => void; 
}) => {
    const currentPrice = getCurrentPrice(product);
    const lp = currentPrice?.lp || 0;
    const sp = currentPrice?.sp || 0;
    
    return (
        <tr className={`border-b border-slate-100 hover:bg-gradient-to-r hover:from-indigo-50/40 hover:via-purple-50/20 hover:to-transparent transition-all group ${
            isSelected ? 'bg-gradient-to-r from-indigo-50/80 to-purple-50/40' : 'bg-white'
        }`}>
            {/* Checkbox */}
            <td className="px-3 py-3 text-center w-12">
                <input 
                    type="checkbox" 
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                    checked={isSelected} 
                    onChange={() => onSelect(product.id)} 
                    aria-label={`Select product ${product.partNo}`}
                />
            </td>

            {/* Product: Image on Left + Part No & Description Below (ID removed) */}
            <td className="px-4 py-3 w-[38%] min-w-[340px]">
                <div className="flex items-center gap-3.5">
                    {/* Modern Image Container with subtle gradient border/shadow */}
                    <div className="relative shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/80 border border-slate-200/90 shadow-2xs flex items-center justify-center overflow-hidden group/img">
                        {product.imageUrl ? (
                            <img 
                                src={product.imageUrl} 
                                alt={product.partNo} 
                                onClick={() => onZoomImage?.(product)}
                                className="w-full h-full object-contain p-0.5 cursor-zoom-in group-hover/img:scale-110 transition-transform duration-200" 
                                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                title="Click to zoom image"
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/50 text-indigo-400">
                                <svg className="w-5 h-5 text-indigo-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                                    <line x1="12" y1="22.08" x2="12" y2="12"/>
                                </svg>
                            </div>
                        )}
                    </div>

                    {/* Part No & Description (Clean, bold, no ID badge) */}
                    <div className="min-w-0 flex-1">
                        <span 
                            className="font-mono font-extrabold text-slate-900 text-sm hover:text-indigo-600 cursor-pointer transition-colors tracking-tight block" 
                            onClick={() => onEdit(product)}
                            title="Click to edit product"
                        >
                            {product.partNo}
                        </span>
                        <div className="text-xs text-slate-500 font-medium truncate max-w-sm sm:max-w-md mt-0.5" title={product.description}>
                            {product.description}
                        </div>
                    </div>
                </div>
            </td>

            {/* HSN Code */}
            <td className="px-3 py-3 text-center w-[10%]">
                {product.hsnCode ? (
                    <span className="font-mono text-xs text-slate-700 bg-slate-100/90 px-2 py-0.5 rounded-md border border-slate-200/70 font-medium">
                        {product.hsnCode}
                    </span>
                ) : (
                    <span className="text-slate-300 text-xs">—</span>
                )}
            </td>

            {/* List Price */}
            <td className="px-4 py-3 text-right w-[13%] whitespace-nowrap">
                {lp > 0 ? (
                    <span className="font-mono font-black text-slate-900 text-sm tracking-tight">
                        ₹{lp.toFixed(2)}
                    </span>
                ) : (
                    <span className="text-slate-300 text-xs font-mono">—</span>
                )}
            </td>

            {/* Selling Price */}
            <td className="px-4 py-3 text-right w-[11%] whitespace-nowrap">
                {sp > 0 ? (
                    <span className="font-mono text-slate-600 text-xs tracking-tight">
                        ₹{sp.toFixed(2)}
                    </span>
                ) : (
                    <span className="text-slate-300 text-xs font-mono">—</span>
                )}
            </td>

            {/* UOM */}
            <td className="px-2 py-3 text-center w-[7%]">
                {product.uom ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-mono">
                        {product.uom}
                    </span>
                ) : (
                    <span className="text-slate-300 text-xs font-mono">—</span>
                )}
            </td>

            {/* Plant */}
            <td className="px-2 py-3 text-center w-[9%]">
                {product.plant ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-mono">
                        {product.plant}
                    </span>
                ) : (
                    <span className="text-slate-300 text-xs font-mono">—</span>
                )}
            </td>

            {/* Weight */}
            <td className="px-3 py-3 text-right w-[8%] whitespace-nowrap">
                {product.weight > 0 ? (
                    <span className="text-slate-700 font-mono text-xs font-medium">
                        {product.weight}{product.weight > 0 && product.weight < 100 ? ' g' : ' kg/m'}
                    </span>
                ) : (
                    <span className="text-slate-300 font-mono text-xs">—</span>
                )}
            </td>

            {/* Actions (Attractive Modern SVG Buttons) */}
            <td className="px-3 py-3 text-center w-[8%] min-w-[85px] whitespace-nowrap">
                <div className="flex items-center justify-center gap-1.5">
                    {/* Edit Button */}
                    <button 
                        onClick={() => onEdit(product)} 
                        className="p-1.5 rounded-xl text-indigo-600 hover:text-white bg-indigo-50/80 hover:bg-gradient-to-r hover:from-indigo-600 hover:to-blue-600 border border-indigo-200/70 hover:border-transparent transition-all shadow-2xs hover:shadow-xs group/btn" 
                        title="Edit Product"
                    >
                        <svg className="w-4 h-4 transition-transform group-hover/btn:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9"/>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                        </svg>
                    </button>
                    
                    {/* Delete Button */}
                    <button 
                        onClick={() => onDelete(product.id)} 
                        className="p-1.5 rounded-xl text-rose-600 hover:text-white bg-rose-50/80 hover:bg-gradient-to-r hover:from-rose-600 hover:to-red-600 border border-rose-200/70 hover:border-transparent transition-all shadow-2xs hover:shadow-xs group/btn" 
                        title="Delete Product"
                    >
                        <svg className="w-4 h-4 transition-transform group-hover/btn:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    );
});

// Memoized ExcelProductRow component (Authentic Microsoft Excel Look)
const ExcelProductRow = React.memo(({ 
    product, 
    index, 
    isSelected, 
    onSelect, 
    onEdit, 
    onDelete, 
    onZoomImage 
}: { 
    product: Product; 
    index: number; 
    isSelected: boolean; 
    onSelect: (id: number) => void; 
    onEdit: (product: Product) => void; 
    onDelete: (id: number) => void; 
    onZoomImage?: (p: Product) => void; 
}) => {
    const currentPrice = getCurrentPrice(product);
    const lp = currentPrice?.lp || 0;
    const sp = currentPrice?.sp || 0;
    
    return (
        <tr className={`border-b border-slate-300 transition-colors h-7.5 text-xs ${
            isSelected ? 'bg-emerald-100/70 font-semibold' : 'hover:bg-emerald-50/40 bg-white'
        }`}>
            {/* Excel Row Header # */}
            <td className="px-1 text-center bg-[#f8f9fa] border-r border-slate-300 text-slate-600 font-mono text-[11px] font-bold select-none w-10">
                {index + 1}
            </td>
            {/* Checkbox */}
            <td className="px-2 text-center border-r border-slate-300 w-8">
                <input 
                    type="checkbox" 
                    className="h-3.5 w-3.5 rounded border-slate-300 text-[#107c41] focus:ring-[#107c41] cursor-pointer" 
                    checked={isSelected} 
                    onChange={() => onSelect(product.id)} 
                    aria-label={`Select product ${product.partNo}`}
                />
            </td>
            {/* A: ID */}
            <td className="px-2 border-r border-slate-300 text-slate-500 font-mono text-center w-14">
                #{product.id}
            </td>
            {/* B: Part No - Prominent, Bold, and Never Truncated */}
            <td className="px-2 border-r border-slate-300 font-mono font-bold text-slate-900 text-xs sm:text-sm min-w-[130px] whitespace-nowrap">
                <span 
                    className="hover:text-[#107c41] cursor-pointer" 
                    onClick={() => onEdit(product)}
                    title="Click to edit product"
                >
                    {product.partNo}
                </span>
            </td>
            {/* C: Image (Compact Thumbnail if exists, or dash) */}
            <td className="px-1 border-r border-slate-300 text-center w-12">
                {product.imageUrl ? (
                    <img 
                        src={product.imageUrl} 
                        alt={product.partNo} 
                        onClick={() => onZoomImage?.(product)}
                        className="w-6 h-6 object-contain rounded bg-white border border-slate-300 cursor-zoom-in hover:scale-125 transition-transform shadow-2xs mx-auto" 
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        title="Click to zoom image"
                    />
                ) : (
                    <span className="text-slate-300 text-xs">—</span>
                )}
            </td>
            {/* D: Description */}
            <td className="px-2 border-r border-slate-300 text-slate-800 max-w-sm truncate" title={product.description}>
                {product.description}
            </td>
            {/* E: HSN Code */}
            <td className="px-2 border-r border-slate-300 text-slate-600 font-mono text-center w-24">
                {product.hsnCode || '—'}
            </td>
            {/* F: List Price */}
            <td className="px-2 border-r border-slate-300 text-right font-mono font-bold text-slate-900 w-28 whitespace-nowrap">
                {lp > 0 ? `₹${lp.toFixed(2)}` : '—'}
            </td>
            {/* G: Selling Price */}
            <td className="px-2 border-r border-slate-300 text-right font-mono text-slate-600 w-28 whitespace-nowrap">
                {sp > 0 ? `₹${sp.toFixed(2)}` : '—'}
            </td>
            {/* H: UOM */}
            <td className="px-1 border-r border-slate-300 text-center font-mono text-slate-700 w-14">
                {product.uom || '—'}
            </td>
            {/* I: Plant */}
            <td className="px-1 border-r border-slate-300 text-center font-mono text-slate-700 w-16">
                {product.plant || '—'}
            </td>
            {/* J: Weight */}
            <td className="px-2 border-r border-slate-300 text-right font-mono text-slate-600 w-20 whitespace-nowrap">
                {product.weight > 0 ? `${product.weight}${product.weight > 0 && product.weight < 100 ? ' g' : ''}` : '—'}
            </td>
            {/* K: Actions */}
            <td className="px-2 text-center w-20 whitespace-nowrap">
                <div className="flex items-center justify-center gap-1.5">
                    <button 
                        onClick={() => onEdit(product)} 
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-all shadow-2xs group/btn" 
                        title="Edit Product"
                    >
                        <svg className="w-3.5 h-3.5 transition-transform group-hover/btn:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </button>
                    <button 
                        onClick={() => onDelete(product.id)} 
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all shadow-2xs group/btn" 
                        title="Delete Product"
                    >
                        <svg className="w-3.5 h-3.5 transition-transform group-hover/btn:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                </div>
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
  const imageUpdateInputRef = useRef<HTMLInputElement>(null);
  const bulkImageFilesInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());
  const [zoomedProduct, setZoomedProduct] = useState<Product | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [viewMode, setViewMode] = useState<'excel' | 'modern'>(() => {
    return (localStorage.getItem('products_view_mode') as 'excel' | 'modern') || 'excel';
  });
  const [activeDropdown, setActiveDropdown] = useState<'export' | 'update' | 'template' | null>(null);
  const canManageProducts = currentUser.role !== 'Sales Person';

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.toolbar-dropdown')) {
        setActiveDropdown(null);
      }
    };
    window.addEventListener('resize', handleResize);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousedown', handleClickOutside);
    };
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
  const handleEdit = useCallback(async (product: Product) => {
    let p = product;
    if (!p.prices || !Array.isArray(p.prices) || p.prices.length === 0) {
      if (p.id) {
        const fresh = await getProductsByIds([p.id]);
        if (fresh && fresh.length > 0) p = fresh[0];
      }
    }
    setProductToEdit(p);
    setIsModalOpen(true);
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    if (window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
        await deleteProductsBatch([id]);
        setDisplayedProducts(prev => prev.filter(p => p.id !== id));
    }
  }, []);

  const handleSaveProduct = useCallback(async (product: Product) => {
    if (productToEdit) {
      await updateProduct(product);
      setDisplayedProducts(prev => prev.map(p => p.id === product.id ? product : p));
    } else {
      await addProductsBatch([product]);
      setSearchTerm(product.partNo);
      setDisplayedProducts(prev => [product, ...prev.filter(p => p.id !== product.id)]);
    }
  }, [productToEdit]);
  
  const handleCloseModal = useCallback(() => { setIsModalOpen(false); setProductToEdit(null); }, []);
  
  // Download Template for adding new products to catalog
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "PartNo": "4510023U100",
        "Description": "ÖLFLEX® UNIPLUS 1X1 BU",
        "HSNCode": "85444990",
        "UOM": "M",
        "Plant": "MFGN",
        "Weight": 0.025,
        "LP": 33.04,
        "SP": 0,
        "ValidFrom": new Date().toISOString().split('T')[0],
        "ValidTo": "9999-12-31",
        "ImageURL": "https://example.com/sample.jpg"
      },
      {
        "PartNo": "4520012U100",
        "Description": "ÖLFLEX® UNIPLUS 1X2.5 BK",
        "HSNCode": "85444990",
        "UOM": "M",
        "Plant": "TRDN",
        "Weight": 0.045,
        "LP": 77.47,
        "SP": 0,
        "ValidFrom": new Date().toISOString().split('T')[0],
        "ValidTo": "9999-12-31",
        "ImageURL": ""
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "New_Products_Template");
    XLSX.writeFile(wb, "New_Products_Template.xlsx");
  };
  
  // Helper to format products for export: ID, Image, Part No, Description, HSN Code, UOM, Plant, Weight, then Price table From date wise
  const exportProductsToExcel = (productsToExport: Product[], filename: string) => {
    const dataToExport = productsToExport.flatMap(product => {
      // Sort price table From date wise (ascending by validFrom date)
      const sortedPrices = [...(product.prices || [])].sort((a, b) => {
        const dateA = new Date(a.validFrom).getTime() || 0;
        const dateB = new Date(b.validFrom).getTime() || 0;
        return dateA - dateB;
      });

      if (sortedPrices.length === 0) {
        return [{
          'ID': product.id,
          'Image': product.imageUrl || '',
          'Part No': product.partNo,
          'Description': product.description,
          'HSN Code': product.hsnCode || '',
          'UOM': product.uom || '',
          'Plant': product.plant || '',
          'Weight': product.weight || 0,
          'LP (List Price)': 0,
          'SP (Special Price)': 0,
          'Valid From': '',
          'Valid To': ''
        }];
      }

      return sortedPrices.map(price => ({
        'ID': product.id,
        'Image': product.imageUrl || '',
        'Part No': product.partNo,
        'Description': product.description,
        'HSN Code': product.hsnCode || '',
        'UOM': product.uom || '',
        'Plant': product.plant || '',
        'Weight': product.weight || 0,
        'LP (List Price)': price.lp || 0,
        'SP (Special Price)': price.sp || 0,
        'Valid From': price.validFrom || '',
        'Valid To': price.validTo || ''
      }));
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, filename);
  };

  const handleExportVisible = () => {
    exportProductsToExcel(displayedProducts, "Products_Visible_Export.xlsx");
  };

  const handleExportAll = async () => {
    setIsUploading(true);
    setUploadProgress('Fetching all products for export...');
    try {
      const allProducts = await fetchAllProductsForExport();
      exportProductsToExcel(allProducts, "Products_All_Catalog_Export.xlsx");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to export all products");
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  // Generate Price Update Template with existing price and updated date
  const handleExportPriceList = async () => {
      setIsUploading(true);
      setUploadProgress('Generating price update template with existing prices...');
      try {
          const allProducts = await fetchAllProductsForExport();
          const todayDateStr = new Date().toISOString().split('T')[0];
          const dataToExport = allProducts.map(product => {
              const currentPrice = getCurrentPrice(product);
              return {
                  'ID': product.id,
                  'Part No': product.partNo,
                  'Description': product.description,
                  'UOM': product.uom || '',
                  'Plant': product.plant || '',
                  'Current LP': currentPrice ? currentPrice.lp : 0,
                  'Current SP': currentPrice ? currentPrice.sp : 0,
                  'Current Valid From': currentPrice ? currentPrice.validFrom : '',
                  'New LP': '',
                  'New SP': '',
                  'New Valid From': todayDateStr, // defaults to today's date
                  'New Valid To': '9999-12-31',
                  'ImageURL': product.imageUrl || ''
              };
          });
          const ws = XLSX.utils.json_to_sheet(dataToExport);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Price_Update_Template");
          XLSX.writeFile(wb, `Price_Update_Template_${todayDateStr}.xlsx`);
      } catch (error) {
          alert(error instanceof Error ? error.message : "Failed to export price list");
      } finally {
          setIsUploading(false);
          setUploadProgress('');
      }
  };

  const handleDownloadImageTemplate = async (mode: 'all' | 'visible' = 'all') => {
    setIsUploading(true);
    setUploadProgress('Fetching products for image template...');
    try {
      let productsList: Product[] = [];
      if (mode === 'all') {
        productsList = await fetchAllProductsForExport();
      } else {
        productsList = displayedProducts;
      }

      const dataToExport = productsList.map(p => ({
        'Part No': p.partNo,
        'Description': p.description,
        'ImageURL': p.imageUrl || ''
      }));
      const defaultData = dataToExport.length > 0 ? dataToExport : [
        { 'Part No': '', 'Description': '', 'ImageURL': '' }
      ];
      const ws = XLSX.utils.json_to_sheet(defaultData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Product_Images");
      XLSX.writeFile(wb, mode === 'all' ? "All_Products_Image_Template.xlsx" : "Visible_Products_Image_Template.xlsx");
    } catch (error) {
      console.error("Failed to generate image template:", error);
      alert(error instanceof Error ? error.message : "Failed to generate image template.");
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const handleImageUpdateUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = e.target?.result;
      if (!data) return;
      setIsUploading(true);
      setUploadProgress('Reading image upload file...');
      try {
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        const rowsWithImages = json.filter(row => {
          const partNo = String(row['Part No'] || row['PartNo'] || row['partNo'] || '').trim();
          const imgUrl = String(row['ImageURL'] || row['ImageUrl'] || row['image_url'] || row['Image URL'] || '').trim();
          return partNo && imgUrl;
        });

        if (rowsWithImages.length === 0) {
          alert("No valid rows with 'Part No' and 'ImageURL' found in the file.");
          setIsUploading(false);
          setUploadProgress('');
          return;
        }

        const localPathRows = rowsWithImages.filter(row => {
          const imgUrl = String(row['ImageURL'] || row['ImageUrl'] || row['image_url'] || row['Image URL'] || '').trim();
          return /^(?:[a-zA-Z]:[\\/]|file:\/\/|\\\\)/i.test(imgUrl);
        });

        if (localPathRows.length > 0 && localPathRows.length === rowsWithImages.length) {
          alert(`Warning: The ImageURL column in your file contains local computer paths (like "C:\\Users\\...").\n\nWeb browsers cannot load files directly from local computer paths for security reasons.\n\nTo upload photos from your computer, please click the "Upload Image Files" button to select the image files directly!`);
          setIsUploading(false);
          setUploadProgress('');
          return;
        }

        const partNos = rowsWithImages.map(row => String(row['Part No'] || row['PartNo'] || row['partNo'] || '').trim());
        const CHUNK_SIZE = 100;
        let updatedCount = 0;

        for (let i = 0; i < partNos.length; i += CHUNK_SIZE) {
          const chunkPartNos = partNos.slice(i, i + CHUNK_SIZE);
          setUploadProgress(`Updating images for products ${i + 1} to ${Math.min(i + CHUNK_SIZE, partNos.length)} of ${partNos.length}...`);
          const products = await getProductsByPartNos(chunkPartNos);
          const productsToUpdate: Product[] = [];

          for (const product of products) {
            const row = rowsWithImages.find(r => String(r['Part No'] || r['PartNo'] || r['partNo'] || '').trim() === product.partNo);
            if (!row) continue;
            const newImgUrl = String(row['ImageURL'] || row['ImageUrl'] || row['image_url'] || row['Image URL'] || '').trim();
            productsToUpdate.push({ ...product, imageUrl: newImgUrl });
          }

          if (productsToUpdate.length > 0) {
            await addProductsBatch(productsToUpdate);
            updatedCount += productsToUpdate.length;
          }
        }

        alert(`Successfully updated images for ${updatedCount} products.`);
        fetchProducts(false);
      } catch (error) {
        console.error("Image upload error:", error);
        alert(error instanceof Error ? error.message : "Failed to process image updates.");
      } finally {
        setIsUploading(false);
        setUploadProgress('');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBulkImageFilesUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const fileList = Array.from(files);
    setIsUploading(true);
    setUploadProgress(`Processing ${fileList.length} image files...`);

    try {
      // Fetch all products so we can match filenames to part numbers
      const allProducts = await fetchAllProductsForExport();
      const productMapByPartNo = new Map<string, Product>();
      allProducts.forEach(p => {
        if (p.partNo) {
          productMapByPartNo.set(p.partNo.trim().toLowerCase(), p);
        }
      });

      const matchedUpdates: Product[] = [];
      let skippedCount = 0;

      const compressImageFile = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const maxDim = 250;
              let width = img.width;
              let height = img.height;
              if (width > maxDim || height > maxDim) {
                if (width > height) {
                  height = Math.round((height * maxDim) / width);
                  width = maxDim;
                } else {
                  width = Math.round((width * maxDim) / height);
                  height = maxDim;
                }
              }
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
              } else {
                resolve(e.target?.result as string);
              }
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target?.result as string;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      };

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        setUploadProgress(`Matching and optimizing image ${i + 1} of ${fileList.length} (${file.name})...`);
        
        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        
        // Exact match by partNo
        let matchedProduct = productMapByPartNo.get(baseName.trim().toLowerCase());
        
        // Substring match (e.g. "OELFLEX_221803_Product_1" contains "221803")
        if (!matchedProduct) {
          for (const [partNoKey, prod] of productMapByPartNo.entries()) {
            if (partNoKey.length >= 4 && baseName.toLowerCase().includes(partNoKey)) {
              matchedProduct = prod;
              break;
            }
          }
        }

        if (matchedProduct) {
          const compressedDataUrl = await compressImageFile(file);
          matchedUpdates.push({ ...matchedProduct, imageUrl: compressedDataUrl });
        } else {
          skippedCount++;
        }
      }

      if (matchedUpdates.length === 0) {
        alert(`None of the ${fileList.length} image files matched any product Part Numbers. Please ensure file names match or include the Part No (e.g. "221803.jpg").`);
        return;
      }

      const CHUNK_SIZE = 50;
      for (let i = 0; i < matchedUpdates.length; i += CHUNK_SIZE) {
        const chunk = matchedUpdates.slice(i, i + CHUNK_SIZE);
        setUploadProgress(`Saving images ${i + 1} to ${Math.min(i + CHUNK_SIZE, matchedUpdates.length)} of ${matchedUpdates.length}...`);
        await addProductsBatch(chunk);
      }

      alert(`Successfully uploaded images for ${matchedUpdates.length} products!${skippedCount > 0 ? ` (${skippedCount} files did not match any Part No)` : ''}`);
      fetchProducts(false);

    } catch (err) {
      console.error("Bulk image upload error:", err);
      alert(err instanceof Error ? err.message : "Bulk image upload failed.");
    } finally {
      setIsUploading(false);
      setUploadProgress('');
      event.target.value = '';
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
              
              // Identify rows with price updates or image updates
              const rowsWithUpdates = json.filter(row => {
                  const desc = String(row['Description'] || '').toLowerCase();
                  if (desc.includes('cutting charge') || desc.includes('not in range')) {
                      return false;
                  }
                  const newLP = parseFloat(row['New LP']);
                  const newSP = parseFloat(row['New SP']);
                  const hasPriceUpdate = (!isNaN(newLP) && newLP > 0) || (!isNaN(newSP) && newSP > 0);
                  const hasImageUpdate = !!row['ImageURL'];
                  return hasPriceUpdate || hasImageUpdate;
              });
              
              if (rowsWithUpdates.length === 0) {
                  alert("No valid updates found in the file. Please ensure 'New LP', 'New SP', or 'ImageURL' columns are filled.");
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

                      let newPrices = product.prices;
                      const hasPriceUpdate = (!isNaN(newLP) && newLP > 0) || (!isNaN(newSP) && newSP > 0);
                      if (hasPriceUpdate) {
                          const newPriceEntry: PriceEntry = { lp: newLP, sp: newSP, validFrom, validTo };
                          newPrices = [...product.prices, newPriceEntry];
                          
                          // Sort and adjust dates
                          newPrices.sort((a, b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime());
                          
                          for (let j = 0; j < newPrices.length - 1; j++) {
                              const nextDate = new Date(newPrices[j+1].validFrom);
                              nextDate.setDate(nextDate.getDate() - 1);
                              newPrices[j].validTo = nextDate.toISOString().split('T')[0];
                          }
                          newPrices[newPrices.length - 1].validTo = '9999-12-31';
                      }
                      
                      let imageUrl = product.imageUrl;
                      if (row['ImageURL'] !== undefined) {
                          imageUrl = String(row['ImageURL']).trim();
                      }
                      
                      productsToUpdate.push({ ...product, prices: newPrices, imageUrl });
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
          const desc = String(row['Description'] || '').toLowerCase();
          
          if (desc.includes('cutting charge') || desc.includes('not in range')) {
            return; // Skip this product
          }

          if (partNo) {
            if (!productsByPartNo[partNo]) productsByPartNo[partNo] = [];
            productsByPartNo[partNo].push(row);
          }
        });

        const nextId = await getNextProductId();
        let newId = nextId - 1;

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
            imageUrl: String(firstRow['ImageURL'] || '').trim(),
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
  };

  const handleImageUpdateUploadClick = () => { imageUpdateInputRef.current?.click(); };
  const handleImageUpdateFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          handleImageUpdateUpload(file);
          event.target.value = '';
      }
  };

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
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/90">
         {/* Top Header with Title, View Switcher, and Professional Grouped Action Buttons */}
         <div className="flex flex-wrap gap-3 justify-between items-center mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3.5 flex-wrap">
               <div className="flex items-center gap-2">
                 <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Products</h2>
                 <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                   {displayedProducts.length}
                 </span>
               </div>

               {/* View Mode Toggle Pill (Modern View vs Excel Grid View) */}
               <div className="hidden sm:inline-flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-semibold shadow-2xs">
                  <button
                     type="button"
                     onClick={() => { setViewMode('modern'); localStorage.setItem('products_view_mode', 'modern'); }}
                     className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                        viewMode === 'modern' 
                          ? 'bg-white text-indigo-700 shadow-xs font-bold' 
                          : 'text-slate-600 hover:text-slate-900'
                     }`}
                  >
                     <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                     <span>Modern View</span>
                  </button>
                  <button
                     type="button"
                     onClick={() => { setViewMode('excel'); localStorage.setItem('products_view_mode', 'excel'); }}
                     className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                        viewMode === 'excel' 
                          ? 'bg-[#107c41] text-white shadow-xs font-bold' 
                          : 'text-slate-600 hover:text-slate-900'
                     }`}
                  >
                     <span className="font-sans font-black bg-white text-[#107c41] px-1 rounded text-[10px] leading-tight">X</span>
                     <span>Excel Grid View</span>
                  </button>
               </div>
            </div>

            {/* Mobile Actions: strictly ordered sequence */}
            {canManageProducts && (
            <div className="flex md:hidden gap-1.5 flex-wrap">
                <button onClick={handleAddNew} className="bg-blue-600 text-white px-2.5 py-1 rounded-lg text-xs font-bold shadow-xs">
                    + Add New
                </button>
                <button onClick={handleExportVisible} className="bg-teal-600 text-white px-2 py-1 rounded-lg text-xs font-semibold">
                    Export
                </button>
                <button onClick={handleExportPriceList} className="bg-amber-600 text-white px-2 py-1 rounded-lg text-xs font-semibold">
                    Update
                </button>
                <button onClick={handleDownloadTemplate} className="bg-sky-600 text-white px-2 py-1 rounded-lg text-xs font-semibold">
                    Template
                </button>
            </div>
            )}
            
            {/* Desktop Actions: Strictly Ordered - 1. Add items (New) -> 2. Export -> 3. Update -> 4. Template */}
            <div className="hidden md:flex flex-wrap gap-2.5 text-xs items-center">
                {/* 1. Add items (New) */}
                {canManageProducts && (
                    <button 
                        onClick={handleAddNew} 
                        disabled={isUploading} 
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-bold py-2 px-4 rounded-xl shadow-md shadow-indigo-500/25 hover:shadow-lg hover:shadow-indigo-500/35 transition-all active:scale-[0.98] disabled:opacity-50 text-xs"
                    >
                        <span className="w-5 h-5 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"/>
                                <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                        </span>
                        <span className="tracking-wide">Add items (New)</span>
                    </button>
                )}

                {/* 2. Export (Dropdown with Date-Wise Options) */}
                <div className="relative toolbar-dropdown">
                    <button 
                        type="button"
                        onClick={() => setActiveDropdown(prev => prev === 'export' ? null : 'export')}
                        disabled={isUploading} 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
                    >
                        <svg className="w-3.5 h-3.5 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        <span>Export</span>
                        <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {activeDropdown === 'export' && (
                        <div className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 text-xs animate-in fade-in zoom-in-95 duration-100">
                            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                                Export Options (Date-Wise Prices)
                            </div>
                            <button 
                                onClick={() => { setActiveDropdown(null); handleExportAll(); }} 
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-800 transition-colors flex flex-col"
                            >
                                <span className="font-semibold text-slate-900">📥 Export All Products (Date-wise)</span>
                                <span className="text-[10px] text-slate-500">ID, Image, Specs, and full price history by date</span>
                            </button>
                            <button 
                                onClick={() => { setActiveDropdown(null); handleExportVisible(); }} 
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-800 transition-colors flex flex-col border-t border-slate-50"
                            >
                                <span className="font-semibold text-slate-900">📄 Export Visible Products</span>
                                <span className="text-[10px] text-slate-500">Only the currently filtered/searched products</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* 3. Update (Dropdown: Download Current Price Sheet & Upload Latest Prices) */}
                {canManageProducts && (
                    <div className="relative toolbar-dropdown">
                        <button 
                            type="button"
                            onClick={() => setActiveDropdown(prev => prev === 'update' ? null : 'update')}
                            disabled={isUploading} 
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
                        >
                            <svg className="w-3.5 h-3.5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            <span>Update</span>
                            <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        {activeDropdown === 'update' && (
                            <div className="absolute right-0 mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 text-xs animate-in fade-in zoom-in-95 duration-100">
                                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                                    Price & Spec Updates
                                </div>
                                <button 
                                    onClick={() => { setActiveDropdown(null); handleExportPriceList(); }} 
                                    className="w-full text-left px-3 py-2 hover:bg-amber-50 text-slate-800 transition-colors flex flex-col"
                                >
                                    <span className="font-semibold text-slate-900">📥 1. Download Price Update Sheet</span>
                                    <span className="text-[10px] text-slate-500">Outputs existing prices with today's effective date column</span>
                                </button>
                                <button 
                                    onClick={() => { setActiveDropdown(null); handlePriceUpdateUploadClick(); }} 
                                    className="w-full text-left px-3 py-2 hover:bg-amber-50 text-slate-800 transition-colors flex flex-col border-t border-slate-50"
                                >
                                    <span className="font-semibold text-slate-900">📤 2. Upload Price Updates</span>
                                    <span className="text-[10px] text-slate-500">Applies latest prices starting from the updated date</span>
                                </button>
                                
                                <div className="border-t border-slate-100 my-1 pt-1 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Bulk Image Tools
                                </div>
                                <button 
                                    onClick={() => { setActiveDropdown(null); handleDownloadImageTemplate('all'); }} 
                                    className="w-full text-left px-3 py-1.5 hover:bg-purple-50 text-slate-700 transition-colors flex items-center gap-1.5"
                                >
                                    <span>🖼️</span>
                                    <span>Download Image URL Template</span>
                                </button>
                                <button 
                                    onClick={() => { setActiveDropdown(null); handleImageUpdateUploadClick(); }} 
                                    className="w-full text-left px-3 py-1.5 hover:bg-purple-50 text-slate-700 transition-colors flex items-center gap-1.5"
                                >
                                    <span>📤</span>
                                    <span>Upload Image URLs Excel</span>
                                </button>
                                <button 
                                    onClick={() => { setActiveDropdown(null); bulkImageFilesInputRef.current?.click(); }} 
                                    className="w-full text-left px-3 py-1.5 hover:bg-purple-50 text-slate-700 transition-colors flex items-center gap-1.5"
                                >
                                    <span>📁</span>
                                    <span>Upload Image Files (Auto-match)</span>
                                </button>
                            </div>
                        )}
                        <input type="file" ref={priceUpdateInputRef} onChange={handlePriceUpdateFileChange} className="hidden" accept=".xlsx, .xls"/>
                        <input type="file" ref={imageUpdateInputRef} onChange={handleImageUpdateFileChange} className="hidden" accept=".xlsx, .xls"/>
                        <input type="file" ref={bulkImageFilesInputRef} onChange={handleBulkImageFilesUpload} className="hidden" accept="image/*" multiple />
                    </div>
                )}

                {/* 4. Template (Dropdown: Download New Items Template & Upload New Items) */}
                <div className="relative toolbar-dropdown">
                    <button 
                        type="button"
                        onClick={() => setActiveDropdown(prev => prev === 'template' ? null : 'template')}
                        disabled={isUploading} 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
                    >
                        <svg className="w-3.5 h-3.5 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        <span>Template</span>
                        <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {activeDropdown === 'template' && (
                        <div className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 text-xs animate-in fade-in zoom-in-95 duration-100">
                            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                                Add New Items to Catalog
                            </div>
                            <button 
                                onClick={() => { setActiveDropdown(null); handleDownloadTemplate(); }} 
                                className="w-full text-left px-3 py-2 hover:bg-sky-50 text-slate-800 transition-colors flex flex-col"
                            >
                                <span className="font-semibold text-slate-900">📥 Download New Items Template</span>
                                <span className="text-[10px] text-slate-500">Includes all required fields and sample items</span>
                            </button>
                            <button 
                                onClick={() => { setActiveDropdown(null); handleUploadClick(); }} 
                                className="w-full text-left px-3 py-2 hover:bg-sky-50 text-slate-800 transition-colors flex flex-col border-t border-slate-50"
                            >
                                <span className="font-semibold text-slate-900">📤 Upload New Items Excel</span>
                                <span className="text-[10px] text-slate-500">Imports filled template to add items to catalog</span>
                            </button>
                        </div>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls"/>
                </div>
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

         {/* Desktop Filters with Professional Polish */}
         <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl">
            <div>
                <label htmlFor="searchTerm" className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Search Part No (use * for OR)
                </label>
                <div className="relative">
                    <input 
                        type="text" 
                        id="searchTerm" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="block w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono" 
                        placeholder="e.g. OLFLEX*UNITRONIC" 
                    />
                    <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                </div>
            </div>
            <div>
                <label htmlFor="searchDescription" className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Search Description (use * for OR)
                </label>
                <div className="relative">
                    <input 
                        type="text" 
                        id="searchDescription" 
                        value={searchDescription} 
                        onChange={e => setSearchDescription(e.target.value)} 
                        className="block w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                        placeholder="e.g. CABLE*POWER" 
                    />
                    <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                </div>
            </div>
            <div>
                <label htmlFor="sortBy" className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Sort By
                </label>
                <select 
                    id="sortBy" 
                    value={sortBy} 
                    onChange={e => setSortBy(e.target.value as SortByType)} 
                    className="block w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                    <option value="price">Price (LP)</option>
                    <option value="id">ID</option>
                    <option value="partNo">Part No</option>
                    <option value="description">Description</option>
                    <option value="hsnCode">HSN Code</option>
                </select>
            </div>
            <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Order
                </label>
                <button 
                    type="button" 
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} 
                    className="w-full bg-white hover:bg-slate-100 text-slate-800 font-semibold py-1.5 px-3 border border-slate-300 rounded-lg shadow-2xs flex items-center justify-between text-xs transition-colors"
                >
                    <span>{sortOrder === 'asc' ? 'Ascending' : 'Descending'}</span>
                    <span className="font-bold text-indigo-600">{sortOrder === 'asc' ? '▲' : '▼'}</span>
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
                            <div className="flex items-center gap-2">
                                {product.imageUrl ? (
                                    <img 
                                        src={product.imageUrl} 
                                        alt={product.partNo} 
                                        onClick={() => setZoomedProduct(product)}
                                        className="w-8 h-8 object-contain rounded bg-slate-50 border border-slate-200 shrink-0 cursor-zoom-in hover:scale-105 transition-transform" 
                                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                        title="Click to zoom image"
                                    />
                                ) : null}
                                <h3 className="text-sm font-bold text-indigo-700">{product.partNo}</h3>
                            </div>
                            <div className="text-xs text-black">#{product.id}</div>
                        </div>
                        <p className="text-xs text-black mt-1 line-clamp-2">{product.description}</p>
                        
                        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2">
                            <div>
                                <p className="text-[10px] text-black uppercase">Standard Price</p>
                                <div className="flex gap-2 text-xs font-medium items-center flex-wrap">
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

        {/* Desktop Table View (Supports Excel Grid View & Modern View) */}
        {viewMode === 'excel' ? (
            <div className="hidden md:block border border-slate-300 rounded shadow-xs bg-white overflow-hidden mt-3">
                {/* Excel Formula & Status Bar */}
                <div className="bg-[#f3f2f1] px-3 py-1.5 border-b border-slate-300 flex items-center justify-between text-xs text-slate-700 select-none font-mono">
                    <div className="flex items-center gap-2">
                        <span className="font-black text-[#107c41] text-sm">fx</span>
                        <span className="text-slate-300">|</span>
                        <span className="text-slate-700 font-sans text-xs">
                            <strong>{displayedProducts.length}</strong> products displayed • Sorted by {sortBy} ({sortOrder})
                            {selectedProductIds.size > 0 && <span className="ml-2 text-emerald-800 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">[{selectedProductIds.size} Selected]</span>}
                        </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-200/70 px-2 py-0.5 rounded">
                        Microsoft Excel Grid
                    </span>
                </div>

                <div className="overflow-x-auto max-h-[72vh] relative">
                    <table className="min-w-full border-collapse text-xs">
                        <thead className="bg-[#f3f2f1] text-slate-700 font-bold uppercase text-[10px] sticky top-0 z-20 select-none border-b border-slate-300 shadow-xs">
                            <tr className="border-b border-slate-300">
                                <th className="py-2 px-1 text-center w-10 border-r border-slate-300 bg-[#e1dfdd] text-slate-700">#</th>
                                <th className="py-2 px-2 text-center w-8 border-r border-slate-300 bg-[#f3f2f1]">
                                    <input type="checkbox" className="h-3.5 w-3.5 rounded border-slate-300 text-[#107c41] focus:ring-[#107c41] cursor-pointer" checked={isAllSelected} onChange={handleSelectAll} aria-label="Select all products"/>
                                </th>
                                <th className="py-2 px-2 text-center border-r border-slate-300 w-14 bg-[#f3f2f1]">A: ID</th>
                                <th className="py-2 px-2 text-left border-r border-slate-300 min-w-[140px] bg-[#f3f2f1]">B: Part No</th>
                                <th className="py-2 px-1 text-center border-r border-slate-300 w-12 bg-[#f3f2f1]">C: Image</th>
                                <th className="py-2 px-2 text-left border-r border-slate-300 min-w-[220px] bg-[#f3f2f1]">D: Description</th>
                                <th className="py-2 px-2 text-center border-r border-slate-300 w-24 bg-[#f3f2f1]">E: HSN Code</th>
                                <th className="py-2 px-2 text-right border-r border-slate-300 w-28 bg-[#f3f2f1]">F: List Price (₹)</th>
                                <th className="py-2 px-2 text-right border-r border-slate-300 w-28 bg-[#f3f2f1]">G: Selling Price (₹)</th>
                                <th className="py-2 px-1 text-center border-r border-slate-300 w-14 bg-[#f3f2f1]">H: UOM</th>
                                <th className="py-2 px-1 text-center border-r border-slate-300 w-16 bg-[#f3f2f1]">I: Plant</th>
                                <th className="py-2 px-2 text-right border-r border-slate-300 w-20 bg-[#f3f2f1]">J: Weight</th>
                                <th className="py-2 px-1 text-center w-20 bg-[#f3f2f1]">K: Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {displayedProducts.map((product, index) => (
                                <ExcelProductRow
                                    key={product.id}
                                    index={index}
                                    product={product}
                                    isSelected={selectedProductIds.has(product.id)}
                                    onSelect={handleSelectOne}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                    onZoomImage={setZoomedProduct}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        ) : (
            <div className="hidden md:block border border-slate-200/90 rounded-2xl shadow-sm bg-white overflow-hidden mt-3">
                <div className="overflow-x-auto max-h-[72vh] relative">
                    <table className="min-w-full text-xs text-left border-collapse table-fixed">
                        <thead className="bg-[#f8fafc] text-slate-800 font-extrabold uppercase text-[10px] tracking-wider sticky top-0 z-20 border-b-2 border-slate-200 shadow-xs select-none">
                            <tr>
                                <th className="px-3 py-3.5 text-center w-12 bg-[#f8fafc]">
                                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" checked={isAllSelected} onChange={handleSelectAll} aria-label="Select all products"/>
                                </th>
                                <th className="px-4 py-3.5 w-[38%] min-w-[340px] bg-[#f8fafc]">Product Details (Part No & Description)</th>
                                <th className="px-3 py-3.5 w-[10%] text-center bg-[#f8fafc]">HSN Code</th>
                                <th className="px-4 py-3.5 w-[13%] text-right bg-[#f8fafc]">List Price</th>
                                <th className="px-4 py-3.5 w-[11%] text-right bg-[#f8fafc]">Selling Price</th>
                                <th className="px-2 py-3.5 w-[7%] text-center bg-[#f8fafc]">UOM</th>
                                <th className="px-2 py-3.5 w-[9%] text-center bg-[#f8fafc]">Plant</th>
                                <th className="px-3 py-3.5 w-[8%] text-right bg-[#f8fafc]">Weight</th>
                                <th className="px-3 py-3.5 w-[8%] text-center min-w-[85px] bg-[#f8fafc]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {displayedProducts.map(product => (
                                <ModernProductRow
                                    key={product.id}
                                    product={product}
                                    isSelected={selectedProductIds.has(product.id)}
                                    onSelect={handleSelectOne}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                    onZoomImage={setZoomedProduct}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
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

      {zoomedProduct && (
        <ImageZoomModal
          imageUrl={zoomedProduct.imageUrl || ''}
          partNo={zoomedProduct.partNo}
          description={zoomedProduct.description}
          onClose={() => setZoomedProduct(null)}
        />
      )}
    </div>
  );
};