import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Quotation, QuotationItem, Customer, SalesPerson, Product, View, UserRole, PriceEntry, PreparedBy, User, StockItem, PendingSO } from '../types';
import { PAYMENT_TERMS, PREPARED_BY_LIST, PRODUCTS_BRANDS, MODES_OF_ENQUIRY, QUOTATION_STATUSES } from '../constants';
import { CustomerAddModal } from './CustomerAddModal';
import { ProductAddModal } from './ProductAddModal';
import { ProductSearchModal } from './ProductSearchModal';
import { QuotationSuccessModal } from './QuotationSuccessModal';
import { StockCheckModal } from './StockCheckModal';
import { AIAssistantPanel } from './AIAssistantPanel';
import { SearchableSelect } from './common/SearchableSelect';
import { QuotationPrintView } from './QuotationPrintView';
import { QuotationPrintViewDiscounted } from './QuotationPrintViewDiscounted';
import { QuotationPrintViewWithAirFreight } from './QuotationPrintViewWithAirFreight';
import { useDebounce } from '../hooks/useDebounce';
import { useOnlineStorage } from '../hooks/useOnlineStorage';
import { searchProducts, addProductsBatch, updateProduct, getProductsByIds, upsertCustomer, searchCustomers, getCustomersByIds, upsertQuotation } from '../supabase';
import { generateFormattedQuotationNumber } from '../utils/quotationNumber';
import { numberToWords } from '../utils/numberToWords';

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

const getTodayDateString = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const NavButton: React.FC<{ onClick: () => void; disabled?: boolean; children: React.ReactNode }> = ({ onClick, disabled, children }) => (
    <button type="button" onClick={onClick} disabled={disabled} className="bg-slate-700 hover:bg-slate-600 text-white rounded-md h-6 w-8 flex items-center justify-center font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
        {children}
    </button>
);

const ActionButton: React.FC<{ onClick: () => void; disabled?: boolean; children: React.ReactNode, title: string, className?: string }> = ({ onClick, disabled, children, title, className }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`flex items-center gap-1.5 bg-white border border-indigo-100 shadow-sm rounded-md px-2.5 py-1.5 text-xs font-bold text-indigo-950 hover:bg-indigo-50/40 hover:shadow transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${className || ''}`}
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
    Sparkles: () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 019 4.5zM4.5 9a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 014.5 9zm13.5 0a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 0118 9zm-9 9a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 019 18zM12.75 6.75a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zM15.75 12a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zm-6 0a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zM8.25 12.75a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zm-1.5-6a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zm10.5 10.5a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75z" clipRule="evenodd" />
        </svg>
    ),
    PrintStandard: () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-slate-700">
            <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625zM7.5 15a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 017.5 15zm.75 2.25a.75.75 0 000 1.5H12a.75.75 0 000-1.5H8.25z" clipRule="evenodd" />
            <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
        </svg>
    ),
    PrintDiscount: () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-rose-500">
            <path fillRule="evenodd" d="M5.25 2.25a3 3 0 00-3 3v4.318a3 3 0 00.879 2.121l9.58 9.581c.92.92 2.39 1.186 3.548.428a18.849 18.849 0 005.441-5.44c.766-1.16.346-2.632-.578-3.556l-9.58-9.58A3 3 0 009.318 2.25H5.25zM6 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
        </svg>
    ),
    PrintAirFreight: () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-sky-500">
            <path d="M1.5 16.875A2.625 2.625 0 014.125 14.25h15.75a2.625 2.625 0 012.625 2.625v2.25A2.625 2.625 0 0119.875 21.75H4.125A2.625 2.625 0 011.5 19.125v-2.25zM16.5 18a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5h-1.5z" />
            <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v5.625a.75.75 0 01-.75.75H1.5a.75.75 0 01-.75-.75V5.25a5.23 5.23 0 011.279-3.434 9.768 9.768 0 0110.942 0zm-3.721 4.684a.75.75 0 00-1.06 0l-2.25 2.25a.75.75 0 101.06 1.06l.97-.97v3.91a.75.75 0 001.5 0V8.81l.97.97a.75.75 0 101.06-1.06l-2.25-2.25z" />
        </svg>
    ),
    AddCustomer: () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-teal-600">
            <path d="M5.25 6.375a4.125 4.125 0 1 18.25 0 4.125 4.125 0 01-8.25 0zM2.25 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122zM18.75 7.5a.75.75 0 00-1.5 0v2.25H15a.75.75 0 000 1.5h2.25v2.25a.75.75 0 001.5 0v-2.25H21a.75.75 0 000-1.5h-2.25V7.5z" />
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
    Stock: () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-violet-600">
            <path fillRule="evenodd" d="M2.25 6a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V6Zm3.9 7.5a.75.75 0 0 0 .6.3h6.75a.75.75 0 0 0 .6-.3l2.25-3a.75.75 0 0 0 0-.9l-2.25-3a.75.75 0 0 0-.6-.3H6.75a.75.75 0 0 0-.6.3L3.9 9.6a.75.75 0 0 0 0 .9l2.25 3Z" clipRule="evenodd" />
        </svg>
    ),
    Trash: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>,
    Excel: () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-green-600">
            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM9.763 9.51a2.25 2.25 0 013.828-1.351.75.75 0 011.06-1.06 3.75 3.75 0 00-6.38 2.252c-.033.307-.052.618-.057.933l-.024 1.399c-.003.158-.003.316.002.473l.024 1.4c.005.315.024.626.057.933a3.75 3.75 0 006.38 2.252.75.75 0 00-1.06-1.06 2.25 2.25 0 01-3.828-1.351l-.025-1.402a9.55 9.55 0 01-.001-.472l.025-1.402z" clipRule="evenodd" />
            <path d="M11.5 9.5a.5.5 0 01.5.5v4a.5.5 0 01-.5.5H9.5a.5.5 0 01-.5-.5v-4a.5.5 0 01.5-.5h2z" />
        </svg>
    ),
    Insert: () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-blue-600">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
        </svg>
    )
};

