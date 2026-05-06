
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Quotation, QuotationItem, Customer, SalesPerson, Product, View, UserRole, PriceEntry, PreparedBy, User, StockItem, PendingSO } from '../types';
import { PAYMENT_TERMS, PREPARED_BY_LIST, PRODUCTS_BRANDS, MODES_OF_ENQUIRY, QUOTATION_STATUSES } from '../constants';
import { CustomerAddModal } from './CustomerAddModal';
import { ProductAddModal } from './ProductAddModal';
import { ProductSearchModal } from './ProductSearchModal';
import { QuotationSuccessModal } from './QuotationSuccessModal';
import { StockCheckModal } from './StockCheckModal';
import { SearchableSelect } from './common/SearchableSelect';
import { QuotationPrintView } from './QuotationPrintView';
import { QuotationPrintViewDiscounted } from './QuotationPrintViewDiscounted';
import { QuotationPrintViewWithAirFreight } from './QuotationPrintViewWithAirFreight';
import { useDebounce } from '../hooks/useDebounce';
import { useOnlineStorage } from '../hooks/useOnlineStorage';
import { searchProducts, addProductsBatch, updateProduct, getProductsByIds, upsertCustomer, searchCustomers, getCustomersByIds, upsertQuotation } from '../supabase';
import { generateFormattedQuotationNumber } from '../utils/quotationNumber';
import { numberToWords } from '../utils/numberToWords';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

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
        className="flex items-center gap-1.5 bg-white border border-slate-200 shadow-sm rounded-md px-2.5 py-1.5 text-xs font-bold text-black hover:bg-slate-50 hover:shadow-md transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM9.763 9.51a2.25 2.25 0 013.828-1.351.75.75 0 011.06-1.06 3.75 3.75 0 00-6.38 2.252c-.033.307-.052.618-.057.933l-.024 1.399c-.003.158-.003.316.002.473l.024 1.4c.005.315.024.626.057.933a3.75 3.75 0 006.38 2.252.75.75 0 00-1.06-1.06 2.25 2.25 0 01-3.828-1.351l-.025-1.402a9.55 9.55 0 01-.001-.472l.025-1.402z" clipRule="evenodd" /> {/* Stylized generic sheet */}
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
        <label className="w-1/3 bg-slate-200 text-black font-bold text-[10px] uppercase tracking-wide flex items-center justify-center text-center px-1 rounded-l-md border border-r-0 border-slate-300 leading-tight whitespace-normal">
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

  // Refs for grid inputs
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  
  // Ref to track the editing session. 
  // This ensures that if we are drafting (editingQuotationId is null), we don't get reset by background updates.
  // Session ID will equal editingQuotationId (which can be null).
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
            // Format: Customer Name_SKC-QTN-XXXX-YYYY-YY DD.MM.YYYY
            const dateStr = formData.quotationDate || new Date().toISOString().split('T')[0];
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
    // For NEW quotations, we set ID to 0 initially (Offline Mode).
    // Real ID is generated only on SAVE to prevent collisions and background reset issues.
    
    // Auto-assign Sales Person ID if the current user is a Sales Person
    let defaultSalesPersonId: number | null = null;
    if (userRole === 'Sales Person') {
        const me = salesPersons.find(sp => sp.name === currentUser.name);
        if (me) defaultSalesPersonId = me.id;
    }

    return {
      id: 0, // 0 indicates "New/Pending"
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
      gstAdded: false,
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
    // STRICT SESSION LOCK:
    // If we are currently editing a session (editingQuotationId is set, or 0/null for draft),
    // and we have local form data, we MUST ignore background updates from 'quotations' prop.
    // This prevents other users' actions (like saving a new quote) from wiping out the current user's draft.
    
    // Start new session or update existing one
    const isReturningToCurrentSession = currentSessionIdRef.current === editingQuotationId;
    
    // If we already have form data for this specific ID (including null/0 for new), 
    // and the quotations list has updated, we only want to re-init if the data actually changed 
    // AND we are not currently the ones who just saved it.
    if (isReturningToCurrentSession && formData !== null) {
        // If we are currently editing, don't let background sync overwrite our local changes
        // unless it's a significant change or we specifically want to reload.
        return;
    }

    const quotationToEdit = quotations.find(q => q.id === editingQuotationId);
    
    // CRITICAL FIX: If we are looking for a specific ID but it's not in the list yet, 
    // WAIT. Do not fall back to createNewQuotation() as that wipes out the form state
    // during the race condition between save and sync.
    if (editingQuotationId !== null && !quotationToEdit) {
        // Wait for the quotation to appear in the props list
        return;
    }

    // Start new session
    currentSessionIdRef.current = editingQuotationId;

    // Use structured clone or deep copy to avoid mutating state directly if objects are shared
    let initialQuotation = quotationToEdit ? JSON.parse(JSON.stringify(quotationToEdit)) : createNewQuotation();
    
    // Sanitize and patch missing fields for legacy data
    if (initialQuotation.details) {
        initialQuotation.details = initialQuotation.details.map((item: QuotationItem) => ({
            ...item,
            airFreightDetails: item.airFreightDetails || { weightPerMtr: 0, airFreightLeadTime: '' }
        }));
    }

    // AUTO-REPAIR: If date is missing or invalid, set to today
    const checkDate = new Date(initialQuotation.quotationDate);
    if (!initialQuotation.quotationDate || isNaN(checkDate.getTime())) {
        initialQuotation.quotationDate = new Date().toISOString().split('T')[0];
    }
    const checkEnquiryDate = new Date(initialQuotation.enquiryDate);
    if (!initialQuotation.enquiryDate || isNaN(checkEnquiryDate.getTime())) {
        initialQuotation.enquiryDate = new Date().toISOString().split('T')[0];
    }

    // Automatically assign Sales Person if missing for new quotations
    if (editingQuotationId === null && initialQuotation.salesPersonId === null && userRole === 'Sales Person') {
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

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    // LOGGING FOR DEBUGGING VANDITA ISSUE
    console.log("Submitting Quotation:", {
        id: formData?.id,
        customerId: formData?.customerId,
        quotationDate: formData?.quotationDate,
        salesPersonId: formData?.salesPersonId
    });

    if (!formData || !formData.customerId || formData.customerId === 0) {
        alert("Please select a valid customer from the dropdown list before saving."); return;
    }
    
    // Sales Person validation
    if (!formData.salesPersonId) {
        alert("Please select a Sales Person before saving."); return;
    }

    const validatedDate = new Date(formData.quotationDate);
    if (!formData.quotationDate || isNaN(validatedDate.getTime()) || formData.quotationDate === '') {
        alert(`The Quotation Date is invalid. Please select a valid date.`); 
        return;
    }
    
    // Enquiry Date validation
    const validatedEnquiryDate = new Date(formData.enquiryDate);
    if (!formData.enquiryDate || isNaN(validatedEnquiryDate.getTime()) || formData.enquiryDate === '') {
        alert(`The Enquiry Date is invalid. Please select a valid date.`); 
        return;
    }

    // Final check for empty details
    if (!formData.details || formData.details.length === 0 || (formData.details.length === 1 && !formData.details[0].productId)) {
        alert("Please add at least one product with a valid Part Number.");
        return;
    }

    // EXTRA SECURITY: Ensure no numeric 0 IDs reach Supabase for Customer/SalesPerson
    if (formData.customerId === 0 || formData.salesPersonId === 0) {
        alert("Invalid Customer or Sales Person selection. Please select again from the list.");
        return;
    }    try {
      setIsSubmitting(true);
      const isNew = editingQuotationId === null || formData.id === 0;
      const safeQuotations = quotations || [];
      
      let idToSave = formData.id;
      if (isNew) {
          const maxId = safeQuotations.length > 0 ? Math.max(...safeQuotations.map(q => q.id)) : 0;
          idToSave = maxId + 1;
      }
      
      const quotationToSave = { ...formData, id: idToSave };
      
      const savedQuotation = await upsertQuotation(quotationToSave);
      
      await setQuotations(prev => {
          const currentQuotations = prev || [];
          if (isNew) {
              return [...currentQuotations, savedQuotation];
          }
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
      
      setSuccessModalData(savedQuotation);
      
    } catch (error) {
      console.error("Submit Error:", error);
      alert(error instanceof Error ? error.message : "Failed to save quotation");
    } finally {
      setIsSubmitting(false);
    }
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
  
  const handlePreview = (type: 'standard' | 'discounted' | 'withAirFreight') => { if (!formData || !formData.customerId) { alert("Please select a customer before previewing."); return; } setPreviewMode(type); };
  
  const handleExportExcel = async (exportType: 'standard' | 'discounted' | 'withAirFreight' = 'standard') => {
      if (!formData || !formData.details.length || !selectedCustomerObj) {
          alert("No data to export. Please select a customer and add items.");
          return;
      }

      try {
          const workbook = new ExcelJS.Workbook();
          const worksheet = workbook.addWorksheet('Quotation');

          const qtnNo = generateFormattedQuotationNumber(formData, quotations || []);
          const dateStr = new Date(formData.quotationDate).toLocaleDateString('en-GB');

          // 1. FONT & BASE STYLING
          worksheet.columns = [
              { key: 'sl', width: 6 },
              { key: 'part', width: 22 },
              { key: 'desc', width: 50 },
              { key: 'moq', width: 10 },
              { key: 'req', width: 10 },
              { key: 'uom', width: 8 },
              { key: 'p1', width: 15 },
              { key: 'p2', width: 15 },
              { key: 'p3', width: 15 },
              { key: 'p4', width: 15 },
              { key: 'stock', width: 18 }
          ];

          const baseFont = { name: 'Cambria', size: 10 };
          const titleFont = { name: 'Cambria', size: 14, bold: true };
          const headerFont = { name: 'Cambria', size: 10, bold: true };

          // 2. LOGO
          if (logoUrl) {
              try {
                  let buffer;
                  let extension: 'png' | 'jpeg' = 'png';
                  
                  if (logoUrl.startsWith('data:')) {
                      const base64Data = logoUrl.split(',')[1];
                      buffer = Buffer.from(base64Data, 'base64');
                      extension = logoUrl.includes('image/jpeg') || logoUrl.includes('image/jpg') ? 'jpeg' : 'png';
                  } else {
                      const response = await fetch(logoUrl);
                      buffer = await response.arrayBuffer();
                  }

                  if (buffer) {
                      const imageId = workbook.addImage({
                          buffer: buffer,
                          extension: extension,
                      });
                      worksheet.addImage(imageId, {
                          tl: { col: 0, row: 0 },
                          ext: { width: 140, height: 70 }
                      });
                      // Push the header text down if logo is present
                      for(let i=0; i<4; i++) worksheet.addRow([]);
                  }
              } catch (e) {
                  console.error("Logo export error:", e);
              }
          }

          // 3. COMPANY HEADER
          const headerRowsArr = [
              ["SIDDHI KABEL CORPORATION PVT LTD"],
              ["# 3, 1st Main, 1st Block, B S K 3rd Stage, BENGALURU-560085."],
              ["Tel: 080-26720440 / Mob: 9620000947 | E-Mail: info@siddhikabel.com"],
              ["GSTIN/UIN: 29AAMCS4385H1ZQ | State Name : Karnataka, Code: 29"],
              [],
              ["QUOTATION"],
              []
          ];

          headerRowsArr.forEach((r, idx) => {
              const row = worksheet.addRow(r);
              row.eachCell(cell => {
                  cell.font = idx === 0 ? titleFont : baseFont;
                  cell.alignment = { horizontal: 'center' };
              });
              if (idx <= 5) worksheet.mergeCells(row.number, 1, row.number, 11);
          });

          // 4. CUSTOMER & QUOTATION DETAILS
          const detailRowsArr = [
              ["BILLED TO:", "", "", "", "", "", "", "", "Quotation No:", qtnNo],
              [selectedCustomerObj.name, "", "", "", "", "", "", "", "Date:", dateStr],
              [selectedCustomerObj.address, "", "", "", "", "", "", "", "Enquiry Date:", new Date(formData.enquiryDate).toLocaleDateString('en-GB')],
              [`${selectedCustomerObj.city} - ${selectedCustomerObj.pincode}`, "", "", "", "", "", "", "", "Sales Person:", salesPersons.find(sp => sp.id === formData.salesPersonId)?.name || 'N/A'],
              [`Attn: ${formData.contactPerson} (${formData.contactNumber})`, "", "", "", "", "", "", "", "", ""]
          ];

          detailRowsArr.forEach((r, idx) => {
              const row = worksheet.addRow(r);
              row.eachCell((cell, colNumber) => {
                  cell.font = (idx === 0 && colNumber <= 1) || colNumber >= 9 ? headerFont : baseFont;
                  if (colNumber >= 9) cell.alignment = { horizontal: 'right' };
              });
          });
          worksheet.addRow([]); // Gap

          // 5. TABLE HEADERS
          let tableHeadersArr: string[] = [];
          if (exportType === 'withAirFreight') {
              tableHeadersArr = ["Sl. No", "Part No", "Description", "MOQ", "REQ", "UOM", "Unit Price", "Air Freight", "Total Unit Price", "Total Amount", "Stock Status"];
          } else if (exportType === 'discounted') {
              tableHeadersArr = ["Sl. No", "Part No", "Description", "MOQ", "REQ", "UOM", "LP", "Disc %", "Net Price", "Total Amount", "Stock Status"];
          } else {
              tableHeadersArr = ["Sl. No", "Part No", "Description", "MOQ", "REQ", "UOM", "Unit Price", "Total Amount", "Stock Status"];
          }

          const tableHeaderRow = worksheet.addRow(tableHeadersArr);
          tableHeaderRow.eachCell(cell => {
              cell.font = headerFont;
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
              cell.border = { bottom: { style: 'thin' }, top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
              cell.alignment = { horizontal: 'center' };
          });

          // 6. DATA ROWS
          const startDataRow = tableHeaderRow.number + 1;
          formData.details.forEach((item, index) => {
              const rowNum = startDataRow + index;
              let rowData: any[] = [];
              
              if (exportType === 'withAirFreight') {
                  const weight = item.airFreightDetails?.weightPerMtr || 0;
                  const freightPerMtr = weight ? (weight / 1000 * 150) : 0;
                  const up = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
                  rowData = [
                      index + 1, item.partNo, item.description, item.moq, item.req, item.uom,
                      up, (item.airFreight ? freightPerMtr : 0),
                      { formula: `ROUND(G${rowNum}+H${rowNum}, 2)` },
                      { formula: `ROUND(D${rowNum}*I${rowNum}, 2)` },
                      item.stockStatus
                  ];
              } else if (exportType === 'discounted') {
                  const lp = item.price;
                  const d = (parseFloat(String(item.discount)) || 0) / 100;
                  rowData = [
                      index + 1, item.partNo, item.description, item.moq, item.req, item.uom,
                      lp, d,
                      { formula: `ROUND(G${rowNum}*(1-H${rowNum}), 2)` },
                      { formula: `ROUND(D${rowNum}*I${rowNum}, 2)` },
                      item.stockStatus
                  ];
              } else {
                  const up = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
                  rowData = [
                      index + 1, item.partNo, item.description, item.moq, item.req, item.uom,
                      up,
                      { formula: `ROUND(D${rowNum}*G${rowNum}, 2)` },
                      item.stockStatus
                  ];
              }

              const row = worksheet.addRow(rowData);
              row.eachCell((cell, colNumber) => {
                  cell.font = baseFont;
                  cell.border = { bottom: { style: 'thin' }, top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
                  
                  // Alignment
                  if ([1, 4, 5, 6].includes(colNumber)) cell.alignment = { horizontal: 'center' };
                  if ([7, 8, 9, 10].includes(colNumber)) {
                      cell.alignment = { horizontal: 'right' };
                      cell.numFmt = colNumber === 8 && exportType === 'discounted' ? '0.00%' : '0.00';
                  }
              });
          });

          // 7. SUMMARY
          const lastDataRow = worksheet.lastRow!.number;
          const totalColChar = exportType === 'withAirFreight' || exportType === 'discounted' ? 'J' : 'H';
          
          worksheet.addRow([]);
          const subtotalRow = worksheet.addRow(["", "", "", "", "", "", "", "SUBTOTAL:", { formula: `ROUND(SUM(${totalColChar}${startDataRow}:${totalColChar}${lastDataRow}), 2)` }]);
          subtotalRow.getCell(8).font = headerFont;
          subtotalRow.getCell(9).numFmt = '#,##0.00';
          subtotalRow.getCell(9).font = headerFont;

          if (formData.gstAdded) {
              const gstRow = worksheet.addRow(["", "", "", "", "", "", "", "GST 18%:", { formula: `ROUND(${totalColChar}${subtotalRow.number}*0.18, 2)` }]);
              gstRow.getCell(8).font = headerFont;
              gstRow.getCell(9).numFmt = '#,##0.00';

              const grandTotalRow = worksheet.addRow(["", "", "", "", "", "", "", "GRAND TOTAL:", { formula: `ROUND(${totalColChar}${subtotalRow.number}*1.18, 2)` }]);
              grandTotalRow.getCell(8).font = titleFont;
              grandTotalRow.getCell(9).numFmt = '#,##0.00';
              grandTotalRow.getCell(9).font = titleFont;
          }

          // 8. FOOTER (Words & Terms)
          worksheet.addRow([]);
          const wordsRow = worksheet.addRow(["Amount in Words:", ""]);
          wordsRow.getCell(1).font = headerFont;
          
          const fSub = formData.details.reduce((s, i) => {
              const up = i.price * (1 - (parseFloat(String(i.discount)) || 0) / 100);
              const af = i.airFreight ? ((i.airFreightDetails?.weightPerMtr || 0) / 1000 * 150) : 0;
              return s + (up + af) * i.moq;
          }, 0);
          const fGrand = formData.gstAdded ? fSub * 1.18 : fSub;
          wordsRow.getCell(2).value = numberToWords(fGrand);
          wordsRow.getCell(2).font = baseFont;
          worksheet.mergeCells(wordsRow.number, 2, wordsRow.number, 11);

          worksheet.addRow([]);
          worksheet.addRow(["Terms & Conditions:"]).getCell(1).font = headerFont;
          const termsArr = [
            `1. Prices: Ex Godown, Bangalore. (The Above Mentioned Price Is Net Disounted)`,
            `2. Goods Service Tax: ${formData.gstAdded ? 'GST 18% or As applicable' : 'GST Extra 18% or As applicable'}`,
            `3. Delivery: Subject to Prior Sales.`,
            `4. Payment terms: ${formData.paymentTerms || 'As mentioned'}`,
            `5. Validity: Valid for One Week.`,
            `6. Other terms: ${formData.otherTerms || 'None'}`
          ];
          
          termsArr.forEach(t => {
              const row = worksheet.addRow([t]);
              row.getCell(1).font = baseFont;
              worksheet.mergeCells(row.number, 1, row.number, 11); // Span across all columns
          });

          worksheet.addRow([]);
          worksheet.addRow([]);
          const signTitle = worksheet.addRow(["", "", "", "", "", "For SIDDHI KABEL CORPORATION PVT LTD,"]);
          signTitle.getCell(6).font = headerFont;
          worksheet.mergeCells(signTitle.number, 6, signTitle.number, 11);
          
          worksheet.addRow([]);
          worksheet.addRow([]);
          const signBottom = worksheet.addRow(["", "", "", "", "", "Authorised Signatory"]);
          signBottom.getCell(6).font = headerFont;
          worksheet.mergeCells(signBottom.number, 6, signBottom.number, 11);

          // Export
          const buffer = await workbook.xlsx.writeBuffer();
          saveAs(new Blob([buffer]), `Quotation_${qtnNo.replace(/\//g, '-')}.xlsx`);

      } catch (error) {
          console.error("Excel Export Error:", error);
          alert("Failed to export Excel. Error: " + (error instanceof Error ? error.message : String(error)));
      }
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
      
      // Automatically assign Sales Person if missing for new quotations
      if (editingQuotationId === null && formData.salesPersonId === null && userRole === 'Sales Person') {
          const currentSp = salesPersons.find(sp => sp.name === currentUser.name);
          if (currentSp) {
              setFormData(prev => prev ? { ...prev, salesPersonId: currentSp.id } : null);
          }
      }

      const baseTotals = formData.details.reduce((acc, item) => {
          const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100);
          acc.moq += item.moq || 0;
          acc.req += item.req || 0;
          acc.amount += unitPrice * item.moq || 0;
          const weight = item.airFreightDetails?.weightPerMtr || 0;
          acc.airFreightAmount += item.airFreight ? (weight / 1000 * 150) * item.moq : 0;
          return acc;
      }, { moq: 0, req: 0, amount: 0, airFreightAmount: 0 });

      const gstAmount = formData.gstAdded ? (baseTotals.amount + baseTotals.airFreightAmount) * 0.18 : 0;
      const grandTotal = baseTotals.amount + baseTotals.airFreightAmount + gstAmount;

      return { ...baseTotals, gstAmount, grandTotal };
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
            <h2 className="text-lg font-bold text-black">Preview</h2>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => {
                  const dateStr = formData.quotationDate || new Date().toISOString().split('T')[0];
                  const dateParts = dateStr.split('-');
                  const formattedDate = dateParts.length === 3 ? `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}` : dateStr;
                  const qtnNo = generateFormattedQuotationNumber(formData, quotations || []).replace(/\//g, '-');
                  const customerName = (selectedCustomerObj?.name || 'Customer').trim();
                  document.title = `${customerName}_${qtnNo} ${formattedDate}`;
                  window.print();
                }} 
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded-md text-xs transition duration-300"
              >
                Print
              </button>
              <button 
                onClick={() => handleExportExcel(previewMode as any)}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded-md text-xs transition duration-300"
              >
                Export to Excel
              </button>
              <button onClick={() => setPreviewMode('none')} className="bg-slate-500 hover:bg-slate-600 text-white font-bold py-1 px-3 rounded-md text-xs transition duration-300">Close</button>
            </div>
          </div>
          <div id="print-area">
             {previewMode === 'standard' && <QuotationPrintView quotation={formData} allQuotations={quotations || []} customer={selectedCustomerObj} salesPerson={selectedSalesPerson} logoUrl={logoUrl ?? null}/>}
             {previewMode === 'discounted' && <QuotationPrintViewDiscounted quotation={formData} allQuotations={quotations || []} customer={selectedCustomerObj} salesPerson={selectedSalesPerson} logoUrl={logoUrl ?? null}/>}
             {previewMode === 'withAirFreight' && <QuotationPrintViewWithAirFreight quotation={formData} allQuotations={quotations || []} customer={selectedCustomerObj} salesPerson={selectedSalesPerson} logoUrl={logoUrl ?? null}/>}
          </div>
        </div>
    );
  }

  if (!formData) return <div className="p-8 text-center text-xs text-black">Loading form...</div>;

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
                {!isReadOnly && (
                    <ActionButton 
                        onClick={handleSubmit} 
                        title={isSubmitting ? "Saving..." : "Save Quotation"} 
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <div className="animate-spin h-3 w-3 border-2 border-white/30 border-t-white rounded-full" />
                        ) : (
                            <Icons.Save />
                        )}
                        <span>{isSubmitting ? "Saving..." : "Save"}</span>
                    </ActionButton>
                )}
                <div className="h-6 border-l border-slate-300 mx-1"></div>
                <div className="flex items-center bg-white border border-slate-200 rounded-md p-1 shadow-sm gap-1">
                    <span className="text-[10px] font-bold text-slate-500 px-1 uppercase border-r border-slate-200 mr-1">Print:</span>
                    <ActionButton onClick={() => handlePreview('standard')} title="Print Standard"><Icons.PrintStandard /><span>Standard</span></ActionButton>
                    <ActionButton onClick={() => handlePreview('discounted')} title="Print Discount"><Icons.PrintDiscount /><span>Discount</span></ActionButton>
                    <ActionButton onClick={() => handlePreview('withAirFreight')} title="Print Airfreight"><Icons.PrintAirFreight /><span>Airfreight</span></ActionButton>
                </div>
                <div className="h-6 border-l border-slate-300 mx-1"></div>
                <ActionButton onClick={handleExportExcel} title="Export to Excel"><Icons.Excel /><span>Export Excel</span></ActionButton>
                <div className="h-6 border-l border-slate-300 mx-1"></div>
                <ActionButton onClick={() => setIsStockCheckModalOpen(true)} title="Check Stock Availability"><Icons.Stock /><span>Check Stock</span></ActionButton>
                <div className="h-6 border-l border-slate-300 mx-1"></div>
                {!isReadOnly && <ActionButton onClick={() => setIsCustomerModalOpen(true)} title="Add New Customer"><Icons.AddCustomer /><span>Customer</span></ActionButton>}
                {!isReadOnly && <ActionButton onClick={() => setIsProductModalOpen(true)} title="Add New Product"><Icons.AddProduct /><span>Product</span></ActionButton>}
                {!isReadOnly && <ActionButton onClick={() => setIsProductSearchModalOpen(true)} title="Search Product"><Icons.SearchProduct /><span>Search</span></ActionButton>}
                <div className="h-6 border-l border-slate-300 mx-1"></div>
                <button
                    type="button"
                    onClick={() => setFormData(prev => prev ? { ...prev, gstAdded: !prev.gstAdded } : null)}
                    className={`flex items-center gap-1.5 border border-slate-200 shadow-sm rounded-md px-2.5 py-1.5 text-xs font-bold transition-all transform active:scale-95 ${formData.gstAdded ? 'bg-green-600 text-white border-green-700' : 'bg-white text-black hover:bg-slate-50'}`}
                    title="Toggle GST Added Option"
                >
                    {formData.gstAdded ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-emerald-600">
                            <path d="M12 7.5a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" />
                            <path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v14.25c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 011.5 19.125V4.875zM11.25 15a3 3 0 116 0 3 3 0 01-6 0zM3.75 15a3 3 0 116 0 3 3 0 01-6 0z" clipRule="evenodd" />
                        </svg>
                    )}
                    <span>GST Added</span>
                </button>
            </div>
            
            {(isReadOnly && (userRole === 'Sales Person' && !isMobile)) && formData.id !== 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 mb-2 text-xs text-yellow-700">
                    <p className="font-bold">View Only Mode</p>
                    <p>You are viewing a quotation created by another Sales Person. You cannot edit this.</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-2 gap-y-1 text-xs">
                <div className="space-y-1">
                    <FormField label="Quotation No"><div className="px-2 py-1 bg-slate-50 font-bold text-black rounded-r-md border border-slate-300 h-full flex items-center text-xs shadow-sm text-[11px] truncate" title={formData.id > 0 ? generateFormattedQuotationNumber(formData, quotations || []) : "New"}>{formData.id > 0 ? generateFormattedQuotationNumber(formData, quotations || []) : "New"}</div></FormField>
                    <FormField label="Quotation Date"><input type="date" name="quotationDate" value={formData.quotationDate} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm text-black" disabled={isReadOnly}/></FormField>
                    <FormField label="Enquiry Date"><input type="date" name="enquiryDate" value={formData.enquiryDate} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm text-black" disabled={isReadOnly}/></FormField>
                    <FormField label="Customer" className='items-start'><div className={`h-full border border-slate-300 rounded-r-md shadow-sm text-black ${isReadOnly ? 'bg-slate-100' : ''}`}><SearchableSelect<Customer> options={searchedCustomers} value={formData.customerId} onChange={val => { if(!isReadOnly) { setFormData(prev => prev ? { ...prev, customerId: val as number | null } : null); const customer = searchedCustomers.find(c => c.id === val); if(customer) setSelectedCustomerObj(customer); } }} idKey="id" displayKey="name" placeholder="Search customer..." onSearch={setCustomerSearchTerm} isLoading={isSearchingCustomers} onOpen={handleCustomerOpen}/></div></FormField>
                     {selectedCustomerObj && (
                        <div className="ml-[33.33%] pl-1 text-[10px] text-black whitespace-normal break-words leading-tight" title={`${selectedCustomerObj.address}, ${selectedCustomerObj.city} - ${selectedCustomerObj.pincode}`}>
                            {selectedCustomerObj.address}, {selectedCustomerObj.city} - {selectedCustomerObj.pincode}
                        </div>
                     )}
                </div>
                <div className="space-y-1">
                    <FormField label="Contact Name"><input type="text" name="contactPerson" value={formData.contactPerson} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm text-black" disabled={isReadOnly}/></FormField>
                    <FormField label="Contact No"><input type="text" name="contactNumber" value={formData.contactNumber} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm text-black" disabled={isReadOnly}/></FormField>
                    <FormField label="Other Terms"><input type="text" name="otherTerms" value={formData.otherTerms} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm text-black" disabled={isReadOnly}/></FormField>
                    <FormField label="Payment"><select name="paymentTerms" value={formData.paymentTerms} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm disabled:bg-slate-100 text-black" disabled={isReadOnly}>{PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}</select></FormField>
                    <FormField label="Prepared By"><select name="preparedBy" value={formData.preparedBy} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm disabled:bg-slate-100 text-black" disabled={isReadOnly}>{PREPARED_BY_LIST.map(p => <option key={p} value={p}>{p}</option>)}</select></FormField>
                </div>
                <div className="space-y-1">
                    <FormField label="Products Brand"><select name="productsBrand" value={formData.productsBrand} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm disabled:bg-slate-100 text-black" disabled={isReadOnly}>{PRODUCTS_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}</select></FormField>
                    <FormField label="Sales Person"><select name="salesPersonId" value={formData.salesPersonId || ''} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm disabled:bg-slate-100 text-black" disabled={isReadOnly}><option value="">Select...</option>{salesPersons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></FormField>
                    <FormField label="Enquiry Mode"><select name="modeOfEnquiry" value={formData.modeOfEnquiry} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm disabled:bg-slate-100 text-black" disabled={isReadOnly}>{MODES_OF_ENQUIRY.map(m => <option key={m} value={m}>{m}</option>)}</select></FormField>
                    <FormField label="Status"><select name="status" value={formData.status} onChange={handleChange} className="w-full px-2 py-1 h-full text-xs border border-slate-300 bg-white rounded-r-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm disabled:bg-slate-100 text-black">{QUOTATION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></FormField>
                    {selectedCustomerObj && selectedCustomerObj.discountStructure && (
                        <div className="flex flex-wrap gap-1 mt-1 text-[10px] border border-slate-200 p-1 rounded bg-slate-50 text-black">
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
                    <thead className="bg-slate-200 text-black font-semibold">
                        <tr className="divide-x divide-slate-300">
                            {gridColumns.map(h => <th key={h} className="p-1 text-center whitespace-nowrap">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody className="bg-white text-xs text-black">{(formData.details || []).map((item, index) => {
                        const unitPrice = item.price * (1 - (parseFloat(String(item.discount)) || 0) / 100); 
                        const amount = unitPrice * (item.moq || 0); 
                        const freightPerMtr = item.airFreightDetails?.weightPerMtr ? (item.airFreightDetails.weightPerMtr / 1000 * 150) : 0; 
                        const freightTotal = item.airFreight ? freightPerMtr * (item.moq || 0) : 0; 
                        const currentProduct = fetchedProducts.get(item.productId);
                        const optionsForSelect = [...searchedProducts];
                        if(currentProduct && !optionsForSelect.some(p => p.id === currentProduct.id)) {
                            optionsForSelect.unshift(currentProduct);
                        }
                        return (
                        <tr key={index} className="divide-x divide-slate-200 hover:bg-slate-50">
                            {/* SL No */}
                            <td className="border-t border-slate-300 p-1 text-center bg-slate-50 text-black">{index + 1}</td>
                            
                            {/* Part No */}
                            <td className="border-t border-slate-300 w-40 align-top">
                                <div className={`h-6 ${isReadOnly ? 'bg-slate-100' : ''} text-black`}>
                                    <SearchableSelect<Product> options={optionsForSelect} value={item.productId} onChange={val => { if(!isReadOnly) handleProductSelect(index, val); }} idKey="id" displayKey="partNo" placeholder="Search..." onSearch={setProductSearchTerm} isLoading={isSearchingProducts} onOpen={handleProductOpen} />
                                </div>
                            </td>
                            
                            {/* Description */}
                            <td className="border-t border-slate-300 p-1 min-w-[160px] max-w-[250px] align-top text-black truncate" title={item.description}>{item.description}</td>
                            
                            {/* MOQ */}
                            <td className="border-t border-slate-300 align-top">
                                <input 
                                    type="number" 
                                    ref={(el) => { inputRefs.current[`${index}-moq`] = el; }}
                                    value={item.moq} 
                                    onChange={e => handleItemChange(index, 'moq', parseInt(e.target.value) || 0)} 
                                    onKeyDown={(e) => handleGridKeyDown(e, index, 'moq')}
                                    onFocus={(e) => e.target.select()}
                                    className="w-12 p-0.5 text-center h-6 border-transparent hover:border-slate-300 focus:border-blue-500 rounded disabled:bg-slate-100 text-xs text-black" 
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
                                    className="w-12 p-0.5 text-center h-6 border-transparent hover:border-slate-300 focus:border-blue-500 rounded disabled:bg-slate-100 text-xs text-black" 
                                    disabled={isReadOnly}
                                />
                            </td>
                            
                            {/* Price (LP/SP) */}
                            <td className="border-t border-slate-300 align-top">
                                <div className="flex items-center bg-slate-100 h-6">
                                    <input type="number" step="0.01" value={item.price.toFixed(2)} className="w-14 p-0.5 text-right h-full bg-transparent text-xs whitespace-nowrap text-black" disabled/>
                                    <select 
                                        value={item.priceSource} 
                                        className="bg-transparent border-l border-slate-200 p-0 text-[9px] text-black h-full appearance-none text-center w-6 focus:outline-none" 
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
                                    className="w-10 p-0.5 text-center h-6 border-transparent hover:border-slate-300 focus:border-blue-500 rounded disabled:bg-slate-100 text-xs text-black" 
                                    disabled={isReadOnly}
                                />
                            </td>
                            
                            {/* Unit Price */}
                            <td className="border-t border-slate-300 p-1 text-right bg-slate-100 align-top font-medium h-6 whitespace-nowrap text-black">
                                {unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            {/* Amount */}
                            <td className="border-t border-slate-300 p-1 text-right bg-slate-100 align-top font-medium h-6 whitespace-nowrap text-black">
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
                                    className="w-16 p-0.5 h-6 border-transparent hover:border-slate-300 focus:border-blue-500 rounded disabled:bg-slate-100 text-xs text-black" 
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
                                         <input 
                                            type="number" 
                                            step="0.001" 
                                            ref={(el) => { inputRefs.current[`${index}-airWeight`] = el; }}
                                            value={item.airFreightDetails?.weightPerMtr || 0} 
                                            onChange={e => handleItemChange(index, 'airFreightDetails.weightPerMtr', parseFloat(e.target.value) || 0)} 
                                            onKeyDown={(e) => handleGridKeyDown(e, index, 'airWeight')}
                                            onFocus={(e) => e.target.select()}
                                            className="w-full p-0.5 text-right border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-xs text-black" 
                                            title="Weight (kg/m) for calculation"
                                        />
                                    ) : (
                                        <span className="text-right flex-grow text-[10px] text-black">{freightPerMtr.toFixed(2)}</span>
                                    )}
                                </div>
                            </td>

                            {/* Air Freight Amt */}
                            <td className="border-t border-slate-300 p-1 text-right bg-slate-100 align-top font-medium h-6 whitespace-nowrap text-black">
                                {freightTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </td>

                            {/* Air Lead Time */}
                            <td className="border-t border-slate-300 align-top">
                                <input 
                                    type="text" 
                                    ref={(el) => { inputRefs.current[`${index}-airLeadTime`] = el; }}
                                    value={item.airFreightDetails?.airFreightLeadTime || ''} 
                                    onChange={e => handleItemChange(index, 'airFreightDetails.airFreightLeadTime', e.target.value)} 
                                    onKeyDown={(e) => handleGridKeyDown(e, index, 'airLeadTime')}
                                    onFocus={(e) => e.target.select()}
                                    className="w-20 p-0.5 h-6 border-transparent hover:border-slate-300 focus:border-blue-500 rounded disabled:bg-slate-100 text-xs text-black" 
                                    disabled={!item.airFreight || isReadOnly}
                                />
                            </td>

                            {/* Actions */}
                            {!isReadOnly && (
                                <td className="border-t border-slate-300 text-center align-middle">
                                    <div className="flex items-center justify-center gap-1">
                                        <button type="button" onClick={() => handleInsertItem(index)} className="hover:scale-110 transition-transform p-0.5" title="Insert Row Below">
                                            <Icons.Insert />
                                        </button>
                                        <button type="button" onClick={() => handleRemoveItem(index)} className="text-rose-500 hover:text-rose-700 hover:scale-110 transition-all p-0.5" title="Remove Item">
                                            <Icons.Trash />
                                        </button>
                                    </div>
                                </td>
                            )}
                        </tr>
                    );})}</tbody>
                </table>
            </div>
             <div className="flex justify-end mt-2 mb-4 items-center gap-2">
                {!isReadOnly && (
                    <>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Rows:</span>
                        <input 
                            type="number" 
                            min="1" 
                            max="50"
                            value={rowsToAdd}
                            onChange={(e) => setRowsToAdd(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-12 h-7 p-1 text-center border border-slate-300 rounded text-xs text-black"
                        />
                        <button type="button" onClick={() => handleAddItem(rowsToAdd)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-7 px-3 text-xs rounded shadow-sm flex items-center gap-1 transition-all">
                            <Icons.New />
                            <span>Add Items</span>
                        </button>
                    </>
                )}
             </div>
        </form>
      </div>
      <CustomerAddModal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} onSave={handleSaveCustomer} salesPersons={salesPersons} />
      <ProductAddModal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} onSave={handleSaveProduct} />
      <ProductSearchModal isOpen={isProductSearchModalOpen} onClose={() => setIsProductSearchModalOpen(false)} onSelect={handleAddProductFromSearch}/>
      <StockCheckModal 
        isOpen={isStockCheckModalOpen}
        onClose={() => setIsStockCheckModalOpen(false)}
        stockStatements={stockStatements}
        pendingSOs={pendingSOs}
      />
      <QuotationSuccessModal 
         isOpen={!!successModalData} 
         onClose={() => setSuccessModalData(null)} 
         quotation={successModalData} 
         customer={selectedCustomerObj}
         salesPerson={salesPersons.find(sp => sp.id === successModalData?.salesPersonId) || null}
         onPrint={(type) => { setSuccessModalData(null); handlePreview(type); }}
         onExportExcel={(type) => { handleExportExcel(type); }}
      />
      
      <div className="fixed bottom-0 left-0 w-full bg-slate-800 text-white p-2 shadow-inner z-40 flex items-center justify-between px-6 text-xs font-medium">
          <div className="flex gap-6">
              <div>Total MOQ: <span className="font-bold text-yellow-400 ml-1">{totals.moq}</span></div>
              <div>Total REQ: <span className="font-bold text-yellow-400 ml-1">{totals.req}</span></div>
          </div>
          <div className="flex gap-6">
              <div>Amount: <span className="font-bold text-green-400 ml-1">{totals.amount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>
              <div>Air Freight: <span className="font-bold text-blue-400 ml-1">{totals.airFreightAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>
              {formData.gstAdded && <div>GST (18%): <span className="font-bold text-teal-400 ml-1">{totals.gstAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>}
              <div className="border-l border-slate-600 pl-4">Grand Total: <span className="font-bold text-white text-sm ml-1">{totals.grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>
          </div>
      </div>
    </div>
  );
};
