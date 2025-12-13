
import React, { useState, useMemo, useEffect } from 'react';
import type { View, SalesPerson, Customer, Product, Quotation, User, QuotationStatus, DeliveryChallan, StockItem, PendingSO } from './types';
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
import { DeliveryChallanManager } from './components/DeliveryChallanManager';
import { DeliveryChallanForm } from './components/DeliveryChallanForm';
import { StockManager } from './components/StockManager';
import { PendingSOManager } from './components/PendingSOManager';


function App() {
  const [users, setUsers, usersLoading, usersError] = useOnlineStorage<User>('users');
  const [salesPersons, setSalesPersons, salesPersonsLoading, salesPersonsError] = useOnlineStorage<SalesPerson>('salesPersons');
  const [quotations, setQuotations, quotationsLoading, quotationsError] = useOnlineStorage<Quotation>('quotations');
  const [deliveryChallans, setDeliveryChallans, deliveryChallansLoading, deliveryChallansError] = useOnlineStorage<DeliveryChallan>('deliveryChallans');
  const [stockStatements, setStockStatements, stockStatementsLoading, stockStatementsError] = useOnlineStorage<StockItem>('stockStatements');
  const [pendingSOs, setPendingSOs, pendingSOsLoading, pendingSOsError] = useOnlineStorage<PendingSO>('pendingSOs');
  
  const [view, setView] = useState<View | 'calendar'>('dashboard');
  const [editingQuotationId, setEditingQuotationId] = useState<number | null>(null);
  const [editingChallanId, setEditingChallanId] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isPasswordChangeRequired, setIsPasswordChangeRequired] = useState(false);
  const [quotationFilter, setQuotationFilter] = useState<{ customerIds?: number[], status?: QuotationStatus } | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
      try {
          return localStorage.getItem('company_logo');
      } catch (e) {
          return null;
      }
  });
  
  const isLoadingData = usersLoading || salesPersonsLoading || quotationsLoading || deliveryChallansLoading;
  const dataError = usersError || salesPersonsError || quotationsError || deliveryChallansError;

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
    setEditingChallanId(null);
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

  const BottomNavItem = ({ active, label, icon, onClick }: { active: boolean, label: string, icon: React.ReactNode, onClick: () => void }) => (
    <button 
      onClick={onClick} 
      className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${active ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );

  // Updated styling for header buttons with shadow and better active state
  const headerBtnClass = (isActive: boolean) => 
    `flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all duration-300 transform ${
      isActive 
        ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-500/40 scale-105 ring-1 ring-indigo-400/50' 
        : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Top Navigation (Desktop) */}
      <nav className="bg-slate-900 text-white shadow-xl no-print hidden md:block z-20">
        <div className="w-full px-4">
          <div className="flex justify-between h-12 items-center">
            <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar py-1">
              <div className="flex items-center gap-2 mr-4 shrink-0 border-r border-slate-700 pr-4">
                  {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 w-auto object-contain bg-white rounded p-0.5" />}
                  <span className="font-bold text-base tracking-wide whitespace-nowrap bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">Siddhi Kabel Corp.</span>
              </div>
              <button onClick={() => handleSetView('dashboard')} className={headerBtnClass(view === 'dashboard')}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
                Dashboard
              </button>
              {/* Moved Quotations here */}
              <button onClick={() => { setQuotationFilter(null); handleSetView('quotations'); }} className={headerBtnClass(view === 'quotations' || view === 'quotation-form')}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                Quotations
              </button>
              <button onClick={() => handleSetView('customers')} className={headerBtnClass(view === 'customers')}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>
                Customers
              </button>
              <button onClick={() => handleSetView('products')} className={headerBtnClass(view === 'products')}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 2a1 1 0 00-.707 1.707L7 4.414v3.758a1 1 0 01-.293.707l-4 4C.817 14.761 2.165 17.5 4.25 17.5h11.5c2.085 0 3.433-2.739 1.543-4.621l-4-4a1 1 0 01-.293-.707V4.414L13.707 3.707A1 1 0 0013 2H7zm2 6.172V4h2v4.172a3 3 0 00.879 2.12l1.027 1.028a4 4 0 00-2.171.102l-.47.156a4 4 0 01-2.53 0l-.47-.156a4 4 0 00-2.172-.102l1.027-1.028A3 3 0 009 8.172z" clipRule="evenodd" /></svg>
                Products
              </button>
              <button onClick={() => handleSetView('calendar')} className={headerBtnClass(view === 'calendar')}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
                Calendar
              </button>
              {(currentUser.role === 'Admin' || currentUser.role === 'Sales Person' || currentUser.role === 'Management') && (
                <button onClick={() => handleSetView('reports')} className={headerBtnClass(view === 'reports')}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" /><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" /></svg>
                    Reports
                </button>
              )}
              {(currentUser.role === 'Admin' || currentUser.role === 'SCM') && (
                <>
                    <button onClick={() => handleSetView('delivery-challans')} className={headerBtnClass(view === 'delivery-challans' || view === 'delivery-challan-form')}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /><path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" /></svg>
                        Challans
                    </button>
                    <button onClick={() => handleSetView('stock')} className={headerBtnClass(view === 'stock')}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" /><path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                        Stock
                    </button>
                    <button onClick={() => handleSetView('pending-so')} className={headerBtnClass(view === 'pending-so')}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                        Pending SO
                    </button>
                </>
              )}
               {currentUser.role === 'Admin' && (
                <>
                    <button onClick={() => handleSetView('sales-persons')} className={headerBtnClass(view === 'sales-persons')}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
                        Sales
                    </button>
                    <button onClick={() => handleSetView('users')} className={headerBtnClass(view === 'users')}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" /></svg>
                        Users
                    </button>
                </>
              )}
              <button onClick={() => handleSetView('user-manual')} className={headerBtnClass(view === 'user-manual')}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                Help
              </button>
            </div>
            <div className="flex items-center space-x-4 ml-4 shrink-0">
              <div className="flex flex-col items-end">
                  <span className="text-xs text-slate-400 font-medium">Logged in as</span>
                  <span className="text-xs font-bold text-white">{currentUser.name}</span>
              </div>
              <button onClick={() => setIsPasswordModalOpen(true)} className="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-800" title="Change Password">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                 </svg>
              </button>
              <button onClick={handleLogout} className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-md hover:shadow-lg transform hover:scale-105">Logout</button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Header */}
      <div className="bg-slate-900 text-white p-3 flex justify-between items-center md:hidden shadow-md no-print z-10 sticky top-0">
          <div className="flex items-center gap-2">
             {logoUrl && <img src={logoUrl} alt="Logo" className="h-6 w-auto bg-white rounded p-0.5" />}
             <span className="font-bold text-lg truncate max-w-[200px]">Siddhi Kabel Corp.</span>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={() => handleSetView('user-manual')} className="text-slate-300 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             </button>
             <span className="text-xs text-slate-300 truncate max-w-[80px]">{currentUser.name}</span>
             <button onClick={handleLogout} className="text-rose-400 hover:text-rose-200">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
             </button>
          </div>
      </div>

      <main className="flex-grow w-full mx-auto p-2 mb-16 md:mb-0">
        {view === 'dashboard' && <Dashboard quotations={quotations} salesPersons={salesPersons} currentUser={currentUser} onLogoUpload={handleLogoUpload} logoUrl={logoUrl} />}
        {view === 'customers' && <CustomerManager salesPersons={salesPersons} quotations={quotations} onFilterQuotations={navigateToQuotationsWithFilter} currentUser={currentUser}/>}
        {view === 'products' && <ProductManager currentUser={currentUser} />}
        {view === 'sales-persons' && <SalesPersonManager salesPersons={salesPersons} setSalesPersons={setSalesPersons} />}
        {view === 'quotations' && <QuotationManager quotations={quotations} salesPersons={salesPersons} setEditingQuotationId={setEditingQuotationId} setView={handleSetView} setQuotations={setQuotations} currentUser={currentUser} quotationFilter={quotationFilter} onBackToCustomers={() => { setQuotationFilter(null); setView('customers'); }} />}
        {view === 'quotation-form' && <QuotationForm salesPersons={salesPersons || []} quotations={quotations || []} setQuotations={setQuotations} setView={handleSetView} editingQuotationId={editingQuotationId} setEditingQuotationId={setEditingQuotationId} currentUser={currentUser} logoUrl={logoUrl} />}
        {view === 'calendar' && <CalendarView quotations={quotations} salesPersons={salesPersons} currentUser={currentUser} onSelectQuotation={(id) => { setEditingQuotationId(id); handleSetView('quotation-form'); }} setQuotations={setQuotations} />}
        {view === 'users' && <UserManager users={users} setUsers={setUsers} currentUser={currentUser} />}
        {view === 'reports' && <Reports quotations={quotations} salesPersons={salesPersons} currentUser={currentUser} />}
        {view === 'user-manual' && <UserManual />}
        {view === 'delivery-challans' && <DeliveryChallanManager deliveryChallans={deliveryChallans} setDeliveryChallans={setDeliveryChallans} quotations={quotations} setView={handleSetView} setEditingChallanId={setEditingChallanId} userRole={currentUser.role} />}
        {view === 'delivery-challan-form' && <DeliveryChallanForm challans={deliveryChallans} setChallans={setDeliveryChallans} quotations={quotations} setView={handleSetView} editingChallanId={editingChallanId} setEditingChallanId={setEditingChallanId} userRole={currentUser.role} />}
        {view === 'stock' && <StockManager stockStatements={stockStatements} setStockStatements={setStockStatements} />}
        {view === 'pending-so' && <PendingSOManager pendingSOs={pendingSOs} setPendingSOs={setPendingSOs} />}
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 shadow-[0_-2px_5px_rgba(0,0,0,0.05)] flex justify-around items-center h-16 px-1 md:hidden z-50 no-print">
          <BottomNavItem active={view === 'dashboard'} label="Home" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>} onClick={() => handleSetView('dashboard')} />
          <BottomNavItem active={view === 'quotations' || view === 'quotation-form'} label="Quote" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" /></svg>} onClick={() => { setQuotationFilter(null); handleSetView('quotations'); }} />
          <BottomNavItem active={view === 'calendar'} label="Calendar" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} onClick={() => handleSetView('calendar')} />
          <BottomNavItem active={view === 'products'} label="Products" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>} onClick={() => handleSetView('products')} />
          <BottomNavItem active={false} label="Back" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" /></svg>} onClick={() => handleSetView('dashboard')} />
      </div>

      <PasswordChangeModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onSave={handlePasswordChange}
        isForced={isPasswordChangeRequired}
      />
    </div>
  );
}

export default App;
