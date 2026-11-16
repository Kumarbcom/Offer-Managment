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

  const handleGeneralChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex justify-center items-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col border border-slate-200 overflow-hidden">
        
        {/* Modern Enterprise Header */}
        <div className="px-6 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
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
              <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5">
                {showDraftPreview ? 'Review draft specifications and pricing schedule before database commit' : 'Product specifications, high-res photo, and Excel pricing schedule'}
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

        {/* Content Area with attractive subtle backdrop */}
        <div className="flex-grow overflow-y-auto p-4 sm:p-5 bg-gradient-to-br from-slate-50 via-slate-100/40 to-indigo-50/20">

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
                      Verify product details and pricing table below. Click <strong>"Confirm & Update Product"</strong> to save to database.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-800 bg-white border border-emerald-200 px-3 py-1 rounded-lg shadow-sm">
                    {draftProduct.prices.length} Price Tier{draftProduct.prices.length > 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Two Column Layout for Draft Review */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* Left Side: Image & Specs */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Image Card */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2">
                      Product Image
                    </span>
                    <div className="flex items-center justify-center bg-gradient-to-b from-slate-50 to-blue-50/30 border border-slate-200 rounded-xl p-3 h-48">
                      {draftProduct.imageUrl ? (
                        <img 
                          src={draftProduct.imageUrl} 
                          alt={draftProduct.partNo} 
                          className="max-h-full max-w-full object-contain rounded-lg drop-shadow-sm"
                        />
                      ) : (
                        <div className="text-center text-slate-400">
                          <svg className="w-10 h-10 mx-auto mb-1 opacity-50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                          <span className="text-xs">No Image Attached</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Specifications Card */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm space-y-2.5">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block border-b border-slate-100 pb-2">
                      Product Specifications
                    </span>
                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Part No</span>
                        <span className="text-xs font-black text-slate-900 font-mono mt-0.5 block">{draftProduct.partNo}</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">HSN Code</span>
                        <span className="font-semibold text-slate-800 mt-0.5 block">{draftProduct.hsnCode || '—'}</span>
                      </div>
                      <div className="col-span-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Description</span>
                        <span className="text-xs font-semibold text-slate-800 mt-0.5 block" title={draftProduct.description}>{draftProduct.description}</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">UOM / Plant</span>
                        <span className="font-semibold text-slate-800 mt-0.5 block">{draftProduct.uom || '—'} / {draftProduct.plant || '—'}</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Weight</span>
                        <span className="font-semibold text-slate-800 mt-0.5 block">{draftProduct.weight || 0} kg/m</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: Finalized Excel Price Grid */}
                <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-[#107c41] text-white flex items-center justify-center font-bold text-xs shadow-xs font-sans">
                          X
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Price Validity Schedule (Excel Grid)
                        </h4>
                      </div>
                      {isPriceOlderThanThreshold(draftProduct.prices) && (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                          Older price Need to check
                        </span>
                      )}
                    </div>

                    <div className="border border-slate-300 rounded-sm overflow-hidden shadow-2xs bg-white">
                      <div className="bg-[#f8f9fa] px-3 py-1.5 border-b border-slate-300 flex items-center justify-between text-xs text-slate-600 select-none font-mono">
                        <span className="text-slate-700 font-sans font-medium text-[11px]">
                          <strong className="text-[#107c41] font-mono font-bold">fx</strong> | Active LP: <strong className="text-emerald-700 font-mono">₹{(draftProduct.prices[0]?.lp || 0).toFixed(2)}</strong>
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-200/70 px-2 py-0.5 rounded">
                          Grid Preview
                        </span>
                      </div>
                      <div className="max-h-[380px] overflow-y-auto">
                        <table className="min-w-full border-collapse text-xs">
                          <thead className="bg-[#f3f2f1] text-slate-700 font-bold uppercase text-[10px] select-none sticky top-0 z-10">
                            <tr className="border-b border-slate-300">
                              <th className="py-1 px-2 text-center w-10 border-r border-slate-300 bg-[#e1dfdd] text-slate-700">#</th>
                              <th className="py-1.5 px-3 text-right border-r border-slate-300">LP (List Price ₹)</th>
                              <th className="py-1.5 px-3 text-right border-r border-slate-300">SP (Special Price ₹)</th>
                              <th className="py-1.5 px-2 text-center border-r border-slate-300 w-28">Valid From</th>
                              <th className="py-1.5 px-2 text-center border-r border-slate-300 w-28">Valid To</th>
                              <th className="py-1.5 px-2 text-center w-20">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 bg-white">
                            {draftProduct.prices.map((price, idx) => (
                              <tr key={idx} className={`border-b border-slate-200 ${idx === 0 ? 'bg-emerald-50/40 font-semibold' : 'hover:bg-slate-50'}`}>
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
                                <td className="py-1 px-2 text-center font-mono text-slate-700 border-r border-slate-300">{price.validFrom}</td>
                                <td className="py-1 px-2 text-center font-mono text-slate-500 border-r border-slate-300">{price.validTo}</td>
                                <td className="py-1 px-2 text-center">
                                  {idx === 0 ? (
                                    <span className="inline-block text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded">
                                      Active
                                    </span>
                                  ) : (
                                    <span className="inline-block text-[9px] text-slate-400">Past</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            /* EDIT FORM VIEW */
            <form id="productEditForm" onSubmit={handlePrepareDraft}>
              <fieldset disabled={isSaving}>

                {/* Two-Column Responsive Grid Layout: Left has Image & Specifications, Right has Excel Price Table */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  
                  {/* LEFT COLUMN: Product Image on top, Product Specifications below (5 cols) */}
                  <div className="lg:col-span-5 space-y-4">
                    
                    {/* 1. Product Image Card */}
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                          Product Image
                        </span>
                        {formData.imageUrl ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Attached
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">
                            Optional
                          </span>
                        )}
                      </div>

                      {/* Attractive Image Container */}
                      <div className="relative group w-full h-44 bg-gradient-to-b from-slate-50 via-slate-50/80 to-blue-50/20 border-2 border-dashed border-slate-200 rounded-xl overflow-hidden flex items-center justify-center transition-all hover:border-indigo-400">
                        {formData.imageUrl ? (
                          <>
                            <img 
                              src={formData.imageUrl} 
                              alt="Product preview" 
                              className="max-h-full max-w-full object-contain p-2 transition-transform duration-200 group-hover:scale-105 drop-shadow-sm"
                              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                            />
                            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-2xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
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
                          <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full p-4 text-center hover:bg-slate-100/50 transition-colors">
                            <div className="w-11 h-11 rounded-full bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600 mb-1.5 shadow-xs">
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            </div>
                            <span className="text-xs font-bold text-slate-800">Click to Upload Image</span>
                            <span className="text-[11px] text-slate-400 mt-0.5">PNG, JPG, WebP supported</span>
                            <input type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                          </label>
                        )}
                      </div>

                      {/* Image URL Toggle */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => setShowUrlInput(!showUrlInput)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                          <span>{showUrlInput ? 'Hide URL input' : 'Paste Image Web URL'}</span>
                        </button>
                        <span className="text-[10px] text-slate-400">Web links</span>
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
                            className="block w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                          />
                        </div>
                      )}
                    </div>

                    {/* 2. Product Specifications (Moved directly below the image) */}
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                          Product Specifications
                        </span>
                        <span className="text-[11px] text-slate-400">* Required</span>
                      </div>

                      <div className="space-y-3">
                        {/* Part No & HSN Code */}
                        <div className="grid grid-cols-2 gap-2.5">
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
                              className="block w-full px-3 py-1.5 text-xs font-mono font-bold text-slate-900 border border-slate-300 rounded-xl shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white hover:border-slate-400 transition-colors"
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
                              className="block w-full px-3 py-1.5 text-xs text-slate-900 border border-slate-300 rounded-xl shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white hover:border-slate-400 transition-colors"
                              placeholder="e.g. 85444990"
                            />
                          </div>
                        </div>

                        {/* Description */}
                        <div>
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
                            className="block w-full px-3 py-1.5 text-xs font-semibold text-slate-900 border border-slate-300 rounded-xl shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white hover:border-slate-400 transition-colors"
                            placeholder="e.g. ÖLFLEX® CLASSIC 110 4G1,5"
                          />
                        </div>

                        {/* UOM & Plant */}
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label htmlFor="uom" className="block text-xs font-bold text-slate-700 mb-1">UOM</label>
                            <select 
                              name="uom" 
                              id="uom" 
                              value={formData.uom} 
                              onChange={handleGeneralChange} 
                              className="block w-full px-3 py-1.5 text-xs text-slate-900 border border-slate-300 rounded-xl shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white hover:border-slate-400 transition-colors"
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
                              className="block w-full px-3 py-1.5 text-xs text-slate-900 border border-slate-300 rounded-xl shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white hover:border-slate-400 transition-colors"
                            >
                              <option value="">Select Plant</option>
                              {PLANTS.map(plant => <option key={plant} value={plant}>{plant}</option>)}
                            </select>
                          </div>
                        </div>

                        {/* Weight */}
                        <div>
                          <label htmlFor="weight" className="block text-xs font-bold text-slate-700 mb-1">Weight (kg/m)</label>
                          <input 
                            type="number" 
                            step="0.001" 
                            name="weight" 
                            id="weight" 
                            value={formData.weight} 
                            onChange={handleGeneralChange} 
                            className="block w-full px-3 py-1.5 text-xs text-slate-900 border border-slate-300 rounded-xl shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white hover:border-slate-400 transition-colors"
                            placeholder="0.000"
                          />
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* RIGHT COLUMN: Excel Price Validity Schedule (7 cols, side-by-side with image & specs) */}
                  <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                    <div>
                      {/* Section Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-[#107c41] text-white flex items-center justify-center font-bold text-xs shadow-xs font-sans">
                            X
                          </div>
                          <div>
                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                              Price Validity Schedule
                            </h3>
                            <span className="text-[10px] text-slate-400">Microsoft Excel Style Grid</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-[#107c41] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full hidden sm:inline">
                            Latest on Top
                          </span>
                          <button 
                            type="button" 
                            onClick={handleAddPriceRow} 
                            className="inline-flex items-center gap-1.5 bg-[#107c41] hover:bg-[#0b5c30] text-white font-bold py-1.5 px-3 text-xs rounded-lg transition-all shadow-xs hover:shadow-sm"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            <span>+ Insert Row</span>
                          </button>
                        </div>
                      </div>

                      {/* Older Price Notification Banner */}
                      {isOlderPriceDetected && (
                        <div className="p-2.5 mb-2.5 bg-amber-50/90 border border-amber-300 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2">
                          <span className="text-sm">⚠️</span>
                          <span>Older price Need to check (Latest price is older than 11.09.2026)</span>
                        </div>
                      )}

                      {/* Excel Spreadsheet Table Container */}
                      <div className="border border-slate-300 rounded-sm shadow-2xs bg-white overflow-hidden">
                        {/* Excel Formula & Status Bar */}
                        <div className="bg-[#f8f9fa] px-3 py-1.5 border-b border-slate-300 flex items-center justify-between text-xs text-slate-600 select-none">
                          <div className="flex items-center gap-2 font-mono">
                            <span className="font-black text-[#107c41]">fx</span>
                            <span className="text-slate-300">|</span>
                            <span className="text-slate-700 font-sans font-medium text-[11px]">
                              <strong>{formData.prices.length}</strong> Tier{formData.prices.length > 1 ? 's' : ''} defined • Row 1 is Active Latest
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-200/70 px-2 py-0.5 rounded">
                            Spreadsheet Grid
                          </span>
                        </div>

                        {/* Excel Grid Body */}
                        <div className="max-h-[460px] overflow-y-auto overflow-x-auto">
                          <table className="min-w-full border-collapse text-xs">
                            <thead className="bg-[#f3f2f1] text-slate-700 font-bold uppercase text-[10px] sticky top-0 z-10 select-none">
                              <tr className="border-b border-slate-300">
                                <th className="py-1 px-1.5 text-center w-10 border-r border-slate-300 bg-[#e1dfdd] text-slate-700">#</th>
                                <th className="py-1.5 px-2 text-right border-r border-slate-300 min-w-[110px]">LP (List Price ₹)</th>
                                <th className="py-1.5 px-2 text-right border-r border-slate-300 min-w-[105px]">SP (Special Price ₹)</th>
                                <th className="py-1.5 px-2 text-center border-r border-slate-300 w-28">Valid From</th>
                                <th className="py-1.5 px-2 text-center border-r border-slate-300 w-28">Valid To</th>
                                <th className="py-1 px-1 text-center w-10 text-slate-600">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                              {formData.prices.map((price, index) => (
                                <tr key={index} className={`hover:bg-emerald-50/30 transition-colors border-b border-slate-200 ${index === 0 ? 'bg-emerald-50/20' : ''}`}>
                                  {/* Excel Row Header (#) */}
                                  <td className="py-0 px-1 text-center bg-[#f8f9fa] border-r border-slate-300 text-slate-600 font-mono font-bold text-[11px] select-none h-8">
                                    {index === 0 ? (
                                      <span className="inline-flex items-center px-1 rounded text-[9px] font-bold bg-[#107c41] text-white" title="Latest Active Price">
                                        1★
                                      </span>
                                    ) : (
                                      index + 1
                                    )}
                                  </td>

                                  {/* LP Cell */}
                                  <td className="p-0 border-r border-slate-300 h-8 bg-white focus-within:ring-2 focus-within:ring-[#107c41] focus-within:z-10">
                                    <div className="flex items-center h-full">
                                      <span className="pl-1.5 text-slate-400 text-xs font-mono select-none">₹</span>
                                      <input 
                                        type="number" 
                                        step="0.01" 
                                        value={price.lp} 
                                        onChange={(e) => handlePriceChange(index, 'lp', e.target.value)} 
                                        onBlur={() => handlePriceBlur(index, 'lp')}
                                        className="w-full h-full px-1.5 text-right text-xs font-mono font-bold text-slate-900 bg-transparent border-none outline-none focus:bg-white"
                                        placeholder="0.00"
                                      />
                                    </div>
                                  </td>

                                  {/* SP Cell */}
                                  <td className="p-0 border-r border-slate-300 h-8 bg-white focus-within:ring-2 focus-within:ring-[#107c41] focus-within:z-10">
                                    <div className="flex items-center h-full">
                                      <span className="pl-1.5 text-slate-400 text-xs font-mono select-none">₹</span>
                                      <input 
                                        type="number" 
                                        step="0.01" 
                                        value={price.sp} 
                                        onChange={(e) => handlePriceChange(index, 'sp', e.target.value)} 
                                        onBlur={() => handlePriceBlur(index, 'sp')}
                                        disabled={price.lp > 0} 
                                        className="w-full h-full px-1.5 text-right text-xs font-mono font-bold text-slate-900 bg-transparent border-none outline-none disabled:bg-[#f3f2f1] disabled:text-slate-400 focus:bg-white"
                                        placeholder="0.00"
                                      />
                                    </div>
                                  </td>

                                  {/* Valid From Cell */}
                                  <td className="p-0 border-r border-slate-300 h-8 bg-white focus-within:ring-2 focus-within:ring-[#107c41] focus-within:z-10">
                                    <input 
                                      type="date" 
                                      value={price.validFrom} 
                                      onChange={(e) => handlePriceChange(index, 'validFrom', e.target.value)} 
                                      className="w-full h-full px-1.5 text-center text-xs font-mono text-slate-800 bg-transparent border-none outline-none focus:bg-white"
                                    />
                                  </td>

                                  {/* Valid To Cell */}
                                  <td className="p-0 border-r border-slate-300 h-8 bg-[#fbfbfa]">
                                    <input 
                                      type="date" 
                                      value={price.validTo} 
                                      disabled 
                                      className="w-full h-full px-1.5 text-center text-xs font-mono text-slate-500 bg-transparent border-none outline-none cursor-not-allowed"
                                    />
                                  </td>

                                  {/* Delete Action Cell */}
                                  <td className="p-0 text-center h-8 bg-white">
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
                  </div>

                </div>

              </fieldset>
            </form>
          )}

        </div>

        {/* Modern Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 shadow-xs">
          {showDraftPreview ? (
            <>
              <button 
                type="button" 
                onClick={() => setShowDraftPreview(false)} 
                disabled={isSaving} 
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors shadow-xs disabled:opacity-50"
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