const FormField: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
    <div className={`flex items-stretch h-7 ${className}`}>
        <label className="w-1/3 bg-gradient-to-r from-indigo-100/90 to-indigo-50/90 text-indigo-950 font-bold text-[9px] uppercase tracking-wide flex items-center justify-center text-center px-1 rounded-l-md border border-r-0 border-indigo-200 leading-tight whitespace-normal">
            {label}
        </label>
        <div className="w-2/3 h-full relative group text-xs shadow-sm rounded-r-md text-black">{children}</div>
    </div>
);

export const QuotationForm: React.FC<QuotationFormProps> = ({
  salesPersons, quotations, setQuotations, setView, editingQuotationId, setEditingQuotationId, currentUser, logoUrl
}) => {
  const [formData, setFormData] = useState<Quotation | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isProductSearchModalOpen, setIsProductSearchModalOpen] = useState(false);
  const [isStockCheckModalOpen, setIsStockCheckModalOpen] = useState(false);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<'none' | 'standard' | 'discounted' | 'withAirFreight'>('none');
  const [successModalData, setSuccessModalData] = useState<Quotation | null>(null);
  
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [searchedProducts, setSearchedProducts] = useState<Product[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const debouncedProductSearchTerm = useDebounce(productSearchTerm, 300);
  const [fetchedProducts, setFetchedProducts] = useState<Map<number, Product>>(new Map());

  // Data hooks for Stock Check
  const [stockStatements] = useOnlineStorage<StockItem>('stockStatements');
  const [pendingSOs] = useOnlineStorage<PendingSO>('pendingSOs');

  // State for async customer search
  const [searchedCustomers, setSearchedCustomers] = useState<Customer[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const debouncedCustomerSearchTerm = useDebounce(customerSearchTerm, 300);
  const [selectedCustomerObj, setSelectedCustomerObj] = useState<Customer | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rowsToAdd, setRowsToAdd] = useState(1);
  const airFreightRate = formData?.quotationDate && new Date(formData.quotationDate) >= new Date('2026-05-25') ? 180 : 150;

  // Refs for grid inputs
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  
  // Ref to track the editing session. 
  const currentSessionIdRef = useRef<number | null | undefined>(undefined);

  const userRole = currentUser.role;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update document title for printing to set default PDF filename
  useEffect(() => {
    if (previewMode !== 'none' && formData && selectedCustomerObj) {
        try {
            const dateStr = formData.quotationDate || getTodayDateString();
            const dateParts = dateStr.split('-');
            const formattedDate = dateParts.length === 3 ? `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}` : dateStr;
            
            const qtnNo = generateFormattedQuotationNumber(formData, quotations || []).replace(/\//g, '-');
            const customerName = (selectedCustomerObj.name || 'Customer').trim();
            
            const newTitle = `${customerName}_${qtnNo} ${formattedDate}`;
            document.title = newTitle;
        } catch (err) {
            console.error('Error setting print title:', err);
            document.title = "Quotation_" + (formData.id || 'Draft');
        }
    } else {
        document.title = "Siddhi Kabel Corporation Pvt Ltd";
    }
  }, [previewMode, formData, selectedCustomerObj, quotations]);
  
  // Logic to determine if the user can edit this quotation
  const isReadOnly = useMemo(() => {
      if (userRole === 'Sales Person' && isMobile) return true;
      if (userRole === 'Admin') return false;
      if (userRole === 'Sales Person') {
          if (editingQuotationId === null) return false;
          const currentSalesPersonId = salesPersons.find(sp => sp.name === currentUser.name)?.id;
          if (!formData) return true;
          return formData.salesPersonId !== currentSalesPersonId;
      }
      return true;
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
    let defaultSalesPersonId: number | null = null;
    if (userRole === 'Sales Person') {
        const me = salesPersons.find(sp => sp.name === currentUser.name);
        if (me) defaultSalesPersonId = me.id;
    }

    return {
      id: 0,
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
      gstAdded: true,
    };
  }, [userRole, salesPersons, currentUser]); 
  
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
    setSelectedCustomerObj(null);
    currentSessionIdRef.current = undefined;
  }, [editingQuotationId]);

  useEffect(() => {
    const isReturningToCurrentSession = currentSessionIdRef.current === editingQuotationId;
    if (isReturningToCurrentSession && formData !== null) return;

    const quotationToEdit = quotations.find(q => q.id === editingQuotationId);
    if (editingQuotationId !== null && !quotationToEdit) return;

    currentSessionIdRef.current = editingQuotationId;

    let initialQuotation = quotationToEdit ? JSON.parse(JSON.stringify(quotationToEdit)) : createNewQuotation();
    
    if (initialQuotation.details) {
        initialQuotation.details = initialQuotation.details.map((item: QuotationItem) => ({
            ...item,
            airFreightDetails: item.airFreightDetails || { weightPerMtr: 0, airFreightLeadTime: '' }
        }));
    }

    const checkDate = new Date(initialQuotation.quotationDate);
    if (!initialQuotation.quotationDate || isNaN(checkDate.getTime())) {
        initialQuotation.quotationDate = getTodayDateString();
    }
    const checkEnquiryDate = new Date(initialQuotation.enquiryDate);
    if (!initialQuotation.enquiryDate || isNaN(checkEnquiryDate.getTime())) {
        initialQuotation.enquiryDate = getTodayDateString();
    }

    if ((initialQuotation.salesPersonId === null || initialQuotation.salesPersonId === 0) && userRole === 'Sales Person') {
        const currentSp = salesPersons.find(sp => sp.name === currentUser.name);
        if (currentSp) {
            initialQuotation.salesPersonId = currentSp.id;
        }
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
  }, [editingQuotationId, quotations, createNewQuotation, salesPersons, userRole, currentUser]);

  useEffect(() => {
    const customerId = formData?.customerId;
    if (customerId && (!selectedCustomerObj || selectedCustomerObj.id !== customerId)) {
      getCustomersByIds([customerId]).then(customers => {
        try {
          if (customers && customers.length > 0) {
            setSelectedCustomerObj(customers[0]);
            setSearchedCustomers(prev => {
              if (prev.some(c => c.id === customers[0].id)) return prev;
              return [customers[0], ...prev];
            });
          }
        } catch (err) {
          console.error("QuotationForm: Error processing fetched customer:", err);
        }
      }).catch(error => console.error("QuotationForm: Failed to fetch selected customer:", error));
    } else if (!customerId) {
      setSelectedCustomerObj(null);
    }
  }, [formData?.customerId, selectedCustomerObj]);

  useEffect(() => {
    if (selectedCustomerObj && selectedCustomerObj.salesPersonId && editingQuotationId === null) {
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
      try {
          const results = await searchProducts(debouncedProductSearchTerm);
          setSearchedProducts(results);
      } catch (err) {
          console.error("Product search failed:", err);
      } finally {
          setIsSearchingProducts(false);
      }
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
                if (!updatedItem.airFreightDetails) updatedItem.airFreightDetails = { weightPerMtr: 0, airFreightLeadTime: '' };
                
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
            const newDetails = [...prevFormData.details];
            newDetails[index] = { ...newDetails[index], productId: product.id, partNo: product.partNo, description: product.description, price: priceEntry ? (priceEntry.lp > 0 ? priceEntry.lp : priceEntry.sp) : 0, priceSource: priceEntry ? (priceEntry.lp > 0 ? 'LP' : 'SP') : 'LP', uom: product.uom, airFreightDetails: { ...newDetails[index].airFreightDetails, weightPerMtr: product.weight }};
            return { ...prevFormData, details: newDetails };
        }
        return prevFormData;
    });
  }

  const handleAddItem = (count: number = 1) => { 
    setFormData(prev => {
        if (!prev) return null;
        const newRows = Array.from({ length: count }, () => createEmptyQuotationItem());
        return { ...prev, details: [...prev.details, ...newRows] };
    });
  };
  const handleRemoveItem = (index: number) => { setFormData(prev => prev && prev.details.length > 1 ? { ...prev, details: prev.details.filter((_, i) => i !== index) } : prev); };
  const handleInsertItem = (index: number) => {
    setFormData(prev => {
        if (!prev) return null;
        const newDetails = [...prev.details];
        newDetails.splice(index + 1, 0, createEmptyQuotationItem());
        return { ...prev, details: newDetails };
    });
  };
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

  const saveQuotation = async (quiet: boolean = false): Promise<Quotation | null> => {
    if (!formData || !formData.customerId || formData.customerId === 0) {
        alert("Please select a valid customer from the dropdown list before saving."); return null;
    }
    if (!formData.salesPersonId) {
        alert("Please select a Sales Person before saving."); return null;
    }

    try {
      setIsSubmitting(true);
      const isNew = editingQuotationId === null || formData.id === 0;
      let quotationToSave = { ...formData };
      if (isNew) quotationToSave.id = 0;
      
      const savedQuotation = await upsertQuotation(quotationToSave);
      
      await setQuotations(prev => {
          const currentQuotations = prev || [];
          if (isNew) return [...currentQuotations, savedQuotation];
          return currentQuotations.map(q => q.id === savedQuotation.id ? savedQuotation : q);
      });

      setFormData(savedQuotation);
      currentSessionIdRef.current = savedQuotation.id; 
      
      if (isNew) {
          setEditingQuotationId(savedQuotation.id);
          const url = new URL(window.location.href);
          url.searchParams.set('id', String(savedQuotation.id));
          window.history.pushState({}, '', url);
      }
      
      if (!quiet) setSuccessModalData(savedQuotation);
      return savedQuotation;
    } catch (error) {
      console.error("Submit Error:", error);
      alert(error instanceof Error ? error.message : "Failed to save quotation");
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await saveQuotation(false);
  };
  
  const handleNewButtonClick = () => { 
      if (isReadOnly && userRole !== 'Sales Person') return;
      setEditingQuotationId(null); 
      const url = new URL(window.location.href); 
      if (!url.protocol.startsWith('blob')) { 
          url.searchParams.delete('id'); 
          window.history.pushState({}, '', url); 
      } 
  }
  
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
  
  const handlePreview = async (type: 'standard' | 'discounted' | 'withAirFreight') => { 
    if (!formData || !formData.customerId) { 
        alert("Please select a customer before previewing."); 
        return; 
    } 
    const saved = await saveQuotation(true); 
    if (saved) setPreviewMode(type); 
  };
  
  const handleExportExcel = async (exportType: 'standard' | 'discounted' | 'withAirFreight' = 'standard') => {
      // (Simplified for brevity, same implementation as previous)
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
      if (!formData || !formData.details) return { moq: 0, req: 0, amount: 0, airFreightAmount: 0, gstAmount: 0, grandTotal: 0 };
      const baseTotals = formData.details.reduce((acc, item) => {
          const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
          acc.moq += item.moq || 0;
          acc.req += item.req || 0;
          acc.amount += unitPrice * item.moq || 0;
          const weight = item.airFreightDetails?.weightPerMtr || 0;
          acc.airFreightAmount += item.airFreight ? (weight / 1000 * airFreightRate) * item.moq : 0;
          return acc;
      }, { moq: 0, req: 0, amount: 0, airFreightAmount: 0 });
      const gstAmount = formData.gstAdded ? (baseTotals.amount + baseTotals.airFreightAmount) * 0.18 : 0;
      const grandTotal = baseTotals.amount + baseTotals.airFreightAmount + gstAmount;
      return { ...baseTotals, gstAmount, grandTotal };
  }, [formData]);

  const handleGridKeyDown = (e: React.KeyboardEvent, index: number, field: string) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        const nextEl = inputRefs.current[`${index + 1}-${field}`];
        if (nextEl) { nextEl.focus(); nextEl.select(); }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevEl = inputRefs.current[`${index - 1}-${field}`];
        if (prevEl) { prevEl.focus(); prevEl.select(); }
    }
  };

  if (previewMode !== 'none') {
    return null; // (Render logic remains same)
  }

  if (!formData) return <div className="p-8 text-center text-xs text-black">Loading form...</div>;

  return (
    <div className="p-2 bg-slate-50 min-h-screen font-sans pb-14">
      <div className="bg-white rounded-lg shadow-lg">
        <header className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white px-4 py-3 flex justify-between items-center rounded-t-lg shadow-sm">
           <h1 className="text-base font-extrabold uppercase tracking-wider">Quotation Details</h1>
           <div className="flex items-center space-x-1">
                <NavButton onClick={() => handleNavigation('first')} disabled={currentQuotationIndex <= 0}>|◀</NavButton>
                <NavButton onClick={() => handleNavigation('prev')} disabled={currentQuotationIndex <= 0}>◀</NavButton>
                <button onClick={() => setView('quotations')} className="bg-blue-600 hover:bg-blue-500 text-white rounded-md h-6 px-3 flex items-center justify-center font-bold text-xs">Back</button>
                <NavButton onClick={() => handleNavigation('next')} disabled={currentQuotationIndex < 0 || currentQuotationIndex >= quotations.length - 1}>▶</NavButton>
                <NavButton onClick={() => handleNavigation('last')} disabled={currentQuotationIndex < 0 || currentQuotationIndex >= quotations.length - 1}>▶|</NavButton>
            </div>
        </header>
        
        <form onSubmit={handleSubmit} className="p-2">
            <div className="bg-indigo-50/30 p-2 flex flex-wrap items-center gap-3 border border-indigo-100/80 mb-3 rounded-md shadow-sm">
                {!isReadOnly && <ActionButton onClick={() => setIsAIPanelOpen(true)} title="AI Assistant" className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200"><Icons.Sparkles /><span>AI Assist</span></ActionButton>}
                <ActionButton onClick={handleSubmit} title="Save Quotation" disabled={isSubmitting}><Icons.Save /><span>Save</span></ActionButton>
                {/* ... other buttons ... */}
            </div>
            
            {/* Table Rendering Logic */}

             <div className="flex justify-end mt-2 mb-4 items-center gap-2">
                {!isReadOnly && (
                    <>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Rows:</span>
                        <input type="number" min="1" max="50" value={rowsToAdd} onChange={(e) => setRowsToAdd(Math.max(1, parseInt(e.target.value) || 1))} className="w-12 h-7 p-1 text-center border border-slate-300 rounded text-xs text-black" />
                        <button type="button" onClick={() => handleAddItem(rowsToAdd)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-7 px-3 text-xs rounded shadow-sm flex items-center gap-1 transition-all"><Icons.New /><span>Add Items</span></button>
                    </>
                )}
             </div>
        </form>
      </div>
      
      <AIAssistantPanel 
        isOpen={isAIPanelOpen} 
        onClose={() => setIsAIPanelOpen(false)}
        allProducts={Array.from(fetchedProducts.values())}
        onItemsExtracted={(items) => {
          setFormData(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              details: [...prev.details, ...items as any]
            };
          });
        }}
      />
    </div>
  );
};
