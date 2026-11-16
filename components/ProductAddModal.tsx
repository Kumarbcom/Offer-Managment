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
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex justify-center items-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        
        {/* Header with Title and ID */}
        <div className="px-5 py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white tracking-wide">
                  {productToEdit ? 'Edit Product' : 'Add New Product'}
                </h2>
                {formData.partNo && (
                  <span className="text-xs font-mono font-bold bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded border border-indigo-400/30">
                    {formData.partNo}
                  </span>
                )}
                {productToEdit && (
                  <span className="text-[11px] font-mono font-medium text-slate-300">
                    (ID #{productToEdit.id})
                  </span>
                )}
              </div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors text-2xl font-bold"
            title="Close"
          >
            &times;
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-grow overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50">

          {/* DRAFT REVIEW VIEW */}
          {showDraftPreview && draftProduct ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">✓</span>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-900 uppercase">Draft Preview</h4>
                    <p className="text-[11px] text-emerald-700">Please review the specifications and price schedule before confirming.</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-800 bg-white border border-emerald-200 px-2.5 py-0.5 rounded">
                  {draftProduct.prices.length} Price Tier{draftProduct.prices.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Specs Summary */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center gap-4">
                  {draftProduct.imageUrl ? (
                    <img src={draftProduct.imageUrl} alt={draftProduct.partNo} className="w-16 h-16 object-contain rounded-lg border border-slate-200 bg-slate-50 p-1 shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400 text-xs shrink-0">No Image</div>
                  )}
                  <div className="space-y-1">
                    <div className="text-xs text-slate-400 font-mono">Part Number</div>
                    <div className="text-base font-bold text-slate-900 font-mono">{draftProduct.partNo}</div>
                    <div className="text-xs text-slate-600">{draftProduct.description}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="bg-slate-50 p-2 rounded border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">HSN Code</span>
                    <span className="font-mono font-medium text-slate-800">{draftProduct.hsnCode || '—'}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">UOM</span>
                    <span className="font-medium text-slate-800">{draftProduct.uom || '—'}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Plant</span>
                    <span className="font-medium text-slate-800">{draftProduct.plant || '—'}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Weight</span>
                    <span className="font-mono font-medium text-slate-800">{draftProduct.weight || 0} kg/m</span>
                  </div>
                </div>
              </div>

              {/* Price Details Summary Table */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">Price Schedule Tiers</div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="min-w-full text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3 text-center w-10">#</th>
                        <th className="py-2 px-3 text-right">List Price (₹)</th>
                        <th className="py-2 px-3 text-right">Special Price (₹)</th>
                        <th className="py-2 px-3 text-center">Valid From</th>
                        <th className="py-2 px-3 text-center">Valid To</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {draftProduct.prices.map((p, idx) => (
                        <tr key={idx} className={idx === 0 ? 'bg-emerald-50/50 font-semibold' : ''}>
                          <td className="py-1.5 px-3 text-center font-mono text-slate-500">{idx === 0 ? '1 (Latest)' : idx + 1}</td>
                          <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">₹{(p.lp || 0).toFixed(2)}</td>
                          <td className="py-1.5 px-3 text-right font-mono text-slate-600">₹{(p.sp || 0).toFixed(2)}</td>
                          <td className="py-1.5 px-3 text-center font-mono text-slate-700">{p.validFrom}</td>
                          <td className="py-1.5 px-3 text-center font-mono text-slate-500">{p.validTo}</td>
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
                
                {/* 1. Product Specifications */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    {/* Part No */}
                    <div className="sm:col-span-4">
                      <label htmlFor="partNo" className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1">
                        Part No <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        name="partNo" 
                        id="partNo" 
                        value={formData.partNo} 
                        onChange={handleGeneralChange} 
                        required 
                        placeholder="e.g. 1119304" 
                        className="w-full px-3 py-1.5 text-sm font-mono font-bold text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      />
                    </div>

                    {/* HSN Code */}
                    <div className="sm:col-span-3">
                      <label htmlFor="hsnCode" className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1">
                        HSN Code
                      </label>
                      <input 
                        type="text" 
                        name="hsnCode" 
                        id="hsnCode" 
                        value={formData.hsnCode || ''} 
                        onChange={handleGeneralChange} 
                        placeholder="e.g. 85444990" 
                        className="w-full px-3 py-1.5 text-sm text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-mono"
                      />
                    </div>

                    {/* Description */}
                    <div className="sm:col-span-5">
                      <label htmlFor="description" className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1">
                        Description <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        name="description" 
                        id="description" 
                        value={formData.description} 
                        onChange={handleGeneralChange} 
                        required 
                        placeholder="e.g. ÖLFLEX® CLASSIC 110 4G1,5" 
                        className="w-full px-3 py-1.5 text-sm text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      />
                    </div>
                  </div>

                  {/* Row 2: UOM, Plant, Weight */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <label htmlFor="uom" className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1">
                        UOM
                      </label>
                      <select 
                        name="uom" 
                        id="uom" 
                        value={formData.uom} 
                        onChange={handleGeneralChange} 
                        className="w-full px-3 py-1.5 text-sm text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      >
                        <option value="">Select UOM</option>
                        {UOMS.map(uom => <option key={uom} value={uom}>{uom}</option>)}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="plant" className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1">
                        Plant
                      </label>
                      <select 
                        name="plant" 
                        id="plant" 
                        value={formData.plant} 
                        onChange={handleGeneralChange} 
                        className="w-full px-3 py-1.5 text-sm text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      >
                        <option value="">Select Plant</option>
                        {PLANTS.map(plant => <option key={plant} value={plant}>{plant}</option>)}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="weight" className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1">
                        Weight (kg/m)
                      </label>
                      <input 
                        type="number" 
                        step="0.001" 
                        name="weight" 
                        id="weight" 
                        value={formData.weight} 
                        onChange={handleGeneralChange} 
                        placeholder="0" 
                        className="w-full px-3 py-1.5 text-sm font-mono text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Product Image (Optional - Compact and Practical) */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Product Image <span className="text-slate-400 font-normal lowercase">(optional)</span>
                    </span>
                    {formData.imageUrl && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Image Attached
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-300 text-xs font-semibold transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      <span>Choose Image File...</span>
                      <input type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                    </label>

                    {formData.imageUrl ? (
                      <div className="flex items-center gap-2 p-1 bg-slate-50 border border-slate-200 rounded-lg">
                        <img 
                          src={formData.imageUrl} 
                          alt="Thumbnail" 
                          className="w-10 h-10 object-contain rounded bg-white border border-slate-200" 
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                        <button 
                          type="button" 
                          onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))} 
                          className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 rounded hover:bg-rose-50 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}

                    <div className="flex-1 min-w-[240px]">
                      <input 
                        type="text" 
                        name="imageUrl" 
                        id="imageUrl" 
                        value={formData.imageUrl && !formData.imageUrl.startsWith('data:image/') ? formData.imageUrl : ''} 
                        onChange={handleGeneralChange} 
                        placeholder="Or paste an Image Web URL (e.g. https://...)" 
                        className="w-full px-3 py-1.5 text-xs text-slate-700 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Price Details (Full Width Clean Table) */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                        Price Details
                      </h3>
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        Latest on Top
                      </span>
                    </div>

                    <button 
                      type="button" 
                      onClick={handleAddPriceRow} 
                      className="inline-flex items-center gap-1 bg-[#107c41] hover:bg-[#0b5c30] text-white font-bold py-1 px-3 text-xs rounded-lg transition-all shadow-xs"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      <span>+ Add Price Row</span>
                    </button>
                  </div>

                  {isOlderPriceDetected && (
                    <div className="p-2 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs font-semibold flex items-center gap-2">
                      <span>⚠️</span>
                      <span>Notice: Some prices have dates older than threshold. Please verify validity dates.</span>
                    </div>
                  )}

                  {/* Price Table */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
                    <div className="max-h-[260px] overflow-y-auto">
                      <table className="min-w-full border-collapse text-xs">
                        <thead className="bg-[#f3f2f1] text-slate-700 font-bold uppercase text-[10px] sticky top-0 z-10 border-b border-slate-300 select-none">
                          <tr>
                            <th className="py-2 px-2 text-center w-12 border-r border-slate-300 bg-[#e1dfdd]">#</th>
                            <th className="py-2 px-3 text-left border-r border-slate-300 min-w-[130px]">LP (List Price ₹)</th>
                            <th className="py-2 px-3 text-left border-r border-slate-300 min-w-[130px]">SP (Special Price ₹)</th>
                            <th className="py-2 px-3 text-center border-r border-slate-300 min-w-[140px]">Valid From</th>
                            <th className="py-2 px-3 text-center border-r border-slate-300 min-w-[130px]">Valid To</th>
                            <th className="py-2 px-2 text-center w-12">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {formData.prices.map((price, index) => (
                            <tr key={index} className={`hover:bg-slate-50 transition-colors ${index === 0 ? 'bg-indigo-50/20' : ''}`}>
                              {/* # Column */}
                              <td className="py-1 px-2 text-center bg-[#f8f9fa] border-r border-slate-300 font-mono font-bold text-slate-600 text-xs">
                                {index === 0 ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                    Latest
                                  </span>
                                ) : (
                                  index + 1
                                )}
                              </td>

                              {/* LP */}
                              <td className="p-1 border-r border-slate-300">
                                <div className="relative flex items-center">
                                  <span className="absolute left-2.5 text-slate-400 text-xs font-mono">₹</span>
                                  <input 
                                    type="number" 
                                    step="0.01" 
                                    value={price.lp} 
                                    onChange={(e) => handlePriceChange(index, 'lp', e.target.value)} 
                                    onBlur={() => handlePriceBlur(index, 'lp')}
                                    className="w-full pl-6 pr-2 py-1 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                    placeholder="0.00"
                                  />
                                </div>
                              </td>

                              {/* SP */}
                              <td className="p-1 border-r border-slate-300">
                                <div className="relative flex items-center">
                                  <span className="absolute left-2.5 text-slate-400 text-xs font-mono">₹</span>
                                  <input 
                                    type="number" 
                                    step="0.01" 
                                    value={price.sp} 
                                    onChange={(e) => handlePriceChange(index, 'sp', e.target.value)} 
                                    onBlur={() => handlePriceBlur(index, 'sp')}
                                    disabled={price.lp > 0} 
                                    className="w-full pl-6 pr-2 py-1 text-xs font-mono text-slate-900 bg-white border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                                    placeholder="0.00"
                                  />
                                </div>
                              </td>

                              {/* Valid From */}
                              <td className="p-1 border-r border-slate-300">
                                <input 
                                  type="date" 
                                  value={price.validFrom} 
                                  onChange={(e) => handlePriceChange(index, 'validFrom', e.target.value)} 
                                  className="w-full px-2 py-1 text-xs font-mono text-slate-800 bg-white border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                />
                              </td>

                              {/* Valid To */}
                              <td className="p-1 border-r border-slate-300">
                                <input 
                                  type="date" 
                                  value={price.validTo} 
                                  disabled 
                                  className="w-full px-2 py-1 text-xs font-mono text-slate-500 bg-slate-100 border border-slate-200 rounded cursor-not-allowed"
                                />
                              </td>

                              {/* Delete */}
                              <td className="p-1 text-center">
                                <button 
                                  type="button" 
                                  onClick={() => handleRemovePriceRow(index)} 
                                  disabled={formData.prices.length <= 1} 
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors disabled:opacity-20"
                                  title="Remove price row"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
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
        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
          {showDraftPreview ? (
            <>
              <button 
                type="button" 
                onClick={() => setShowDraftPreview(false)} 
                disabled={isSaving} 
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
              >
                Back to Edit
              </button>

              <button 
                type="button" 
                onClick={handleConfirmSave} 
                disabled={isSaving} 
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-xs disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : (productToEdit ? 'Confirm & Update Product' : 'Confirm & Save Product')}
              </button>
            </>
          ) : (
            <>
              <button 
                type="button" 
                onClick={onClose} 
                disabled={isSaving} 
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
              >
                Cancel
              </button>

              <button 
                type="button" 
                onClick={async () => {
                  if (!validateProduct()) return;
                  const sortedPrices = sortPricesLatestFirst([...formData.prices]);
                  const preparedProduct: Product = {
                    ...formData,
                    prices: sortedPrices,
                    id: productToEdit ? productToEdit.id : 0,
                  };
                  setDraftProduct(preparedProduct);
                  setShowDraftPreview(true);
                }} 
                disabled={isSaving} 
                className="px-4 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                Preview Draft
              </button>

              <button 
                type="button" 
                onClick={async () => {
                  if (!validateProduct()) return;
                  setIsSaving(true);
                  try {
                    const sortedPrices = sortPricesLatestFirst([...formData.prices]);
                    let finalProduct: Product = {
                      ...formData,
                      prices: sortedPrices,
                      id: productToEdit ? productToEdit.id : 0,
                    };
                    if (!productToEdit) {
                      const nextId = await getNextProductId();
                      finalProduct.id = nextId;
                    }
                    onSave(finalProduct);
                  } catch (error) {
                    alert(error instanceof Error ? error.message : 'An error occurred while saving.');
                  } finally {
                    setIsSaving(false);
                  }
                }} 
                disabled={isSaving} 
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-xs disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : (productToEdit ? 'Update Product' : 'Save Product')}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
