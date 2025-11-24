
import React, { useState, useMemo, useEffect } from 'react';
import type { View, SalesPerson, Customer, Product, Quotation, User, QuotationStatus, DeliveryChallan } from './types';
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
import { DeliveryChallanManager } from './components/DeliveryChallanManager';
import { DeliveryChallanForm } from './components/DeliveryChallanForm';
import { Reports } from './components/Reports';
import { CalendarView } from './components/CalendarView';
import { UserManual } from './components/UserManual';


function App() {
  const [users, setUsers, usersLoading, usersError] = useOnlineStorage<User>('users');
  const [salesPersons, setSalesPersons, salesPersonsLoading, salesPersonsError] = useOnlineStorage<SalesPerson>('salesPersons');
  const [quotations, setQuotations, quotationsLoading, quotationsError] = useOnlineStorage<Quotation>('quotations');
  const [deliveryChallans, setDeliveryChallans, deliveryChallansLoading, deliveryChallansError] = useOnlineStorage<DeliveryChallan>('deliveryChallans');
  
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

  const headerBtnClass = (isActive: boolean) => 
    `px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wide transition-colors ${isActive ? 'bg-slate-900 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`;

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Top Navigation (Desktop) */}
      <nav className="bg-slate-800 text-white shadow-lg no-print hidden md:block">
        <div className="w-full px-2">
          <div className="flex justify-between h-12">
            <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-2 mr-2 shrink-0">
                  {logoUrl && <img src={logoUrl} alt="Logo" className="h-7 w-auto object-contain bg-white rounded p-0.5" />}
                  <span className="font-bold text-base tracking-wide whitespace-nowrap">Siddhi Kabel Corporation Pvt Ltd</span>
              </div>
              <button onClick={() => handleSetView('dashboard')} className={headerBtnClass(view === 'dashboard')}>Dashboard</button>
              <button onClick={() => handleSetView('customers')} className={headerBtnClass(view === 'customers')}>Customers</button>
              <button onClick={() => handleSetView('products')} className={headerBtnClass(view === 'products')}>Products</button>
              <button onClick={() => { setQuotationFilter(null); handleSetView('quotations'); }} className={headerBtnClass(view === 'quotations' || view === 'quotation-form')}>Quotations</button>
              <button onClick={() => handleSetView('calendar')} className={headerBtnClass(view === 'calendar')}>Calendar</button>
              <button onClick={() => handleSetView('delivery-challans')} className={headerBtnClass(view === 'delivery-challans' || view === 'delivery-challan-form')}>Challans</button>
              {(currentUser.role === 'Admin' || currentUser.role === 'Sales Person' || currentUser.role === 'Management') && (
                <button onClick={() => handleSetView('reports')} className={headerBtnClass(view === 'reports')}>Reports</button>
              )}
               {currentUser.role === 'Admin' && (
                <>
                    <button onClick={() => handleSetView('sales-persons')} className={headerBtnClass(view === 'sales-persons')}>Sales</button>
                    <button onClick={() => handleSetView('users')} className={headerBtnClass(view === 'users')}>Users</button>
                </>
              )}
              <button onClick={() => handleSetView('user-manual')} className={headerBtnClass(view === 'user-manual')}>Help</button>
            </div>
            <div className="flex items-center space-x-2 ml-2 shrink-0">
              <span className="text-xs text-slate-300 hidden lg:inline">Hello, {currentUser.name}</span>
              <button onClick={() => setIsPasswordModalOpen(true)} className="text-slate-400 hover:text-white" title="Change Password">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                 </svg>
              </button>
              <button onClick={handleLogout} className="bg-rose-600 hover:bg-rose-700 text-white px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors">Logout</button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Header */}
      <div className="bg-slate-800 text-white p-3 flex justify-between items-center md:hidden shadow-md no-print z-10 sticky top-0">
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
        {view === 'customers' && <CustomerManager salesPersons={salesPersons} quotations={quotations} onFilterQuotations={navigateToQuotationsWithFilter}/>}
        {view === 'products' && <ProductManager currentUser={currentUser} />}
        {view === 'sales-persons' && <SalesPersonManager salesPersons={salesPersons} setSalesPersons={setSalesPersons} />}
        {view === 'quotations' && <QuotationManager quotations={quotations} salesPersons={salesPersons} setEditingQuotationId={setEditingQuotationId} setView={handleSetView} setQuotations={setQuotations} currentUser={currentUser} quotationFilter={quotationFilter} onBackToCustomers={() => { setQuotationFilter(null); setView('customers'); }} />}
        {view === 'quotation-form' && <QuotationForm salesPersons={salesPersons || []} quotations={quotations || []} setQuotations={setQuotations} setView={handleSetView} editingQuotationId={editingQuotationId} setEditingQuotationId={setEditingQuotationId} currentUser={currentUser} logoUrl={logoUrl} />}
        {view === 'calendar' && <CalendarView quotations={quotations} salesPersons={salesPersons} currentUser={currentUser} onSelectQuotation={(id) => { setEditingQuotationId(id); handleSetView('quotation-form'); }} setQuotations={setQuotations} />}
        {view === 'users' && <UserManager users={users} setUsers={setUsers} currentUser={currentUser} />}
        {view === 'delivery-challans' && <DeliveryChallanManager deliveryChallans={deliveryChallans} setDeliveryChallans={setDeliveryChallans} quotations={quotations} setView={handleSetView} setEditingChallanId={setEditingChallanId} userRole={currentUser.role} />}
        {view === 'delivery-challan-form' && <DeliveryChallanForm challans={deliveryChallans} setChallans={setDeliveryChallans} quotations={quotations} setView={handleSetView} editingChallanId={editingChallanId} setEditingChallanId={setEditingChallanId} userRole={currentUser.role} />}
        {view === 'reports' && <Reports quotations={quotations} salesPersons={salesPersons} currentUser={currentUser} />}
        {view === 'user-manual' && <UserManual />}
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
