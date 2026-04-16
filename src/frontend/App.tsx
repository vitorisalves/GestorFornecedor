/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { AnimatePresence } from 'motion/react';

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
    saveSupplier,
    deleteSupplier,
    addCategory
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

  const [currentPage, setCurrentPage] = useState<'suppliers' | 'shopping' | 'history' | 'omie' | 'reminders'>('suppliers');
  
  const {
    externalProducts,
    isSyncingExternal,
    isTriggeringSync,
    managedProducts,
    isFetchingManaged,
    triggerOmieSync,
    fetchExternalProducts,
    addToManager
  } = useOmie(currentPage);

  const {
    reminders,
    addReminder
  } = useReminders(isAuthReady, addAppNotification);

  const {
    handleExportExcel,
    handleImportExcel
  } = useExcel(suppliers, saveSupplier, addNotification);

  // --- LOCAL UI STATE ---
  const [loginCpf, setLoginCpf] = useState('');
  const [loginName, setLoginName] = useState('');

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

  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [listName, setListName] = useState('');
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);
  const [listToDelete, setListToDelete] = useState<string | null>(null);
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
    if (!newName || !newPhone || productList.length === 0) return;
    
    const supplierId = editingSupplierId || Math.random().toString(36).substring(2, 11);
    await saveSupplier({
      id: supplierId,
      name: newName,
      phone: newPhone,
      products: productList
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
    if (newProductName.trim() && newProductPrice && newProductCategory.trim()) {
      const product: Product = {
        name: newProductName.trim(),
        price: parseFloat(newProductPrice),
        category: newProductCategory.trim()
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
      addReminder(reminderProductName, reminderDate);
      setReminderProductName('');
      setReminderDate('');
      addNotification('Lembrete agendado!', 1);
    }
  };

  // --- RENDER ---
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

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar 
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        isAdmin={isAdmin}
        setIsSettingsOpen={setIsSettingsOpen}
        handleLogout={handleLogout}
        loggedName={loggedName}
      />

      <main className="flex-1 p-12 max-w-7xl mx-auto">
        <Header 
          notifications={notifications}
          appNotifications={appNotifications}
          isNotificationsOpen={isNotificationsOpen}
          setIsNotificationsOpen={setIsNotificationsOpen}
          markAllAsRead={markAllAsRead}
          clearNotifications={clearNotifications}
          cart={cart}
          setIsCartOpen={setIsCartOpen}
        />

        <AnimatePresence mode="wait">
          {currentPage === 'suppliers' && (
            <SuppliersView 
              key="suppliers"
              suppliers={suppliers}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              setIsAdding={setIsAdding}
              handleEditSupplier={onEditSupplier}
              setSupplierToDelete={setSupplierToDelete}
              addToCart={(p, s) => { addToCart(p, s); addNotification(p.name, 1); }}
              handleExportExcel={handleExportExcel}
              handleImportExcel={handleImportExcel}
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
              addToCart={(p, s, q) => { addToCart(p, s, q); addNotification(p.name, q); }}
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
              addToManager={(c) => addToManager(c, addNotification)}
              managedProducts={managedProducts}
              externalCurrentPage={externalCurrentPage}
              setExternalCurrentPage={setExternalCurrentPage}
              externalItemsPerPage={50}
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
              handleScheduleReminder={onScheduleReminder}
              deleteReminder={async (id) => {
                const { deleteDoc, doc } = await import('firebase/firestore');
                const { db } = await import('./firebase');
                await deleteDoc(doc(db, 'reminders', id));
              }}
            />
          )}
        </AnimatePresence>
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
      />
    </div>
  );
}
