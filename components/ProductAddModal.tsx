import React, { useState, useEffect } from 'react';
import type { Product, PriceEntry } from '../types';
import { UOMS, PLANTS } from '../constants';
import { getNextProductId } from '../supabase';
import { isPriceOlderThanThreshold, sortPricesLatestFirst } from '../utils/priceUtils';

interface ProductAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product) => Promise<void>;
  productToEdit?: Product | null;
}

const emptyProductData: Omit<Product, 'id'> = {
  partNo: '',
  description: '',
  hsnCode: '',
  prices: [{ lp: 0, sp: 0, validFrom: new Date().toISOString().split('T')[0], validTo: '9999-12-31' }],
  uom: '',
  plant: '',
  weight: 0,
  imageUrl: '',
};

export const ProductAddModal: React.FC<ProductAddModalProps> = ({ isOpen, onClose, onSave, productToEdit }) => {
  const [formData, setFormData] = useState<Omit<Product, 'id'> | Product>(emptyProductData);
  const [isSaving, setIsSaving] = useState(false);
  const [showDraftPreview, setShowDraftPreview] = useState(false);
  const [draftProduct, setDraftProduct] = useState<Product | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowDraftPreview(false);
      setDraftProduct(null);
      setShowUrlInput(false);

      if (productToEdit) {
        // Ensure price list always has entries (fallback to default tier if empty)
        const rawPrices = (productToEdit.prices && Array.isArray(productToEdit.prices) && productToEdit.prices.length > 0)
            ? productToEdit.prices
            : [{ lp: 0, sp: 0, validFrom: new Date().toISOString().split('T')[0], validTo: '9999-12-31' }];

        // Sort prices on load so the latest price is on top as requested
        const sortedProduct = { 
            ...productToEdit, 
            prices: sortPricesLatestFirst(rawPrices)
                .map(p => ({
                    ...p,
                    lp: Math.round((p.lp || 0) * 100) / 100,
                    sp: Math.round((p.sp || 0) * 100) / 100
                }))
        };
        setFormData(sortedProduct);
      } else {
        setFormData(emptyProductData);
      }
    }
  }, [isOpen, productToEdit]);

  if (!isOpen) return null;

  const handleGeneralChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
        ...prev,
        [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handlePriceChange = (index: number, field: keyof PriceEntry, value: string) => {
    const newPrices = [...formData.prices];
    const priceEntry = { ...newPrices[index] };
    
    if (field === 'lp' || field === 'sp') {
        const numValue = parseFloat(value) || 0;
        priceEntry[field] = numValue;
        if (field === 'lp' && numValue > 0) {
            priceEntry.sp = 0;
        }
        if (field === 'sp' && numValue > 0) {
            priceEntry.lp = 0;
        }
    } else {
        priceEntry[field] = value;
    }
    
    newPrices[index] = priceEntry;
    setFormData(prev => ({ ...prev, prices: newPrices }));
  };

  const handlePriceBlur = (index: number, field: 'lp' | 'sp') => {
      const newPrices = [...formData.prices];
      const val = newPrices[index][field];
      newPrices[index][field] = Math.round(Number(val || 0) * 100) / 100;
      setFormData(prev => ({ ...prev, prices: newPrices }));
  };

  const handleAddPriceRow = () => {
    const today = new Date().toISOString().split('T')[0];
    const newPrice: PriceEntry = { lp: 0, sp: 0, validFrom: today, validTo: '9999-12-31' };
    setFormData(prev => ({ ...prev, prices: [newPrice, ...prev.prices] }));
  };
  
  const handleRemovePriceRow = (index: number) => {
    if (formData.prices.length <= 1) return;
    setFormData(prev => ({ ...prev, prices: prev.prices.filter((_, i) => i !== index) }));
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, WebP, etc.).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // High quality preview (up to 400x400)
        const maxDim = 400;
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
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setFormData(prev => ({ ...prev, imageUrl: compressedDataUrl }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Step 1: Prepare draft and show preview before updating
  const handlePrepareDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.partNo?.trim() || !formData.description?.trim()) {
      alert('Part No and Description are required.');
      return;
    }

    // Process prices chronologically to compute contiguous validTo boundaries
    let processedPrices = [...formData.prices]
      .sort((a, b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime());

    for (let i = 0; i < processedPrices.length - 1; i++) {
        const nextValidFrom = new Date(processedPrices[i + 1].validFrom);
        nextValidFrom.setDate(nextValidFrom.getDate() - 1);
        processedPrices[i].validTo = nextValidFrom.toISOString().split('T')[0];
    }
    if (processedPrices.length > 0) {
       processedPrices[processedPrices.length - 1].validTo = '9999-12-31';
    }

    // Keep draft sorted latest first for display
    const finalPrices = sortPricesLatestFirst(processedPrices);
    const draft: Product = {
      ...formData,
      id: ('id' in formData && formData.id) ? formData.id : 0,
      partNo: formData.partNo.trim(),
      description: formData.description.trim(),
      prices: finalPrices
    };

    setDraftProduct(draft);
    setShowDraftPreview(true);
  };

  // Step 2: Final confirm and persist to Supabase
  const handleConfirmSave = async () => {
    if (!draftProduct) return;
    setIsSaving(true);
    try {
      let productToSave = { ...draftProduct };
      if (!productToSave.id) {
        const newId = await getNextProductId();
        productToSave.id = newId;
      }
      await onSave(productToSave);
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'An unknown error occurred while saving the product.');
      console.error('Failed to save product:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const isOlderPriceDetected = isPriceOlderThanThreshold(formData.prices);

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex justify-center items-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col border border-slate-200 overflow-hidden">
        
        {/* Modern Enterprise Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  {formData.partNo ? formData.partNo : (productToEdit ? 'Edit Product' : 'Add New Product')}
                </h2>
                {formData.description && (
                  <span className="text-xs text-indigo-200 font-medium max-w-md truncate hidden sm:inline" title={formData.description}>
                    — {formData.description}
                  </span>
                )}
                {productToEdit && (
                  <span className="text-[11px] font-bold bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-full border border-indigo-400/40 font-mono shadow-xs">
                    ID #{productToEdit.id}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {showDraftPreview ? 'Review the draft specifications and price brackets below before saving' : 'Configure product master, high-resolution image, and Excel price tiers schedule'}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="w-9 h-9 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors text-2xl font-bold"
            title="Close"
          >
            &times;
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-grow overflow-y-auto p-5 sm:p-6 space-y-4 bg-slate-50/60">

          {/* DRAFT REVIEW VIEW */}
          {showDraftPreview && draftProduct ? (
            <div className="space-y-4">
              {/* Draft Notice Banner */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-300 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-base font-bold shadow-sm shrink-0">
                    ✓
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">Draft Preview Ready</h4>
                    <p className="text-xs text-emerald-900 mt-0.5">
                      Verify specifications and pricing below. Click <strong>"Confirm & Update Product"</strong> to save to live catalog.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-800 bg-white border border-emerald-200 px-3 py-1 rounded-lg shadow-sm">
                    {draftProduct.prices.length} Price Tier{draftProduct.prices.length > 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Product Info Cards with Big Image Preview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                {/* Big Image in Draft */}
                <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-xl p-2 h-44">
                  {draftProduct.imageUrl ? (
                    <img 
                      src={draftProduct.imageUrl} 
                      alt={draftProduct.partNo} 
                      className="max-h-full max-w-full object-contain rounded-lg"
                    />
                  ) : (
                    <div className="text-center text-slate-400">
                      <svg className="w-10 h-10 mx-auto mb-1 opacity-50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                      <span className="text-[11px]">No Image Attached</span>
                    </div>
                  )}
                </div>

                {/* Specs Details */}
                <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Part No</span>
                    <span className="text-sm font-black text-slate-900 font-mono mt-0.5 block">{draftProduct.partNo}</span>
                  </div>
                  <div className="col-span-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Description</span>
                    <span className="text-sm font-semibold text-slate-800 mt-0.5 block truncate" title={draftProduct.description}>{draftProduct.description}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">HSN Code</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block">{draftProduct.hsnCode || '—'}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">UOM</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block">{draftProduct.uom || '—'}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Plant</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block">{draftProduct.plant || '—'}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Weight</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block">{draftProduct.weight || 0} kg/m</span>
                  </div>
                  <div className="col-span-2 bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Current List Price (LP)</span>
                    <span className="text-base font-black text-emerald-950 font-mono mt-0.5 block">
                      ₹{(draftProduct.prices[0]?.lp || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Draft Price Table in Excel Grid */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Finalized Price Validity Schedule (Excel Grid)</span>
                  </h4>
                  {isPriceOlderThanThreshold(draftProduct.prices) && (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                      Older price Need to check
                    </span>
                  )}
                </div>

                <div className="border border-slate-300 rounded-sm overflow-hidden shadow-xs bg-white">
                  <table className="min-w-full border-collapse text-xs">
                    <thead className="bg-[#f3f2f1] text-slate-700 font-bold uppercase text-[10px] select-none">
                      <tr className="border-b border-slate-300">
                        <th className="py-1.5 px-2 text-center w-12 border-r border-slate-300 bg-[#e1dfdd] text-slate-700">#</th>
                        <th className="py-1.5 px-3 text-right border-r border-slate-300">LP (List Price ₹)</th>
                        <th className="py-1.5 px-3 text-right border-r border-slate-300">SP (Special Price ₹)</th>
                        <th className="py-1.5 px-3 text-center border-r border-slate-300 w-36">Valid From</th>
                        <th className="py-1.5 px-3 text-center border-r border-slate-300 w-36">Valid To</th>
                        <th className="py-1.5 px-3 text-center w-28">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {draftProduct.prices.map((price, idx) => (
                        <tr key={idx} className={`border-b border-slate-200 ${idx === 0 ? 'bg-emerald-50/30 font-semibold' : 'hover:bg-slate-50'}`}>
                          <td className="py-1 px-1 text-center bg-[#f8f9fa] border-r border-slate-300 text-slate-600 font-mono font-bold text-[11px] select-none h-7">
                            {idx === 0 ? (
                              <span className="inline-flex items-center px-1 rounded text-[9px] font-bold bg-[#107c41] text-white">
                                1★
                              </span>
                            ) : (
                              idx + 1
                            )}
                          </td>
                          <td className="py-1 px-3 text-right font-mono font-bold text-slate-900 border-r border-slate-300">₹{(price.lp || 0).toFixed(2)}</td>
                          <td className="py-1 px-3 text-right font-mono text-slate-600 border-r border-slate-300">₹{(price.sp || 0).toFixed(2)}</td>
                          <td className="py-1 px-3 text-center font-mono text-slate-700 border-r border-slate-300">{price.validFrom}</td>
                          <td className="py-1 px-3 text-center font-mono text-slate-500 border-r border-slate-300">{price.validTo}</td>
                          <td className="py-1 px-3 text-center">
                            {idx === 0 ? (
                              <span className="inline-block text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                                Active Latest
                              </span>
                            ) : (
                              <span className="inline-block text-[9px] text-slate-400">Past Bracket</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* EDIT FORM VIEW */
            <form id="productEditForm" onSubmit={handlePrepareDraft} className="space-y-4">
              <fieldset disabled={isSaving} className="space-y-4">

                {/* Top Section: Bigger Image Card + Specifications Side by Side */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  
                  {/* Left Column: Big Prominent Product Image Card (4 cols) */}
                  <div className="md:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                          Product Image
                        </span>
                        {formData.imageUrl && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Attached
                          </span>
                        )}
                      </div>

                      {/* Bigger Featured Image Box */}
                      <div className="relative group w-full h-44 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl overflow-hidden flex items-center justify-center transition-all hover:border-indigo-400">
                        {formData.imageUrl ? (
                          <>
                            <img 
                              src={formData.imageUrl} 
                              alt="Product preview" 
                              className="max-h-full max-w-full object-contain p-2 transition-transform duration-200 group-hover:scale-105"
                              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                            />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <label className="cursor-pointer bg-white text-slate-800 text-xs font-bold px-3 py-1.5 rounded-lg shadow-md hover:bg-slate-50 transition-colors">
                                Replace
                                <input type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                              </label>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                                className="bg-rose-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-md hover:bg-rose-700 transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          </>
                        ) : (
                          <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full p-4 text-center hover:bg-slate-100/60 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-2 shadow-xs">
                              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            </div>
                            <span className="text-xs font-bold text-slate-800">Click to Upload Image</span>
                            <span className="text-[11px] text-slate-400 mt-0.5">PNG, JPG, WebP supported</span>
                            <input type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Image URL Toggle */}
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => setShowUrlInput(!showUrlInput)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                        <span>{showUrlInput ? 'Hide URL input' : 'Paste Image Web URL'}</span>
                      </button>
                      <span className="text-[10px] text-slate-400">Optional</span>
                    </div>

                    {showUrlInput && (
                      <div className="mt-2">
                        <input 
                          type="text" 
                          name="imageUrl" 
                          id="imageUrl" 
                          value={formData.imageUrl && !formData.imageUrl.startsWith('data:image/') ? formData.imageUrl : ''} 
                          onChange={handleGeneralChange} 
                          placeholder="https://example.com/product.jpg" 
                          className="block w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* Right Column: Product Specifications (8 cols) */}
                  <div className="md:col-span-8 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                          Product Specifications
                        </span>
                        <span className="text-[11px] text-slate-400">* Required fields</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="partNo" className="block text-xs font-bold text-slate-700 mb-1">
                            Part No <span className="text-red-500">*</span>
                          </label>
                          <input 
                            type="text" 
                            name="partNo" 
                            id="partNo" 
                            value={formData.partNo} 
                            onChange={handleGeneralChange} 
                            required 
                            className="block w-full px-3 py-2 text-xs font-mono font-bold text-slate-900 border border-slate-300 rounded-xl shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white hover:border-slate-400 transition-colors"
                            placeholder="e.g. 1119304"
                          />
                        </div>

                        <div>
                          <label htmlFor="hsnCode" className="block text-xs font-bold text-slate-700 mb-1">HSN Code</label>
                          <input 
                            type="text" 
                            name="hsnCode" 
                            id="hsnCode" 
                            value={formData.hsnCode || ''} 
                            onChange={handleGeneralChange} 
                            className="block w-full px-3 py-2 text-xs text-slate-900 border border-slate-300 rounded-xl shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white hover:border-slate-400 transition-colors"
                            placeholder="e.g. 85444990"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label htmlFor="description" className="block text-xs font-bold text-slate-700 mb-1">
                            Description <span className="text-red-500">*</span>
                          </label>
                          <input 
                            type="text" 
                            name="description" 
                            id="description" 
                            value={formData.description} 
                            onChange={handleGeneralChange} 
                            required 
                            className="block w-full px-3 py-2 text-xs font-semibold text-slate-900 border border-slate-300 rounded-xl shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white hover:border-slate-400 transition-colors"
                            placeholder="e.g. ÖLFLEX® CLASSIC 110 4G1,5"
                          />
                        </div>

                        <div>
                          <label htmlFor="uom" className="block text-xs font-bold text-slate-700 mb-1">UOM</label>
                          <select 
                            name="uom" 
                            id="uom" 
                            value={formData.uom} 
                            onChange={handleGeneralChange} 
                            className="block w-full px-3 py-2 text-xs text-slate-900 border border-slate-300 rounded-xl shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white hover:border-slate-400 transition-colors"
                          >
                            <option value="">Select UOM</option>
                            {UOMS.map(uom => <option key={uom} value={uom}>{uom}</option>)}
                          </select>
                        </div>

                        <div>
                          <label htmlFor="plant" className="block text-xs font-bold text-slate-700 mb-1">Plant</label>
                          <select 
                            name="plant" 
                            id="plant" 
                            value={formData.plant} 
                            onChange={handleGeneralChange} 
                            className="block w-full px-3 py-2 text-xs text-slate-900 border border-slate-300 rounded-xl shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white hover:border-slate-400 transition-colors"
                          >
                            <option value="">Select Plant</option>
                            {PLANTS.map(plant => <option key={plant} value={plant}>{plant}</option>)}
                          </select>
                        </div>

                        <div>
                          <label htmlFor="weight" className="block text-xs font-bold text-slate-700 mb-1">Weight (kg/m)</label>
                          <input 
                            type="number" 
                            step="0.001" 
                            name="weight" 
                            id="weight" 
                            value={formData.weight} 
                            onChange={handleGeneralChange} 
                            className="block w-full px-3 py-2 text-xs text-slate-900 border border-slate-300 rounded-xl shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white hover:border-slate-400 transition-colors"
                            placeholder="0.000"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Price Details Table Section - Authentic Excel Spreadsheet Look */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-[#107c41] text-white flex items-center justify-center font-bold text-xs shadow-xs font-sans">
                        X
                      </div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Price Validity Schedule (Excel Table View)
                      </h3>
                      <span className="text-[10px] font-bold text-[#107c41] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Latest on Top
                      </span>
                    </div>

                    <button 
                      type="button" 
                      onClick={handleAddPriceRow} 
                      className="inline-flex items-center gap-1.5 bg-[#107c41] hover:bg-[#0b5c30] text-white font-bold py-1.5 px-3.5 text-xs rounded-lg transition-all shadow-xs hover:shadow-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      <span>+ Insert Price Row</span>
                    </button>
                  </div>

                  {/* Warning if older price */}
                  {isOlderPriceDetected && (
                    <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2">
                      <span className="text-sm">⚠️</span>
                      <span>Older price Need to check (Latest price is older than 11.09.2026)</span>
                    </div>
                  )}

                  {/* Excel Spreadsheet Table Container */}
                  <div className="border border-slate-300 rounded-sm shadow-xs bg-white overflow-hidden">
                    {/* Excel Formula & Status Bar */}
                    <div className="bg-[#f3f2f1] px-3 py-1.5 border-b border-slate-300 flex items-center justify-between text-xs text-slate-600 select-none">
                      <div className="flex items-center gap-2.5 font-mono">
                        <span className="font-black text-[#107c41]">fx</span>
                        <span className="text-slate-300">|</span>
                        <span className="text-slate-700 font-sans font-medium text-[11px]">
                          <strong>{formData.prices.length}</strong> Tier{formData.prices.length > 1 ? 's' : ''} defined • Row 1 represents the active latest bracket
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-200/70 px-2 py-0.5 rounded">
                        Spreadsheet Grid
                      </span>
                    </div>

                    <div className="max-h-60 overflow-y-auto overflow-x-auto">
                      <table className="min-w-full border-collapse text-xs">
                        <thead className="bg-[#f3f2f1] text-slate-700 font-bold uppercase text-[10px] sticky top-0 z-10 select-none">
                          <tr className="border-b border-slate-300">
                            <th className="py-1 px-2 text-center w-12 border-r border-slate-300 bg-[#e1dfdd] text-slate-700">#</th>
                            <th className="py-1 px-3 text-right border-r border-slate-300 min-w-[140px]">LP (List Price ₹)</th>
                            <th className="py-1 px-3 text-right border-r border-slate-300 min-w-[140px]">SP (Special Price ₹)</th>
                            <th className="py-1 px-3 text-center border-r border-slate-300 w-36">Valid From</th>
                            <th className="py-1 px-3 text-center border-r border-slate-300 w-36">Valid To</th>
                            <th className="py-1 px-2 text-center w-12 text-slate-600">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {formData.prices.map((price, index) => (
                            <tr key={index} className={`hover:bg-emerald-50/30 transition-colors border-b border-slate-200 ${index === 0 ? 'bg-emerald-50/20' : ''}`}>
                              {/* Excel Row Header (#) */}
                              <td className="py-0 px-1 text-center bg-[#f8f9fa] border-r border-slate-300 text-slate-600 font-mono font-bold text-[11px] select-none h-7">
                                {index === 0 ? (
                                  <span className="inline-flex items-center px-1 rounded text-[9px] font-bold bg-[#107c41] text-white" title="Latest Active Price">
                                    1★
                                  </span>
                                ) : (
                                  index + 1
                                )}
                              </td>

                              {/* LP Cell */}
                              <td className="p-0 border-r border-slate-300 h-7 bg-white focus-within:ring-2 focus-within:ring-[#107c41] focus-within:z-10">
                                <div className="flex items-center h-full">
                                  <span className="pl-2 text-slate-400 text-xs font-mono select-none">₹</span>
                                  <input 
                                    type="number" 
                                    step="0.01" 
                                    value={price.lp} 
                                    onChange={(e) => handlePriceChange(index, 'lp', e.target.value)} 
                                    onBlur={() => handlePriceBlur(index, 'lp')}
                                    className="w-full h-full px-2 text-right text-xs font-mono font-bold text-slate-900 bg-transparent border-none outline-none focus:bg-white"
                                    placeholder="0.00"
                                  />
                                </div>
                              </td>

                              {/* SP Cell */}
                              <td className="p-0 border-r border-slate-300 h-7 bg-white focus-within:ring-2 focus-within:ring-[#107c41] focus-within:z-10">
                                <div className="flex items-center h-full">
                                  <span className="pl-2 text-slate-400 text-xs font-mono select-none">₹</span>
                                  <input 
                                    type="number" 
                                    step="0.01" 
                                    value={price.sp} 
                                    onChange={(e) => handlePriceChange(index, 'sp', e.target.value)} 
                                    onBlur={() => handlePriceBlur(index, 'sp')}
                                    disabled={price.lp > 0} 
                                    className="w-full h-full px-2 text-right text-xs font-mono font-bold text-slate-900 bg-transparent border-none outline-none disabled:bg-[#f3f2f1] disabled:text-slate-400 focus:bg-white"
                                    placeholder="0.00"
                                  />
                                </div>
                              </td>

                              {/* Valid From Cell */}
                              <td className="p-0 border-r border-slate-300 h-7 bg-white focus-within:ring-2 focus-within:ring-[#107c41] focus-within:z-10">
                                <input 
                                  type="date" 
                                  value={price.validFrom} 
                                  onChange={(e) => handlePriceChange(index, 'validFrom', e.target.value)} 
                                  className="w-full h-full px-2 text-center text-xs font-mono text-slate-800 bg-transparent border-none outline-none focus:bg-white"
                                />
                              </td>

                              {/* Valid To Cell */}
                              <td className="p-0 border-r border-slate-300 h-7 bg-[#fbfbfa]">
                                <input 
                                  type="date" 
                                  value={price.validTo} 
                                  disabled 
                                  className="w-full h-full px-2 text-center text-xs font-mono text-slate-500 bg-transparent border-none outline-none cursor-not-allowed"
                                />
                              </td>

                              {/* Delete Action Cell */}
                              <td className="p-0 text-center h-7 bg-white">
                                <button 
                                  type="button" 
                                  onClick={() => handleRemovePriceRow(index)} 
                                  disabled={formData.prices.length <= 1} 
                                  className="w-full h-full flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-20 disabled:hover:text-slate-400 transition-colors"
                                  title="Delete Row"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </fieldset>
            </form>
          )}

        </div>

        {/* Modern Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 shadow-xs">
          {showDraftPreview ? (
            <>
              <button 
                type="button" 
                onClick={() => setShowDraftPreview(false)} 
                disabled={isSaving} 
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors shadow-xs disabled:opacity-50"
              >
                <span>← Back to Edit</span>
              </button>

              <button 
                type="button" 
                onClick={handleConfirmSave} 
                disabled={isSaving} 
                className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl transition-all shadow-md shadow-emerald-600/25 hover:shadow-lg hover:shadow-emerald-600/30 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span>Saving to Database...</span>
                  </>
                ) : (
                  <>
                    <span>✓ Confirm & Update Product</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button 
                type="button" 
                onClick={onClose} 
                disabled={isSaving} 
                className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors shadow-xs disabled:opacity-50"
              >
                Cancel
              </button>

              <button 
                type="submit" 
                form="productEditForm" 
                disabled={isSaving} 
                className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 rounded-xl transition-all shadow-md shadow-indigo-600/30 hover:shadow-lg hover:shadow-indigo-600/35 hover:-translate-y-0.5 disabled:opacity-50"
              >
                <span>{productToEdit ? 'Review Draft & Update →' : 'Review Draft & Save →'}</span>
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
