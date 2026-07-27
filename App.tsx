import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { View, SalesPerson, Customer, Product, Quotation, User, QuotationStatus, StockItem, PendingSO } from './types';
import { useOnlineStorage } from './hooks/useOnlineStorage';
import { SalesPersonManager } from './components/SalesPersonManager';
import { CustomerManager } from './components/CustomerManager';
import { ProductManager } from './components/ProductManager';
import { QuotationManager } from './components/QuotationManager';
import { QuotationForm } from './components/QuotationForm';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';
import { PasswordChangeModal } from './components/PasswordChangeModal';
import { UserManager } from './components/UserManager';
import { Reports } from './components/Reports';
import { CalendarView } from './components/CalendarView';
import { UserManual } from './components/UserManual';
import { StockManager } from './components/StockManager';
import { CustomerResponsePage } from './components/CustomerResponsePage';
import { StorageManager } from './components/StorageManager';
import { PendingSOManager } from './components/PendingSOManager';

export const App = () => {
  const [users, setUsers, usersLoading, usersError] = useOnlineStorage<User>('users');
  const [salesPersons, setSalesPersons, salesPersonsLoading, salesPersonsError] = useOnlineStorage<SalesPerson>('salesPersons');
  const [customers, setCustomers, customersLoading, customersError] = useOnlineStorage<Customer>('customers');
  const [quotations, setQuotations, quotationsLoading, quotationsError] = useOnlineStorage<Quotation>('quotations');
  const [stockStatements, setStockStatements, stockStatementsLoading, stockStatementsError] = useOnlineStorage<StockItem>('stockStatements');
  const [pendingSOs, setPendingSOs, pendingSOsLoading, pendingSOsError] = useOnlineStorage<PendingSO>('pendingSOs');

  const [view, setView] = useState<View | 'calendar'>('dashboard');
  const [editingQuotationId, setEditingQuotationId] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isPasswordChangeRequired, setIsPasswordChangeRequired] = useState(false);
  const [quotationFilter, setQuotationFilter] = useState<{ customerIds?: number[], status?: QuotationStatus } | null>(null);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem('company_logo');
    } catch (e) {
      return null;
    }
  });

  const isLoadingData = usersLoading || salesPersonsLoading || customersLoading || quotationsLoading || pendingSOsLoading;
  const dataError = usersError || salesPersonsError || customersError || quotationsError || pendingSOsError;

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
    if (user.password === '123456') {
      setIsPasswordChangeRequired(true);
      setIsPasswordModalOpen(true);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
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
      setCurrentUser({ ...currentUser, password: newPassword });
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

  if (customerResponseParams) {
    return (
      <CustomerResponsePage
        quotationId={customerResponseParams.quotationId}
        action={customerResponseParams.action}
        reason={customerResponseParams.reason}
      />
    );
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

  if (!currentUser) {
    return <Login onLogin={handleLogin} users={users} isLoading={usersLoading} />;
  }

  const SidebarItem = ({ active, label, icon, onClick }: { active: boolean, label: string, icon: React.ReactNode, onClick: () => void }) => (
    <button
      onClick={onClick}
      title={!isSidebarExpanded ? label : undefined}
      className={`flex items-center gap-3 py-3 mx-2 rounded-xl text-left transition-all ${
        active 
        ? 'bg-gradient-to-r from-red-500/10 to-red-500/5 text-red-600 font-bold border-l-4 border-red-500' 
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 border-l-4 border-transparent font-medium'
      } ${isSidebarExpanded ? 'px-4' : 'px-0 justify-center'}`}
    >
      <div className={!isSidebarExpanded ? 'mx-auto' : ''}>{icon}</div>
      {isSidebarExpanded && <span className="truncate">{label}</span>}
    </button>
  );

  return (
    <div className="flex h-screen bg-[#f8f9fc] overflow-hidden">
      
      {/* Left Sidebar (Desktop) */}
      <aside className={`bg-white border-r border-slate-200 flex-col hidden md:flex z-20 shrink-0 transition-all duration-300 ${isSidebarExpanded ? 'w-64' : 'w-20'}`}>
        <div className="h-16 flex items-center px-6 border-b border-slate-100 shrink-0 overflow-hidden">
          <div className="flex items-center gap-2">
            {logoUrl ? <img src={logoUrl} alt="Logo" className="h-8 w-auto object-contain shrink-0" /> : <div className="h-8 w-8 bg-red-600 rounded-lg flex items-center justify-center text-white font-bold shrink-0">S</div>}
            {isSidebarExpanded && <span className="font-bold text-slate-800 tracking-tight text-lg whitespace-nowrap">Siddhi Kabel</span>}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 space-y-2 no-scrollbar overflow-x-hidden">
          <div className={`text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ${isSidebarExpanded ? 'px-6' : 'text-center px-2 text-[10px]'}`}>Menu</div>
          
          <SidebarItem active={view === 'dashboard'} label="Dashboard" onClick={() => handleSetView('dashboard')} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>} />
          <SidebarItem active={view === 'quotations' || view === 'quotation-form'} label="Quotations" onClick={() => { setQuotationFilter(null); handleSetView('quotations'); }} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" /></svg>} />
          <SidebarItem active={view === 'customers'} label="Customers" onClick={() => handleSetView('customers')} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
          <SidebarItem active={view === 'products'} label="Products" onClick={() => handleSetView('products')} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>} />
          <SidebarItem active={view === 'calendar'} label="Calendar" onClick={() => handleSetView('calendar')} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
          
          {(currentUser.role === 'Admin' || currentUser.role === 'Sales Person' || currentUser.role === 'Management') && (
            <SidebarItem active={view === 'reports'} label="Reports" onClick={() => handleSetView('reports')} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} />
          )}

          <div className={`text-xs font-bold text-slate-400 uppercase tracking-wider mt-8 mb-2 ${isSidebarExpanded ? 'px-6' : 'text-center px-2 text-[10px]'}`}>Admin</div>
          
          {(currentUser.role === 'Admin' || currentUser.role === 'SCM') && (
            <SidebarItem active={view === 'pending-so'} label="Pending SO" onClick={() => handleSetView('pending-so')} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>} />
          )}
          {currentUser.role === 'Admin' && (
            <>
              <SidebarItem active={view === 'sales-persons'} label="Sales Staff" onClick={() => handleSetView('sales-persons')} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} />
              <SidebarItem active={view === 'users'} label="Users" onClick={() => handleSetView('users')} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
            </>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-100">
           <SidebarItem active={view === 'user-manual'} label="Help & Docs" onClick={() => handleSetView('user-manual')} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        </div>
      </aside>

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
                 placeholder="Search anything here..." 
                 className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-full leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-red-500 focus:border-red-500 sm:text-sm transition-colors" 
               />
             </div>
             
             {/* Mobile Logo */}
             <div className="md:hidden flex items-center gap-2">
               {logoUrl ? <img src={logoUrl} alt="Logo" className="h-6 w-auto" /> : <div className="h-6 w-6 bg-red-600 rounded flex items-center justify-center text-white text-xs font-bold">S</div>}
             </div>
          </div>

          {/* Right: Actions & Profile */}
          <div className="flex items-center gap-4 shrink-0">
            <button className="text-slate-400 hover:text-slate-600 hidden md:block">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            </button>
            <button className="text-slate-400 hover:text-slate-600 relative hidden md:block">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
               <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
            </button>
            <button onClick={() => setIsStorageModalOpen(true)} className="text-slate-400 hover:text-slate-600 relative" title="Storage Status">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10l8 4m8-4V7l-8-4m0 10L4 7m8 4v10M4 7v10l8 4" /></svg>
               <span className={`absolute top-0 right-0 block h-2 w-2 rounded-full ring-2 ring-white ${dataError ? 'bg-red-500' : isLoadingData ? 'bg-amber-400' : 'bg-green-500'}`}></span>
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
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 relative">
          {view === 'dashboard' && <Dashboard quotations={quotations} salesPersons={salesPersons} currentUser={currentUser} onLogoUpload={handleLogoUpload} logoUrl={logoUrl} />}
          {view === 'customers' && <CustomerManager salesPersons={salesPersons} quotations={quotations} onFilterQuotations={navigateToQuotationsWithFilter} currentUser={currentUser} />}
          {view === 'products' && <ProductManager currentUser={currentUser} />}
          {view === 'sales-persons' && <SalesPersonManager salesPersons={salesPersons} setSalesPersons={setSalesPersons} />}
          {view === 'quotations' && <QuotationManager quotations={quotations} customers={customers} salesPersons={salesPersons} setEditingQuotationId={setEditingQuotationId} setView={handleSetView} setQuotations={setQuotations} currentUser={currentUser} quotationFilter={quotationFilter} onBackToCustomers={() => { setQuotationFilter(null); setView('customers'); }} />}
          {view === 'quotation-form' && <QuotationForm salesPersons={salesPersons || []} quotations={quotations || []} setQuotations={setQuotations} setView={handleSetView} editingQuotationId={editingQuotationId} setEditingQuotationId={setEditingQuotationId} currentUser={currentUser} logoUrl={logoUrl} />}
          {view === 'calendar' && <CalendarView quotations={quotations} salesPersons={salesPersons} currentUser={currentUser} onSelectQuotation={(id) => { setEditingQuotationId(id); handleSetView('quotation-form'); }} setQuotations={setQuotations} />}
          {view === 'users' && <UserManager users={users} setUsers={setUsers} currentUser={currentUser} />}
          {view === 'reports' && <Reports quotations={quotations} salesPersons={salesPersons} currentUser={currentUser} />}
          {view === 'user-manual' && <UserManual />}
          {view === 'pending-so' && <PendingSOManager pendingSOs={pendingSOs} setPendingSOs={setPendingSOs} />}
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
               <StorageManager />
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
