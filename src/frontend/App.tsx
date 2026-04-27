/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCcw, PlusCircle } from 'lucide-react';

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
    isAdmin,
    authError
  } = useAuth();

  const {
    notifications,
    appNotifications,
    isNotificationsOpen,
    setIsNotificationsOpen,
    addNotification,
    addAppNotification,
    markAllAsRead,
    clearNotifications,
    requestPermission
  } = useNotifications();

  const {
    suppliers,
    categories,
    isLoading: isSuppliersLoading,
    refreshData: refreshSuppliers,
    saveSupplier,
    deleteSupplier,
    deleteAllSuppliers,
    addCategory,
    deleteCategory,
    error: suppliersError
  } = useSuppliers(isAuthReady, isLoggedIn);

  const {
    reminders,
    refreshReminders,
    addReminder,
    deleteReminder,
    error: remindersError
  } = useReminders(isAuthReady, addAppNotification);

  // Memoized logic for quota check
  const isQuotaExceeded = React.useMemo(() => {
    const errors = [suppliersError, authError, remindersError];
    return errors.some(err => 
      err?.toLowerCase().includes('quota') || err?.toLowerCase().includes('resource-exhausted')
    );
  }, [suppliersError, authError, remindersError]);

  const {
    cart,
    setCart,
    savedLists,
    isLoadingLists,
    refreshLists,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    finalizeList,
    toggleSavedListItemBought,
    deleteSavedList,
    addItemToList
  } = useCart(isAuthReady, isLoggedIn, loggedName, addAppNotification);

  const handleReconnect = React.useCallback(async () => {
    const { db, enableNetwork } = await import('./firebase');
    try {
      await enableNetwork(db);
      refreshSuppliers();
      refreshLists();
      refreshReminders();
      addNotification("Reconectando...", 1, 'info');
    } catch (e) {
      console.error("Reconnection failed:", e);
    }
  }, [refreshSuppliers, refreshLists, refreshReminders, addNotification]);

  useEffect(() => {
    if (isQuotaExceeded) {
      import('./firebase').then(({ db, disableNetwork }) => {
        disableNetwork(db).catch(console.error);
      });
    }
  }, [isQuotaExceeded]);

  const [activeTargetListId, setActiveTargetListId] = useState<string | null>(null);
  const [activeTargetListName, setActiveTargetListName] = useState<string | null>(null);

  const handleAddToCart = React.useCallback((product: Product, supplierName: string, quantity: number) => {
    if (activeTargetListId) {
      addItemToList(activeTargetListId, product, supplierName, quantity);
      addNotification(`Adicionado à lista ${activeTargetListName}`, quantity, 'info');
    } else {
      addToCart(product, supplierName, quantity);
      addNotification(product.name, quantity, 'cart');
    }
  }, [activeTargetListId, activeTargetListName, addItemToList, addNotification, addToCart]);

  const [currentPage, setCurrentPage] = useState<'suppliers' | 'mercado' | 'materiais' | 'shopping' | 'history' | 'omie' | 'reminders'>('suppliers');
  
  const {
    externalProducts,
    isSyncingExternal,
    isTriggeringSync,
    apiHealth,
    isCheckingHealth,
    isWakingUp,
    wakeUpMessage,
    triggerOmieSync,
    fetchExternalProducts,
    checkApiHealth
  } = useOmie(currentPage);

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
  useEffect(() => {
    const cleanCpf = loginCpf.replace(/\D/g, '');
    if (cleanCpf.length === 11) {
      const user = authorizedUsers.find(u => u.cpf === cleanCpf);
      if (user?.name) {
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
  const onLogin = React.useCallback((e: React.FormEvent) => {
    e.preventDefault();
    handleLogin(loginCpf, loginName);
  }, [handleLogin, loginCpf, loginName]);

  const onFinalizeList = React.useCallback(async () => {
    if (isFinalizing) return;
    setIsFinalizing(true);
    try {
      const newList = await finalizeList(listName, editingListId);
      if (newList) {
        setListName('');
        setEditingListId(null);
        setIsCartOpen(false);
        setCurrentPage('history');
        addNotification(editingListId ? 'Lista atualizada!' : 'Lista finalizada!', 1);
        
        const title = editingListId ? 'Lista Atualizada' : 'Nova Lista de Compras';
        const msg = editingListId 
          ? `A lista "${newList.name}" foi atualizada com sucesso.`
          : `A lista "${newList.name}" foi criada com sucesso.`;
        
        addAppNotification(title, msg);
      }
    } finally {
      setIsFinalizing(false);
    }
  }, [isFinalizing, finalizeList, listName, editingListId, addNotification, addAppNotification]);

  const onSetActiveTargetList = React.useCallback((id: string | null, name: string | null) => {
    setActiveTargetListId(id);
    setActiveTargetListName(name);
    if (id) {
      setCurrentPage('suppliers');
      addNotification(`Modo de adição para: ${name}`, 1, 'info');
    }
  }, [addNotification]);

  const onEditSavedList = React.useCallback((list: any) => {
    setCart(list.items);
    setListName(list.name);
    setEditingListId(list.id);
    setIsCartOpen(true);
  }, [setCart]);

  const resetForm = React.useCallback(() => {
    setNewName('');
    setNewPhone('');
    setNewProductName('');
    setNewProductPrice('');
    setNewProductCategory('');
    setProductList([]);
    setEditingProductIndex(null);
    setEditingSupplierId(null);
  }, []);

  const onAddSupplier = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
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
  }, [productList, newProductName, newProductPrice, newProductCategory, editingProductIndex, newName, newPhone, editingSupplierId, saveSupplier, resetForm]);

  const onEditSupplier = React.useCallback((supplier: Supplier) => {
    setEditingSupplierId(supplier.id);
    setNewName(supplier.name);
    setNewPhone(supplier.phone);
    setProductList(supplier.products);
    setIsAdding(true);
  }, []);

  const addProduct = React.useCallback(() => {
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
  }, [newProductName, newProductPrice, newProductCategory, editingProductIndex, productList]);

  const onAddCategory = React.useCallback(() => {
    if (newCategoryName.trim()) {
      addCategory(newCategoryName.trim());
      setNewCategoryName('');
    }
  }, [newCategoryName, addCategory]);

  const onScheduleReminder = React.useCallback(() => {
    if (reminderProductName && reminderDate) {
      let finalDate = reminderDate;
      if (reminderDate.length === 10) {
        finalDate = `${reminderDate}T09:00:00`;
      }
      addReminder(reminderProductName, finalDate);
      setReminderProductName('');
      setReminderDate('');
      addNotification('Lembrete agendado!', 1);
    }
  }, [reminderProductName, reminderDate, addReminder, addNotification]);

  const onImportExcel = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleImportExcel(e, (data) => {
      setPendingImportData(data);
    });
  }, [handleImportExcel]);

  const onPerformImport = React.useCallback(async (replace: boolean) => {
    if (!pendingImportData || isImporting) return;
    setIsImporting(true);
    try {
      await performImport(pendingImportData, replace, deleteAllSuppliers);
      setPendingImportData(null);
    } finally {
      setIsImporting(false);
    }
  }, [pendingImportData, isImporting, performImport, deleteAllSuppliers]);

  // --- RENDER HELPERS ---
  const mainSuppliers = React.useMemo(() => 
    suppliers.filter(s => 
      !['MERCADO', 'MATERIAIS'].includes(s.name.toUpperCase())
    ), [suppliers]
  );

  const authorizedCpfs = React.useMemo(() => 
    Array.from(new Set(authorizedUsers.map(u => u.cpf))), 
    [authorizedUsers]
  );

  // Common UI styles
  const smallLabelStyle = "text-[10px] font-black uppercase tracking-[0.2em] leading-none opacity-50";

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

      <main className="flex-1 lg:ml-64 p-4 md:p-8 lg:p-12 w-full overflow-x-hidden min-h-screen transition-all">
        <div className="max-w-6xl mx-auto px-4 md:px-0">
          <Header
            requestPermission={requestPermission} 
            notifications={notifications}
            appNotifications={appNotifications}
            isNotificationsOpen={isNotificationsOpen}
            setIsNotificationsOpen={setIsNotificationsOpen}
            markAllAsRead={markAllAsRead}
            clearNotifications={clearNotifications}
            cart={cart}
            setIsCartOpen={setIsCartOpen}
            onMenuToggle={() => setIsSidebarOpen(true)}
            isOffline={isQuotaExceeded}
            onReconnect={handleReconnect}
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
                <span className={smallLabelStyle}>Status de Conexão</span>
                <span className="text-sm font-bold tracking-tight">Sincronização Limitada (Modo Offline)</span>
              </div>
            </div>
            
            <div className="p-6">
              <p className="text-slate-600 font-medium text-sm leading-relaxed mb-4">
                {isQuotaExceeded 
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
                
                <div className="flex items-center gap-4">
                  <a 
                    href="https://firebase.google.com/pricing#cloud-firestore" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                  >
                    Documentação de Cota →
                  </a>

                  <button 
                    onClick={handleReconnect}
                    className="text-[10px] font-black text-white bg-indigo-600 px-4 py-2 rounded-xl uppercase tracking-tighter hover:bg-indigo-700 transition-all flex items-center gap-2"
                  >
                    <RefreshCcw className="w-3 h-3" />
                    Tentar Reconectar Agora
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTargetListId && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-8 p-6 bg-indigo-600 rounded-[2.5rem] border-2 border-slate-900 shadow-xl shadow-indigo-100 flex items-center justify-between"
          >
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30">
                <PlusCircle className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black text-indigo-100 uppercase tracking-widest mb-1">Você está adicionando itens à:</p>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{activeTargetListName}</h3>
              </div>
            </div>
            <button 
              onClick={() => onSetActiveTargetList(null, null)}
              className="px-6 py-3 bg-white text-indigo-600 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-100 transition-all active:scale-95 shadow-lg border-b-4 border-slate-200 active:border-b-0"
            >
              Concluir Edição
            </button>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {(currentPage === 'suppliers' || currentPage === 'mercado' || currentPage === 'materiais') && (
            <SuppliersView 
              key={currentPage}
              suppliers={mainSuppliers}
              allSuppliers={suppliers}
              isLoading={isSuppliersLoading}
              onRefresh={refreshSuppliers}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              setIsAdding={setIsAdding}
              handleEditSupplier={onEditSupplier}
              setSupplierToDelete={setSupplierToDelete}
              addToCart={handleAddToCart}
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
              addToCart={handleAddToCart}
            />
          )}
          {currentPage === 'history' && (
            <HistoryView 
              key="history"
              savedLists={savedLists}
              isLoading={isLoadingLists}
              onRefresh={refreshLists}
              editSavedList={onEditSavedList}
              deleteSavedList={setListToDelete}
              toggleSavedListItemBought={toggleSavedListItemBought}
              setActiveTargetList={onSetActiveTargetList}
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
              isWakingUp={isWakingUp}
              wakeUpMessage={wakeUpMessage}
              checkApiHealth={checkApiHealth}
              addToCart={handleAddToCart}
              externalCurrentPage={externalCurrentPage}
              setExternalCurrentPage={setExternalCurrentPage}
              externalItemsPerPage={10}
            />
          )}
          {currentPage === 'reminders' && (
            <RemindersView 
              key="reminders"
              reminders={reminders}
              onRefresh={refreshReminders}
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
