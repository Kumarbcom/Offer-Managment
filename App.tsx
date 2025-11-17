import React, { useState, useMemo } from 'react';
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


function App() {
  const [users, setUsers, usersLoading, usersError] = useOnlineStorage<User>('users');
  const [salesPersons, setSalesPersons, salesPersonsLoading, salesPersonsError] = useOnlineStorage<SalesPerson>('salesPersons');
  const [customers, setCustomers, customersLoading, customersError] = useOnlineStorage<Customer>('customers');
  const [quotations, setQuotations, quotationsLoading, quotationsError] = useOnlineStorage<Quotation>('quotations');
  const [deliveryChallans, setDeliveryChallans, deliveryChallansLoading, deliveryChallansError] = useOnlineStorage<DeliveryChallan>('deliveryChallans');
  
  const [view, setView] = useState<View>('dashboard');
  const [editingQuotationId, setEditingQuotationId] = useState<number | null>(null);
  const [editingChallanId, setEditingChallanId] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isPasswordChangeRequired, setIsPasswordChangeRequired] = useState(false);
  const [quotationFilter, setQuotationFilter] = useState<{ customerIds?: number[], status?: QuotationStatus } | null>(null);
  
  const isLoadingData = usersLoading || salesPersonsLoading || customersLoading || quotationsLoading || deliveryChallansLoading;
  const dataError = usersError || salesPersonsError || customersError || quotationsError || deliveryChallansError;

  const handleLogin = (user: User) => {
      setCurrentUser(user);
      if (user.password === '123456') {
        setIsPasswordChangeRequired(true);
        setIsPasswordModalOpen(true);
      }
  };

  const handleLogout = () => {
      setCurrentUser(null);
      setIsPasswordChangeRequired(false);
      setView('dashboard');
  };

  const handlePasswordChange = async (newPassword: string) => {
    if (!currentUser || !users) return;
    const updatedUsers = users.map(u => u.name === currentUser.name ? { ...u, password: newPassword } : u);
    await setUsers(updatedUsers);
    setCurrentUser(prev => prev ? { ...prev, password: newPassword } : null);
    setIsPasswordModalOpen(false);
    setIsPasswordChangeRequired(false);
    alert('Password updated successfully!');
  };
  
  const handleSetView = (targetView: View) => {
    if (targetView !== 'quotations' && targetView !== 'quotation-form') {
      setQuotationFilter(null);
    }
    if (targetView === 'quotations') {
      setEditingQuotationId(null);
    }
    setView(targetView);
  };

  const navigateToQuotationsWithFilter = (filter: { customerIds: number[], status?: QuotationStatus }) => {
    setQuotationFilter(filter);
    setView('quotations');
  };
  
  const salesPersonUser = useMemo(() => {
    if (currentUser?.role === 'Sales Person') {
        return salesPersons?.find(sp => sp.name === currentUser.name);
    }
    return null;
  }, [currentUser, salesPersons]);

  const visibleQuotations = useMemo(() => {
    if (!quotations) return null;
    if (currentUser?.role === 'Sales Person' && salesPersonUser) {
        return quotations.filter(q => q.salesPersonId === salesPersonUser.id);
    }
    return quotations;
  }, [currentUser, quotations, salesPersonUser]);
  
  const renderLoadingScreen = (message: string = 'Loading application data...') => (
     <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Offer Management Pro</h1>
            <p className="text-lg text-gray-600">{message}</p>
        </div>
    </div>
  );

  const renderView = () => {
    if (!currentUser) return null;
    if (isLoadingData) return <div className="text-center p-8">Loading...</div>;

    switch (view) {
      case 'dashboard':
        return <Dashboard 
                  quotations={visibleQuotations} 
                  customers={customers} 
                  salesPersons={salesPersons}
                  currentUser={currentUser}
                />;
      case 'quotations':
        return <QuotationManager 
                  quotations={visibleQuotations} 
                  customers={customers} 
                  salesPersons={salesPersons} 
                  setEditingQuotationId={setEditingQuotationId}
                  setView={setView}
                  setQuotations={setQuotations}
                  userRole={currentUser.role}
                  quotationFilter={quotationFilter}
                  onBackToCustomers={() => handleSetView('customers')}
                />;
      case 'quotation-form':
        return <QuotationForm 
                  customers={customers!}
                  setCustomers={setCustomers}
                  salesPersons={salesPersons!}
                  quotations={quotations!}
                  setQuotations={setQuotations}
                  setView={setView}
                  editingQuotationId={editingQuotationId}
                  setEditingQuotationId={setEditingQuotationId}
                  userRole={currentUser.role}
                />;
      case 'customers':
        return currentUser.role === 'Admin' ? <CustomerManager 
            customers={customers} 
            setCustomers={setCustomers} 
            salesPersons={salesPersons}
            quotations={quotations}
            onFilterQuotations={navigateToQuotationsWithFilter}
        /> : <div>Access Denied</div>;
      case 'products':
        return currentUser.role === 'Admin' ? <ProductManager /> : <div>Access Denied</div>;
      case 'sales-persons':
        return currentUser.role === 'Admin' ? <SalesPersonManager salesPersons={salesPersons} setSalesPersons={setSalesPersons} /> : <div>Access Denied</div>;
      case 'users':
        return currentUser.role === 'Admin' ? <UserManager users={users} setUsers={setUsers} currentUser={currentUser} /> : <div>Access Denied</div>;
       case 'delivery-challans':
        return <DeliveryChallanManager 
                  deliveryChallans={deliveryChallans}
                  setDeliveryChallans={setDeliveryChallans}
                  quotations={quotations}
                  customers={customers}
                  setView={setView}
                  setEditingChallanId={setEditingChallanId}
                  userRole={currentUser.role}
                />;
      case 'delivery-challan-form':
        return <DeliveryChallanForm 
                  challans={deliveryChallans}
                  setChallans={setDeliveryChallans}
                  quotations={quotations}
                  customers={customers}
                  setView={setView}
                  editingChallanId={editingChallanId}
                  setEditingChallanId={setEditingChallanId}
                  userRole={currentUser.role}
                />
      default:
        return <div>Select a view</div>;
    }
  };
  
  const navItems: { name: string; view: View, roles: User['role'][] }[] = [
      { name: 'Dashboard', view: 'dashboard', roles: ['Admin', 'Management', 'Sales Person', 'SCM', 'Viewer'] },
      { name: 'Quotations', view: 'quotations', roles: ['Admin', 'Management', 'Sales Person', 'SCM', 'Viewer'] },
      { name: 'Delivery Challans', view: 'delivery-challans', roles: ['Admin', 'SCM'] },
      { name: 'Customers', view: 'customers', roles: ['Admin'] },
      { name: 'Products', view: 'products', roles: ['Admin'] },
      { name: 'Sales Persons', view: 'sales-persons', roles: ['Admin'] },
      { name: 'Users', view: 'users', roles: ['Admin'] },
  ];

  if (!currentUser) {
    return <Login onLogin={handleLogin} users={users} isLoading={usersLoading} />;
  }
  
  const visibleNavItems = navItems.filter(item => item.roles.includes(currentUser.role));
  
  const mainAppClass = `min-h-screen bg-slate-100 font-sans ${isPasswordChangeRequired ? 'filter blur-sm pointer-events-none' : ''}`;

  if (dataError) {
      return renderLoadingScreen(`Error connecting to the database: ${dataError.message}`);
  }

  if (isLoadingData) {
      return renderLoadingScreen();
  }

  if (view === 'quotation-form' || view === 'delivery-challan-form') {
      return (
        <>
            <PasswordChangeModal
                isOpen={isPasswordModalOpen}
                onClose={() => !isPasswordChangeRequired && setIsPasswordModalOpen(false)}
                onSave={handlePasswordChange}
                isForced={isPasswordChangeRequired}
            />
            <div className={mainAppClass}>
                {renderView()}
            </div>
        </>
      )
  }

  return (
    <>
        <PasswordChangeModal
            isOpen={isPasswordModalOpen}
            onClose={() => !isPasswordChangeRequired && setIsPasswordModalOpen(false)}
            onSave={handlePasswordChange}
            isForced={isPasswordChangeRequired}
        />
        <div className={mainAppClass}>
            <header className="bg-white shadow-sm sticky top-0 z-20">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-wrap justify-between items-center py-3 gap-4">
                        <div className="flex items-center space-x-4">
                            <h1 className="text-xl md:text-2xl font-bold text-gray-800">Offer Management Pro</h1>
                            <span className="text-sm text-gray-500 font-medium pt-1 hidden sm:inline">Welcome, {currentUser.name} ({currentUser.role})</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <nav className="flex flex-wrap space-x-1">
                                {visibleNavItems.map(item => (
                                    <button
                                        key={item.view}
                                        onClick={() => handleSetView(item.view)}
                                        className={`px-3 py-2 text-sm font-semibold rounded-md transition duration-300 ${
                                            view === item.view
                                            ? 'bg-blue-600 text-white shadow'
                                            : 'text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {item.name}
                                    </button>
                                ))}
                            </nav>
                             <button
                                onClick={() => setIsPasswordModalOpen(true)}
                                className="p-2 text-sm font-semibold rounded-md transition duration-300 text-slate-600 hover:bg-slate-200"
                                title="Change Password"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v-2l1-1 1-1 1.257-1.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                                </svg>
                            </button>
                            <button
                                onClick={handleLogout}
                                className="p-2 text-sm font-semibold rounded-md transition duration-300 text-red-600 hover:bg-red-100"
                                title="Logout"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </header>
            <main className="container mx-auto p-4 md:p-8">
                {renderView()}
            </main>
        </div>
    </>
  );
}

export default App;