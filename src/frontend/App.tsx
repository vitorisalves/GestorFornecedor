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
import { useDeliveredProducts } from './hooks/useDeliveredProducts';
import { useReminders } from './hooks/useReminders';
import { useExcel } from './hooks/useExcel';
import { useSupplierForm } from './hooks/useSupplierForm';
import { useDeletions } from './hooks/useDeletions';

// Components
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { NotificationCenter } from './components/NotificationCenter';
import { SuppliersView } from './components/SuppliersView';
import { ShoppingView } from './components/ShoppingView';
import { HistoryView } from './components/HistoryView';
import { DeliveredProductsView } from './components/DeliveredProductsView';
import { RemindersView } from './components/RemindersView';
import { AIView } from './components/AIView';
import { DashboardView } from './components/DashboardView';
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
    isApproved,
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
  } = useSuppliers(isAuthReady, isApproved);

  const {
    reminders,
    refreshReminders,
    addReminder,
    deleteReminder,
    error: remindersError
  } = useReminders(isAuthReady, isApproved, addAppNotification);

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
    addItemToList,
    updateProductPriceInLists
  } = useCart(isAuthReady, isApproved, loggedName, addAppNotification);

  const {
    deliveredProducts,
    saveDeliveredProduct,
    deleteDeliveredProduct,
    toggleDeliveryStatus,
    updatePurchaseDate,
    updateForecastDate,
    updateDeliveryDate,
    updateDeliveredQuantity
  } = useDeliveredProducts(isAuthReady, isApproved, addAppNotification);

  const handleUpdateCartQuantity = React.useCallback((name: string, supplierName: string, delta: number) => {
    // 1. Update cart
    updateCartQuantity(name, supplierName, delta);
    
    const item = cart.find(i => i.name === name && i.supplierName === supplierName);
    if(item) {
       updateDeliveredQuantity(name, supplierName, item.quantity + delta);
    }
  }, [updateCartQuantity, cart, updateDeliveredQuantity]);

  const handleToggleSavedListItemBought = React.useCallback(async (listId: string, productName: string, supplierName: string) => {
    const list = savedLists.find(l => l.id === listId);
    if (!list) return;

    const item = list.items.find(i => i.name === productName && i.supplierName === supplierName);
    if (!item) return;

    // Se o item NÃO estava comprado, ele vai se tornar comprado agora (Check)
    const becomingBought = !item.bought;

    // 1. Se for marcar como comprado
    if (becomingBought) {
      const now = new Date();
      const day = now.getDate().toString().padStart(2, '0');
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const formattedDate = `${day}/${month}/${now.getFullYear()}`;
      
      const supplier = suppliers.find(s => s.name === supplierName);
      if (supplier) {
        const productIndex = supplier.products.findIndex(p => p.name === productName);
        if (productIndex !== -1) {
          const updatedSupplier = { ...supplier };
          updatedSupplier.products = [...updatedSupplier.products];
          updatedSupplier.products[productIndex] = {
            ...updatedSupplier.products[productIndex],
            lastPurchaseDate: formattedDate
          };
          
          try {
            await saveSupplier(updatedSupplier);
            
            const sanitizeForId = (str: string) => {
              return str
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-+|-+$/g, '');
            };

            const deliveryId = sanitizeForId(`${productName}-${supplierName}-${now.getTime()}`);
            await saveDeliveredProduct({
              id: deliveryId,
              name: productName,
              supplierName: supplierName,
              purchaseDate: formattedDate,
              delivered: false,
              quantity: item.quantity
            });

            // 2. Atualiza na lista com o novo deliveryId
            await toggleSavedListItemBought(listId, productName, supplierName, { bought: true, deliveryId });

            addNotification(`Data atualizada e enviado para Entregues`, 1, 'info');
          } catch (err) {
            console.error("Erro ao atualizar data de compra:", err);
          }
        }
      }
    } else {
      // 1. Se for desmarcar, remove dos entregues se existir o deliveryId ou se encontrar nos produtos entregues
      const productsToDelete = [];
      if (item.deliveryId) {
        productsToDelete.push(item.deliveryId);
      }
      
      // Também busca por correspondência de nome e fornecedor em produtos n entregues
      const matches = deliveredProducts.filter(p => p.name === productName && p.supplierName === supplierName && !p.delivered);
      matches.forEach(m => {
        if (!productsToDelete.includes(m.id)) {
          productsToDelete.push(m.id);
        }
      });

      if (productsToDelete.length > 0) {
        try {
          for (const id of productsToDelete) {
            await deleteDeliveredProduct(id);
          }
          addNotification("Removido dos Entregues", 1, 'info');
        } catch (err) {
          console.error("Erro ao remover dos entregues:", err);
          addNotification("Erro ao remover dos entregues", 0, 'info');
        }
      }

      // 2. Atualiza na lista removendo o deliveryId
      await toggleSavedListItemBought(listId, productName, supplierName, { bought: false, deliveryId: undefined });
    }
  }, [savedLists, toggleSavedListItemBought, suppliers, saveSupplier, addNotification, saveDeliveredProduct, deleteDeliveredProduct]);

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

  const [currentPage, setCurrentPage] = useState<'dashboard' | 'suppliers' | 'mercado' | 'materiais' | 'shopping' | 'history' | 'delivered' | 'reminders' | 'ai'>('dashboard');
  
  const {
    handleExportExcel,
    handleImportExcel,
    handleSyncSheets,
    performImport
  } = useExcel(suppliers, saveSupplier, addNotification);

  // --- LOCAL UI STATE ---
  const [loginCpf, setLoginCpf] = useState('');
  const [loginName, setLoginName] = useState('');
  const [pendingImportData, setPendingImportData] = useState<Record<string, Supplier> | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [listName, setListName] = useState('');
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const { deletions, setDeletion } = useDeletions();
  const [searchTerm, setSearchTerm] = useState('');
  const [shoppingQuantities, setShoppingQuantities] = useState<Record<string, number | string>>({});
  const [newCategoryName, setNewCategoryName] = useState('');
  const [reminderProductName, setReminderProductName] = useState('');
  const [reminderDate, setReminderDate] = useState('');

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

  const {
    formState,
    setFormState,
    productList,
    setProductList,
    editingSupplierId,
    setEditingSupplierId,
    editingProductIndex,
    setEditingProductIndex,
    isSaving,
    productNameRef,
    resetForm,
    addProduct,
    handleEditProduct,
    onAddSupplier,
    onEditSupplier
  } = useSupplierForm(suppliers, saveSupplier, updateProductPriceInLists, addNotification);

  const onLogin = React.useCallback((e: React.FormEvent) => {
    e.preventDefault();
    handleLogin(loginCpf, loginName);
  }, [handleLogin, loginCpf, loginName]);

  const onFinalizeList = React.useCallback(async () => {
    if (isFinalizing) return;
    setIsFinalizing(true);
    try {
      const newList = await finalizeList(listName, editingListId, shippingFee);
      if (newList) {
        setListName('');
        setShippingFee(0);
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
  }, [isFinalizing, finalizeList, listName, shippingFee, editingListId, addNotification, addAppNotification]);

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
    setShippingFee(list.shippingFee || 0);
    setEditingListId(list.id);
    setIsCartOpen(true);
  }, [setCart, setListName, setShippingFee, setEditingListId, setIsCartOpen]);

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

  const onSyncSheets = React.useCallback(async () => {
    await handleSyncSheets((data) => {
      setPendingImportData(data);
    });
  }, [handleSyncSheets]);

  const handleUpdateProductPrice = React.useCallback(async (name: string, supplierName: string, newPrice: number) => {
    // 1. Update cart
    setCart(prev => prev.map(item => item.name === name && item.supplierName === supplierName ? { ...item, price: newPrice } : item));
    
    // 2. Update all saved lists
    await updateProductPriceInLists(name, supplierName, newPrice);
    
    // 3. Update supplier
    const supplier = suppliers.find(s => s.name === supplierName);
    if (supplier) {
      const productIndex = supplier.products.findIndex(p => p.name === name);
      if (productIndex !== -1) {
        const updatedSupplier = { ...supplier };
        updatedSupplier.products = [...updatedSupplier.products];
        updatedSupplier.products[productIndex] = { ...updatedSupplier.products[productIndex], price: newPrice };
        try {
            await saveSupplier(updatedSupplier);
        } catch (err) {
            console.error("Erro ao atualizar preço no fornecedor:", err);
            addNotification("Erro ao atualizar preço", 0, 'info');
        }
      }
    }
  }, [setCart, updateProductPriceInLists, suppliers, saveSupplier, addNotification]);

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
        {currentPage === 'dashboard' && (
          <DashboardView 
            key="dashboard"
            savedLists={savedLists}
          />
        )}
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
            handleEditSupplier={(s) => onEditSupplier(s, setIsAdding)}
            setSupplierToDelete={(id) => setDeletion('supplier', id)}
            addToCart={handleAddToCart}
            handleExportExcel={handleExportExcel}
            handleImportExcel={onImportExcel}
            handleSyncSheets={onSyncSheets}
            activeTab={currentPage === 'suppliers' ? 'fornecedores' : currentPage as any}
            onTabChange={(tab) => setCurrentPage(tab === 'fornecedores' ? 'suppliers' : tab)}
            addNotification={addNotification}
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
            deleteSavedList={(id) => setDeletion('list', id)}
            toggleSavedListItemBought={handleToggleSavedListItemBought}
            setActiveTargetList={onSetActiveTargetList}
          />
        )}
        {currentPage === 'delivered' && (
          <DeliveredProductsView 
            key="delivered"
            deliveredProducts={deliveredProducts}
            toggleDeliveryStatus={toggleDeliveryStatus}
            deleteDeliveredProduct={deleteDeliveredProduct}
            updatePurchaseDate={updatePurchaseDate}
            updateForecastDate={updateForecastDate}
            updateDeliveryDate={updateDeliveryDate}
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
            deleteReminder={(id) => setDeletion('reminder', id)}
          />
        )}
        {currentPage === 'ai' && (
          <AIView 
            key="ai"
            suppliers={suppliers}
            categories={categories}
            deliveredProducts={deliveredProducts}
            saveSupplier={saveSupplier}
            updateForecastDate={updateForecastDate}
            updateProductPriceInLists={updateProductPriceInLists}
            addToCart={handleAddToCart}
            addNotification={addNotification}
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
        newProductLastPurchaseDate={formState.productLastPurchaseDate}
        setNewProductLastPurchaseDate={(productLastPurchaseDate) => setFormState(prev => ({ ...prev, productLastPurchaseDate }))}
        newProductPaymentMethod={formState.productPaymentMethod}
        setNewProductPaymentMethod={(productPaymentMethod) => setFormState(prev => ({ ...prev, productPaymentMethod }))}
        categories={categories}
        editingProductIndex={editingProductIndex}
        productNameRef={productNameRef}
        addProduct={addProduct}
        handleEditProduct={(i) => { handleEditProduct(i); setIsAdding(true); }}
        removeProduct={(i) => setProductList(productList.filter((_, idx) => idx !== i))}
        handleAddSupplier={(e) => onAddSupplier(e, setIsAdding)}
        resetForm={resetForm}
        isCartOpen={isCartOpen}
        setIsCartOpen={setIsCartOpen}
        cart={cart}
        listName={listName}
        setListName={setListName}
        shippingFee={shippingFee}
        setShippingFee={setShippingFee}
        updateCartQuantity={handleUpdateCartQuantity}
        updateProductPrice={handleUpdateProductPrice}
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
        setSupplierToDelete={(id) => setDeletion('supplier', id)}
        confirmDelete={() => { if (deletions.supplier) { deleteSupplier(deletions.supplier); setDeletion('supplier', null); } }}
        listToDelete={deletions.list}
        setListToDelete={(id) => setDeletion('list', id)}
        confirmDeleteList={() => { if (deletions.list) { deleteSavedList(deletions.list); setDeletion('list', null); } }}
        reminderToDelete={deletions.reminder}
        setReminderToDelete={(id) => setDeletion('reminder', id)}
        confirmDeleteReminder={() => { if (deletions.reminder) { deleteReminder(deletions.reminder); setDeletion('reminder', null); } }}
        categoryToDelete={deletions.category}
        setCategoryToDelete={(id) => setDeletion('category', id)}
        confirmDeleteCategory={() => { if (deletions.category) { deleteCategory(deletions.category); setDeletion('category', null); } }}
        userToDelete={deletions.user}
        setUserToDelete={(id) => setDeletion('user', id)}
        confirmDeleteUser={async () => { 
          if (deletions.user && removeUserRequest) { 
            await removeUserRequest(deletions.user); 
            setDeletion('user', null); 
            addNotification("Usuário removido", 1, 'info');
          } 
        }}
        pendingImportData={pendingImportData}
        setPendingImportData={setPendingImportData}
        handlePerformImport={onPerformImport}
        isImporting={isImporting}
        isSaving={isSaving}
      />
    </AppLayout>
  );
}
