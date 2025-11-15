import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Quotation, QuotationItem, Customer, SalesPerson, Product, View, UserRole, PriceEntry, PreparedBy } from '../types';
import { PAYMENT_TERMS, PREPARED_BY_LIST, PRODUCTS_BRANDS, MODES_OF_ENQUIRY, QUOTATION_STATUSES } from '../constants';
import { CustomerAddModal } from './CustomerAddModal';
import { ProductAddModal } from './ProductAddModal';
import { ProductSearchModal } from './ProductSearchModal';
import { SearchableSelect } from './common/SearchableSelect';
import { QuotationPrintView } from './QuotationPrintView';
import { QuotationPrintViewDiscounted } from './QuotationPrintViewDiscounted';
import { QuotationPrintViewWithAirFreight } from './QuotationPrintViewWithAirFreight';

interface QuotationFormProps {
  customers: Customer[];
  setCustomers: (value: React.SetStateAction<Customer[]>) => Promise<void>;
  salesPersons: SalesPerson[];
  products: Product[];
  setProducts: (value: React.SetStateAction<Product[]>) => Promise<void>;
  quotations: Quotation[];
  setQuotations: (value: React.SetStateAction<Quotation[]>) => Promise<void>;
  setView: (view: View) => void;
  editingQuotationId: number | null;
  setEditingQuotationId: (id: number | null) => void;
  userRole: UserRole;
}

const createEmptyQuotationItem = (): QuotationItem => ({
  productId: 0,
  partNo: '',
  description: '',
  moq: 1,
  req: 1,
  price: 0,
  priceSource: 'LP',
  discount: 0,
  stockStatus: 'Ex-Stock',
  uom: '',
  airFreight: false,
  airFreightDetails: { weightPerMtr: 0, airFreightLeadTime: '' },
});

const getTodayDateString = () => new Date().toISOString().split('T')[0];

const NavButton: React.FC<{ onClick: () => void; disabled?: boolean; children: React.ReactNode }> = ({ onClick, disabled, children }) => (
    <button type="button" onClick={onClick} disabled={disabled} className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg h-8 w-10 flex items-center justify-center font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed">
        {children}
    </button>
);

