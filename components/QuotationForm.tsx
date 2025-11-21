import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Quotation, QuotationItem, Customer, SalesPerson, Product, View, UserRole, PriceEntry, PreparedBy } from '../types';
import { PAYMENT_TERMS, PREPARED_BY_LIST, PRODUCTS_BRANDS, MODES_OF_ENQUIRY, QUOTATION_STATUSES } from '../constants';
import { CustomerAddModal } from './CustomerAddModal';
import { ProductAddModal } from './ProductAddModal';
import { ProductSearchModal } from './ProductSearchModal';
import { SearchableSelect } from './common/SearchableSelect';
import { QuotationPrintView } from './QuotationPrintView';
import { QuotationPrintViewDiscounted } from './QuotationPrintViewDiscounted';
import { QuotationPrintViewWithAirFreight } from './QuotationPrintViewWithAirFreight';
import { useDebounce } from '../hooks/useDebounce';
import { searchProducts, addProductsBatch, updateProduct, getProductsByIds, upsertCustomer, searchCustomers, getCustomersByIds } from '../supabase';

declare var XLSX: any;

interface QuotationFormProps {
  salesPersons: SalesPerson[];
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
    <button type="button" onClick={onClick} disabled={disabled} className="bg-slate-700 hover:bg-slate-600 text-white rounded-md h-6 w-8 flex items-center justify-center font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
        {children}
    </button>
);

const ActionButton: React.FC<{ onClick: () => void; disabled?: boolean; children: React.ReactNode, title: string }> = ({ onClick, disabled, children, title }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className="flex items-center gap-1 bg-white border border-slate-300 rounded-md px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
        {children}
    </button>
);

const Icons = {
    New: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>,
    Save: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" /></svg>,
    PrintStandard: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" /></svg>,
    PrintDiscount: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a1 1 0 011-1h14a1 1 0 011 1v5a.997.997 0 01-.293.707zM11 5H9v2H7v2h2v2h2v-2h2V7h-2V5z" clipRule="evenodd" /></svg>,
    PrintAirFreight: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>,
    AddCustomer: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 11a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1v-1z" /></svg>,
    AddProduct: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /><path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" /></svg>,
    SearchProduct: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>,
    Trash: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>,
    Excel: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>,
};

const FormField: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
    <div className={`flex items-stretch h-7 ${className}`}>
        <label className="w-1/3 bg-slate-100 text-slate-600 font-semibold text-[10px] uppercase tracking-wide flex items-center justify-center text-center px-1 rounded-l-md border border-r-0 border-slate-300 leading-tight whitespace-normal">
            {label}
        </label>
        <div className="w-2/3 h-full relative group text-xs">{children}</div>
    </div>
);

