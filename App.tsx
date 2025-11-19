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


function App() {
  const [users, setUsers, usersLoading, usersError] = useOnlineStorage<User>('users');
  const [salesPersons, setSalesPersons, salesPersonsLoading, salesPersonsError] = useOnlineStorage<SalesPerson>('salesPersons');
  const [quotations, setQuotations, quotationsLoading, quotationsError] = useOnlineStorage<Quotation>('quotations');
  const [deliveryChallans, setDeliveryChallans, deliveryChallansLoading, deliveryChallansError] = useOnlineStorage<DeliveryChallan>('deliveryChallans');
  
  const [view, setView] = useState<View>('dashboard');
  const [editingQuotationId, setEditingQuotationId] = useState<number | null>(null);
  const [editingChallanId, setEditingChallanId] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isPasswordChangeRequired, setIsPasswordChangeRequired] = useState(false);
  const [quotationFilter, setQuotationFilter] = useState<{ customerIds?: number[], status?: QuotationStatus } | null>(null);
  
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

  const navigateToQuotationsWithFilter = (filter: { customerIds?: number[], status?: QuotationStatus }) => {
    setQuotationFilter(filter);
    setView('quotations');
  };
  
  const handleSetView = (newView: View) => {
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <nav className="bg-slate-800 text-white shadow-lg no-print">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-14">
            <div className="flex items-center space-x-4 overflow-x-auto no-scrollbar">
              <span className="font-bold text-lg tracking-wide mr-2 whitespace-nowrap">Offer Management</span>
              <button onClick={() => handleSetView('dashboard')} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${view === 'dashboard' ? 'bg-slate-900 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>Dashboard</button>
              <button onClick={() => handleSetView('customers')} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${view === 'customers' ? 'bg-slate-900 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>Customers</button>
              <button onClick={() => handleSetView('products')} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${view === 'products' ? 'bg-slate-900 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>Products</button>
              <button onClick={() => { setQuotationFilter(null); handleSetView('quotations'); }} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${view === 'quotations' || view === 'quotation-form' ? 'bg-slate-900 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>Quotations</button>
              <button onClick={() => handleSetView('delivery-challans')} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${view === 'delivery-challans' || view === 'delivery-challan-form' ? 'bg-slate-900 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>Challans</button>
              {(currentUser.role === 'Admin' || currentUser.role === 'Sales Person' || currentUser.role === 'Management') && (
                <button onClick={() => handleSetView('reports')} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${view === 'reports' ? 'bg-slate-900 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>Reports</button>
              )}
              {currentUser.role === 'Admin' && (
                <>
                    <button onClick={() => handleSetView('sales-persons')} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${view === 'sales-persons' ? 'bg-slate-900 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>Sales Persons</button>
                    <button onClick={() => handleSetView('users')} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${view === 'users' ? 'bg-slate-900 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>Users</button>
                </>
              )}
            </div>
            <div className="flex items-center space-x-3 ml-4">
              <span className="text-sm text-slate-300 hidden sm:inline">Hello, {currentUser.name}</span>
              <button onClick={() => setIsPasswordModalOpen(true)} className="text-slate-400 hover:text-white" title="Change Password">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                 </svg>
              </button>
              <button onClick={handleLogout} className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1 rounded-md text-xs font-bold transition-colors">Logout</button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow max-w-7xl w-full mx-auto py-6 sm:px-6 lg:px-8">
        {view === 'dashboard' && <Dashboard quotations={quotations} salesPersons={salesPersons} currentUser={currentUser} />}
        {view === 'customers' && <CustomerManager salesPersons={salesPersons} quotations={quotations} onFilterQuotations={navigateToQuotationsWithFilter}/>}
        {view === 'products' && <ProductManager />}
        {view === 'sales-persons' && <SalesPersonManager salesPersons={salesPersons} setSalesPersons={setSalesPersons} />}
        {view === 'quotations' && <QuotationManager quotations={quotations} salesPersons={salesPersons} setEditingQuotationId={setEditingQuotationId} setView={handleSetView} setQuotations={setQuotations} userRole={currentUser.role} quotationFilter={quotationFilter} onBackToCustomers={() => { setQuotationFilter(null); setView('customers'); }} />}
        {view === 'quotation-form' && <QuotationForm salesPersons={salesPersons || []} quotations={quotations || []} setQuotations={setQuotations} setView={handleSetView} editingQuotationId={editingQuotationId} setEditingQuotationId={setEditingQuotationId} userRole={currentUser.role} />}
        {view === 'users' && <UserManager users={users} setUsers={setUsers} currentUser={currentUser} />}
        {view === 'delivery-challans' && <DeliveryChallanManager deliveryChallans={deliveryChallans} setDeliveryChallans={setDeliveryChallans} quotations={quotations} setView={handleSetView} setEditingChallanId={setEditingChallanId} userRole={currentUser.role} />}
        {view === 'delivery-challan-form' && <DeliveryChallanForm challans={deliveryChallans} setChallans={setDeliveryChallans} quotations={quotations} setView={handleSetView} editingChallanId={editingChallanId} setEditingChallanId={setEditingChallanId} userRole={currentUser.role} />}
        {view === 'reports' && <Reports quotations={quotations} salesPersons={salesPersons} currentUser={currentUser} />}
      </main>

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