export const QuotationForm: React.FC<QuotationFormProps> = ({
  customers, setCustomers, salesPersons, products, setProducts, quotations, setQuotations, setView, editingQuotationId, setEditingQuotationId, userRole
}) => {
  const [formData, setFormData] = useState<Quotation | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isProductSearchModalOpen, setIsProductSearchModalOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<'none' | 'standard' | 'discounted' | 'withAirFreight'>('none');

  const isReadOnly = userRole !== 'Admin' && userRole !== 'Sales Person';

  const getPriceForDate = useCallback((product: Product, date: string): PriceEntry | null => {
    if (!product || !product.prices) return null;
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const priceEntry = product.prices.find(p => {
        const from = new Date(p.validFrom);
        const to = new Date(p.validTo);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        return targetDate >= from && targetDate <= to;
    })
    if(priceEntry) return priceEntry;

    const pastOrCurrentPrices = product.prices.filter(p => new Date(p.validFrom) <= targetDate);
    if(pastOrCurrentPrices.length > 0) {
        return pastOrCurrentPrices.sort((a,b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime())[0];
    }
    
    return [...product.prices].sort((a,b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime())[0] || null;
  }, []);

  const createNewQuotation = useCallback((): Quotation => {
    const newId = quotations.length > 0 ? Math.max(...quotations.map(q => q.id)) + 1 : 1;
    return {
      id: newId,
      quotationDate: getTodayDateString(),
      enquiryDate: getTodayDateString(),
      customerId: '',
      contactPerson: '',
      contactNumber: '',
      otherTerms: '± 5% Length Variation',
      paymentTerms: '100% Against Proforma Invoice',
      preparedBy: 'Kumar' as PreparedBy,
      productsBrand: 'Lapp',
      salesPersonId: '',
      modeOfEnquiry: 'Customer Email',
      status: 'Open',
      comments: '',
      details: [createEmptyQuotationItem()],
    };
  }, [quotations]);

  useEffect(() => {
    const quotationToEdit = quotations.find(q => q.id === editingQuotationId);
    setFormData(quotationToEdit || createNewQuotation());
  }, [editingQuotationId, quotations, createNewQuotation]);

  useEffect(() => {
    if (formData && formData.customerId) {
        const customer = customers.find(c => c.id === formData.customerId);
        if (customer && customer.salesPersonId) {
            setFormData(prev => prev ? {...prev, salesPersonId: customer.salesPersonId} : null);
        }
    }
  }, [formData?.customerId, customers]);

  useEffect(() => {
    if (!formData || !formData.details.length || !products) return;
    let wasUpdated = false;
    const newDetails = formData.details.map(item => {
        if (item.productId > 0) {
            const product = products.find(p => p.id === item.productId);
            if (product) {
                const priceEntry = getPriceForDate(product, formData.quotationDate);
                const newPrice = priceEntry ? (priceEntry.lp > 0 ? priceEntry.lp : priceEntry.sp) : 0;
                if (newPrice !== item.price) {
                    wasUpdated = true;
                    return { ...item, price: newPrice, priceSource: priceEntry ? (priceEntry.lp > 0 ? 'LP' : 'SP') : 'LP' };
                }
            }
        }
        return item;
    });
    if (wasUpdated) setFormData(prev => prev ? { ...prev, details: newDetails } : null);
  }, [formData?.quotationDate, products, getPriceForDate, formData?.details]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const isNumericId = name === 'customerId' || name === 'salesPersonId';
    setFormData(prev => prev ? { ...prev, [name]: isNumericId ? (value ? parseInt(value) : '') : value } : null);
  };
  
  const handleItemChange = async (index: number, field: keyof QuotationItem | `airFreightDetails.${keyof QuotationItem['airFreightDetails']}`, value: any) => {
    if (!formData) return;
    
    let productToUpdate: { productId: number, newWeight: number } | null = null;
    
    const newDetails = formData.details.map((item, i) => {
        if (i === index) {
            const updatedItem = { ...item };
            if (field.startsWith('airFreightDetails.')) {
                const subField = field.split('.')[1] as keyof QuotationItem['airFreightDetails'];
                updatedItem.airFreightDetails = { ...updatedItem.airFreightDetails, [subField]: value };
            } else { (updatedItem as any)[field] = value; }
            
            if (field === 'airFreightDetails.weightPerMtr') {
                const product = products.find(p => p.id === updatedItem.productId);
                if (product && product.weight !== value) {
                    productToUpdate = { productId: updatedItem.productId, newWeight: value };
                }
            }
            if (field === 'airFreight' && value === false) updatedItem.airFreightDetails.airFreightLeadTime = '';
            return updatedItem;
        }
        return item;
    });

    if (productToUpdate) {
        await setProducts(prevProducts => prevProducts.map(p => p.id === productToUpdate!.productId ? {...p, weight: productToUpdate!.newWeight} : p));
    }

    setFormData({ ...formData, details: newDetails });
  };
  
  const handleProductSelect = (index: number, productId: number | string) => {
    if (!formData || !productId) return;
    const numericProductId = Number(productId);
    const product = products.find(p => p.id === numericProductId);
    if (product) {
        const priceEntry = getPriceForDate(product, formData.quotationDate);
        if (!priceEntry) alert(`No valid price found for product ${product.partNo} on date ${new Date(formData.quotationDate).toLocaleDateString()}. Please check product price validity.`);
        const newDetails = [...formData.details];
        newDetails[index] = { ...newDetails[index], productId: product.id, partNo: product.partNo, description: product.description, price: priceEntry ? (priceEntry.lp > 0 ? priceEntry.lp : priceEntry.sp) : 0, priceSource: priceEntry ? (priceEntry.lp > 0 ? 'LP' : 'SP') : 'LP', uom: product.uom, airFreightDetails: { ...newDetails[index].airFreightDetails, weightPerMtr: product.weight }};
        setFormData({ ...formData, details: newDetails });
    }
  }

  const handleAddItem = () => { if (formData) setFormData({ ...formData, details: [...formData.details, createEmptyQuotationItem()] }); };
  const handleRemoveItem = (index: number) => { if (formData && formData.details.length > 1) setFormData({ ...formData, details: formData.details.filter((_, i) => i !== index) }); };
  const handleSaveCustomer = async (newCustomer: Customer) => { await setCustomers(prev => [...prev.filter(c => c.id !== newCustomer.id), newCustomer]); setFormData(prev => prev ? { ...prev, customerId: newCustomer.id } : null); setIsCustomerModalOpen(false); };
  const handleSaveProduct = async (newProduct: Product) => { await setProducts(prev => [...prev.filter(p => p.id !== newProduct.id), newProduct]); setIsProductModalOpen(false); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !formData || !formData.customerId) {
        alert("Please select a customer."); return;
    }
    const isNew = editingQuotationId === null;
    const idToSave = isNew ? (quotations.length > 0 ? Math.max(...quotations.map(q => q.id)) + 1 : 1) : editingQuotationId;
    let quotationToSave = { ...formData, id: idToSave };
    
    await setQuotations(prev => isNew ? [...prev, quotationToSave] : prev.map(q => q.id === idToSave ? quotationToSave : q));
    if(isNew) {
        setEditingQuotationId(quotationToSave.id);
        const url = new URL(window.location.href); url.searchParams.set('id', String(quotationToSave.id)); window.history.pushState({}, '', url);
    }
    alert("Quotation saved successfully!");
  };
  
  const handleNewButtonClick = () => { if (isReadOnly) return; setEditingQuotationId(null); const url = new URL(window.location.href); url.searchParams.delete('id'); window.history.pushState({}, '', url); }
  
  const handleAddProductFromSearch = (product: Product, discount: number) => {
    if (!formData) return;
    const priceEntry = getPriceForDate(product, formData.quotationDate);
    if (!priceEntry) { alert(`No valid price found for product ${product.partNo}. Cannot add.`); return; }
    const newQuotationItem: QuotationItem = { productId: product.id, partNo: product.partNo, description: product.description, moq: 1, req: 1, price: priceEntry.lp > 0 ? priceEntry.lp : priceEntry.sp, priceSource: priceEntry.lp > 0 ? 'LP' : 'SP', discount: discount, stockStatus: 'Ex-Stock', uom: product.uom, airFreight: false, airFreightDetails: { weightPerMtr: product.weight, airFreightLeadTime: '' }};
    const emptyItemIndex = formData.details.findIndex(item => !item.productId);
    const newDetails = [...formData.details];
    if (emptyItemIndex !== -1) newDetails[emptyItemIndex] = newQuotationItem;
    else newDetails.push(newQuotationItem);
    setFormData({ ...formData, details: newDetails });
    setIsProductSearchModalOpen(false);
  };
  
  const handlePreview = (type: 'standard' | 'discounted' | 'withAirFreight') => { if (!formData || !formData.customerId) { alert("Please select a customer before previewing."); return; } setPreviewMode(type); };

  const currentQuotationIndex = useMemo(() => editingQuotationId === null ? -1 : quotations.findIndex(q => q.id === editingQuotationId), [editingQuotationId, quotations]);

  const handleNavigation = (direction: 'first' | 'prev' | 'next' | 'last') => {
      if (quotations.length === 0) return;
      let newIndex = 0;
      if (direction === 'first') newIndex = 0;
      else if (direction === 'last') newIndex = quotations.length - 1;
      else if (direction === 'prev') newIndex = Math.max(0, currentQuotationIndex - 1);
      else if (direction === 'next') newIndex = Math.min(quotations.length - 1, currentQuotationIndex + 1);
      
      const newId = quotations[newIndex].id;
      setEditingQuotationId(newId);
      const url = new URL(window.location.href); url.searchParams.set('id', String(newId)); window.history.pushState({}, '', url);
  };
  
  const totals = useMemo(() => {
      if (!formData) return { moq: 0, req: 0, amount: 0, airFreightAmount: 0 };
      return formData.details.reduce((acc, item) => {
          const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
          acc.moq += item.moq || 0;
          acc.req += item.req || 0;
          acc.amount += unitPrice * item.moq || 0;
          acc.airFreightAmount += item.airFreight ? (item.airFreightDetails.weightPerMtr / 1000 * 150) * item.moq : 0;
          return acc;
      }, { moq: 0, req: 0, amount: 0, airFreightAmount: 0 });
  }, [formData]);

  const selectedCustomer = useMemo(() => customers.find(c => c.id === formData?.customerId), [customers, formData?.customerId]);
  const selectedSalesPerson = useMemo(() => salesPersons.find(sp => sp.id === formData?.salesPersonId), [salesPersons, formData?.salesPersonId]);

  if (previewMode !== 'none') {
    if (!formData || !selectedCustomer) return null;
    return (
        <div className="bg-gray-100 min-h-screen">
          <div className="bg-white shadow-md p-4 mb-4 flex justify-between items-center no-print sticky top-0 z-30">
            <h2 className="text-2xl font-bold text-gray-800">Quotation Preview</h2>
            <div className="flex items-center space-x-2">
              <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">Print</button>
              <button onClick={() => setPreviewMode('none')} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition duration-300">Close</button>
            </div>
          </div>
          <div id="print-area">
             {previewMode === 'standard' && <QuotationPrintView quotation={formData} customer={selectedCustomer} salesPerson={selectedSalesPerson}/>}
             {previewMode === 'discounted' && <QuotationPrintViewDiscounted quotation={formData} customer={selectedCustomer} salesPerson={selectedSalesPerson}/>}
             {previewMode === 'withAirFreight' && <QuotationPrintViewWithAirFreight quotation={formData} customer={selectedCustomer} salesPerson={selectedSalesPerson}/>}
          </div>
        </div>
    );
  }

  if (!formData) return <div className="p-8 text-center">Loading form...</div>;
  
  return (
    <div className="p-2 md:p-4 bg-gray-50 min-h-screen font-sans">
      <div className="bg-white rounded-lg shadow-lg">
        <header className="bg-gray-800 text-white p-2 flex justify-between items-center rounded-t-lg">
           <h1 className="text-lg font-bold">Quotation Details</h1>
           <div className="flex items-center space-x-2">
                <NavButton onClick={() => handleNavigation('first')} disabled={currentQuotationIndex <= 0}>|◀</NavButton>
                <NavButton onClick={() => handleNavigation('prev')} disabled={currentQuotationIndex <= 0}>◀</NavButton>
                <button onClick={() => setView('quotations')} className="bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg h-8 px-3 flex items-center justify-center font-bold text-lg">🏠</button>
                <NavButton onClick={() => handleNavigation('next')} disabled={currentQuotationIndex < 0 || currentQuotationIndex >= quotations.length - 1}>▶</NavButton>
                <NavButton onClick={() => handleNavigation('last')} disabled={currentQuotationIndex < 0 || currentQuotationIndex >= quotations.length - 1}>▶|</NavButton>
            </div>
        </header>
        
        <form onSubmit={handleSubmit} className="p-3 md:p-4">
            <div className="bg-gray-100 p-2 flex flex-wrap items-center gap-2 border border-gray-300 mb-4 rounded-md">
                {!isReadOnly && <button type="button" onClick={handleNewButtonClick} className="bg-white border border-gray-400 rounded px-3 py-1.5 text-sm flex items-center gap-1.5 hover:bg-gray-50"><span>📝</span>New</button>}
                {!isReadOnly && <button type="submit" className="bg-white border border-gray-400 rounded px-3 py-1.5 text-sm flex items-center gap-1.5 hover:bg-gray-50"><span>💾</span>Save</button>}
                <button type="button" onClick={() => handlePreview('standard')} className="bg-white border border-gray-400 rounded px-3 py-1.5 text-sm flex items-center gap-1.5 hover:bg-gray-50"><span>🖨️</span>Preview</button>
                <button type="button" onClick={() => handlePreview('discounted')} className="bg-white border border-gray-400 rounded px-3 py-1.5 text-sm flex items-center gap-1.5 hover:bg-gray-50"><span>🏷️</span>Discounted</button>
                <button type="button" onClick={() => handlePreview('withAirFreight')} className="bg-white border border-gray-400 rounded px-3 py-1.5 text-sm flex items-center gap-1.5 hover:bg-gray-50"><span>✈️</span>Air Freight</button>
                {!isReadOnly && <button type="button" onClick={() => setIsCustomerModalOpen(true)} className="bg-white border border-gray-400 rounded px-3 py-1.5 text-sm flex items-center gap-1.5 hover:bg-gray-50"><span>👥</span>Add Customer</button>}
                {!isReadOnly && <button type="button" onClick={() => setIsProductModalOpen(true)} className="bg-white border border-gray-400 rounded px-3 py-1.5 text-sm flex items-center gap-1.5 hover:bg-gray-50"><span>📦</span>Add Product</button>}
                {!isReadOnly && <button type="button" onClick={() => setIsProductSearchModalOpen(true)} className="bg-white border border-gray-400 rounded px-3 py-1.5 text-sm flex items-center gap-1.5 hover:bg-gray-50"><span>🔍</span>Search Product</button>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
                <div className="space-y-2">
                    <div className="flex items-center"><label className="w-1/3 bg-gray-200 p-2 font-semibold text-center rounded-l-md">Quotation ID</label><div className="w-2/3 p-2 bg-gray-100 font-bold rounded-r-md">{editingQuotationId ?? "{New}"}</div></div>
                    <div className="flex items-center"><label className="w-1/3 bg-gray-200 p-2 font-semibold text-center rounded-l-md">Quotation Date</label><input type="date" name="quotationDate" value={formData.quotationDate} onChange={handleChange} className="w-2/3 p-1.5 border border-gray-300 rounded-r-md" disabled={isReadOnly}/></div>
                    <div className="flex items-center"><label className="w-1/3 bg-gray-200 p-2 font-semibold text-center rounded-l-md">Enquiry Date</label><input type="date" name="enquiryDate" value={formData.enquiryDate} onChange={handleChange} className="w-2/3 p-1.5 border border-gray-300 rounded-r-md" disabled={isReadOnly}/></div>
                    <div className="flex items-start"><label className="w-1/3 bg-gray-200 p-2 font-semibold text-center rounded-l-md">Customer</label><div className={`w-2/3 border border-gray-300 rounded-r-md ${isReadOnly ? 'bg-gray-100' : ''}`}><SearchableSelect options={customers} value={formData.customerId} onChange={val => handleChange({ target: { name: 'customerId', value: String(val) } } as any)} idKey="id" displayKey="name" placeholder="Type to search customer..."/>{selectedCustomer && <div className="p-2 bg-gray-50 text-xs text-gray-600">{selectedCustomer.address}, {selectedCustomer.city} - {selectedCustomer.pincode}</div>}</div></div>
                </div>
                <div className="space-y-2">
                    <div className="flex items-center"><label className="w-1/3 bg-gray-200 p-2 font-semibold text-center rounded-l-md">Contact Name</label><input type="text" name="contactPerson" value={formData.contactPerson} onChange={handleChange} className="w-2/3 p-1.5 border border-gray-300 rounded-r-md" disabled={isReadOnly}/></div>
                    <div className="flex items-center"><label className="w-1/3 bg-gray-200 p-2 font-semibold text-center rounded-l-md">Contact No</label><input type="text" name="contactNumber" value={formData.contactNumber} onChange={handleChange} className="w-2/3 p-1.5 border border-gray-300 rounded-r-md" disabled={isReadOnly}/></div>
                    <div className="flex items-center"><label className="w-1/3 bg-gray-200 p-2 font-semibold text-center rounded-l-md">Other Terms</label><input type="text" name="otherTerms" value={formData.otherTerms} onChange={handleChange} className="w-2/3 p-1.5 border border-gray-300 rounded-r-md" disabled={isReadOnly}/></div>
                    <div className="flex items-center"><label className="w-1/3 bg-gray-200 p-2 font-semibold text-center rounded-l-md">Payment</label><select name="paymentTerms" value={formData.paymentTerms} onChange={handleChange} className="w-2/3 p-1.5 border border-gray-300 bg-white rounded-r-md disabled:bg-gray-100" disabled={isReadOnly}>{PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    <div className="flex items-center"><label className="w-1/3 bg-gray-200 p-2 font-semibold text-center rounded-l-md">Prepared By</label><select name="preparedBy" value={formData.preparedBy} onChange={handleChange} className="w-2/3 p-1.5 border border-gray-300 bg-white rounded-r-md disabled:bg-gray-100" disabled={isReadOnly}>{PREPARED_BY_LIST.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                    <div className="flex items-center"><label className="w-1/3 bg-gray-200 p-2 font-semibold text-center rounded-l-md">Products</label><select name="productsBrand" value={formData.productsBrand} onChange={handleChange} className="w-2/3 p-1.5 border border-gray-300 bg-white rounded-r-md disabled:bg-gray-100" disabled={isReadOnly}>{PRODUCTS_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                </div>
                <div className="space-y-2">
                    <div className="flex items-center"><label className="w-1/3 bg-gray-200 p-2 font-semibold text-center rounded-l-md">Sales Person</label><select name="salesPersonId" value={formData.salesPersonId} onChange={handleChange} className="w-2/3 p-1.5 border border-gray-300 bg-white rounded-r-md disabled:bg-gray-100" disabled={isReadOnly}><option value="">Select...</option>{salesPersons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                    <div className="flex items-center"><label className="w-1/3 bg-gray-200 p-2 font-semibold text-center rounded-l-md">Enquiry Mode</label><select name="modeOfEnquiry" value={formData.modeOfEnquiry} onChange={handleChange} className="w-2/3 p-1.5 border border-gray-300 bg-white rounded-r-md disabled:bg-gray-100" disabled={isReadOnly}>{MODES_OF_ENQUIRY.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                    <div className="flex items-center"><label className="w-1/3 bg-gray-200 p-2 font-semibold text-center rounded-l-md">Status</label><select name="status" value={formData.status} onChange={handleChange} className="w-2/3 p-1.5 border border-gray-300 bg-white rounded-r-md disabled:bg-gray-100" disabled={isReadOnly}>{QUOTATION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    {selectedCustomer && <fieldset className="border-2 border-gray-200 p-2 space-y-1 rounded-md"><legend className="font-bold text-gray-700 px-1 text-xs">Customer Discounts</legend>{Object.entries(selectedCustomer.discountStructure).map(([key, value]) => <div key={key} className="flex items-center text-xs"><label className="w-1/2 bg-gray-200 text-gray-800 p-1 text-center rounded-l-sm capitalize">{key.replace(/([A-Z])/g, ' $1')}</label><div className="w-1/2 p-1 bg-gray-100 rounded-r-sm">{value}%</div></div>)}</fieldset>}
                </div>
            </div>

            <div className="mt-6 overflow-x-auto">
                <table className="min-w-full border-collapse border border-gray-300">
                    <thead className="bg-gray-200 text-gray-600 text-xs"><tr className="divide-x divide-gray-300">{['Part No', 'Description', 'MOQ', 'REQ', 'Price', 'Discount %', 'Unit Price', 'Amount', 'Stock Status', 'Air Freight?', 'Weight/Mtr', 'Freight/Mtr', 'Total Freight', 'Lead Time', ''].map(h=><th key={h} className="p-2 font-semibold">{h}</th>)}</tr></thead>
                    <tbody className="bg-white text-xs"><tr className="h-2"></tr>{formData.details.map((item, index) => {const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100); const amount = unitPrice * (item.moq || 0); const freightPerMtr = (item.airFreightDetails.weightPerMtr / 1000) * 150; const freightTotal = item.airFreight ? freightPerMtr * (item.moq || 0) : 0; return (<tr key={index} className="divide-x divide-gray-200"><td className={`border-t border-gray-300 w-48 ${isReadOnly ? 'bg-gray-100' : ''}`}><SearchableSelect options={products} value={item.productId} onChange={val => handleProductSelect(index, val)} idKey="id" displayKey="partNo" placeholder="Type to search..."/></td><td className="border-t border-gray-300 p-1 min-w-[200px] truncate">{item.description}</td><td className="border-t border-gray-300"><input type="number" value={item.moq} onChange={e => handleItemChange(index, 'moq', parseInt(e.target.value) || 0)} className="w-16 p-1 text-center disabled:bg-gray-100" disabled={isReadOnly}/></td><td className="border-t border-gray-300"><input type="number" value={item.req} onChange={e => handleItemChange(index, 'req', parseInt(e.target.value) || 0)} className="w-16 p-1 text-center disabled:bg-gray-100" disabled={isReadOnly}/></td><td className="border-t border-gray-300"><div className="flex items-center"><input type="number" step="0.01" value={item.price.toFixed(2)} className="w-20 p-1 text-right flex-grow bg-gray-100" disabled/><select value={item.priceSource} className="bg-gray-100 border-l p-1" disabled><option value="LP">LP</option><option value="SP">SP</option></select></div></td><td className="border-t border-gray-300"><input type="text" value={item.discount} onChange={e => handleItemChange(index, 'discount', e.target.value)} className="w-16 p-1 text-center disabled:bg-gray-100" disabled={isReadOnly}/></td><td className="border-t border-gray-300 p-1 text-right bg-gray-50">{unitPrice.toFixed(2)}</td><td className="border-t border-gray-300 p-1 text-right bg-gray-50">{amount.toFixed(2)}</td><td className="border-t border-gray-300"><input type="text" value={item.stockStatus} onChange={e => handleItemChange(index, 'stockStatus', e.target.value)} className="w-24 p-1 disabled:bg-gray-100" disabled={isReadOnly}/></td><td className="border-t border-gray-300 text-center"><input type="checkbox" checked={item.airFreight} onChange={e => handleItemChange(index, 'airFreight', e.target.checked)} className="h-4 w-4 disabled:bg-gray-100" disabled={isReadOnly}/></td><td className="border-t border-gray-300"><input type="number" step="0.001" value={item.airFreightDetails.weightPerMtr} onChange={e => handleItemChange(index, 'airFreightDetails.weightPerMtr', parseFloat(e.target.value) || 0)} className="w-20 p-1 text-right disabled:bg-gray-100" disabled={!item.airFreight || isReadOnly}/></td><td className="border-t border-gray-300 p-1 text-right bg-gray-50">{freightPerMtr.toFixed(2)}</td><td className="border-t border-gray-300 p-1 text-right bg-gray-50">{freightTotal.toFixed(2)}</td><td className="border-t border-gray-300"><input type="text" value={item.airFreightDetails.airFreightLeadTime} onChange={e => handleItemChange(index, 'airFreightDetails.airFreightLeadTime', e.target.value)} className="w-24 p-1 disabled:bg-gray-100" disabled={!item.airFreight || isReadOnly}/></td><td className="border-t border-gray-300 text-center">{!isReadOnly && <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700 font-bold p-1">✕</button>}</td></tr>);})}</tbody>
                    <tfoot className="bg-gray-200 text-gray-800 font-bold text-xs"><tr className="divide-x divide-gray-300"><td colSpan={2} className="p-2 text-center">Total</td><td className="p-2 text-center">{totals.moq}</td><td className="p-2 text-center">{totals.req}</td><td colSpan={3}></td><td className="p-2 text-right">{totals.amount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td colSpan={4}></td><td className="p-2 text-right">{totals.airFreightAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td colSpan={2}></td></tr></tfoot>
                </table>
            </div>
             <div className="flex justify-end mt-2">{!isReadOnly && <button type="button" onClick={handleAddItem} className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-1 px-3 text-sm rounded">+ Add Row</button>}</div>
        </form>
      </div>
      <CustomerAddModal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} onSave={handleSaveCustomer} salesPersons={salesPersons} customers={customers}/>
      <ProductAddModal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} onSave={handleSaveProduct} products={products}/>
      <ProductSearchModal isOpen={isProductSearchModalOpen} onClose={() => setIsProductSearchModalOpen(false)} products={products} onSelect={handleAddProductFromSearch}/>
    </div>
  );
};
