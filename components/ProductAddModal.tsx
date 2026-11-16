import React, { useState, useEffect } from 'react';
import type { Product, PriceEntry } from '../types';
import { UOMS, PLANTS } from '../constants';
import { getNextProductId } from '../supabase';
import { isPriceOlderThanThreshold, sortPricesLatestFirst } from '../utils/priceUtils';

interface ProductAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product) => void;
  productToEdit?: Product | null;
}

export const ProductAddModal: React.FC<ProductAddModalProps> = ({ isOpen, onClose, onSave, productToEdit }) => {
  const [formData, setFormData] = useState<Omit<Product, 'id'>>({
    partNo: '',
    description: '',
    hsnCode: '',
    uom: '',
    plant: '',
    weight: 0,
    imageUrl: '',
    prices: [],
  });

  const [showUrlInput, setShowUrlInput] = useState(false);
  const [showDraftPreview, setShowDraftPreview] = useState(false);
  const [draftProduct, setDraftProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (productToEdit) {
      setFormData({
        partNo: productToEdit.partNo || '',
        description: productToEdit.description || '',
        hsnCode: productToEdit.hsnCode || '',
        uom: productToEdit.uom || '',
        plant: productToEdit.plant || '',
        weight: productToEdit.weight || 0,
        imageUrl: productToEdit.imageUrl || '',
        prices: productToEdit.prices && productToEdit.prices.length > 0
          ? sortPricesLatestFirst([...productToEdit.prices])
          : [{ lp: 0, sp: 0, validFrom: new Date().toISOString().split('T')[0], validTo: '9999-12-31' }],
      });
      setShowUrlInput(Boolean(productToEdit.imageUrl && !productToEdit.imageUrl.startsWith('data:image/')));
    } else {
      setFormData({
        partNo: '',
        description: '',
        hsnCode: '',
        uom: '',
        plant: '',
        weight: 0,
        imageUrl: '',
        prices: [{ lp: 0, sp: 0, validFrom: new Date().toISOString().split('T')[0], validTo: '9999-12-31' }],
      });
      setShowUrlInput(false);
    }
    setShowDraftPreview(false);
    setDraftProduct(null);
  }, [productToEdit, isOpen]);

  const handleGeneralChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'weight' ? parseFloat(value) || 0 : value
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
    const priceEntry = formData.prices[index];
    if (priceEntry) {
      const numValue = priceEntry[field];
      if (numValue !== undefined && numValue !== null && !isNaN(numValue)) {
        const newPrices = [...formData.prices];
        newPrices[index] = {
          ...priceEntry,
          [field]: parseFloat(numValue.toFixed(2))
        };
        setFormData(prev => ({ ...prev, prices: newPrices }));
      }
    }
  };

  const handleAddPriceRow = () => {
    const today = new Date().toISOString().split('T')[0];
    const newPrice: PriceEntry = { lp: 0, sp: 0, validFrom: today, validTo: '9999-12-31' };
    setFormData(prev => ({ ...prev, prices: [newPrice, ...prev.prices] }));
  };

  const handleRemovePriceRow = (index: number) => {
    if (formData.prices.length <= 1) {
      alert("A product must contain at least one price tier.");
      return;
    }
    setFormData(prev => ({
      ...prev,
      prices: prev.prices.filter((_, i) => i !== index)
    }));
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 450;
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
  };

  const validateProduct = () => {
    if (!formData.partNo.trim()) {
      alert('Part Number is required.');
      return false;
    }
    if (!formData.description.trim()) {
      alert('Description is required.');
      return false;
    }
    if (formData.prices.length === 0) {
      alert('At least one price entry is required.');
      return false;
    }
    for (const p of formData.prices) {
      if ((p.lp === undefined || p.lp === 0) && (p.sp === undefined || p.sp === 0)) {
        alert('Each price entry must have either a valid LP (List Price) or SP (Special Price).');
        return false;
      }
      if (!p.validFrom) {
        alert('Valid From date is required for all price entries.');
        return false;
      }
    }
    return true;
  };

  const handlePrepareDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateProduct()) return;

    const sortedPrices = sortPricesLatestFirst([...formData.prices]);
    const preparedProduct: Product = {
      ...formData,
      prices: sortedPrices,
      id: productToEdit ? productToEdit.id : 0,
    };

    setDraftProduct(preparedProduct);
    setShowDraftPreview(true);
  };

  const handleConfirmSave = async () => {
    if (!draftProduct) return;
    setIsSaving(true);
    try {
      let finalProduct = { ...draftProduct };
      if (!productToEdit) {
        const nextId = await getNextProductId();
        finalProduct.id = nextId;
      }
      onSave(finalProduct);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'An unknown error occurred while saving the product.');
      console.error('Failed to save product:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const isOlderPriceDetected = isPriceOlderThanThreshold(formData.prices);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex justify-center items-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[96vh] flex flex-col border border-indigo-200/50 overflow-hidden">
        
        {/* Modern Colorful Indigo/Purple Header */}
        <div className="px-6 py-3.5 bg-gradient-to-r from-[#170e5c] via-[#211b85] to-[#3b2fc4] text-white flex items-center justify-between shrink-0 shadow-lg">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-900/50">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base font-extrabold text-white tracking-wide">
                  {formData.partNo ? formData.partNo : (productToEdit ? 'Edit Product' : 'Add New Product')}
                  {formData.description ? ` — ${formData.description}` : ''}
                </h2>
                {productToEdit && (
                  <span className="text-[11px] font-bold bg-[#292270] text-indigo-200 px-2.5 py-0.5 rounded-full border border-indigo-400/30 font-mono tracking-wider">
                    TP {productToEdit.id}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-indigo-200/90 font-medium">
                {showDraftPreview ? 'Review draft details before database commit' : 'Single-view product master: image, and Excel price validity schedule'}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="w-8 h-8 rounded-full text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all text-xl font-bold"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Content Area - Designed for SINGLE VIEW (Zero Unnecessary Scrolling) */}
        <div className="flex-grow overflow-y-auto p-4 sm:p-5 bg-[#f4f7fc]">

          {/* DRAFT REVIEW VIEW */}
          {showDraftPreview && draftProduct ? (
            <div className="space-y-3">
              {/* Draft Notice Banner */}
              <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-300 rounded-xl p-2.5 px-4 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                    ✓
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">Draft Preview Ready</h4>
                    <p className="text-[11px] text-emerald-900">
                      Verify specifications and pricing below, then confirm to save to live catalog.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-800 bg-white border border-emerald-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                  {draftProduct.prices.length} Price Tier{draftProduct.prices.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Two Column Single View Layout for Draft */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                
                {/* Left Side: Image & Specs (7 cols) */}
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Big Image */}
                    <div className="w-full sm:w-48 h-40 bg-gradient-to-br from-slate-50 to-indigo-50/30 border border-slate-200 rounded-xl p-2 flex items-center justify-center shrink-0">
                      {draftProduct.imageUrl ? (
                        <img 
                          src={draftProduct.imageUrl} 
                          alt={draftProduct.partNo} 
                          className="max-h-full max-w-full object-contain rounded-lg drop-shadow-sm"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">No Image</span>
                      )}
                    </div>

                    {/* Primary Specs */}
                    <div className="flex-1 space-y-2 text-xs">
                      <div className="p-2 rounded-lg bg-indigo-50/40 border border-indigo-100">
                        <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Part No</span>
                        <span className="text-sm font-black text-slate-900 font-mono block">{draftProduct.partNo}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-teal-50/40 border border-teal-100">
                        <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider block">HSN Code</span>
                        <span className="font-semibold text-slate-800 block">{draftProduct.hsnCode || '—'}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-purple-50/40 border border-purple-100">
                        <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Description</span>
                        <span className="font-semibold text-slate-800 block truncate" title={draftProduct.description}>{draftProduct.description}</span>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Specs Row */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-amber-50/40 border border-amber-100">
                      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">UOM</span>
                      <span className="font-semibold text-slate-800 block">{draftProduct.uom || '—'}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-50/40 border border-emerald-100">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Plant</span>
                      <span className="font-semibold text-slate-800 block">{draftProduct.plant || '—'}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-sky-50/40 border border-sky-100">
                      <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider block">Weight</span>
                      <span className="font-semibold text-slate-800 block">{draftProduct.weight || 0} kg/m</span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Compact Excel Price Table (5 cols) */}
                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded bg-[#107c41] text-white flex items-center justify-center font-bold text-[11px]">
                        X
                      </div>
                      <span className="text-xs font-bold text-slate-900 uppercase">Excel Pricing</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      Active: ₹{(draftProduct.prices[0]?.lp || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="border border-slate-300 rounded overflow-hidden">
                    <div className="max-h-[260px] overflow-y-auto">
                      <table className="min-w-full border-collapse text-xs">
                        <thead className="bg-[#f3f2f1] text-slate-700 font-bold uppercase text-[9px] sticky top-0">
                          <tr className="border-b border-slate-300">
                            <th className="py-1 px-1 text-center w-8 bg-[#e1dfdd] border-r border-slate-300">#</th>
                            <th className="py-1 px-2 text-right border-r border-slate-300">LP (₹)</th>
                            <th className="py-1 px-2 text-right border-r border-slate-300">SP (₹)</th>
                            <th className="py-1 px-2 text-center border-r border-slate-300">From</th>
                            <th className="py-1 px-2 text-center">To</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {draftProduct.prices.map((price, idx) => (
                            <tr key={idx} className={`border-b border-slate-200 ${idx === 0 ? 'bg-emerald-50/40 font-semibold' : ''}`}>
                              <td className="py-1 px-1 text-center bg-[#f8f9fa] border-r border-slate-300 text-slate-600 font-mono text-[10px]">
                                {idx === 0 ? '1★' : idx + 1}
                              </td>
                              <td className="py-1 px-2 text-right font-mono font-bold text-slate-900 border-r border-slate-300">₹{(price.lp || 0).toFixed(2)}</td>
                              <td className="py-1 px-2 text-right font-mono text-slate-600 border-r border-slate-300">₹{(price.sp || 0).toFixed(2)}</td>
                              <td className="py-1 px-2 text-center font-mono text-slate-700 border-r border-slate-300">{price.validFrom}</td>
                              <td className="py-1 px-2 text-center font-mono text-slate-500">{price.validTo}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            /* EDIT FORM VIEW - COLORFUL & COMPACT SINGLE-VIEW */
            <form id="productEditForm" onSubmit={handlePrepareDraft}>
              <fieldset disabled={isSaving}>

                {/* Two-Column Single-View Grid Matching Mockup */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                  
                  {/* LEFT CARD (7 COLS): Image & Product Specifications */}
                  <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between space-y-3.5">
                    
                    {/* Card Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-2xs">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                          Image & Product Specifications
                        </h3>
                      </div>
                      {formData.imageUrl ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-bold">✓</span>
                          Attached
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Optional</span>
                      )}
                    </div>

                    {/* Image (Left) + Part No / HSN / Description (Right) */}
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      
                      {/* Product Image Area */}
                      <div className="w-full sm:w-44 shrink-0 flex flex-col items-center gap-2">
                        <div className="relative group w-full h-32 bg-white border border-dashed border-blue-200 hover:border-blue-400 rounded-xl overflow-hidden flex items-center justify-center transition-all shadow-2xs">
                          {formData.imageUrl ? (
                            <>
                              <img 
                                src={formData.imageUrl} 
                                alt="Product preview" 
                                className="max-h-full max-w-full object-contain p-2 transition-transform duration-200 group-hover:scale-105"
                                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                              />
                              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-2xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                <label className="cursor-pointer bg-white text-slate-800 text-[10px] font-bold px-2 py-1 rounded-md shadow hover:bg-slate-50 transition-colors">
                                  Replace
                                  <input type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                                  className="bg-rose-600 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow hover:bg-rose-700 transition-colors"
                                >
                                  Remove
                                </button>
                              </div>
                            </>
                          ) : (
                            <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full p-2 text-center hover:bg-blue-50/30 transition-colors">
                              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                              </div>
                              <span className="text-[11px] font-bold text-blue-900">Upload Photo</span>
                              <span className="text-[9px] text-slate-400">PNG, JPG, WebP</span>
                              <input type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                            </label>
                          )}
                        </div>

                        {/* Paste Web URL Action Button */}
                        <button
                          type="button"
                          onClick={() => setShowUrlInput(!showUrlInput)}
                          className="w-full inline-flex items-center justify-center gap-1.5 bg-blue-50/80 hover:bg-blue-100 text-blue-600 text-xs font-bold py-1.5 px-3 rounded-xl border border-blue-100 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                          <span>{showUrlInput ? 'Hide URL' : 'Paste Web URL'}</span>
                        </button>

                        {showUrlInput && (
                          <input 
                            type="text" 
                            name="imageUrl" 
                            id="imageUrl" 
                            value={formData.imageUrl && !formData.imageUrl.startsWith('data:image/') ? formData.imageUrl : ''} 
                            onChange={handleGeneralChange} 
                            placeholder="https://.../product.jpg" 
                            className="block w-full px-2.5 py-1 text-xs border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 bg-white"
                          />
                        )}
                      </div>

                      {/* Right Part: Part No, HSN, Description */}
                      <div className="flex-1 space-y-3 w-full">
                        {/* Part No & HSN Code */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label htmlFor="partNo" className="block text-xs font-bold text-slate-800 mb-1">
                              Part No <span className="text-rose-500">*</span>
                            </label>
                            <input 
                              type="text" 
                              name="partNo" 
                              id="partNo" 
                              value={formData.partNo} 
                              onChange={handleGeneralChange} 
                              required 
                              className="block w-full px-3 py-2 text-sm font-bold text-slate-900 bg-[#f8fafc] border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                              placeholder="e.g. 221803"
                            />
                          </div>

                          <div>
                            <label htmlFor="hsnCode" className="block text-xs font-bold text-slate-800 mb-1">
                              HSN Code
                            </label>
                            <input 
                              type="text" 
                              name="hsnCode" 
                              id="hsnCode" 
                              value={formData.hsnCode || ''} 
                              onChange={handleGeneralChange} 
                              className="block w-full px-3 py-2 text-sm text-slate-800 bg-[#f8fafc] border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all placeholder:text-slate-400"
                              placeholder="e.g. 85444990"
                            />
                          </div>
                        </div>

                        {/* Description with Purple Document Icon */}
                        <div>
                          <label htmlFor="description" className="block text-xs font-bold text-slate-800 mb-1">
                            Description <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative flex items-center">
                            <span className="absolute left-3 text-purple-600 flex items-center pointer-events-none">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
                            </span>
                            <input 
                              type="text"
                              name="description" 
                              id="description" 
                              value={formData.description} 
                              onChange={handleGeneralChange} 
                              required 
                              className="block w-full pl-9 pr-3 py-2 text-sm font-bold text-slate-900 bg-[#f8fafc] border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all"
                              placeholder="e.g. ÖLFLEX® TRAY II 3G1 18/3C"
                            />
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Bottom Row: 3 Spec Pods (UOM, Plant, Weight) */}
                    <div className="grid grid-cols-3 gap-2.5 pt-2">
                      {/* ⚙️ UOM */}
                      <div className="bg-[#fff8ea] border border-[#fdecd0] rounded-xl p-2.5">
                        <label htmlFor="uom" className="text-amber-800 font-bold text-xs flex items-center gap-1">
                          <span>⚙️</span> UOM
                        </label>
                        <select 
                          name="uom" 
                          id="uom" 
                          value={formData.uom} 
                          onChange={handleGeneralChange} 
                          className="mt-1.5 block w-full px-2.5 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg shadow-2xs focus:outline-none focus:border-amber-400"
                        >
                          <option value="">Select</option>
                          {UOMS.map(uom => <option key={uom} value={uom}>{uom}</option>)}
                        </select>
                      </div>

                      {/* 🍃 Plant */}
                      <div className="bg-[#eefcf3] border border-[#d1f4df] rounded-xl p-2.5">
                        <label htmlFor="plant" className="text-emerald-800 font-bold text-xs flex items-center gap-1">
                          <span>🍃</span> Plant
                        </label>
                        <select 
                          name="plant" 
                          id="plant" 
                          value={formData.plant} 
                          onChange={handleGeneralChange} 
                          className="mt-1.5 block w-full px-2.5 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg shadow-2xs focus:outline-none focus:border-emerald-400"
                        >
                          <option value="">Select</option>
                          {PLANTS.map(plant => <option key={plant} value={plant}>{plant}</option>)}
                        </select>
                      </div>

                      {/* ⚖️ Weight */}
                      <div className="bg-[#edf5ff] border border-[#d3e5fc] rounded-xl p-2.5">
                        <label htmlFor="weight" className="text-blue-800 font-bold text-xs flex items-center gap-1">
                          <span>⚖️</span> Weight (KG/M)
                        </label>
                        <input 
                          type="number" 
                          step="0.001" 
                          name="weight" 
                          id="weight" 
                          value={formData.weight} 
                          onChange={handleGeneralChange} 
                          className="mt-1.5 block w-full px-2.5 py-1.5 text-xs font-bold font-mono text-slate-800 bg-white border border-slate-200 rounded-lg shadow-2xs focus:outline-none focus:border-blue-400"
                          placeholder="0"
                        />
                      </div>
                    </div>

                  </div>

                  {/* RIGHT CARD (5 COLS): Price Schedule (Excel Grid View) */}
                  <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col overflow-hidden">
                    
                    {/* Header Banner - Royal Blue Gradient */}
                    <div className="bg-gradient-to-r from-[#0356c9] via-[#0866dc] to-[#044db9] text-white p-3.5 px-4 flex items-center justify-between shrink-0 shadow-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white tracking-wide">
                            Price Schedule
                          </h3>
                          <p className="text-[11px] text-blue-100 font-medium -mt-0.5">
                            Excel Grid View
                          </p>
                        </div>
                      </div>

                      <button 
                        type="button" 
                        onClick={handleAddPriceRow} 
                        className="inline-flex items-center gap-1.5 bg-[#0461de] hover:bg-[#0352be] border border-blue-300/40 text-white font-bold py-1.5 px-3 text-xs rounded-xl transition-all shadow-xs"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        <span>+ Add Row</span>
                      </button>
                    </div>

                    {/* Sub-header Bar */}
                    <div className="bg-[#eaf3fe] px-4 py-2 border-b border-blue-100 flex items-center justify-between text-xs shrink-0">
                      <div className="flex items-center gap-1.5 text-blue-900 font-medium">
                        <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">i</span>
                        <span>{formData.prices.length} Tiers – Row 1 Active</span>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-200">
                        Latest on Top ↑
                      </span>
                    </div>

                    {/* Older Price Warning */}
                    {isOlderPriceDetected && (
                      <div className="p-2 mx-3 my-1.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs font-semibold flex items-center gap-1.5">
                        <span>⚠️</span>
                        <span>Older price: check validity date</span>
                      </div>
                    )}

                    {/* Table Body Grid */}
                    <div className="flex-1 overflow-y-auto max-h-[300px]">
                      <table className="min-w-full border-collapse text-xs">
                        <thead className="bg-[#f8fafc] text-slate-700 font-bold uppercase text-[10px] sticky top-0 z-10 border-b border-slate-200 select-none">
                          <tr>
                            <th className="py-2.5 px-1.5 text-center w-9">#</th>
                            <th className="py-2.5 px-2 text-center min-w-[75px]">LP (₹)</th>
                            <th className="py-2.5 px-2 text-center min-w-[65px]">SP (₹)</th>
                            <th className="py-2.5 px-2 text-center min-w-[95px]">VALID FROM</th>
                            <th className="py-2.5 px-2 text-center min-w-[95px]">VALID TO</th>
                            <th className="py-2.5 px-1.5 text-center w-12">DELETE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {formData.prices.map((price, index) => (
                            <tr key={index} className={`hover:bg-blue-50/20 transition-colors ${index === 0 ? 'bg-[#edf5fe]/60' : ''}`}>
                              {/* Row Number */}
                              <td className="py-2 px-1 text-center font-mono font-bold text-xs select-none">
                                {index === 0 ? (
                                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-2xs">
                                    1★
                                  </span>
                                ) : (
                                  <span className="text-slate-600">{index + 1}</span>
                                )}
                              </td>

                              {/* LP Cell */}
                              <td className="py-1 px-1.5 text-center">
                                <input 
                                  type="number" 
                                  step="0.01" 
                                  value={price.lp} 
                                  onChange={(e) => handlePriceChange(index, 'lp', e.target.value)} 
                                  onBlur={() => handlePriceBlur(index, 'lp')}
                                  className="w-full text-center px-1 py-1 text-xs font-mono font-bold text-slate-900 bg-slate-50/60 rounded-md border border-slate-200/80 focus:bg-white focus:border-blue-500 focus:outline-none"
                                  placeholder="0.00"
                                />
                              </td>

                              {/* SP Cell */}
                              <td className="py-1 px-1.5 text-center">
                                <input 
                                  type="number" 
                                  step="0.01" 
                                  value={price.sp} 
                                  onChange={(e) => handlePriceChange(index, 'sp', e.target.value)} 
                                  onBlur={() => handlePriceBlur(index, 'sp')}
                                  disabled={price.lp > 0} 
                                  className="w-full text-center px-1 py-1 text-xs font-mono font-bold text-slate-900 bg-slate-50/60 rounded-md border border-slate-200/80 focus:bg-white focus:border-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                                  placeholder="0.00"
                                />
                              </td>

                              {/* Valid From */}
                              <td className="py-1 px-1.5 text-center">
                                <input 
                                  type="date" 
                                  value={price.validFrom} 
                                  onChange={(e) => handlePriceChange(index, 'validFrom', e.target.value)} 
                                  className="w-full text-center px-1 py-1 text-[11px] font-mono text-slate-800 bg-slate-50/60 rounded-md border border-slate-200/80 focus:bg-white focus:border-blue-500 focus:outline-none"
                                />
                              </td>

                              {/* Valid To */}
                              <td className="py-1 px-1.5 text-center">
                                <input 
                                  type="date" 
                                  value={price.validTo} 
                                  disabled 
                                  className="w-full text-center px-1 py-1 text-[11px] font-mono text-slate-500 bg-slate-100/80 rounded-md border border-slate-200/80 cursor-not-allowed"
                                />
                              </td>

                              {/* Delete */}
                              <td className="py-1 px-1.5 text-center">
                                <button 
                                  type="button" 
                                  onClick={() => handleRemovePriceRow(index)} 
                                  disabled={formData.prices.length <= 1} 
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-20 disabled:hover:bg-transparent transition-colors mx-auto"
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

        {/* Modern Colorful Footer Actions */}
        <div className="px-6 py-3 bg-white border-t border-slate-100 flex items-center justify-between shrink-0 shadow-xs">
          {showDraftPreview ? (
            <>
              <button 
                type="button" 
                onClick={() => setShowDraftPreview(false)} 
                disabled={isSaving} 
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
              >
                <span>← Back to Edit</span>
              </button>

              <button 
                type="button" 
                onClick={handleConfirmSave} 
                disabled={isSaving} 
                className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl transition-all shadow-md shadow-emerald-600/25 hover:shadow-lg disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span>Saving...</span>
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
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
              >
                ✕ Cancel
              </button>

              <button 
                type="submit" 
                form="productEditForm" 
                disabled={isSaving} 
                className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl transition-all shadow-md shadow-indigo-600/30 hover:shadow-lg hover:scale-[1.01] disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                <span>{productToEdit ? 'Review Draft & Update →' : 'Review Draft & Save →'}</span>
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
