import React, { useState, useEffect } from 'react';
import type { Product, PriceEntry } from '../types';
import { UOMS, PLANTS } from '../constants';
import { getNextProductId } from '../supabase';
import { isPriceOlderThanThreshold, sortPricesLatestFirst, parseProductDate } from '../utils/priceUtils';

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
            priceEntry.sp = 0; // If LP has a value, SP must be 0
        }
        if (field === 'sp' && numValue > 0) {
            priceEntry.lp = 0; // If SP has a value, LP must be 0
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
    // Insert at the top so the latest tier stays on top
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
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
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
  const latestPrice = formData.prices[0];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex justify-center items-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {productToEdit ? 'Edit Product' : 'Add New Product'}
                {productToEdit && (
                  <span className="text-[11px] font-semibold bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/30">
                    ID #{productToEdit.id}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-300">
                {showDraftPreview ? 'Review changes carefully before applying updates' : 'Manage product specifications, pricing tiers, and image'}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors text-lg"
          >
            &times;
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-grow overflow-y-auto p-5 sm:p-6 space-y-4">

          {/* DRAFT REVIEW VIEW */}
          {showDraftPreview && draftProduct ? (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              {/* Draft Notice Banner */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    ✓
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">Draft Preview Ready</h4>
                    <p className="text-xs text-indigo-800">
                      Check all values below. Click <strong>"Confirm & Update"</strong> to save to database or <strong>"Back to Edit"</strong> to make changes.
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-indigo-700 bg-white border border-indigo-200 px-2.5 py-1 rounded-lg shadow-2xs">
                  {draftProduct.prices.length} Price Tier{draftProduct.prices.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Product Info Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Part No</span>
                  <span className="text-sm font-black text-slate-900 font-mono mt-0.5 block">{draftProduct.partNo}</span>
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Description</span>
                  <span className="text-sm font-semibold text-slate-800 mt-0.5 block truncate" title={draftProduct.description}>{draftProduct.description}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">HSN Code</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">{draftProduct.hsnCode || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">UOM</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">{draftProduct.uom || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Plant</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">{draftProduct.plant || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Weight</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">{draftProduct.weight || 0} kg/m</span>
                </div>
              </div>

              {/* Draft Price Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Pricing Tiers Draft (Latest on Top)</span>
                  </h4>
                  {isPriceOlderThanThreshold(draftProduct.prices) && (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                      Older price Need to check
                    </span>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12">#</th>
                        <th className="py-2.5 px-3 text-left">LP (List Price)</th>
                        <th className="py-2.5 px-3 text-left">SP (Special Price)</th>
                        <th className="py-2.5 px-3 text-left">Valid From</th>
                        <th className="py-2.5 px-3 text-left">Valid To</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {draftProduct.prices.map((price, idx) => (
                        <tr key={idx} className={idx === 0 ? 'bg-indigo-50/40 font-semibold' : ''}>
                          <td className="py-2 px-3 text-center text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">₹{(price.lp || 0).toFixed(2)}</td>
                          <td className="py-2 px-3 text-slate-600">₹{(price.sp || 0).toFixed(2)}</td>
                          <td className="py-2 px-3 text-slate-700">{price.validFrom}</td>
                          <td className="py-2 px-3 text-slate-500">{price.validTo}</td>
                          <td className="py-2 px-3 text-center">
                            {idx === 0 ? (
                              <span className="inline-block text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded">
                                Active Latest
                              </span>
                            ) : (
                              <span className="inline-block text-[9px] text-slate-400">Past Tier</span>
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

                {/* Primary Specs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                      className="block w-full px-3 py-1.5 text-xs font-semibold text-slate-900 border border-slate-300 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
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
                      className="block w-full px-3 py-1.5 text-xs text-slate-900 border border-slate-300 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      placeholder="e.g. 85444990"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-1">
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
                      className="block w-full px-3 py-1.5 text-xs font-semibold text-slate-900 border border-slate-300 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
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
                      className="block w-full px-3 py-1.5 text-xs text-slate-900 border border-slate-300 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
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
                      className="block w-full px-3 py-1.5 text-xs text-slate-900 border border-slate-300 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
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
                      className="block w-full px-3 py-1.5 text-xs text-slate-900 border border-slate-300 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      placeholder="0.000"
                    />
                  </div>
                </div>

                {/* Compact Image Section */}
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    {/* Thumbnail preview if exists */}
                    {formData.imageUrl ? (
                      <div className="relative group w-11 h-11 bg-white rounded-lg border border-slate-200 p-0.5 shadow-2xs shrink-0 flex items-center justify-center">
                        <img 
                          src={formData.imageUrl} 
                          alt="Product" 
                          className="max-w-full max-h-full object-contain rounded"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold shadow-xs hover:bg-rose-600 transition-colors"
                          title="Remove image"
                        >
                          &times;
                        </button>
                      </div>
                    ) : (
                      <div className="w-11 h-11 rounded-lg border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-400 shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                      </div>
                    )}
                    <div>
                      <span className="font-bold text-slate-800 block text-xs">Product Image</span>
                      <span className="text-[11px] text-slate-500 block">
                        {formData.imageUrl ? 'Image attached (optimized)' : 'Optional. Attach a photo or drawing'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:border-indigo-400 transition-all shadow-2xs">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      <span>{formData.imageUrl ? 'Replace Image' : 'Upload Image'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageFileChange} 
                        className="hidden" 
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowUrlInput(!showUrlInput)}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 bg-white border border-slate-300 rounded-lg transition-colors shadow-2xs"
                    >
                      {showUrlInput ? 'Hide URL' : 'Paste URL'}
                    </button>
                  </div>

                  {/* Optional URL Input */}
                  {showUrlInput && (
                    <div className="w-full pt-2 border-t border-slate-200">
                      <input 
                        type="text" 
                        name="imageUrl" 
                        id="imageUrl" 
                        value={formData.imageUrl && !formData.imageUrl.startsWith('data:image/') ? formData.imageUrl : ''} 
                        onChange={handleGeneralChange} 
                        placeholder="https://example.com/product-image.jpg" 
                        className="block w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                  )}
                </div>

                {/* Price Details Table Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Price Details
                      </h3>
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                        Latest on Top
                      </span>
                    </div>

                    <button 
                      type="button" 
                      onClick={handleAddPriceRow} 
                      className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-2.5 text-xs rounded-lg transition-colors shadow-2xs"
                    >
                      <span>+ Add Price Row</span>
                    </button>
                  </div>

                  {/* Warning if older price */}
                  {isOlderPriceDetected && (
                    <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs font-semibold flex items-center gap-2">
                      <span className="text-sm">⚠️</span>
                      <span>Older price Need to check (Latest price is older than 11.09.2026)</span>
                    </div>
                  )}

                  {/* Modern Compact Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                    <div className="max-h-56 overflow-y-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-xs">
                        <thead className="bg-slate-50 sticky top-0 z-10 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="py-2 px-3 text-center w-12">#</th>
                            <th className="py-2 px-3 text-left">LP (List Price ₹)</th>
                            <th className="py-2 px-3 text-left">SP (Special Price ₹)</th>
                            <th className="py-2 px-3 text-left w-36">Valid From</th>
                            <th className="py-2 px-3 text-left w-36">Valid To</th>
                            <th className="py-2 px-3 text-center w-14">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {formData.prices.map((price, index) => (
                            <tr key={index} className={`hover:bg-slate-50/80 transition-colors ${index === 0 ? 'bg-indigo-50/20' : ''}`}>
                              <td className="py-1.5 px-3 text-center font-semibold text-slate-500">
                                {index === 0 ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700" title="Latest / Current Price">
                                    Latest
                                  </span>
                                ) : (
                                  index + 1
                                )}
                              </td>
                              <td className="py-1.5 px-3">
                                <div className="relative">
                                  <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-slate-400 text-xs">₹</span>
                                  <input 
                                    type="number" 
                                    step="0.01" 
                                    value={price.lp} 
                                    onChange={(e) => handlePriceChange(index, 'lp', e.target.value)} 
                                    onBlur={() => handlePriceBlur(index, 'lp')}
                                    className="w-full pl-6 pr-2 py-1 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 font-semibold bg-white"
                                    placeholder="0.00"
                                  />
                                </div>
                              </td>
                              <td className="py-1.5 px-3">
                                <div className="relative">
                                  <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-slate-400 text-xs">₹</span>
                                  <input 
                                    type="number" 
                                    step="0.01" 
                                    value={price.sp} 
                                    onChange={(e) => handlePriceChange(index, 'sp', e.target.value)} 
                                    onBlur={() => handlePriceBlur(index, 'sp')}
                                    disabled={price.lp > 0} 
                                    className="w-full pl-6 pr-2 py-1 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 font-semibold disabled:bg-slate-100 disabled:text-slate-400 bg-white"
                                    placeholder="0.00"
                                  />
                                </div>
                              </td>
                              <td className="py-1.5 px-3">
                                <input 
                                  type="date" 
                                  value={price.validFrom} 
                                  onChange={(e) => handlePriceChange(index, 'validFrom', e.target.value)} 
                                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 bg-white"
                                />
                              </td>
                              <td className="py-1.5 px-3">
                                <input 
                                  type="date" 
                                  value={price.validTo} 
                                  disabled 
                                  className="w-full px-2 py-1 text-xs bg-slate-100 border border-slate-200 rounded-md text-slate-500 cursor-not-allowed"
                                />
                              </td>
                              <td className="py-1.5 px-3 text-center">
                                <button 
                                  type="button" 
                                  onClick={() => handleRemovePriceRow(index)} 
                                  disabled={formData.prices.length <= 1} 
                                  className="text-slate-400 hover:text-rose-600 disabled:opacity-20 disabled:hover:text-slate-400 p-1 rounded hover:bg-rose-50 transition-colors"
                                  title="Delete Price Tier"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
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

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          {showDraftPreview ? (
            <>
              <button 
                type="button" 
                onClick={() => setShowDraftPreview(false)} 
                disabled={isSaving} 
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors shadow-2xs disabled:opacity-50"
              >
                <span>← Back to Edit</span>
              </button>

              <button 
                type="button" 
                onClick={handleConfirmSave} 
                disabled={isSaving} 
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
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
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors shadow-2xs disabled:opacity-50"
              >
                Cancel
              </button>

              <button 
                type="submit" 
                form="productEditForm" 
                disabled={isSaving} 
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
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
