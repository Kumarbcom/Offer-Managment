
import React, { useState, useEffect } from 'react';
import type { View, SalesPerson, Customer, Product, Quotation, User, QuotationStatus, DeliveryChallan, PendingSO } from './types';
import { useOnlineStorage } from './hooks/useOnlineStorage';
import { useLocalStorage } from './hooks/useLocalStorage';
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
import { PendingSOManager } from './components/PendingSOManager';

export const App: React.FC = () => {
  const [user, setUser] = useLocalStorage<User | null>('currentUser', null);
  const [view, setView] = useState<View>('dashboard');
  const [logoUrl, setLogoUrl] = useLocalStorage<string | null>('companyLogo', null);

  const [salesPersons, setSalesPersons, salesPersonsLoading] = useOnlineStorage<SalesPerson>('salesPersons');
  const [customers, setCustomers, customersLoading] = useOnlineStorage<Customer>('customers');
  const [products, setProducts, productsLoading] = useOnlineStorage<Product>('products');
  const [quotations, setQuotations, quotationsLoading] = useOnlineStorage<Quotation>('quotations');
  const [users, setUsers, usersLoading] = useOnlineStorage<User>('users');
  const [deliveryChallans, setDeliveryChallans, deliveryChallansLoading] = useOnlineStorage<DeliveryChallan>('deliveryChallans');
  const [pendingSOs, setPendingSOs, pendingSOsLoading] = useOnlineStorage<PendingSO>('pendingSOs');

  const [editingQuotationId, setEditingQuotationId] = useState<number | null>(null);
  const [editingChallanId, setEditingChallanId] = useState<number | null>(null);
  const [quotationFilter, setQuotationFilter] = useState<{ customerIds?: number[], status?: QuotationStatus } | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isLoading = salesPersonsLoading || customersLoading || productsLoading || quotationsLoading || usersLoading || deliveryChallansLoading || pendingSOsLoading;

  useEffect(() => {
    if (user && user.password === '123456') {
      setIsPasswordModalOpen(true);
    }
  }, [user]);

  // Sync URL params for Quotation Editing deep linking
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
        setEditingQuotationId(parseInt(id));
        setView('quotation-form');
    }
  }, [user]);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setView('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setView('dashboard');
    setIsMobileMenuOpen(false);
  };

  const handlePasswordChange = async (newPassword: string) => {
    if (!user || !users) return;
    const updatedUser = { ...user, password: newPassword };
    const updatedUsers = users.map(u => u.name === user.name ? updatedUser : u);
    await setUsers(updatedUsers);
    setUser(updatedUser);
    setIsPasswordModalOpen(false);
  };

  const handleFilterQuotations = (filter: { customerIds?: number[], status?: QuotationStatus }) => {
      setQuotationFilter(filter);
      setView('quotations');
  };

  const handleBackToCustomers = () => {
      setQuotationFilter(null);
      setView('customers');
  };

  const handleNavClick = (newView: View) => {
      setView(newView);
      setIsMobileMenuOpen(false);
      setQuotationFilter(null); // Reset filter when changing views
  };

  if (!user) {
    return <Login onLogin={handleLogin} users={users} isLoading={isLoading} />;
  }

  const NavItem = ({ viewName, label, icon }: { viewName: View, label: string, icon: React.ReactNode }) => (
      <button
          onClick={() => handleNavClick(viewName)}
          className={`flex items-center space-x-3 w-full p-3 rounded-lg transition-colors ${view === viewName ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
      >
          {icon}
          <span className="font-medium">{label}</span>
      </button>
  );

  return (
    <div className="flex min-h-screen bg-slate-100">
      <PasswordChangeModal 
        isOpen={isPasswordModalOpen} 
        onClose={() => setIsPasswordModalOpen(false)} 
        onSave={handlePasswordChange} 
        isForced={user.password === '123456'}
      />

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
            <h1 className="text-xl font-bold tracking-wider">SKC Offer App</h1>
            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
        
        <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-80px)]">
            <NavItem viewName="dashboard" label="Dashboard" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>} />
            <NavItem viewName="calendar" label="Calendar" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
            <NavItem viewName="quotations" label="Quotations" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" /></svg>} />
            
            <NavItem viewName="customers" label="Customers" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
            <NavItem viewName="products" label="Products" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>} />
            
            {(user.role === 'Admin' || user.role === 'SCM' || user.role === 'Management') && (
                <NavItem viewName="pending-so" label="Pending Orders" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
            )}

            {(user.role === 'Admin' || user.role === 'SCM') && (
                <NavItem viewName="delivery-challans" label="Delivery Challans" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>} />
            )}

            {(user.role === 'Admin' || user.role === 'Management') && (
                <NavItem viewName="reports" label="Reports" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} />
            )}

            {user.role === 'Admin' && (
                <NavItem viewName="sales-persons" label="Sales Persons" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} />
            )}
            
            {user.role === 'Admin' && (
                <NavItem viewName="users" label="Users" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
            )}

            <NavItem viewName="user-manual" label="User Manual" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>} />
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-slate-800 bg-slate-900">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm">
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="text-sm font-bold truncate max-w-[120px]">{user.name}</div>
                        <div className="text-xs text-slate-400">{user.role}</div>
                    </div>
                </div>
            </div>
            <button 
                onClick={handleLogout} 
                className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-md transition-colors text-sm"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Logout
            </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto h-screen flex flex-col">
        <header className="bg-white shadow-sm p-4 md:hidden flex items-center justify-between">
            <h1 className="text-lg font-bold text-slate-800">SKC Offer App</h1>
            <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-600 hover:text-slate-900">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
        </header>

        <div className="flex-1 p-2 md:p-6 overflow-y-auto">
            {view === 'dashboard' && <Dashboard quotations={quotations} salesPersons={salesPersons} currentUser={user} onLogoUpload={setLogoUrl} logoUrl={logoUrl} />}
            
            {view === 'customers' && <CustomerManager salesPersons={salesPersons} quotations={quotations} onFilterQuotations={handleFilterQuotations} currentUser={user} />}
            
            {view === 'products' && <ProductManager currentUser={user} />}
            
            {view === 'quotations' && <QuotationManager quotations={quotations} salesPersons={salesPersons} setEditingQuotationId={setEditingQuotationId} setView={setView} setQuotations={setQuotations} currentUser={user} quotationFilter={quotationFilter} onBackToCustomers={quotationFilter ? handleBackToCustomers : undefined} />}
            
            {view === 'quotation-form' && <QuotationForm salesPersons={salesPersons || []} quotations={quotations || []} setQuotations={setQuotations} setView={setView} editingQuotationId={editingQuotationId} setEditingQuotationId={setEditingQuotationId} currentUser={user} logoUrl={logoUrl} />}
            
            {view === 'sales-persons' && <SalesPersonManager salesPersons={salesPersons} setSalesPersons={setSalesPersons} />}
            
            {view === 'users' && <UserManager users={users} setUsers={setUsers} currentUser={user} />}
            
            {view === 'reports' && <Reports quotations={quotations} salesPersons={salesPersons} currentUser={user} />}
            
            {view === 'calendar' && <CalendarView quotations={quotations} salesPersons={salesPersons} currentUser={user} onSelectQuotation={(id) => { setEditingQuotationId(id); setView('quotation-form'); }} setQuotations={setQuotations} />}
            
            {view === 'user-manual' && <UserManual />}

            {view === 'delivery-challans' && <DeliveryChallanManager deliveryChallans={deliveryChallans} setDeliveryChallans={setDeliveryChallans} quotations={quotations} setView={setView} setEditingChallanId={setEditingChallanId} userRole={user.role} />}

            {view === 'delivery-challan-form' && <DeliveryChallanForm challans={deliveryChallans} setChallans={setDeliveryChallans} quotations={quotations} setView={setView} editingChallanId={editingChallanId} setEditingChallanId={setEditingChallanId} userRole={user.role} />}

            {view === 'pending-so' && <PendingSOManager pendingSOs={pendingSOs} setPendingSOs={setPendingSOs} />}
        </div>
      </main>
    </div>
  );
};
