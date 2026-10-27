import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { View, SalesPerson, Customer, Product, Quotation, User, QuotationStatus } from './types';
import { useOnlineStorage } from './hooks/useOnlineStorage';
import { Login } from './components/Login';
import { PasswordChangeModal } from './components/PasswordChangeModal';
import { DEFAULT_LOGO_BASE64 } from './constants';
import { CustomerResponsePage } from './components/CustomerResponsePage';
import { PublicPdfViewer } from './components/PublicPdfViewer';

// Route-level code-splitting for high performance & instant initial load
const SalesPersonManager = React.lazy(() => import('./components/SalesPersonManager').then(m => ({ default: m.SalesPersonManager })));
const CustomerManager = React.lazy(() => import('./components/CustomerManager').then(m => ({ default: m.CustomerManager })));
const ProductManager = React.lazy(() => import('./components/ProductManager').then(m => ({ default: m.ProductManager })));
const QuotationManager = React.lazy(() => import('./components/QuotationManager').then(m => ({ default: m.QuotationManager })));
const QuotationForm = React.lazy(() => import('./components/QuotationForm').then(m => ({ default: m.QuotationForm })));
const Dashboard = React.lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const UserManager = React.lazy(() => import('./components/UserManager').then(m => ({ default: m.UserManager })));
const CustomerLoginManager = React.lazy(() => import('./components/CustomerLoginManager').then(m => ({ default: m.CustomerLoginManager })));
const CalendarView = React.lazy(() => import('./components/CalendarView').then(m => ({ default: m.CalendarView })));
const UserManual = React.lazy(() => import('./components/UserManual').then(m => ({ default: m.UserManual })));
const StorageManager = React.lazy(() => import('./components/StorageManager').then(m => ({ default: m.StorageManager })));

const ViewLoadingFallback = () => (
  <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] p-8 text-center animate-pulse">
    <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mb-3" />
    <p className="text-xs font-semibold text-slate-500">Loading view...</p>
  </div>
);

