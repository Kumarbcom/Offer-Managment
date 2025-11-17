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
    <button type="button" onClick={onClick} disabled={disabled} className="bg-slate-700 hover:bg-slate-600 text-white rounded-md h-8 w-10 flex items-center justify-center font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
        {children}
    </button>
);

const ActionButton: React.FC<{ onClick: () => void; disabled?: boolean; children: React.ReactNode, title: string }> = ({ onClick, disabled, children, title }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className="flex items-center gap-2 bg-white border border-slate-300 rounded-md px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
        {children}
    </button>
);

const Icons = {
    New: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>,
    Save: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" /></svg>,
    PrintStandard: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" /></svg>,
    PrintDiscount: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a1 1 0 011-1h14a1 1 0 011 1v5a.997.997 0 01-.293.707zM11 5H9v2H7v2h2v2h2v-2h2V7h-2V5z" clipRule="evenodd" /></svg>,
    PrintAirFreight: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>,
    AddCustomer: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 11a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1v-1z" /></svg>,
    AddProduct: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /><path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" /></svg>,
    SearchProduct: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>,
    Trash: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>,
};

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
        if (customer && customer.salesPersonId && formData.salesPersonId !== customer.salesPersonId) {
            setFormData(prev => prev ? {...prev, salesPersonId: customer.salesPersonId} : null);
        }
    }
  }, [formData?.customerId, customers, formData?.salesPersonId]);

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
                    const priceSource: 'LP' | 'SP' = priceEntry ? (priceEntry.lp > 0 ? 'LP' : 'SP') : 'LP';
                    return { ...item, price: newPrice, priceSource: priceSource };
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
    let productToUpdate: { productId: number, newWeight: number } | null = null;
    
    setFormData(prev => {
        if (!prev) return null;
        const newDetails = prev.details.map((item, i) => {
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
        return { ...prev, details: newDetails };
    });

    if (productToUpdate) {
        await setProducts(prevProducts => prevProducts.map(p => p.id === productToUpdate!.productId ? {...p, weight: productToUpdate!.newWeight} : p));
    }
  };

  const handleAddItem = () => { setFormData(prev => prev ? { ...prev, details: [...prev.details, createEmptyQuotationItem()] } : null); };
  const handleRemoveItem = (index: number) => { setFormData(prev => prev && prev.details.length > 1 ? { ...prev, details: prev.details.filter((_, i) => i !== index) } : prev); };
  const handleSaveCustomer = async (newCustomer: Customer) => { await setCustomers(prev => [...prev.filter(c => c.id !== newCustomer.id), newCustomer]); setFormData(prev => prev ? { ...prev, customerId: newCustomer.id } : null); setIsCustomerModalOpen(false); };
  const handleSaveProduct = async (newProduct: Product) => { await setProducts(prev => [...prev.filter(p => p.id !== newProduct.id), newProduct]); setIsProductModalOpen(false); };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
    setFormData(prev => {
        if (!prev) return null;
        const priceEntry = getPriceForDate(product, prev.quotationDate);
        if (!priceEntry) { alert(`No valid price found for product ${product.partNo}. Cannot add.`); return prev; }
        const newQuotationItem: QuotationItem = { productId: product.id, partNo: product.partNo, description: product.description, moq: 1, req: 1, price: priceEntry.lp > 0 ? priceEntry.lp : priceEntry.sp, priceSource: priceEntry.lp > 0 ? 'LP' : 'SP', discount: discount, stockStatus: 'Ex-Stock', uom: product.uom, airFreight: false, airFreightDetails: { weightPerMtr: product.weight, airFreightLeadTime: '' }};
        const emptyItemIndex = prev.details.findIndex(item => !item.productId);
        const newDetails = [...prev.details];
        if (emptyItemIndex !== -1) newDetails[emptyItemIndex] = newQuotationItem;
        else newDetails.push(newQuotationItem);
        setIsProductSearchModalOpen(false);
        return { ...prev, details: newDetails };
    });
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
        <div className="bg-slate-100 min-h-screen">
          <div className="bg-white shadow-md p-4 mb-4 flex justify-between items-center no-print sticky top-0 z-30">
            <h2 className="text-2xl font-bold text-slate-800">Quotation Preview</h2>
            <div className="flex items-center space-x-2">
              <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">Print</button>
              <button onClick={() => setPreviewMode('none')} className="bg-slate-500 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-md transition duration-300">Close</button>
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
  
  const FormField: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
    <div className={`flex items-stretch ${className}`}>
        <label className="w-1/3 bg-slate-100 text-slate-600 font-semibold text-sm flex items-center justify-center text-center p-2 rounded-l-md border border-r-0 border-slate-300">
            {label}
        </label>
        <div className="w-2/3">{children}</div>
    </div>
  );

  return (
    <div className="p-2 md:p-4 bg-slate-50 min-h-screen font-sans">
      <div className="bg-white rounded-lg shadow-lg">
        <header className="bg-slate-800 text-white p-2 flex justify-between items-center rounded-t-lg">
           <h1 className="text-lg font-bold">Quotation Details</h1>
           <div className="flex items-center space-x-2">
                <NavButton onClick={() => handleNavigation('first')} disabled={currentQuotationIndex <= 0}>|◀</NavButton>
                <NavButton onClick={() => handleNavigation('prev')} disabled={currentQuotationIndex <= 0}>◀</NavButton>
                <button onClick={() => setView('quotations')} className="bg-blue-500 hover:bg-blue-400 text-white rounded-md h-8 px-3 flex items-center justify-center font-bold text-base" title="Back to Quotations List">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
                </button>
                <NavButton onClick={() => handleNavigation('next')} disabled={currentQuotationIndex < 0 || currentQuotationIndex >= quotations.length - 1}>▶</NavButton>
                <NavButton onClick={() => handleNavigation('last')} disabled={currentQuotationIndex < 0 || currentQuotationIndex >= quotations.length - 1}>▶|</NavButton>
            </div>
        </header>
        
        <form onSubmit={handleSubmit} className="p-3 md:p-4">
            <div className="bg-slate-50 p-2 flex flex-wrap items-center gap-2 border border-slate-200 mb-4 rounded-md">
                {!isReadOnly && <ActionButton onClick={handleNewButtonClick} title="New Quotation"><Icons.New /><span>New</span></ActionButton>}
                {!isReadOnly && <ActionButton onClick={handleSubmit} title="Save Quotation"><Icons.Save /><span>Save</span></ActionButton>}
                <ActionButton onClick={() => handlePreview('standard')} title="Preview Standard"><Icons.PrintStandard /><span>Preview</span></ActionButton>
                <ActionButton onClick={() => handlePreview('discounted')} title="Preview with Discount"><Icons.PrintDiscount /><span>Discounted</span></ActionButton>
                <ActionButton onClick={() => handlePreview('withAirFreight')} title="Preview with Air Freight"><Icons.PrintAirFreight /><span>Air Freight</span></ActionButton>
                <div className="h-6 border-l border-slate-300 mx-2"></div>
                {!isReadOnly && <ActionButton onClick={() => setIsCustomerModalOpen(true)} title="Add New Customer"><Icons.AddCustomer /><span>Customer</span></ActionButton>}
                {!isReadOnly && <ActionButton onClick={() => setIsProductModalOpen(true)} title="Add New Product"><Icons.AddProduct /><span>Product</span></ActionButton>}
                {!isReadOnly && <ActionButton onClick={() => setIsProductSearchModalOpen(true)} title="Search Product"><Icons.SearchProduct /><span>Search</span></ActionButton>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
                <div className="space-y-2">
                    <FormField label="Quotation ID"><div className="p-2 bg-slate-50 font-bold text-slate-800 rounded-r-md border border-slate-300 h-full flex items-center">{editingQuotationId ?? "{New}"}</div></FormField>
                    <FormField label="Quotation Date"><input type="date" name="quotationDate" value={formData.quotationDate} onChange={handleChange} className="w-full p-1.5 border border-slate-300 rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 h-full" disabled={isReadOnly}/></FormField>
                    <FormField label="Enquiry Date"><input type="date" name="enquiryDate" value={formData.enquiryDate} onChange={handleChange} className="w-full p-1.5 border border-slate-300 rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 h-full" disabled={isReadOnly}/></FormField>
                    <FormField label="Customer" className='items-start'><div className={`border border-slate-300 rounded-r-md ${isReadOnly ? 'bg-slate-100' : ''}`}><SearchableSelect options={customers} value={formData.customerId} onChange={val => handleChange({ target: { name: 'customerId', value: String(val) } } as any)} idKey="id" displayKey="name" placeholder="Type to search customer..."/>{selectedCustomer && <div className="p-2 bg-slate-50 text-xs text-slate-600 border-t border-slate-200">{selectedCustomer.address}, {selectedCustomer.city} - {selectedCustomer.pincode}</div>}</div></FormField>
                </div>
                <div className="space-y-2">
                    <FormField label="Contact Name"><input type="text" name="contactPerson" value={formData.contactPerson} onChange={handleChange} className="w-full p-1.5 border border-slate-300 rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 h-full" disabled={isReadOnly}/></FormField>
                    <FormField label="Contact No"><input type="text" name="contactNumber" value={formData.contactNumber} onChange={handleChange} className="w-full p-1.5 border border-slate-300 rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 h-full" disabled={isReadOnly}/></FormField>
                    <FormField label="Other Terms"><input type="text" name="otherTerms" value={formData.otherTerms} onChange={handleChange} className="w-full p-1.5 border border-slate-300 rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 h-full" disabled={isReadOnly}/></FormField>
                    <FormField label="Payment"><select name="paymentTerms" value={formData.paymentTerms} onChange={handleChange} className="w-full p-1.5 border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 h-full disabled:bg-slate-100" disabled={isReadOnly}>{PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}</select></FormField>
                    <FormField label="Prepared By"><select name="preparedBy" value={formData.preparedBy} onChange={handleChange} className="w-full p-1.5 border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 h-full disabled:bg-slate-100" disabled={isReadOnly}>{PREPARED_BY_LIST.map(p => <option key={p} value={p}>{p}</option>)}</select></FormField>
                    <FormField label="Products"><select name="productsBrand" value={formData.productsBrand} onChange={handleChange} className="w-full p-1.5 border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 h-full disabled:bg-slate-100" disabled={isReadOnly}>{PRODUCTS_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}</select></FormField>
                </div>
                <div className="space-y-2">
                    <FormField label="Sales Person"><select name="salesPersonId" value={formData.salesPersonId} onChange={handleChange} className="w-full p-1.5 border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 h-full disabled:bg-slate-100" disabled={isReadOnly}><option value="">Select...</option>{salesPersons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></FormField>
                    <FormField label="Enquiry Mode"><select name="modeOfEnquiry" value={formData.modeOfEnquiry} onChange={handleChange} className="w-full p-1.5 border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 h-full disabled:bg-slate-100" disabled={isReadOnly}>{MODES_OF_ENQUIRY.map(m => <option key={m} value={m}>{m}</option>)}</select></FormField>
                    <FormField label="Status"><select name="status" value={formData.status} onChange={handleChange} className="w-full p-1.5 border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 h-full disabled:bg-slate-100" disabled={isReadOnly}>{QUOTATION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></FormField>
                    {selectedCustomer && <fieldset className="border-2 border-slate-200 p-2 space-y-1 rounded-md"><legend className="font-bold text-slate-700 px-1 text-xs">Customer Discounts</legend>{Object.entries(selectedCustomer.discountStructure).map(([key, value]) => <div key={key} className="flex items-center text-xs"><label className="w-1/2 bg-slate-200 text-slate-800 p-1 text-center rounded-l-sm capitalize">{key.replace(/([A-Z])/g, ' $1')}</label><div className="w-1/2 p-1 bg-slate-100 rounded-r-sm font-medium">{value}%</div></div>)}</fieldset>}
                </div>
            </div>

            <div className="mt-6 overflow-x-auto">
                <table className="min-w-full border-collapse border border-slate-300">
                    <thead className="bg-slate-200 text-slate-700 text-xs font-semibold"><tr className="divide-x divide-slate-300">{['Part No', 'Description', 'MOQ', 'REQ', 'Price', 'Discount %', 'Unit Price', 'Amount', 'Stock Status', 'Air Freight?', 'Weight/Mtr', 'Freight/Mtr', 'Total Freight', 'Lead Time', ''].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead>
                    <tbody className="bg-white text-xs">{formData.details.map((item, index) => {const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100); const amount = unitPrice * (item.moq || 0); const freightPerMtr = (item.airFreightDetails.weightPerMtr / 1000) * 150; const freightTotal = item.airFreight ? freightPerMtr * (item.moq || 0) : 0; return (<tr key={index} className="divide-x divide-slate-200 hover:bg-slate-50"><td className="border-t border-slate-300 w-48 align-top p-1 text-slate-800 font-medium bg-slate-50">{item.partNo || <span className="text-slate-400">Select product...</span>}</td><td className="border-t border-slate-300 p-1 min-w-[200px] align-top text-slate-600">{item.description}</td><td className="border-t border-slate-300 align-top"><input type="number" value={item.moq} onChange={e => handleItemChange(index, 'moq', parseInt(e.target.value) || 0)} className="w-16 p-1 text-center border-transparent hover:border-slate-300 focus:border-blue-500 rounded disabled:bg-slate-100" disabled={isReadOnly}/></td><td className="border-t border-slate-300 align-top"><input type="number" value={item.req} onChange={e => handleItemChange(index, 'req', parseInt(e.target.value) || 0)} className="w-16 p-1 text-center border-transparent hover:border-slate-300 focus:border-blue-500 rounded disabled:bg-slate-100" disabled={isReadOnly}/></td><td className="border-t border-slate-300 align-top"><div className="flex items-center bg-slate-100"><input type="number" step="0.01" value={item.price.toFixed(2)} className="w-20 p-1 text-right flex-grow bg-transparent" disabled/><select value={item.priceSource} className="bg-transparent border-l border-slate-200 p-1 text-slate-500" disabled><option value="LP">LP</option><option value="SP">SP</option></select></div></td><td className="border-t border-slate-300 align-top"><input type="text" value={item.discount} onChange={e => handleItemChange(index, 'discount', e.target.value)} className="w-16 p-1 text-center border-transparent hover:border-slate-300 focus:border-blue-500 rounded disabled:bg-slate-100" disabled={isReadOnly}/></td><td className="border-t border-slate-300 p-1 text-right bg-slate-100 align-top font-medium">{unitPrice.toFixed(2)}</td><td className="border-t border-slate-300 p-1 text-right bg-slate-100 align-top font-medium">{amount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td className="border-t border-slate-300 align-top"><input type="text" value={item.stockStatus} onChange={e => handleItemChange(index, 'stockStatus', e.target.value)} className="w-24 p-1 border-transparent hover:border-slate-300 focus:border-blue-500 rounded disabled:bg-slate-100" disabled={isReadOnly}/></td><td className="border-t border-slate-300 text-center align-top pt-1"><input type="checkbox" checked={item.airFreight} onChange={e => handleItemChange(index, 'airFreight', e.target.checked)} className="h-4 w-4 disabled:bg-slate-100" disabled={isReadOnly}/></td><td className="border-t border-slate-300 align-top"><input type="number" step="0.001" value={item.airFreightDetails.weightPerMtr} onChange={e => handleItemChange(index, 'airFreightDetails.weightPerMtr', parseFloat(e.target.value) || 0)} className="w-20 p-1 text-right border-transparent hover:border-slate-300 focus:border-blue-500 rounded disabled:bg-slate-100" disabled={!item.airFreight || isReadOnly}/></td><td className="border-t border-slate-300 p-1 text-right bg-slate-100 align-top">{freightPerMtr.toFixed(2)}</td><td className="border-t border-slate-300 p-1 text-right bg-slate-100 align-top font-medium">{freightTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td className="border-t border-slate-300 align-top"><input type="text" value={item.airFreightDetails.airFreightLeadTime} onChange={e => handleItemChange(index, 'airFreightDetails.airFreightLeadTime', e.target.value)} className="w-24 p-1 border-transparent hover:border-slate-300 focus:border-blue-500 rounded disabled:bg-slate-100" disabled={!item.airFreight || isReadOnly}/></td><td className="border-t border-slate-300 text-center align-middle">{!isReadOnly && <button type="button" onClick={() => handleRemoveItem(index)} className="text-rose-500 hover:text-rose-700 p-1 transition-colors" title="Remove Item"><Icons.Trash /></button>}</td></tr>);})}</tbody>
                    <tfoot className="bg-slate-200 text-slate-800 font-bold text-xs"><tr className="divide-x divide-slate-300"><td colSpan={2} className="p-2 text-center">Total</td><td className="p-2 text-center">{totals.moq}</td><td className="p-2 text-center">{totals.req}</td><td colSpan={3}></td><td className="p-2 text-right">{totals.amount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td colSpan={4}></td><td className="p-2 text-right">{totals.airFreightAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td colSpan={2}></td></tr></tfoot>
                </table>
            </div>
             <div className="flex justify-end mt-2">{!isReadOnly && <button type="button" onClick={handleAddItem} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 text-sm rounded">+ Add Row</button>}</div>
        </form>
      </div>
      <CustomerAddModal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} onSave={handleSaveCustomer} salesPersons={salesPersons} customers={customers}/>
      <ProductAddModal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} onSave={handleSaveProduct} products={products}/>
      <ProductSearchModal isOpen={isProductSearchModalOpen} onClose={() => setIsProductSearchModalOpen(false)} products={products} onSelect={handleAddProductFromSearch}/>
    </div>
  );
};
