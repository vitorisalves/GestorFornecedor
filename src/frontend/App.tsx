/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCcw } from 'lucide-react';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useNotifications } from './hooks/useNotifications';
import { useSuppliers } from './hooks/useSuppliers';
import { useCart } from './hooks/useCart';
import { useOmie } from './hooks/useOmie';
import { useReminders } from './hooks/useReminders';
import { useExcel } from './hooks/useExcel';

// Components
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { NotificationCenter } from './components/NotificationCenter';
import { SuppliersView } from './components/SuppliersView';
import { ShoppingView } from './components/ShoppingView';
import { HistoryView } from './components/HistoryView';
import { OmieView } from './components/OmieView';
import { RemindersView } from './components/RemindersView';
import { Modals } from './components/Modals';
import { Header } from './components/Header';

// Types
import { Product, Supplier } from './types';

export default function App() {
  // --- CUSTOM HOOKS ---
  const {
    isLoggedIn,
    loggedCpf,
    loggedName,
    isAuthReady,
    authorizedUsers,
    loginError,
    setLoginError,
    handleLogin,
    handleLogout,
    updateUserStatus,
    removeUserRequest,
    isAdmin
  } = useAuth();

  const {
    notifications,
    appNotifications,
    isNotificationsOpen,
    setIsNotificationsOpen,
    addNotification,
    addAppNotification,
    markAllAsRead,
    clearNotifications
  } = useNotifications();

  const {
    suppliers,
    categories,
    isLoading: isSuppliersLoading,
    saveSupplier,
    deleteSupplier,
    deleteAllSuppliers,
    addCategory,
    deleteCategory,
    error: suppliersError
  } = useSuppliers(isAuthReady, isLoggedIn);

  const {
    cart,
    setCart,
    savedLists,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    finalizeList,
    toggleSavedListItemBought,
    deleteSavedList
  } = useCart(isAuthReady, isLoggedIn, loggedName);

  const [currentPage, setCurrentPage] = useState<'suppliers' | 'mercado' | 'materiais' | 'shopping' | 'history' | 'omie' | 'reminders'>('suppliers');
  
  const {
    externalProducts,
    isSyncingExternal,
    isTriggeringSync,
    managedProducts,
    isFetchingManaged,
    apiHealth,
    isCheckingHealth,
    triggerOmieSync,
    fetchExternalProducts,
    addToManager,
    checkApiHealth
  } = useOmie(currentPage);

  const {
    reminders,
    addReminder,
    deleteReminder
  } = useReminders(isAuthReady, addAppNotification);

  const {
    handleExportExcel,
    handleImportExcel,
    performImport
  } = useExcel(suppliers, saveSupplier, addNotification);

  // --- LOCAL UI STATE ---
  const [loginCpf, setLoginCpf] = useState('');
  const [loginName, setLoginName] = useState('');

  // Import State
  const [pendingImportData, setPendingImportData] = useState<Record<string, Supplier> | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Auto-fill name based on CPF
  React.useEffect(() => {
    const cleanCpf = loginCpf.replace(/\D/g, '');
    if (cleanCpf.length === 11) {
      const user = authorizedUsers.find(u => u.cpf === cleanCpf);
      if (user && user.name) {
        setLoginName(user.name);
      }
    } else if (cleanCpf.length === 0) {
      setLoginName('');
    }
  }, [loginCpf, authorizedUsers]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [listName, setListName] = useState('');
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);
  const [listToDelete, setListToDelete] = useState<string | null>(null);
  const [reminderToDelete, setReminderToDelete] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [shoppingQuantities, setShoppingQuantities] = useState<Record<string, number | string>>({});
  const [newCategoryName, setNewCategoryName] = useState('');
  const [externalSearchTerm, setExternalSearchTerm] = useState('');
  const [externalCurrentPage, setExternalCurrentPage] = useState(1);
  const [reminderProductName, setReminderProductName] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  
  // Form state for adding/editing suppliers
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [productList, setProductList] = useState<Product[]>([]);
  const [editingProductIndex, setEditingProductIndex] = useState<number | null>(null);
  const productNameRef = useRef<HTMLInputElement>(null);

  // --- HANDLERS ---
  const onLogin = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin(loginCpf, loginName);
  };

  const onFinalizeList = async () => {
    if (isFinalizing) return;
    setIsFinalizing(true);
    try {
      const newList = await finalizeList(listName, editingListId);
      if (newList) {
        setListName('');
        setEditingListId(null);
        setIsCartOpen(false);
        setCurrentPage('history');
        addNotification('Lista finalizada!', 1);
        addAppNotification('Nova Lista de Compras', `A lista "${newList.name}" foi criada com sucesso.`);
      }
    } finally {
      setIsFinalizing(false);
    }
  };

  const onEditSavedList = (list: any) => {
    setCart(list.items);
    setListName(list.name);
    setEditingListId(list.id);
    setIsCartOpen(true);
  };

  const onAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Auto-add product if fields are filled but not added to list yet
    let finalProductList = [...productList];
    if (newProductName.trim()) {
      const product: Product = {
        name: newProductName.trim(),
        price: parseFloat(newProductPrice || '0'),
        category: newProductCategory.trim() || 'Outros'
      };
      
      if (editingProductIndex !== null) {
        finalProductList[editingProductIndex] = product;
      } else {
        finalProductList.push(product);
      }
    }

    if (!newName || !newPhone || finalProductList.length === 0) return;
    
    const supplierId = editingSupplierId || Math.random().toString(36).substring(2, 11);
    await saveSupplier({
      id: supplierId,
      name: newName,
      phone: newPhone,
      products: finalProductList
    });
    
    resetForm();
    setIsAdding(false);
  };

  const onEditSupplier = (supplier: Supplier) => {
    setEditingSupplierId(supplier.id);
    setNewName(supplier.name);
    setNewPhone(supplier.phone);
    setProductList(supplier.products);
    setIsAdding(true);
  };

  const resetForm = () => {
    setNewName('');
    setNewPhone('');
    setNewProductName('');
    setNewProductPrice('');
    setNewProductCategory('');
    setProductList([]);
    setEditingProductIndex(null);
    setEditingSupplierId(null);
  };

  const addProduct = () => {
    if (newProductName.trim()) {
      const product: Product = {
        name: newProductName.trim(),
        price: parseFloat(newProductPrice || '0'),
        category: newProductCategory.trim() || 'Outros'
      };
      
      if (editingProductIndex !== null) {
        const updatedList = [...productList];
        updatedList[editingProductIndex] = product;
        setProductList(updatedList);
        setEditingProductIndex(null);
      } else {
        setProductList([...productList, product]);
      }
      
      setNewProductName('');
      setNewProductPrice('');
      setNewProductCategory('');
      productNameRef.current?.focus();
    }
  };

  const onAddCategory = () => {
    if (newCategoryName.trim()) {
      addCategory(newCategoryName.trim());
      setNewCategoryName('');
    }
  };

  const onScheduleReminder = () => {
    if (reminderProductName && reminderDate) {
      // Se for apenas data (YYYY-MM-DD), normalizamos para permitir o processamento
      let finalDate = reminderDate;
      if (reminderDate.length === 10) {
        finalDate = `${reminderDate}T09:00:00`;
      }
      addReminder(reminderProductName, finalDate);
      setReminderProductName('');
      setReminderDate('');
      addNotification('Lembrete agendado!', 1);
    }
  };

  const onImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleImportExcel(e, (data) => {
      setPendingImportData(data);
    });
  };

  const onPerformImport = async (replace: boolean) => {
    if (!pendingImportData || isImporting) return;
    setIsImporting(true);
    try {
      await performImport(pendingImportData, replace, deleteAllSuppliers);
      setPendingImportData(null);
    } finally {
      setIsImporting(false);
    }
  };

  // --- RENDER ---
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full"
        />
      </div>
    );
  }

  if (!isLoggedIn) {
    const authorizedCpfs = Array.from(new Set(authorizedUsers.map(u => u.cpf)));
    return (
      <Login 
        loginCpf={loginCpf}
        setLoginCpf={setLoginCpf}
        loginName={loginName}
        setLoginName={setLoginName}
        loginError={loginError}
        handleLogin={onLogin}
        authorizedCpfs={authorizedCpfs}
      />
    );
  }

  // Filter suppliers to remove specific channels from main list
  const mainSuppliers = suppliers.filter(s => 
    s.name.toUpperCase() !== 'MERCADO' && 
    s.name.toUpperCase() !== 'MATERIAIS'
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage} 
        isAdmin={isAdmin}
        setIsSettingsOpen={setIsSettingsOpen}
        handleLogout={handleLogout}
        loggedName={loggedName}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="flex-1 lg:ml-72 p-4 md:p-8 lg:p-12 w-full overflow-x-hidden min-h-screen transition-all">
        <div className="max-w-7xl mx-auto">
          <Header 
            notifications={notifications}
            appNotifications={appNotifications}
            isNotificationsOpen={isNotificationsOpen}
            setIsNotificationsOpen={setIsNotificationsOpen}
            markAllAsRead={markAllAsRead}
            clearNotifications={clearNotifications}
            cart={cart}
            setIsCartOpen={setIsCartOpen}
            onMenuToggle={() => setIsSidebarOpen(true)}
          />

        {suppliersError && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-sm"
          >
            <div className="flex items-center gap-3 px-6 py-3 bg-slate-900 text-white">
              <RefreshCcw className="w-4 h-4 animate-spin-slow" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] leading-none opacity-50">Status de Conexão</span>
                <span className="text-sm font-bold tracking-tight">Sincronização Limitada (Modo Offline)</span>
              </div>
            </div>
            
            <div className="p-6">
              <p className="text-slate-600 font-medium text-sm leading-relaxed mb-4">
                {suppliersError.toLowerCase().includes('quota') || suppliersError.toLowerCase().includes('limit') 
                  ? (
                    <>
                      O limite diário de leitura do banco de dados foi atingido. O sistema está operando em <span className="font-bold text-slate-900 underline decoration-indigo-500/30 underline-offset-4">modo de alta disponibilidade local</span>.
                      <br /><br />
                      Você pode continuar usando o app normalmente. Suas alterações serão salvas localmente e sincronizadas assim que a cota for restaurada (meia-noite de hoje).
                    </>
                  )
                  : `Ocorreu um erro técnico: ${suppliersError}`}
              </p>
              
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.5)]" />
                  <span>DADOS CARREGADOS DO CACHE (BROWSER)</span>
                </div>
                
                <a 
                  href="https://firebase.google.com/pricing#cloud-firestore" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[10px] font-black text-slate-900 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                >
                  Ver Detalhes da Cota →
                </a>
              </div>
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {(currentPage === 'suppliers' || currentPage === 'mercado' || currentPage === 'materiais') && (
            <SuppliersView 
              key={currentPage}
              suppliers={mainSuppliers}
              allSuppliers={suppliers}
              isLoading={isSuppliersLoading}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              setIsAdding={setIsAdding}
              handleEditSupplier={onEditSupplier}
              setSupplierToDelete={setSupplierToDelete}
              addToCart={(p: Product, s: string, q: number) => { 
                addToCart(p, s, q); 
                addNotification(p.name, q || 1, 'cart'); 
              }}
              handleExportExcel={handleExportExcel}
              handleImportExcel={onImportExcel}
              activeTab={currentPage === 'suppliers' ? 'fornecedores' : currentPage as any}
              onTabChange={(tab) => setCurrentPage(tab === 'fornecedores' ? 'suppliers' : tab)}
            />
          )}
          {currentPage === 'shopping' && (
            <ShoppingView 
              key="shopping"
              suppliers={suppliers}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              shoppingQuantities={shoppingQuantities}
              setShoppingQuantities={setShoppingQuantities}
              addToCart={(p: Product, s: string, q: number) => { 
                addToCart(p, s, q); 
                addNotification(p.name, q, 'cart'); 
              }}
            />
          )}
          {currentPage === 'history' && (
            <HistoryView 
              key="history"
              savedLists={savedLists}
              editSavedList={onEditSavedList}
              deleteSavedList={setListToDelete}
              toggleSavedListItemBought={toggleSavedListItemBought}
            />
          )}
          {currentPage === 'omie' && (
            <OmieView 
              key="omie"
              externalProducts={externalProducts}
              externalSearchTerm={externalSearchTerm}
              setExternalSearchTerm={setExternalSearchTerm}
              isSyncingExternal={isSyncingExternal}
              isTriggeringSync={isTriggeringSync}
              triggerOmieSync={() => triggerOmieSync(addNotification)}
              fetchExternalProducts={() => fetchExternalProducts(addNotification)}
              apiHealth={apiHealth}
              isCheckingHealth={isCheckingHealth}
              checkApiHealth={checkApiHealth}
              addToCart={(p, s, q) => { addToCart(p, s, q); addNotification(p.name, q, 'cart'); }}
              addToManager={(code) => addToManager(code, addNotification)}
              externalCurrentPage={externalCurrentPage}
              setExternalCurrentPage={setExternalCurrentPage}
              externalItemsPerPage={10}
            />
          )}
          {currentPage === 'reminders' && (
            <RemindersView 
              key="reminders"
              reminders={reminders}
              reminderProductName={reminderProductName}
              setReminderProductName={setReminderProductName}
              reminderDate={reminderDate}
              setReminderDate={setReminderDate}
              addReminder={onScheduleReminder}
              deleteReminder={setReminderToDelete}
            />
          )}
        </AnimatePresence>
      </div>
    </main>

      <Modals 
        isAdding={isAdding}
        setIsAdding={setIsAdding}
        editingSupplierId={editingSupplierId}
        newName={newName}
        setNewName={setNewName}
        newPhone={newPhone}
        setNewPhone={setNewPhone}
        productList={productList}
        newProductName={newProductName}
        setNewProductName={setNewProductName}
        newProductPrice={newProductPrice}
        setNewProductPrice={setNewProductPrice}
        newProductCategory={newProductCategory}
        setNewProductCategory={setNewProductCategory}
        categories={categories}
        editingProductIndex={editingProductIndex}
        productNameRef={productNameRef}
        addProduct={addProduct}
        handleEditProduct={(i) => {
          const p = productList[i];
          setNewProductName(p.name);
          setNewProductPrice(p.price.toString());
          setNewProductCategory(p.category);
          setEditingProductIndex(i);
        }}
        removeProduct={(i) => setProductList(productList.filter((_, idx) => idx !== i))}
        handleAddSupplier={onAddSupplier}
        resetForm={resetForm}
        isCartOpen={isCartOpen}
        setIsCartOpen={setIsCartOpen}
        cart={cart}
        listName={listName}
        setListName={setListName}
        updateCartQuantity={updateCartQuantity}
        removeFromCart={removeFromCart}
        finalizeList={onFinalizeList}
        isFinalizing={isFinalizing}
        clearCart={clearCart}
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        newCategoryName={newCategoryName}
        setNewCategoryName={setNewCategoryName}
        handleAddCategory={onAddCategory}
        authorizedUsers={authorizedUsers}
        updateUserStatus={updateUserStatus}
        removeUserRequest={removeUserRequest}
        supplierToDelete={supplierToDelete}
        setSupplierToDelete={setSupplierToDelete}
        confirmDelete={() => { if (supplierToDelete) { deleteSupplier(supplierToDelete); setSupplierToDelete(null); } }}
        listToDelete={listToDelete}
        setListToDelete={setListToDelete}
        confirmDeleteList={() => { if (listToDelete) { deleteSavedList(listToDelete); setListToDelete(null); } }}
        reminderToDelete={reminderToDelete}
        setReminderToDelete={setReminderToDelete}
        confirmDeleteReminder={() => { if (reminderToDelete) { deleteReminder(reminderToDelete); setReminderToDelete(null); } }}
        categoryToDelete={categoryToDelete}
        setCategoryToDelete={setCategoryToDelete}
        confirmDeleteCategory={() => { if (categoryToDelete) { deleteCategory(categoryToDelete); setCategoryToDelete(null); } }}
        pendingImportData={pendingImportData}
        setPendingImportData={setPendingImportData}
        handlePerformImport={onPerformImport}
        isImporting={isImporting}
      />
    </div>
  );
}
