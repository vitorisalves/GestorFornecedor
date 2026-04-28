/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCcw, PlusCircle, BellRing, X } from 'lucide-react';

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
import { AppLayout } from './components/AppLayout';
import { QuotaBanner } from './components/QuotaBanner';
import { ActiveTargetBanner } from './components/ActiveTargetBanner';
import { PermissionBanner } from './components/PermissionBanner';

// Types
import { Product, Supplier } from './types';
import { extractErrorMessage } from './utils';

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
      console.error("Reconnection failed:", extractErrorMessage(e));
    }
  }, [refreshSuppliers, refreshLists, refreshReminders, addNotification]);

  useEffect(() => {
    if (isQuotaExceeded) {
      import('./firebase').then(({ db, disableNetwork }) => {
        disableNetwork(db).catch(err => console.error(extractErrorMessage(err)));
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
  
  // Grouped Delete States
  const [deletions, setDeletions] = useState<{
    supplier: string | null;
    list: string | null;
    reminder: string | null;
    category: string | null;
  }>({
    supplier: null,
    list: null,
    reminder: null,
    category: null
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [shoppingQuantities, setShoppingQuantities] = useState<Record<string, number | string>>({});
  const [newCategoryName, setNewCategoryName] = useState('');
  const [externalSearchTerm, setExternalSearchTerm] = useState('');
  const [externalCurrentPage, setExternalCurrentPage] = useState(1);
  const [reminderProductName, setReminderProductName] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  
  // Form state for adding/editing suppliers
  const [formState, setFormState] = useState({
    name: '',
    phone: '',
    productName: '',
    productPrice: '',
    productCategory: '',
  });
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
    setFormState({
      name: '',
      phone: '',
      productName: '',
      productPrice: '',
      productCategory: '',
    });
    setProductList([]);
    setEditingProductIndex(null);
    setEditingSupplierId(null);
  }, []);

  const onAddSupplier = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalProductList = [...productList];
    if (formState.productName.trim()) {
      const product: Product = {
        name: formState.productName.trim(),
        price: parseFloat(formState.productPrice || '0'),
        category: formState.productCategory.trim() || 'Outros'
      };
      
      if (editingProductIndex !== null) {
        finalProductList[editingProductIndex] = product;
      } else {
        finalProductList.push(product);
      }
    }

    if (!formState.name || !formState.phone || finalProductList.length === 0) return;
    
    const supplierId = editingSupplierId || Math.random().toString(36).substring(2, 11);
    await saveSupplier({
      id: supplierId,
      name: formState.name,
      phone: formState.phone,
      products: finalProductList
    });
    
    resetForm();
    setIsAdding(false);
  }, [productList, formState, editingProductIndex, editingSupplierId, saveSupplier, resetForm]);

  const onEditSupplier = React.useCallback((supplier: Supplier) => {
    setEditingSupplierId(supplier.id);
    setFormState({
      name: supplier.name,
      phone: supplier.phone,
      productName: '',
      productPrice: '',
      productCategory: '',
    });
    setProductList(supplier.products);
    setIsAdding(true);
  }, []);

  const addProduct = React.useCallback(() => {
    if (formState.productName.trim()) {
      const product: Product = {
        name: formState.productName.trim(),
        price: parseFloat(formState.productPrice || '0'),
        category: formState.productCategory.trim() || 'Outros'
      };
      
      if (editingProductIndex !== null) {
        const updatedList = [...productList];
        updatedList[editingProductIndex] = product;
        setProductList(updatedList);
        setEditingProductIndex(null);
      } else {
        setProductList([...productList, product]);
      }
      
      setFormState(prev => ({
        ...prev,
        productName: '',
        productPrice: '',
        productCategory: '',
      }));
      productNameRef.current?.focus();
    }
  }, [formState, editingProductIndex, productList]);

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

  const [showNativePermissionBanner, setShowNativePermissionBanner] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        const timer = setTimeout(() => setShowNativePermissionBanner(true), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleRequestNativePermission = async () => {
    await requestPermission();
    setShowNativePermissionBanner(false);
  };

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
    <AppLayout
      currentPage={currentPage}
      setCurrentPage={setCurrentPage}
      isAdmin={isAdmin}
      setIsSettingsOpen={setIsSettingsOpen}
      handleLogout={handleLogout}
      loggedName={loggedName}
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
      requestPermission={requestPermission}
      notifications={notifications}
      appNotifications={appNotifications}
      isNotificationsOpen={isNotificationsOpen}
      setIsNotificationsOpen={setIsNotificationsOpen}
      markAllAsRead={markAllAsRead}
      clearNotifications={clearNotifications}
      cart={cart}
      setIsCartOpen={setIsCartOpen}
      isOffline={isQuotaExceeded}
      onReconnect={handleReconnect}
    >
      <PermissionBanner 
        show={showNativePermissionBanner}
        onDismiss={() => setShowNativePermissionBanner(false)}
        onRequest={handleRequestNativePermission}
      />

      <QuotaBanner 
        error={suppliersError}
        isQuotaExceeded={isQuotaExceeded}
        onReconnect={handleReconnect}
      />

      <ActiveTargetBanner 
        name={activeTargetListName}
        onClear={() => onSetActiveTargetList(null, null)}
      />

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
            setSupplierToDelete={(id) => setDeletions(prev => ({ ...prev, supplier: id }))}
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
            deleteSavedList={(id) => setDeletions(prev => ({ ...prev, list: id }))}
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
            deleteReminder={(id) => setDeletions(prev => ({ ...prev, reminder: id }))}
          />
        )}
      </AnimatePresence>

      <Modals 
        isAdding={isAdding}
        setIsAdding={setIsAdding}
        editingSupplierId={editingSupplierId}
        newName={formState.name}
        setNewName={(name) => setFormState(prev => ({ ...prev, name }))}
        newPhone={formState.phone}
        setNewPhone={(phone) => setFormState(prev => ({ ...prev, phone }))}
        productList={productList}
        newProductName={formState.productName}
        setNewProductName={(productName) => setFormState(prev => ({ ...prev, productName }))}
        newProductPrice={formState.productPrice}
        setNewProductPrice={(productPrice) => setFormState(prev => ({ ...prev, productPrice }))}
        newProductCategory={formState.productCategory}
        setNewProductCategory={(productCategory) => setFormState(prev => ({ ...prev, productCategory }))}
        categories={categories}
        editingProductIndex={editingProductIndex}
        productNameRef={productNameRef}
        addProduct={addProduct}
        handleEditProduct={(i) => {
          const p = productList[i];
          setFormState(prev => ({
            ...prev,
            productName: p.name,
            productPrice: p.price.toString(),
            productCategory: p.category
          }));
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
        supplierToDelete={deletions.supplier}
        setSupplierToDelete={(id) => setDeletions(prev => ({ ...prev, supplier: id }))}
        confirmDelete={() => { if (deletions.supplier) { deleteSupplier(deletions.supplier); setDeletions(prev => ({ ...prev, supplier: null })); } }}
        listToDelete={deletions.list}
        setListToDelete={(id) => setDeletions(prev => ({ ...prev, list: id }))}
        confirmDeleteList={() => { if (deletions.list) { deleteSavedList(deletions.list); setDeletions(prev => ({ ...prev, list: null })); } }}
        reminderToDelete={deletions.reminder}
        setReminderToDelete={(id) => setDeletions(prev => ({ ...prev, reminder: id }))}
        confirmDeleteReminder={() => { if (deletions.reminder) { deleteReminder(deletions.reminder); setDeletions(prev => ({ ...prev, reminder: null })); } }}
        categoryToDelete={deletions.category}
        setCategoryToDelete={(id) => setDeletions(prev => ({ ...prev, category: id }))}
        confirmDeleteCategory={() => { if (deletions.category) { deleteCategory(deletions.category); setDeletions(prev => ({ ...prev, category: null })); } }}
        pendingImportData={pendingImportData}
        setPendingImportData={setPendingImportData}
        handlePerformImport={onPerformImport}
        isImporting={isImporting}
      />
    </AppLayout>
  );
}
