
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Quotation, QuotationItem, Customer, SalesPerson, Product, View, UserRole, PriceEntry, PreparedBy, User } from '../types';
import { PAYMENT_TERMS, PREPARED_BY_LIST, PRODUCTS_BRANDS, MODES_OF_ENQUIRY, QUOTATION_STATUSES } from '../constants';
import { CustomerAddModal } from './CustomerAddModal';
import { ProductAddModal } from './ProductAddModal';
import { ProductSearchModal } from './ProductSearchModal';
import { QuotationSuccessModal } from './QuotationSuccessModal';
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
  currentUser: User;
  logoUrl?: string | null;
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
        className="flex items-center gap-1.5 bg-white border border-slate-200 shadow-sm rounded-md px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:shadow-md transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
    >
        {children}
    </button>
);

// Enhanced Colorful Icons
const Icons = {
    New: () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-blue-500">
            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 9a.75.75 0 00-1.5 0v2.25H9a.75.75 0 000 1.5h2.25V15a.75.75 0 001.5 0v-2.25H15a.75.75 0 000-1.5h-2.25V9z" clipRule="evenodd" />
        </svg>
    ),
    Save: () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-indigo-600">
            <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
            <path d="M3.75 12h16.5a.75.75 0 010 1.5H3.75a.75.75 0 010-1.5z" className="hidden" />
            <path d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-9a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0112 9V5.25a1.5 1.5 0 00-1.5-1.5h-3z" /> 
        </svg>
    ),
    PrintStandard: () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-slate-600">
            <path fillRule="evenodd" d="M7.875 1.5C6.839 1.5 6 2.34 6 3.375v2.99c-.426.053-.851.11-1.274.174-1.454.218-2.476 1.483-2.476 2.917v6.294a3 3 0 003 3h.27l-.155 1.705A1.875 1.875 0 007.232 22.5h9.536a1.875 1.875 0 001.867-2.045l-.155-1.705h.27a3 3 0 003-3V9.456c0-1.434-1.022-2.7-2.476-2.917A48.816 48.816 0 0018 6.366V3.375c0-1.036-.84-1.875-1.875-1.875h-8.25zM16.5 6.205v-2.83A.375.375 0 0016.125 3h-8.25a.375.375 0 00-.375.375v2.83a49.353 49.353 0 019 0zm-.217 8.295a.75.75 0 10-1.483.22 48.575 48.575 0 01-5.6 0 .75.75 0 00-1.483-.22 50.05 50.05 0 005.6 0v.002a50.05 50.05 0 002.966-.002zM7.363 18.93a.375.375 0 00.374.342h9.526a.375.375 0 00.374-.342l.312-3.435c-3.2.68-6.57.68-9.77 0l.312 3.435z" clipRule="evenodd" />
        </svg>
    ),
    PrintDiscount: () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-rose-500">
            <path fillRule="evenodd" d="M5.25 2.25a3 3 0 00-3 3v4.318a3 3 0 00.879 2.121l9.58 9.581c.92.92 2.39 1.186 3.548.428a18.849 18.849 0 005.441-5.44c.766-1.16.346-2.632-.578-3.556l-9.58-9.58A3 3 0 009.318 2.25H5.25zM6 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
        </svg>
    ),
    PrintAirFreight: () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-sky-500">
            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
        </svg>
    ),
    AddCustomer: () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-teal-600">
            <path d="M5.25 6.375a4.125 4.125 0 1 18.25 0 4.125 4.125 0 01-8.25 0zM2.25 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122zM18.75 7.5a.75.75 0 00-1.5 0v2.25H15a.75.75 0 000 1.5h2.25v2.25a.75.75 0 001.5 0v-2.25H21a.75.75 0 000-1.5h-2.25V7.5z" />
        </svg>
    ),
    AddProduct: () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-amber-500">
            <path d="M12.378 1.602a.75.75 0 00-.756 0L3 6.632l9 5.25 9-5.25-8.622-5.03zM21.75 7.93l-9 5.25v9l8.628-5.032a.75.75 0 0 0.372-.648V7.93zM11.25 22.18v-9l-9-5.25v8.57a.75.75 0 00.372.648l8.628 5.033z" />
        </svg>
    ),
    SearchProduct: () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-purple-600">
            <path d="M8.25 10.875a2.625 2.625 0 115.25 0 2.625 2.625 0 01-5.25 0z" />
            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.125 4.5a4.125 4.125 0 102.338 7.524l2.007 2.006a.75.75 0 101.06-1.06l-2.006-2.007a4.125 4.125 0 00-3.399-6.463z" clipRule="evenodd" />
        </svg>
    ),
    Trash: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>,
    Excel: () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-green-600">
            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM9.763 9.51a2.25 2.25 0 013.828-1.351.75.75 0 001.06-1.06 3.75 3.75 0 00-6.38 2.252c-.033.307-.052.618-.057.933l-.024 1.399c-.003.158-.003.316.002.473l.024 1.4c.005.315.024.626.057.933a3.75 3.75 0 006.38 2.252.75.75 0 00-1.06-1.06 2.25 2.25 0 01-3.828-1.351l-.025-1.402a9.55 9.55 0 01-.001-.472l.025-1.402z" clipRule="evenodd" /> {/* Stylized generic sheet */}
            <path d="M11.5 9.5a.5.5 0 01.5.5v4a.5.5 0 01-.5.5H9.5a.5.5 0 01-.5-.5v-4a.5.5 0 01.5-.5h2z" />
        </svg>
    ),
};