export const App = () => {
  const [users, setUsers, usersLoading, usersError] = useOnlineStorage<User>('users');
  const [salesPersons, setSalesPersons, salesPersonsLoading, salesPersonsError] = useOnlineStorage<SalesPerson>('salesPersons');
  const [customers, setCustomers, customersLoading, customersError] = useOnlineStorage<Customer>('customers');
  const [quotations, setQuotations, quotationsLoading, quotationsError] = useOnlineStorage<Quotation>('quotations');

  const [view, setView] = useState<View | 'calendar'>('dashboard');
  const [editingQuotationId, setEditingQuotationId] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = sessionStorage.getItem('active_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isPasswordChangeRequired, setIsPasswordChangeRequired] = useState(false);
  const [quotationFilter, setQuotationFilter] = useState<{ customerIds?: number[], status?: QuotationStatus } | null>(null);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [globalSearchInput, setGlobalSearchInput] = useState('');
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem('company_logo') || DEFAULT_LOGO_BASE64;
    } catch (e) {
      return DEFAULT_LOGO_BASE64;
    }
  });

  
  // Shortcut: Ctrl+K / Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('global-search-input');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isSyncingBackgroundData = quotationsLoading || customersLoading;
  // Non-blocking initial load: only wait for critical auth & staff metadata (sub-second!)
  const isLoadingData = usersLoading || salesPersonsLoading;
  const dataError = usersError || salesPersonsError;

  // Ensure Customer role is locked to quotations
  useEffect(() => {
    if (currentUser?.role === 'Customer' && view !== 'quotations' && view !== 'quotation-form') {
      setView('quotations');
    }
  }, [currentUser, view]);

  // Handle Deep Linking for Quotations
  useEffect(() => {
    if (!isLoadingData && currentUser) {
      const urlParams = new URLSearchParams(window.location.search);
      const quotationId = urlParams.get('id');
      if (quotationId) {
        const id = parseInt(quotationId, 10);
        if (!isNaN(id)) {
          const exists = quotations?.some(q => q.id === id);
          if (exists) {
            setEditingQuotationId(id);
            setView('quotation-form');
          }
        }
      }
    }
  }, [isLoadingData, currentUser, quotations]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    try { sessionStorage.setItem('active_user', JSON.stringify(user)); } catch (e) {}
    if (user.password === '123456') {
      setIsPasswordChangeRequired(true);
      setIsPasswordModalOpen(true);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try { sessionStorage.removeItem('active_user'); } catch (e) {}
    setView('dashboard');
    setEditingQuotationId(null);
    setQuotationFilter(null);
    // Clean up URL on logout
    const url = new URL(window.location.href);
    if (!url.protocol.startsWith('blob')) {
      url.searchParams.delete('id');
      window.history.pushState({}, '', url);
    }
  };

  const handlePasswordChange = async (newPassword: string) => {
    if (currentUser && users) {
      const updatedUsers = users.map(u => u.name === currentUser.name ? { ...u, password: newPassword } : u);
      await setUsers(updatedUsers);
      setIsPasswordModalOpen(false);
      setIsPasswordChangeRequired(false);
      const updatedUser = { ...currentUser, password: newPassword };
      setCurrentUser(updatedUser);
      try { sessionStorage.setItem('active_user', JSON.stringify(updatedUser)); } catch (e) {}
    }
  };

  const handleLogoUpload = (url: string | null) => {
    setLogoUrl(url);
    try {
      if (url) {
        localStorage.setItem('company_logo', url);
      } else {
        localStorage.removeItem('company_logo');
      }
    } catch (e) {
      console.error("Failed to save logo to local storage:", e);
      alert("Failed to save logo locally (likely due to size limits). It will be reset on reload.");
    }
  };

  const navigateToQuotationsWithFilter = (filter: { customerIds?: number[], status?: QuotationStatus }) => {
    setQuotationFilter(filter);
    setView('quotations');
  };

  const handleSetView = (newView: View | 'calendar') => {
    setView(newView);
    if (newView === 'quotation-form') {
      setIsSidebarExpanded(false);
    }
    // Clear deep link parameter when navigating away manually
    if (newView === 'quotations') {
      const url = new URL(window.location.href);
      if (!url.protocol.startsWith('blob')) {
        url.searchParams.delete('id');
        window.history.pushState({}, '', url);
      }
    }
  }

  // --- Customer Response URL handler (public, no login required) ---
  // MUST be checked BEFORE loading/auth guards so customers can use it without an account
  const customerResponseParams = (() => {
    const params = new URLSearchParams(window.location.search);
    const qr = params.get('qr');
    const action = params.get('action');
    if (qr && action) {
      const id = parseInt(qr, 10);
      if (!isNaN(id)) return { quotationId: id, action, reason: params.get('reason') || undefined };
    }
    return null;
  })();
  const publicPdfParams = (() => {
    const params = new URLSearchParams(window.location.search);
    const viewPdf = params.get('view_pdf');
    if (viewPdf) {
      const id = parseInt(viewPdf, 10);
      if (!isNaN(id)) return { quotationId: id, format: params.get('format') };
    }
    return null;
  })();

  if (customerResponseParams) {
    return (
      <CustomerResponsePage
        quotationId={customerResponseParams.quotationId}
        action={customerResponseParams.action}
        reason={customerResponseParams.reason}
      />
    );
  }
  if (publicPdfParams) {
    return (
      <PublicPdfViewer
        quotationId={publicPdfParams.quotationId}
        format={publicPdfParams.format}
      />
    );
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} users={users} isLoading={usersLoading} />;
  }

  if (isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="p-8 bg-white rounded-lg shadow-md">
          <p className="text-lg text-gray-700 font-semibold">Loading Application Data...</p>
        </div>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="p-8 bg-white rounded-lg shadow-md border border-red-200">
          <h2 className="text-xl text-red-700 font-bold mb-2">Error Loading Data</h2>
          <p className="text-gray-700">{dataError.message}</p>
          <button onClick={() => window.location.reload()} className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Retry</button>
        </div>
      </div>
    );
  }

  const SidebarItem = ({ active, label, icon, onClick }: { active: boolean, label: string, icon: React.ReactNode, onClick: () => void }) => (
    <button
      onClick={onClick}
      title={!isSidebarExpanded ? label : undefined}
      className={`flex items-center py-2 mx-2 text-sm rounded-xl text-left transition-colors overflow-hidden ${
        active 
        ? 'bg-gradient-to-r from-red-500/10 to-red-500/5 text-red-600 font-bold border-l-4 border-red-500' 
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 border-l-4 border-transparent font-medium'
      } ${isSidebarExpanded ? 'px-4' : 'px-0 justify-center'}`}
    >
      <div className={`shrink-0 flex items-center justify-center transition-all ${isSidebarExpanded ? 'mr-3' : 'mx-auto'}`}>
        {icon}
      </div>
      <AnimatePresence initial={false}>
        {isSidebarExpanded && (
          <motion.span 
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="truncate block whitespace-nowrap"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );

  return (
    <div className="flex h-screen bg-[#f8f9fc] overflow-hidden">
      
      {/* Left Sidebar (Desktop) */}
      <motion.aside 
        animate={{ width: isSidebarExpanded ? 200 : 64 }}
        transition={{ type: "spring", bounce: 0, duration: 0.3 }}
        className="bg-white border-r border-slate-200 flex-col hidden md:flex z-20 shrink-0 overflow-x-hidden"
      >
        <div className="h-16 flex items-center px-4 md:px-5 border-b border-slate-100 shrink-0 overflow-hidden min-w-[200px]">
          <div className="flex items-center gap-3">
            {logoUrl ? <img src={logoUrl} alt="Logo" className="h-8 w-8 rounded-full object-cover shrink-0 shadow-sm border border-slate-200" /> : <div className="h-8 w-8 bg-red-600 rounded-full flex items-center justify-center text-white font-bold shrink-0 shadow-sm">S</div>}
            <AnimatePresence initial={false}>
              {isSidebarExpanded && (
                <motion.span 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="font-bold text-slate-800 tracking-tight text-sm whitespace-normal leading-tight"
                >
                  Siddhi Kabel Corporation Pvt Ltd
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 space-y-1 no-scrollbar overflow-x-hidden w-full">
          <div className="h-6 flex items-center mb-1">
             {isSidebarExpanded ? (
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs font-bold text-slate-400 uppercase tracking-wider px-6">Menu</motion.div>
             ) : (
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center w-full">•••</motion.div>
             )}
          </div>
          
          {currentUser.role !== 'Customer' && (
            <SidebarItem active={view === 'dashboard'} label="Dashboard" onClick={() => handleSetView('dashboard')} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>} />
          )}
          <SidebarItem active={view === 'quotations' || view === 'quotation-form'} label="Quotations" onClick={() => { setQuotationFilter(null); handleSetView('quotations'); }} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" /></svg>} />
          {currentUser.role !== 'Customer' && (
            <>
              <SidebarItem active={view === 'customers'} label="Customers" onClick={() => handleSetView('customers')} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
              <SidebarItem active={view === 'products'} label="Products" onClick={() => handleSetView('products')} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>} />
              <SidebarItem active={view === 'calendar'} label="Calendar" onClick={() => handleSetView('calendar')} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
            </>
          )}
          


          <div className="h-6 flex items-center mt-6 mb-1">
             {isSidebarExpanded ? (
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs font-bold text-slate-400 uppercase tracking-wider px-6">Admin</motion.div>
             ) : (
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center w-full">•••</motion.div>
             )}
          </div>
          

          {currentUser.role === 'Admin' && (
            <>
              <SidebarItem active={view === 'sales-persons'} label="Sales Staff" onClick={() => handleSetView('sales-persons')} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} />
              <SidebarItem active={view === 'users'} label="Users" onClick={() => handleSetView('users')} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
              <SidebarItem active={view === 'customer-logins'} label="Customer Logins" onClick={() => handleSetView('customer-logins')} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>} />
            </>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-100">
           <SidebarItem active={view === 'user-manual'} label="Help & Docs" onClick={() => handleSetView('user-manual')} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shrink-0 z-10 transition-all">
          
          {/* Left: Mobile Menu Toggle & Search */}
          <div className="flex items-center gap-4 flex-1">
             <button 
               onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} 
               className="hidden md:flex text-slate-400 hover:bg-slate-100 p-2 rounded-xl transition-colors shrink-0"
               title="Toggle Sidebar"
             >
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
               </svg>
             </button>
             
             <div className="relative max-w-md w-full hidden md:block">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
               </div>
               <input 
                 type="text" 
                 id="global-search-input"
                  placeholder="Search quotations (Ctrl+K or Enter)..." 
                 value={globalSearchInput}
                 onChange={(e) => setGlobalSearchInput(e.target.value)}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter' && globalSearchInput.trim() !== '') {
                     setGlobalSearchQuery(globalSearchInput);
                     handleSetView('quotations');
                     setGlobalSearchInput('');
                   }
                 }}
                 className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-full leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-red-500 focus:border-red-500 sm:text-sm transition-colors" 
               />
             </div>
             
             {/* Mobile Logo */}
             <div className="md:hidden flex items-center gap-2">
               {logoUrl ? <img src={logoUrl} alt="Logo" className="h-6 w-6 rounded-full object-cover shadow-sm border border-slate-200" /> : <div className="h-6 w-6 bg-red-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">S</div>}
             </div>
          </div>

          {/* Right: Actions & Profile */}
          <div className="flex items-center gap-4 shrink-0">
            <button 
              onClick={() => { setEditingQuotationId(null); handleSetView('quotation-form'); }}
              className="hidden md:flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New Quotation
            </button>

            <button className="text-slate-400 hover:text-slate-600 hidden md:block">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            </button>
            <button className="text-slate-400 hover:text-slate-600 relative hidden md:block">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
               <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
            </button>
            <button onClick={() => setIsStorageModalOpen(true)} className="text-slate-400 hover:text-slate-600 relative" title="Storage Status">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10l8 4m8-4V7l-8-4m0 10L4 7m8 4v10M4 7v10l8 4" /></svg>
               <span className={`absolute top-0 right-0 block h-2 w-2 rounded-full ring-2 ring-white ${dataError ? 'bg-red-500' : isSyncingBackgroundData ? 'bg-amber-400 animate-pulse' : 'bg-green-500'}`}></span>
            </button>
            
            <div className="h-6 w-px bg-slate-200 hidden md:block mx-1"></div>

            <div className="flex items-center gap-3">
               <div className="hidden md:block text-right">
                 <div className="text-sm font-bold text-slate-800 leading-none">{currentUser.name}</div>
                 <div className="text-[10px] text-slate-500 uppercase tracking-wider">{currentUser.role}</div>
               </div>
               <button onClick={handleLogout} className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200 hover:bg-red-100 hover:text-red-700 hover:border-red-200 transition-colors" title="Logout">
                 {currentUser.name.substring(0, 1)}
               </button>
            </div>
          </div>
        </header>

        {/* Scrollable Main Content */}
        <main className={`flex-1 overflow-y-auto relative ${view === 'quotation-form' || view === 'quotations' ? 'p-0 bg-white' : 'p-4 md:p-6 pb-24 md:pb-6'}`}>
          <React.Suspense fallback={<ViewLoadingFallback />}>
          {view === 'dashboard' && <Dashboard quotations={quotations} salesPersons={salesPersons} currentUser={currentUser} onLogoUpload={handleLogoUpload} logoUrl={logoUrl} />}
          {view === 'customers' && <CustomerManager salesPersons={salesPersons} quotations={quotations} onFilterQuotations={navigateToQuotationsWithFilter} currentUser={currentUser} />}
          {view === 'products' && <ProductManager currentUser={currentUser} />}
          {view === 'sales-persons' && <SalesPersonManager salesPersons={salesPersons} setSalesPersons={setSalesPersons} />}
          {view === 'quotations' && <QuotationManager 
            quotations={quotations} 
            customers={customers}
            salesPersons={salesPersons} 
            setEditingQuotationId={setEditingQuotationId} 
            setView={handleSetView} 
            setQuotations={setQuotations} 
            currentUser={currentUser} 
            quotationFilter={quotationFilter} 
            onBackToCustomers={quotationFilter ? () => { setQuotationFilter(null); handleSetView('customers'); } : undefined}
            globalSearch={globalSearchQuery}
            onClearGlobalSearch={() => setGlobalSearchQuery('')}
          />}
          {view === 'quotation-form' && <QuotationForm salesPersons={salesPersons || []} quotations={quotations || []} setQuotations={setQuotations} setView={handleSetView} editingQuotationId={editingQuotationId} setEditingQuotationId={setEditingQuotationId} currentUser={currentUser} logoUrl={logoUrl} />}
          {view === 'calendar' && <CalendarView quotations={quotations} salesPersons={salesPersons} currentUser={currentUser} onSelectQuotation={(id) => { setEditingQuotationId(id); handleSetView('quotation-form'); }} setQuotations={setQuotations} />}
          {view === 'users' && <UserManager users={users} setUsers={setUsers} currentUser={currentUser} customers={customers || []} />}
          {view === 'customer-logins' && <CustomerLoginManager users={users} setUsers={setUsers} customers={customers || []} currentUser={currentUser} />}
                    {view === 'user-manual' && <UserManual />}
                    </React.Suspense>
        </main>

      </div>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] flex justify-around items-center h-16 px-1 md:hidden z-50 pb-safe no-print">
        <button onClick={() => handleSetView('dashboard')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${view === 'dashboard' ? 'text-red-600' : 'text-slate-400'}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
          <span className="text-[10px] font-medium">Home</span>
        </button>
        <button onClick={() => { setQuotationFilter(null); handleSetView('quotations'); }} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${view === 'quotations' || view === 'quotation-form' ? 'text-red-600' : 'text-slate-400'}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" /></svg>
          <span className="text-[10px] font-medium">Quote</span>
        </button>
        <button onClick={() => handleSetView('customers')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${view === 'customers' ? 'text-red-600' : 'text-slate-400'}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          <span className="text-[10px] font-medium">Clients</span>
        </button>
        <button onClick={() => handleSetView('products')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${view === 'products' ? 'text-red-600' : 'text-slate-400'}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          <span className="text-[10px] font-medium">Products</span>
        </button>
      </div>

      <PasswordChangeModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onSave={handlePasswordChange}
        isForced={isPasswordChangeRequired}
      />

      {/* Storage Management Modal */}
      {isStorageModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100"
          >
            <div className="bg-white border-b border-slate-100 p-4 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">Storage Management</h2>
              <button onClick={() => setIsStorageModalOpen(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6">
               <React.Suspense fallback={<div className="p-4 text-center text-xs text-slate-500">Loading storage...</div>}><StorageManager /></React.Suspense>
               <div className="mt-6 flex justify-end">
                   <button 
                    onClick={() => setIsStorageModalOpen(false)}
                    className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-sm"
                   >
                       Done
                   </button>
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