export const QuotationForm: React.FC<QuotationFormProps> = ({
  salesPersons, quotations, setQuotations, setView, editingQuotationId, setEditingQuotationId, userRole
}) => {
  const [formData, setFormData] = useState<Quotation | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isProductSearchModalOpen, setIsProductSearchModalOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<'none' | 'standard' | 'discounted' | 'withAirFreight'>('none');
  
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [searchedProducts, setSearchedProducts] = useState<Product[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const debouncedProductSearchTerm = useDebounce(productSearchTerm, 300);
  const [fetchedProducts, setFetchedProducts] = useState<Map<number, Product>>(new Map());

  // State for async customer search
  const [searchedCustomers, setSearchedCustomers] = useState<Customer[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const debouncedCustomerSearchTerm = useDebounce(customerSearchTerm, 300);
  const [selectedCustomerObj, setSelectedCustomerObj] = useState<Customer | null>(null);

  // Refs for grid inputs
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

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
    const safeQuotations = quotations || [];
    const newId = safeQuotations.length > 0 ? Math.max(...safeQuotations.map(q => q.id)) + 1 : 1;
    return {
      id: newId,
      quotationDate: getTodayDateString(),
      enquiryDate: getTodayDateString(),
      customerId: null,
      contactPerson: '',
      contactNumber: '',
      otherTerms: '± 5% Length Variation',
      paymentTerms: '100% Against Proforma Invoice',
      preparedBy: 'Kumar' as PreparedBy,
      productsBrand: 'Lapp',
      salesPersonId: null,
      modeOfEnquiry: 'Customer Email',
      status: 'Open',
      comments: '',
      details: [createEmptyQuotationItem()],
    };
  }, [quotations]);
  
  const handleCustomerOpen = useCallback(() => {
    if (searchedCustomers.length === 0 && !isSearchingCustomers) {
        setIsSearchingCustomers(true);
        searchCustomers('').then(results => {
            setSearchedCustomers(results);
            setIsSearchingCustomers(false);
        }).catch(err => {
            console.error(err);
            setIsSearchingCustomers(false);
        });
    }
  }, [searchedCustomers.length, isSearchingCustomers]);

  const handleProductOpen = useCallback(() => {
      if (searchedProducts.length === 0 && !isSearchingProducts) {
          setIsSearchingProducts(true);
          searchProducts('').then(results => {
              setSearchedProducts(results);
              setIsSearchingProducts(false);
          }).catch(err => {
              console.error(err);
              setIsSearchingProducts(false);
          });
      }
  }, [searchedProducts.length, isSearchingProducts]);

  useEffect(() => {
    const quotationToEdit = quotations.find(q => q.id === editingQuotationId);
    // Use structured clone or deep copy to avoid mutating state directly if objects are shared
    let initialQuotation = quotationToEdit ? JSON.parse(JSON.stringify(quotationToEdit)) : createNewQuotation();
    
    // Sanitize and patch missing fields for legacy data to prevent Uncaught TypeErrors
    if (initialQuotation.details) {
        initialQuotation.details = initialQuotation.details.map((item: QuotationItem) => ({
            ...item,
            airFreightDetails: item.airFreightDetails || { weightPerMtr: 0, airFreightLeadTime: '' }
        }));
    }
    // Check discount structure to prevent errors if missing
    if (initialQuotation.customerId) {
        // We let the customer load effect handle patching if needed, but we ensure it's safe to render
    }

    setFormData(initialQuotation);

    if (initialQuotation.details) {
        const productIds = initialQuotation.details.map((d: QuotationItem) => d.productId).filter((id: number) => id > 0);
        if (productIds.length > 0) {
            getProductsByIds(productIds).then(products => {
                setFetchedProducts(new Map(products.map(p => [p.id, p])));
            }).catch(error => console.error("QuotationForm: Failed to fetch product details:", error));
        } else {
            setFetchedProducts(new Map());
        }
    }
  }, [editingQuotationId, quotations, createNewQuotation]);

  useEffect(() => {
    const customerId = formData?.customerId;
    if (customerId && (!selectedCustomerObj || selectedCustomerObj.id !== customerId)) {
      getCustomersByIds([customerId]).then(customers => {
        if (customers.length > 0) {
          setSelectedCustomerObj(customers[0]);
          setSearchedCustomers(prev => {
            if (prev.some(c => c.id === customers[0].id)) return prev;
            return [customers[0], ...prev];
          });
        }
      }).catch(error => console.error("QuotationForm: Failed to fetch selected customer:", error));
    } else if (!customerId) {
      setSelectedCustomerObj(null);
    }
  }, [formData?.customerId, selectedCustomerObj]);

  useEffect(() => {
    if (selectedCustomerObj && selectedCustomerObj.salesPersonId) {
        setFormData(prev => prev ? {...prev, salesPersonId: selectedCustomerObj.salesPersonId} : null);
    }
  }, [selectedCustomerObj]);

  useEffect(() => {
    if (!formData || !formData.details?.length || fetchedProducts.size === 0) return;
    let wasUpdated = false;
    const newDetails = formData.details.map(item => {
        if (item.productId > 0) {
            const product = fetchedProducts.get(item.productId);
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
  }, [formData?.quotationDate, fetchedProducts, getPriceForDate, formData?.details]);

  useEffect(() => {
    const performSearch = async () => {
      setIsSearchingProducts(true);
      const results = await searchProducts(debouncedProductSearchTerm);
      setSearchedProducts(results);
      setIsSearchingProducts(false);
    };
    performSearch();
  }, [debouncedProductSearchTerm]);
  
  useEffect(() => {
    const performSearch = async () => {
      setIsSearchingCustomers(true);
      const results = await searchCustomers(debouncedCustomerSearchTerm);
      if (selectedCustomerObj && !results.some(c => c.id === selectedCustomerObj.id)) {
        setSearchedCustomers([selectedCustomerObj, ...results]);
      } else {
        setSearchedCustomers(results);
      }
      setIsSearchingCustomers(false);
    };
    performSearch();
  }, [debouncedCustomerSearchTerm, selectedCustomerObj]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const isNumericId = name === 'salesPersonId';
    setFormData(prev => prev ? { ...prev, [name]: isNumericId ? (value ? parseInt(value) : null) : value } : null);
  };
  
  const handleItemChange = async (index: number, field: keyof QuotationItem | `airFreightDetails.${keyof QuotationItem['airFreightDetails']}`, value: any) => {
    setFormData(prev => {
        if (!prev) return null;
        const newDetails = prev.details.map((item, i) => {
            if (i === index) {
                const updatedItem = { ...item };
                if (!updatedItem.airFreightDetails) updatedItem.airFreightDetails = { weightPerMtr: 0, airFreightLeadTime: '' }; // Safety init
                
                if (field.startsWith('airFreightDetails.')) {
                    const subField = field.split('.')[1] as keyof QuotationItem['airFreightDetails'];
                    updatedItem.airFreightDetails = { ...updatedItem.airFreightDetails, [subField]: value };
                } else { (updatedItem as any)[field] = value; }
                
                if (field === 'airFreightDetails.weightPerMtr') {
                    const product = fetchedProducts.get(updatedItem.productId);
                    if (product && product.weight !== value) {
                        updateProduct({ ...product, weight: value });
                    }
                }
                if (field === 'airFreight' && value === false) updatedItem.airFreightDetails.airFreightLeadTime = '';
                return updatedItem;
            }
            return item;
        });
        return { ...prev, details: newDetails };
    });
  };
  
  const handleProductSelect = (index: number, productId: number | string | null) => {
    if (!productId) {
        // Handle clear
        setFormData(prevFormData => {
            if (!prevFormData) return null;
            const newDetails = [...prevFormData.details];
            newDetails[index] = createEmptyQuotationItem();
            return { ...prevFormData, details: newDetails };
        });
        return;
    }
    setFormData(prevFormData => {
        if (!prevFormData) return null;
        const numericProductId = Number(productId);
        const product = searchedProducts.find(p => p.id === numericProductId);
        if (product) {
            setFetchedProducts(prev => new Map(prev).set(product.id, product));
            const priceEntry = getPriceForDate(product, prevFormData.quotationDate);
            if (!priceEntry) alert(`No valid price found for product ${product.partNo} on date ${prevFormData.quotationDate ? new Date(prevFormData.quotationDate).toLocaleDateString() : 'N/A'}. Please check product price validity.`);
            const newDetails = [...prevFormData.details];
            newDetails[index] = { ...newDetails[index], productId: product.id, partNo: product.partNo, description: product.description, price: priceEntry ? (priceEntry.lp > 0 ? priceEntry.lp : priceEntry.sp) : 0, priceSource: priceEntry ? (priceEntry.lp > 0 ? 'LP' : 'SP') : 'LP', uom: product.uom, airFreightDetails: { ...newDetails[index].airFreightDetails, weightPerMtr: product.weight }};
            return { ...prevFormData, details: newDetails };
        }
        return prevFormData;
    });
  }

  const handleAddItem = () => { setFormData(prev => prev ? { ...prev, details: [...prev.details, createEmptyQuotationItem()] } : null); };
  const handleRemoveItem = (index: number) => { setFormData(prev => prev && prev.details.length > 1 ? { ...prev, details: prev.details.filter((_, i) => i !== index) } : prev); };
  const handleSaveCustomer = async (newCustomer: Customer) => { 
    try {
        await upsertCustomer(newCustomer);
        setFormData(prev => prev ? { ...prev, customerId: newCustomer.id } : null); 
        setSelectedCustomerObj(newCustomer);
        setIsCustomerModalOpen(false); 
    } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to save customer');
    }
  };
  const handleSaveProduct = async (newProduct: Product) => { await addProductsBatch([newProduct]); setIsProductModalOpen(false); };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!formData || !formData.customerId) {
        alert("Please select a customer."); return;
    }
    try {
      const isNew = editingQuotationId === null;
      const safeQuotations = quotations || [];
      const idToSave = isNew ? (safeQuotations.length > 0 ? Math.max(...safeQuotations.map(q => q.id)) + 1 : 1) : editingQuotationId;
      let quotationToSave = { ...formData, id: idToSave };
      
      await setQuotations(prev => {
          const currentQuotations = prev || [];
          if (isNew) {
              return [...currentQuotations, quotationToSave];
          }
          return currentQuotations.map(q => q.id === idToSave ? quotationToSave : q);
      });

      if(isNew) {
          setEditingQuotationId(quotationToSave.id);
          const url = new URL(window.location.href);
          if (!url.protocol.startsWith('blob')) {
            url.searchParams.set('id', String(quotationToSave.id));
            window.history.pushState({}, '', url);
          }

          // WhatsApp Notification Logic
          const salesPerson = salesPersons.find(sp => sp.id === formData.salesPersonId);
          if (salesPerson && salesPerson.mobile) {
             if (window.confirm(`Quotation saved. Do you want to notify ${salesPerson.name} on WhatsApp?`)) {
                 const totalValue = formData.details.reduce((sum, item) => {
                    const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
                    return sum + (unitPrice * item.moq);
                 }, 0);

                 const appUrl = window.location.href.split('?')[0] + `?id=${idToSave}`;
                 
                 const message = `*New Quotation Generated*\n` +
                                `QTN No: ${idToSave}\n` +
                                `Date: ${formData.quotationDate}\n` +
                                `Customer: ${selectedCustomerObj?.name || 'N/A'}\n` +
                                `Contact: ${formData.contactPerson} (${formData.contactNumber})\n` +
                                `Value: ₹${totalValue.toLocaleString('en-IN', {maximumFractionDigits: 0})}\n` +
                                `Link: ${appUrl}`;
                
                 let phone = salesPerson.mobile.replace(/\D/g, '');
                 if (phone.length === 10) phone = '91' + phone;

                 const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
                 window.open(whatsappUrl, '_blank');
             }
          }
      }
      alert("Quotation saved successfully!");
    } catch (error) {
      alert(error instanceof Error ? error.message : 'An unknown error occurred while saving the quotation.');
      console.error('Failed to save quotation:', error);
    }
  };
  
  const handleNewButtonClick = () => { if (isReadOnly) return; setEditingQuotationId(null); const url = new URL(window.location.href); if (!url.protocol.startsWith('blob')) { url.searchParams.delete('id'); window.history.pushState({}, '', url); } }
  
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
        setFetchedProducts(new Map(fetchedProducts).set(product.id, product));
        setIsProductSearchModalOpen(false);
        return { ...prev, details: newDetails };
    });
  };
  
  const handlePreview = (type: 'standard' | 'discounted' | 'withAirFreight') => { if (!formData || !formData.customerId) { alert("Please select a customer before previewing."); return; } setPreviewMode(type); };
  
  const handleExportExcel = () => {
      if (!formData || !formData.details.length) {
          alert("No data to export.");
          return;
      }

      const data = formData.details.map((item, index) => {
          const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
          const amount = unitPrice * (item.moq || 0);
          return {
              'Sl No': index + 1,
              'Part No': item.partNo,
              'Description': item.description,
              'MOQ': item.moq,
              'REQ': item.req,
              'UOM': item.uom,
              'List Price': item.price,
              'Discount %': item.discount,
              'Net Unit Price': unitPrice,
              'Total Amount': amount,
              'Stock Status': item.stockStatus,
              'Air Freight': item.airFreight ? 'Yes' : 'No'
          };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Quotation Details");
      XLSX.writeFile(wb, `Quotation_${formData.id || 'New'}_Details.xlsx`);
  };

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
      const url = new URL(window.location.href);
      if (!url.protocol.startsWith('blob')) {
        url.searchParams.set('id', String(newId));
        window.history.pushState({}, '', url);
      }
  };
  
  const totals = useMemo(() => {
      if (!formData) return { moq: 0, req: 0, amount: 0, airFreightAmount: 0 };
      return formData.details.reduce((acc, item) => {
          const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
          acc.moq += item.moq || 0;
          acc.req += item.req || 0;
          acc.amount += unitPrice * item.moq || 0;
          // Safe access with optional chaining for airFreightDetails
          const weight = item.airFreightDetails?.weightPerMtr || 0;
          acc.airFreightAmount += item.airFreight ? (weight / 1000 * 150) * item.moq : 0;
          return acc;
      }, { moq: 0, req: 0, amount: 0, airFreightAmount: 0 });
  }, [formData]);

  const selectedSalesPerson = useMemo(() => salesPersons.find(sp => sp.id === formData?.salesPersonId), [salesPersons, formData?.salesPersonId]);

  const handleGridKeyDown = (e: React.KeyboardEvent, index: number, field: string) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        const nextEl = inputRefs.current[`${index + 1}-${field}`];
        if (nextEl) {
            nextEl.focus();
            nextEl.select();
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevEl = inputRefs.current[`${index - 1}-${field}`];
        if (prevEl) {
             prevEl.focus();
             prevEl.select();
        }
    }
  };

  if (previewMode !== 'none') {
    if (!formData || !selectedCustomerObj) return null;
    return (
        <div className="bg-slate-100 min-h-screen">
          <div className="bg-white shadow-md p-2 mb-4 flex justify-between items-center no-print sticky top-0 z-30">
            <h2 className="text-lg font-bold text-slate-800">Preview</h2>
            <div className="flex items-center space-x-2">
              <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded-md text-xs transition duration-300">Print</button>
              <button onClick={() => setPreviewMode('none')} className="bg-slate-500 hover:bg-slate-600 text-white font-bold py-1 px-3 rounded-md text-xs transition duration-300">Close</button>
            </div>
          </div>
          <div id="print-area">
             {previewMode === 'standard' && <QuotationPrintView quotation={formData} customer={selectedCustomerObj} salesPerson={selectedSalesPerson}/>}
             {previewMode === 'discounted' && <QuotationPrintViewDiscounted quotation={formData} customer={selectedCustomerObj} salesPerson={selectedSalesPerson}/>}
             {previewMode === 'withAirFreight' && <QuotationPrintViewWithAirFreight quotation={formData} customer={selectedCustomerObj} salesPerson={selectedSalesPerson}/>}
          </div>
        </div>
    );
  }

  if (!formData) return <div className="p-8 text-center text-xs">Loading form...</div>;

  return (
    <div className="p-2 bg-slate-50 min-h-screen font-sans">
      <div className="bg-white rounded-lg shadow-lg">
        <header className="bg-slate-800 text-white px-3 py-2 flex justify-between items-center rounded-t-lg">
           <h1 className="text-sm font-bold uppercase tracking-wide">Quotation Details</h1>
           <div className="flex items-center space-x-1">
                <NavButton onClick={() => handleNavigation('first')} disabled={currentQuotationIndex <= 0}>|◀</NavButton>
                <NavButton onClick={() => handleNavigation('prev')} disabled={currentQuotationIndex <= 0}>◀</NavButton>
                <button onClick={() => setView('quotations')} className="bg-blue-500 hover:bg-blue-400 text-white rounded-md h-6 px-3 flex items-center justify-center font-bold text-xs" title="Back to Quotations List">
                    Back
                </button>
                <NavButton onClick={() => handleNavigation('next')} disabled={currentQuotationIndex < 0 || currentQuotationIndex >= quotations.length - 1}>▶</NavButton>
                <NavButton onClick={() => handleNavigation('last')} disabled={currentQuotationIndex < 0 || currentQuotationIndex >= quotations.length - 1}>▶|</NavButton>
            </div>
        </header>
        
        <form onSubmit={handleSubmit} className="p-2">
            <div className="bg-slate-50 p-1 flex flex-wrap items-center gap-2 border border-slate-200 mb-2 rounded-md shadow-sm">
                {!isReadOnly && <ActionButton onClick={handleNewButtonClick} title="New Quotation"><Icons.New /><span>New</span></ActionButton>}
                {!isReadOnly && <ActionButton onClick={handleSubmit} title="Save Quotation"><Icons.Save /><span>Save</span></ActionButton>}
                <div className="h-5 border-l border-slate-300 mx-1"></div>
                <ActionButton onClick={() => handlePreview('standard')} title="Preview Standard"><Icons.PrintStandard /><span>Preview</span></ActionButton>
                <ActionButton onClick={() => handlePreview('discounted')} title="Preview with Discount"><Icons.PrintDiscount /><span>Discounted</span></ActionButton>
                <ActionButton onClick={() => handlePreview('withAirFreight')} title="Preview with Air Freight"><Icons.PrintAirFreight /><span>Air Freight</span></ActionButton>
                <div className="h-5 border-l border-slate-300 mx-1"></div>
                <ActionButton onClick={handleExportExcel} title="Export to Excel"><Icons.Excel /><span>Export Excel</span></ActionButton>
                <div className="h-5 border-l border-slate-300 mx-1"></div>
                {!isReadOnly && <ActionButton onClick={() => setIsCustomerModalOpen(true)} title="Add New Customer"><Icons.AddCustomer /><span>Customer</span></ActionButton>}
                {!isReadOnly && <ActionButton onClick={() => setIsProductModalOpen(true)} title="Add New Product"><Icons.AddProduct /><span>Product</span></ActionButton>}
                {!isReadOnly && <ActionButton onClick={() => setIsProductSearchModalOpen(true)} title="Search Product"><Icons.SearchProduct /><span>Search</span></ActionButton>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-2 gap-y-1 text-xs">
                <div className="space-y-1">
                    <FormField label="Quotation ID"><div className="px-2 py-1 bg-slate-50 font-bold text-slate-800 rounded-r-md border border-slate-300 h-full flex items-center text-xs">{editingQuotationId ?? "{New}"}</div></FormField>
                    <FormField label="Quotation Date"><input type="date" name="quotationDate" value={formData.quotationDate} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500" disabled={isReadOnly}/></FormField>
                    <FormField label="Enquiry Date"><input type="date" name="enquiryDate" value={formData.enquiryDate} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500" disabled={isReadOnly}/></FormField>
                    <FormField label="Customer" className='items-start'><div className={`h-full border border-slate-300 rounded-r-md ${isReadOnly ? 'bg-slate-100' : ''}`}><SearchableSelect<Customer> options={searchedCustomers} value={formData.customerId} onChange={val => { setFormData(prev => prev ? { ...prev, customerId: val as number | null } : null); const customer = searchedCustomers.find(c => c.id === val); if(customer) setSelectedCustomerObj(customer); }} idKey="id" displayKey="name" placeholder="Search customer..." onSearch={setCustomerSearchTerm} isLoading={isSearchingCustomers} onOpen={handleCustomerOpen}/></div></FormField>
                     {selectedCustomerObj && (
                        <div className="ml-[33.33%] pl-1 text-[10px] text-slate-500 whitespace-normal break-words leading-tight" title={`${selectedCustomerObj.address}, ${selectedCustomerObj.city} - ${selectedCustomerObj.pincode}`}>
                            {selectedCustomerObj.address}, {selectedCustomerObj.city} - {selectedCustomerObj.pincode}
                        </div>
                     )}
                </div>
                <div className="space-y-1">
                    <FormField label="Contact Name"><input type="text" name="contactPerson" value={formData.contactPerson} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500" disabled={isReadOnly}/></FormField>
                    <FormField label="Contact No"><input type="text" name="contactNumber" value={formData.contactNumber} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500" disabled={isReadOnly}/></FormField>
                    <FormField label="Other Terms"><input type="text" name="otherTerms" value={formData.otherTerms} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500" disabled={isReadOnly}/></FormField>
                    <FormField label="Payment"><select name="paymentTerms" value={formData.paymentTerms} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100" disabled={isReadOnly}>{PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}</select></FormField>
                    <FormField label="Prepared By"><select name="preparedBy" value={formData.preparedBy} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100" disabled={isReadOnly}>{PREPARED_BY_LIST.map(p => <option key={p} value={p}>{p}</option>)}</select></FormField>
                </div>
                <div className="space-y-1">
                    <FormField label="Products Brand"><select name="productsBrand" value={formData.productsBrand} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100" disabled={isReadOnly}>{PRODUCTS_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}</select></FormField>
                    <FormField label="Sales Person"><select name="salesPersonId" value={formData.salesPersonId || ''} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100" disabled={isReadOnly}><option value="">Select...</option>{salesPersons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></FormField>
                    <FormField label="Enquiry Mode"><select name="modeOfEnquiry" value={formData.modeOfEnquiry} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100" disabled={isReadOnly}>{MODES_OF_ENQUIRY.map(m => <option key={m} value={m}>{m}</option>)}</select></FormField>
                    <FormField label="Status"><select name="status" value={formData.status} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100">{QUOTATION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></FormField>
                    {selectedCustomerObj && selectedCustomerObj.discountStructure && (
                        <div className="flex flex-wrap gap-1 mt-1 text-[10px] border border-slate-200 p-1 rounded bg-slate-50">
                            {Object.entries(selectedCustomerObj.discountStructure).map(([key, value]) => {
                                const val = Number(value);
                                if (!isNaN(val) && val > 0) {
                                    return (
                                        <div key={key} className="px-1 bg-slate-200 rounded">
                                            <span className="font-semibold capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>: {val}%
                                        </div>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-3 overflow-x-auto">
                <table className="min-w-full border-collapse border border-slate-300 text-[11px]">
                    <thead className="bg-slate-200 text-slate-700 font-semibold"><tr className="divide-x divide-slate-300">{['Part No', 'Description', 'MOQ', 'REQ', 'Price', 'Disc%', 'Net Price', 'Amount', 'Stock', 'Air?', 'Wt/M', 'Fr/M', 'Total Fr', 'Lead Time', ''].map(h=><th key={h} className="p-1 text-center whitespace-nowrap">{h}</th>)}</tr></thead>
                    <tbody className="bg-white text-xs">{formData.details.map((item, index) => {const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100); const amount = unitPrice * (item.moq || 0); 
                    // SAFE GUARD for airFreightDetails with optional chaining
                    const freightPerMtr = item.airFreightDetails?.weightPerMtr ? (item.airFreightDetails.weightPerMtr / 1000) * 150 : 0; 
                    const freightTotal = item.airFreight ? freightPerMtr * (item.moq || 0) : 0; 
                    const currentProduct = fetchedProducts.get(item.productId);
                    const optionsForSelect = [...searchedProducts];
                    if(currentProduct && !optionsForSelect.some(p => p.id === currentProduct.id)) {
                        optionsForSelect.unshift(currentProduct);
                    }
                    return (<tr key={index} className="divide-x divide-slate-200 hover:bg-slate-50"><td className="border-t border-slate-300 w-40 align-top"><div className={`h-6 ${isReadOnly ? 'bg-slate-100' : ''}`}><SearchableSelect<Product> options={optionsForSelect} value={item.productId} onChange={val => handleProductSelect(index, val)} idKey="id" displayKey="partNo" placeholder="Search..." onSearch={setProductSearchTerm} isLoading={isSearchingProducts} onOpen={handleProductOpen} /></div></td><td className="border-t border-slate-300 p-1 min-w-[160px] max-w-[250px] align-top text-slate-600 truncate" title={item.description}>{item.description}</td>
                    
                    <td className="border-t border-slate-300 align-top">
                        <input 
                            type="number" 
                            ref={(el) => { inputRefs.current[`${index}-moq`] = el; }}
                            value={item.moq} 
                            onChange={e => handleItemChange(index, 'moq', parseInt(e.target.value) || 0)} 
                            onKeyDown={(e) => handleGridKeyDown(e, index, 'moq')}
                            onFocus={(e) => e.target.select()}
                            className="w-12 p-0.5 text-center h-6 border-transparent hover:border-slate-300 focus:border-blue-500 rounded disabled:bg-slate-100 text-xs" 
                            disabled={isReadOnly}
                        />
                    </td>
                    <td className="border-t border-slate-300 align-top">
                        <input 
                            type="number" 
                            ref={(el) => { inputRefs.current[`${index}-req`] = el; }}
                            value={item.req} 
                            onChange={e => handleItemChange(index, 'req', parseInt(e.target.value) || 0)} 
                            onKeyDown={(e) => handleGridKeyDown(e, index, 'req')}
                            onFocus={(e) => e.target.select()}
                            className="w-12 p-0.5 text-center h-6 border-transparent hover:border-slate-300 focus:border-blue-500 rounded disabled:bg-slate-100 text-xs" 
                            disabled={isReadOnly}
                        />
                    </td>
                    
                    <td className="border-t border-slate-300 align-top"><div className="flex items-center bg-slate-100 h-6"><input type="number" step="0.01" value={item.price.toFixed(2)} className="w-14 p-0.5 text-right h-full bg-transparent text-xs whitespace-nowrap" disabled/><select value={item.priceSource} className="bg-transparent border-l border-slate-200 p-0 text-[10px] text-slate-500 h-full" disabled><option value="LP">L</option><option value="SP">S</option></select></div></td>
                    
                    <td className="border-t border-slate-300 align-top">
                        <input 
                            type="text" 
                            ref={(el) => { inputRefs.current[`${index}-discount`] = el; }}
                            value={item.discount} 
                            onChange={e => handleItemChange(index, 'discount', e.target.value)} 
                            onKeyDown={(e) => handleGridKeyDown(e, index, 'discount')}
                            onFocus={(e) => e.target.select()}
                            className="w-10 p-0.5 text-center h-6 border-transparent hover:border-slate-300 focus:border-blue-500 rounded disabled:bg-slate-100 text-xs" 
                            disabled={isReadOnly}
                        />
                    </td>
                    
                    <td className="border-t border-slate-300 p-1 text-right bg-slate-100 align-top font-medium h-6 whitespace-nowrap">{unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="border-t border-slate-300 p-1 text-right bg-slate-100 align-top font-medium h-6 whitespace-nowrap">{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    
                    <td className="border-t border-slate-300 align-top">
                        <input 
                            type="text" 
                            ref={(el) => { inputRefs.current[`${index}-stockStatus`] = el; }}
                            value={item.stockStatus} 
                            onChange={e => handleItemChange(index, 'stockStatus', e.target.value)} 
                            onKeyDown={(e) => handleGridKeyDown(e, index, 'stockStatus')}
                            onFocus={(e) => e.target.select()}
                            className="w-16 p-0.5 h-6 border-transparent hover:border-slate-300 focus:border-blue-500 rounded disabled:bg-slate-100 text-xs" 
                            disabled={isReadOnly}
                        />
                    </td>
                    
                    <td className="border-t border-slate-300 text-center align-top pt-1"><input type="checkbox" checked={item.airFreight} onChange={e => handleItemChange(index, 'airFreight', e.target.checked)} className="h-3 w-3 disabled:bg-slate-100" disabled={isReadOnly}/></td><td className="border-t border-slate-300 align-top"><input type="number" step="0.001" value={item.airFreightDetails?.weightPerMtr || 0} onChange={e => handleItemChange(index, 'airFreightDetails.weightPerMtr', parseFloat(e.target.value) || 0)} className="w-12 p-0.5 text-right h-6 border-transparent hover:border-slate-300 focus:border-blue-500 rounded disabled:bg-slate-100 text-xs" disabled={!item.airFreight || isReadOnly}/></td><td className="border-t border-slate-300 p-1 text-right bg-slate-100 align-top h-6">{freightPerMtr.toFixed(0)}</td><td className="border-t border-slate-300 p-1 text-right bg-slate-100 align-top font-medium h-6 whitespace-nowrap">{freightTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td className="border-t border-slate-300 align-top"><input type="text" value={item.airFreightDetails?.airFreightLeadTime || ''} onChange={e => handleItemChange(index, 'airFreightDetails.airFreightLeadTime', e.target.value)} className="w-16 p-0.5 h-6 border-transparent hover:border-slate-300 focus:border-blue-500 rounded disabled:bg-slate-100 text-xs" disabled={!item.airFreight || isReadOnly}/></td><td className="border-t border-slate-300 text-center align-middle">{!isReadOnly && <button type="button" onClick={() => handleRemoveItem(index)} className="text-rose-500 hover:text-rose-700 p-0.5 transition-colors" title="Remove Item"><Icons.Trash /></button>}</td></tr>);})}</tbody>
                    <tfoot className="bg-slate-200 text-slate-800 font-bold text-xs"><tr className="divide-x divide-slate-300"><td colSpan={2} className="p-1 text-center">Total</td><td className="p-1 text-center">{totals.moq}</td><td className="p-1 text-center">{totals.req}</td><td colSpan={3}></td><td className="p-1 text-right whitespace-nowrap">{totals.amount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td colSpan={4}></td><td className="p-1 text-right whitespace-nowrap">{totals.airFreightAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td colSpan={2}></td></tr></tfoot>
                </table>
            </div>
             <div className="flex justify-end mt-2">{!isReadOnly && <button type="button" onClick={handleAddItem} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 text-xs rounded">+ Add Row</button>}</div>
        </form>
      </div>
      <CustomerAddModal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} onSave={handleSaveCustomer} salesPersons={salesPersons} />
      <ProductAddModal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} onSave={handleSaveProduct} />
      <ProductSearchModal isOpen={isProductSearchModalOpen} onClose={() => setIsProductSearchModalOpen(false)} onSelect={handleAddProductFromSearch}/>
    </div>
  );
};