const FormField: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
    <div className={`flex items-stretch h-7 ${className}`}>
        <label className="w-1/3 bg-slate-200 text-slate-800 font-bold text-[10px] uppercase tracking-wide flex items-center justify-center text-center px-1 rounded-l-md border border-r-0 border-slate-300 leading-tight whitespace-normal">
            {label}
        </label>
        <div className="w-2/3 h-full relative group text-xs shadow-sm rounded-r-md">{children}</div>
    </div>
);

export const QuotationForm: React.FC<QuotationFormProps> = ({
  salesPersons, quotations, setQuotations, setView, editingQuotationId, setEditingQuotationId, currentUser, logoUrl
}) => {
  const [formData, setFormData] = useState<Quotation | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isProductSearchModalOpen, setIsProductSearchModalOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<'none' | 'standard' | 'discounted' | 'withAirFreight'>('none');
  const [successModalData, setSuccessModalData] = useState<Quotation | null>(null);
  
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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Refs for grid inputs
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  
  // Ref to track the last edited ID to detect navigation vs background update
  const prevEditingIdRef = useRef<number | null | undefined>(undefined);

  const userRole = currentUser.role;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Logic to determine if the user can edit this quotation
  const isReadOnly = useMemo(() => {
      // Sales Person on Mobile can ONLY view
      if (userRole === 'Sales Person' && isMobile) return true;
      
      if (userRole === 'Admin') return false;
      if (userRole === 'Sales Person') {
          // If creating new, it's editable
          if (editingQuotationId === null) return false;
          // If editing, check ownership
          const currentSalesPersonId = salesPersons.find(sp => sp.name === currentUser.name)?.id;
          // If formData is not loaded yet, default to readonly until we check ownership
          if (!formData) return true;
          return formData.salesPersonId !== currentSalesPersonId;
      }
      return true; // Other roles are read-only
  }, [userRole, editingQuotationId, formData, salesPersons, currentUser, isMobile]);


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
    
    // Auto-assign Sales Person ID if the current user is a Sales Person
    let defaultSalesPersonId: number | null = null;
    if (userRole === 'Sales Person') {
        const me = salesPersons.find(sp => sp.name === currentUser.name);
        if (me) defaultSalesPersonId = me.id;
    }

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
      salesPersonId: defaultSalesPersonId,
      modeOfEnquiry: 'Customer Email',
      status: 'Open',
      comments: '',
      details: [createEmptyQuotationItem()],
    };
  }, [quotations, userRole, salesPersons, currentUser]);
  
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
    // Ensure we don't overwrite local changes when the background data refreshes (Multi-user fix)
    // We only want to re-initialize if the User intentionally navigates to a different Quotation ID.
    const isSameId = prevEditingIdRef.current === editingQuotationId;
    const hasData = formData !== null;
    
    // If ID hasn't changed (user didn't navigate), and we already have data, 
    // ignore background updates to 'quotations' list.
    if (isSameId && hasData) {
        return;
    }
    
    // Update tracked ID
    if (!isSameId) {
        prevEditingIdRef.current = editingQuotationId;
    }

    const quotationToEdit = quotations.find(q => q.id === editingQuotationId);
    
    // If editingQuotationId is set (not New), but we can't find it in the list:
    // It might be that 'quotations' list hasn't loaded yet. We shouldn't init as New/Empty in that case.
    if (editingQuotationId !== null && !quotationToEdit && quotations.length === 0) {
        // Wait for data to load
        return;
    }

    // Use structured clone or deep copy to avoid mutating state directly if objects are shared
    let initialQuotation = quotationToEdit ? JSON.parse(JSON.stringify(quotationToEdit)) : createNewQuotation();
    
    // Sanitize and patch missing fields for legacy data
    if (initialQuotation.details) {
        initialQuotation.details = initialQuotation.details.map((item: QuotationItem) => ({
            ...item,
            airFreightDetails: item.airFreightDetails || { weightPerMtr: 0, airFreightLeadTime: '' }
        }));
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
    if (selectedCustomerObj && selectedCustomerObj.salesPersonId && editingQuotationId === null) {
        // Only auto-update sales person on NEW quotations when a customer is selected
        // For existing quotations, we preserve the original sales person
        setFormData(prev => prev ? {...prev, salesPersonId: selectedCustomerObj.salesPersonId} : null);
    }
  }, [selectedCustomerObj, editingQuotationId]);

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
          // IMPORTANT: Manually update local form state immediately after save to prevent race condition
          // where the component might re-initialize with empty data while waiting for the ID prop update.
          setFormData(quotationToSave);
          prevEditingIdRef.current = quotationToSave.id;

          setEditingQuotationId(quotationToSave.id);
          const url = new URL(window.location.href);
          if (!url.protocol.startsWith('blob')) {
            url.searchParams.set('id', String(quotationToSave.id));
            window.history.pushState({}, '', url);
          }
          // Show success modal only for new quotations
          setSuccessModalData(quotationToSave);
      } else {
          alert("Quotation updated successfully!");
      }
      
    } catch (error) {
      alert(error instanceof Error ? error.message : 'An unknown error occurred while saving the quotation.');
      console.error('Failed to save quotation:', error);
    }
  };
  
  const handleNewButtonClick = () => { if (isReadOnly && userRole !== 'Sales Person') return; setEditingQuotationId(null); const url = new URL(window.location.href); if (!url.protocol.startsWith('blob')) { url.searchParams.delete('id'); window.history.pushState({}, '', url); } }
  
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
      if (!formData || !formData.details) return { moq: 0, req: 0, amount: 0, airFreightAmount: 0 };
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
             {previewMode === 'standard' && <QuotationPrintView quotation={formData} customer={selectedCustomerObj} salesPerson={selectedSalesPerson} logoUrl={logoUrl ?? null}/>}
             {previewMode === 'discounted' && <QuotationPrintViewDiscounted quotation={formData} customer={selectedCustomerObj} salesPerson={selectedSalesPerson} logoUrl={logoUrl ?? null}/>}
             {previewMode === 'withAirFreight' && <QuotationPrintViewWithAirFreight quotation={formData} customer={selectedCustomerObj} salesPerson={selectedSalesPerson} logoUrl={logoUrl ?? null}/>}
          </div>
        </div>
    );
  }

  if (!formData) return <div className="p-8 text-center text-xs">Loading form...</div>;

  // Define Grid Columns based on user request
  const gridColumns = ['SL No', 'Part No', 'Description', 'MOQ', 'REQ', 'Price', 'Discount%', 'Unit Price', 'Amount', 'Stock Status', 'Air per Unit', 'Air Freight Amt', 'Air Lead Time'];
  if (!isReadOnly) gridColumns.push('');

  return (
    <div className="p-2 bg-slate-50 min-h-screen font-sans pb-14">
      <div className="bg-white rounded-lg shadow-lg">
        <header className="bg-slate-950 text-white px-4 py-3 flex justify-between items-center rounded-t-lg">
           <h1 className="text-base font-extrabold uppercase tracking-wider">Quotation Details</h1>
           <div className="flex items-center space-x-1">
                <NavButton onClick={() => handleNavigation('first')} disabled={currentQuotationIndex <= 0}>|◀</NavButton>
                <NavButton onClick={() => handleNavigation('prev')} disabled={currentQuotationIndex <= 0}>◀</NavButton>
                <button onClick={() => setView('quotations')} className="bg-blue-600 hover:bg-blue-500 text-white rounded-md h-6 px-3 flex items-center justify-center font-bold text-xs" title="Back to Quotations List">
                    Back
                </button>
                <NavButton onClick={() => handleNavigation('next')} disabled={currentQuotationIndex < 0 || currentQuotationIndex >= quotations.length - 1}>▶</NavButton>
                <NavButton onClick={() => handleNavigation('last')} disabled={currentQuotationIndex < 0 || currentQuotationIndex >= quotations.length - 1}>▶|</NavButton>
            </div>
        </header>
        
        <form onSubmit={handleSubmit} className="p-2">
            <div className="bg-slate-50 p-2 flex flex-wrap items-center gap-3 border border-slate-200 mb-3 rounded-md shadow-sm">
                {(!isReadOnly || userRole === 'Sales Person') && <ActionButton onClick={handleNewButtonClick} title="New Quotation"><Icons.New /><span>New</span></ActionButton>}
                {!isReadOnly && <ActionButton onClick={handleSubmit} title="Save Quotation"><Icons.Save /><span>Save</span></ActionButton>}
                <div className="h-6 border-l border-slate-300 mx-1"></div>
                <ActionButton onClick={() => handlePreview('standard')} title="Preview Standard"><Icons.PrintStandard /><span>Preview</span></ActionButton>
                <ActionButton onClick={() => handlePreview('discounted')} title="Preview with Discount"><Icons.PrintDiscount /><span>Discounted</span></ActionButton>
                <ActionButton onClick={() => handlePreview('withAirFreight')} title="Preview with Air Freight"><Icons.PrintAirFreight /><span>Air Freight</span></ActionButton>
                <div className="h-6 border-l border-slate-300 mx-1"></div>
                <ActionButton onClick={handleExportExcel} title="Export to Excel"><Icons.Excel /><span>Export Excel</span></ActionButton>
                <div className="h-6 border-l border-slate-300 mx-1"></div>
                {!isReadOnly && <ActionButton onClick={() => setIsCustomerModalOpen(true)} title="Add New Customer"><Icons.AddCustomer /><span>Customer</span></ActionButton>}
                {!isReadOnly && <ActionButton onClick={() => setIsProductModalOpen(true)} title="Add New Product"><Icons.AddProduct /><span>Product</span></ActionButton>}
                {!isReadOnly && <ActionButton onClick={() => setIsProductSearchModalOpen(true)} title="Search Product"><Icons.SearchProduct /><span>Search</span></ActionButton>}
            </div>
            
            {(isReadOnly && (userRole === 'Sales Person' && !isMobile)) && formData.id !== 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 mb-2 text-xs text-yellow-700">
                    <p className="font-bold">View Only Mode</p>
                    <p>You are viewing a quotation created by another Sales Person. You cannot edit this.</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-2 gap-y-1 text-xs">
                <div className="space-y-1">
                    <FormField label="Quotation ID"><div className="px-2 py-1 bg-slate-50 font-bold text-slate-800 rounded-r-md border border-slate-300 h-full flex items-center text-xs shadow-sm">{editingQuotationId ?? "{New}"}</div></FormField>
                    <FormField label="Quotation Date"><input type="date" name="quotationDate" value={formData.quotationDate} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm" disabled={isReadOnly}/></FormField>
                    <FormField label="Enquiry Date"><input type="date" name="enquiryDate" value={formData.enquiryDate} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm" disabled={isReadOnly}/></FormField>
                    <FormField label="Customer" className='items-start'><div className={`h-full border border-slate-300 rounded-r-md shadow-sm ${isReadOnly ? 'bg-slate-100' : ''}`}><SearchableSelect<Customer> options={searchedCustomers} value={formData.customerId} onChange={val => { if(!isReadOnly) { setFormData(prev => prev ? { ...prev, customerId: val as number | null } : null); const customer = searchedCustomers.find(c => c.id === val); if(customer) setSelectedCustomerObj(customer); } }} idKey="id" displayKey="name" placeholder="Search customer..." onSearch={setCustomerSearchTerm} isLoading={isSearchingCustomers} onOpen={handleCustomerOpen}/></div></FormField>
                     {selectedCustomerObj && (
                        <div className="ml-[33.33%] pl-1 text-[10px] text-slate-500 whitespace-normal break-words leading-tight" title={`${selectedCustomerObj.address}, ${selectedCustomerObj.city} - ${selectedCustomerObj.pincode}`}>
                            {selectedCustomerObj.address}, {selectedCustomerObj.city} - {selectedCustomerObj.pincode}
                        </div>
                     )}
                </div>
                <div className="space-y-1">
                    <FormField label="Contact Name"><input type="text" name="contactPerson" value={formData.contactPerson} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm" disabled={isReadOnly}/></FormField>
                    <FormField label="Contact No"><input type="text" name="contactNumber" value={formData.contactNumber} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm" disabled={isReadOnly}/></FormField>
                    <FormField label="Other Terms"><input type="text" name="otherTerms" value={formData.otherTerms} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm" disabled={isReadOnly}/></FormField>
                    <FormField label="Payment"><select name="paymentTerms" value={formData.paymentTerms} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm disabled:bg-slate-100" disabled={isReadOnly}>{PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}</select></FormField>
                    <FormField label="Prepared By"><select name="preparedBy" value={formData.preparedBy} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm disabled:bg-slate-100" disabled={isReadOnly}>{PREPARED_BY_LIST.map(p => <option key={p} value={p}>{p}</option>)}</select></FormField>
                </div>
                <div className="space-y-1">
                    <FormField label="Products Brand"><select name="productsBrand" value={formData.productsBrand} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm disabled:bg-slate-100" disabled={isReadOnly}>{PRODUCTS_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}</select></FormField>
                    <FormField label="Sales Person"><select name="salesPersonId" value={formData.salesPersonId || ''} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm disabled:bg-slate-100" disabled={isReadOnly}><option value="">Select...</option>{salesPersons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></FormField>
                    <FormField label="Enquiry Mode"><select name="modeOfEnquiry" value={formData.modeOfEnquiry} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm disabled:bg-slate-100" disabled={isReadOnly}>{MODES_OF_ENQUIRY.map(m => <option key={m} value={m}>{m}</option>)}</select></FormField>
                    <FormField label="Status"><select name="status" value={formData.status} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm disabled:bg-slate-100">{QUOTATION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></FormField>
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
                    <thead className="bg-slate-200 text-slate-700 font-semibold">
                        <tr className="divide-x divide-slate-300">
                            {gridColumns.map(h => <th key={h} className="p-1 text-center whitespace-nowrap">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody className="bg-white text-xs">{(formData.details || []).map((item, index) => {
                        const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100); 
                        const amount = unitPrice * (item.moq || 0); 
                        const freightPerMtr = item.airFreightDetails?.weightPerMtr ? (item.airFreightDetails.weightPerMtr / 1000) * 150 : 0; 
                        const freightTotal = item.airFreight ? freightPerMtr * (item.moq || 0) : 0; 
                        const currentProduct = fetchedProducts.get(item.productId);
                        const optionsForSelect = [...searchedProducts];
                        if(currentProduct && !optionsForSelect.some(p => p.id === currentProduct.id)) {
                            optionsForSelect.unshift(currentProduct);
                        }
                        return (
                        <tr key={index} className="divide-x divide-slate-200 hover:bg-slate-50">
                            {/* SL No */}
                            <td className="border-t border-slate-300 p-1 text-center bg-slate-50">{index + 1}</td>
                            
                            {/* Part No */}
                            <td className="border-t border-slate-300 w-40 align-top">
                                <div className={`h-6 ${isReadOnly ? 'bg-slate-100' : ''}`}>
                                    <SearchableSelect<Product> options={optionsForSelect} value={item.productId} onChange={val => { if(!isReadOnly) handleProductSelect(index, val); }} idKey="id" displayKey="partNo" placeholder="Search..." onSearch={setProductSearchTerm} isLoading={isSearchingProducts} onOpen={handleProductOpen} />
                                </div>
                            </td>
                            
                            {/* Description */}
                            <td className="border-t border-slate-300 p-1 min-w-[160px] max-w-[250px] align-top text-slate-600 truncate" title={item.description}>{item.description}</td>
                            
                            {/* MOQ */}
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

                            {/* REQ */}
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
                            
                            {/* Price (LP/SP) */}
                            <td className="border-t border-slate-300 align-top">
                                <div className="flex items-center bg-slate-100 h-6">
                                    <input type="number" step="0.01" value={item.price.toFixed(2)} className="w-14 p-0.5 text-right h-full bg-transparent text-xs whitespace-nowrap" disabled/>
                                    <select 
                                        value={item.priceSource} 
                                        className="bg-transparent border-l border-slate-200 p-0 text-[9px] text-slate-500 h-full appearance-none text-center w-6 focus:outline-none" 
                                        disabled
                                    >
                                        <option value="LP">LP</option><option value="SP">SP</option>
                                    </select>
                                </div>
                            </td>
                            
                            {/* Discount % */}
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
                            
                            {/* Unit Price */}
                            <td className="border-t border-slate-300 p-1 text-right bg-slate-100 align-top font-medium h-6 whitespace-nowrap">
                                {unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            {/* Amount */}
                            <td className="border-t border-slate-300 p-1 text-right bg-slate-100 align-top font-medium h-6 whitespace-nowrap">
                                {amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            
                            {/* Stock Status */}
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
                            
                            {/* Air per Unit (with Checkbox for toggle if editable) */}
                            <td className="border-t border-slate-300 align-top min-w-[100px]">
                                <div className="flex items-center gap-1 h-6 px-1">
                                    <input 
                                        type="checkbox" 
                                        checked={item.airFreight} 
                                        onChange={e => handleItemChange(index, 'airFreight', e.target.checked)} 
                                        className="h-3 w-3 disabled:bg-slate-100" 
                                        disabled={isReadOnly}
                                        title="Toggle Air Freight"
                                    />
                                    {!isReadOnly && item.airFreight ? (
                                         <input type="number" step="0.001" value={item.airFreightDetails?.weightPerMtr || 0} onChange={e => handleItemChange(index, 'airFreightDetails.weightPerMtr', parseFloat(e.target.value) || 0)} className="w-full p-0.5 text-right border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-xs" title="Weight (kg/m) for calculation"/>
                                    ) : (
                                        <span className="text-right flex-grow text-[10px]">{freightPerMtr.toFixed(2)}</span>
                                    )}
                                </div>
                            </td>

                            {/* Air Freight Amt */}
                            <td className="border-t border-slate-300 p-1 text-right bg-slate-100 align-top font-medium h-6 whitespace-nowrap">
                                {freightTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </td>

                            {/* Air Lead Time */}
                            <td className="border-t border-slate-300 align-top">
                                <input 
                                    type="text" 
                                    value={item.airFreightDetails?.airFreightLeadTime || ''} 
                                    onChange={e => handleItemChange(index, 'airFreightDetails.airFreightLeadTime', e.target.value)} 
                                    className="w-20 p-0.5 h-6 border-transparent hover:border-slate-300 focus:border-blue-500 rounded disabled:bg-slate-100 text-xs" 
                                    disabled={!item.airFreight || isReadOnly}
                                />
                            </td>

                            {/* Actions */}
                            {!isReadOnly && (
                                <td className="border-t border-slate-300 text-center align-middle">
                                    <button type="button" onClick={() => handleRemoveItem(index)} className="text-rose-500 hover:text-rose-700 p-0.5 transition-colors" title="Remove Item">
                                        <Icons.Trash />
                                    </button>
                                </td>
                            )}
                        </tr>
                    );})}</tbody>
                </table>
            </div>
             <div className="flex justify-end mt-2 mb-4">{!isReadOnly && <button type="button" onClick={handleAddItem} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 text-xs rounded">+ Add Row</button>}</div>
        </form>
      </div>
      <CustomerAddModal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} onSave={handleSaveCustomer} salesPersons={salesPersons} />
      <ProductAddModal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} onSave={handleSaveProduct} />
      <ProductSearchModal isOpen={isProductSearchModalOpen} onClose={() => setIsProductSearchModalOpen(false)} onSelect={handleAddProductFromSearch}/>
      <QuotationSuccessModal 
         isOpen={!!successModalData} 
         onClose={() => setSuccessModalData(null)} 
         quotation={successModalData} 
         customer={selectedCustomerObj}
         salesPerson={salesPersons.find(sp => sp.id === successModalData?.salesPersonId) || null}
         onPrint={() => { setSuccessModalData(null); handlePreview('standard'); }}
      />
      
      <div className="fixed bottom-0 left-0 w-full bg-slate-800 text-white p-2 shadow-inner z-40 flex items-center justify-between px-6 text-xs font-medium">
          <div className="flex gap-6">
              <div>Total MOQ: <span className="font-bold text-yellow-400 ml-1">{totals.moq}</span></div>
              <div>Total REQ: <span className="font-bold text-yellow-400 ml-1">{totals.req}</span></div>
          </div>
          <div className="flex gap-6">
              <div>Amount: <span className="font-bold text-green-400 ml-1">{totals.amount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>
              <div>Air Freight: <span className="font-bold text-blue-400 ml-1">{totals.airFreightAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>
              <div className="border-l border-slate-600 pl-4">Grand Total: <span className="font-bold text-white text-sm ml-1">{(totals.amount + totals.airFreightAmount).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>
          </div>
      </div>
    </div>
  );
};
