/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, query, orderBy, deleteDoc, doc, updateDoc, limit } from 'firebase/firestore';
import { Product, SavedList } from '../types';
import { extractErrorMessage, safeStringify, handleFirestoreError, OperationType, cleanObject } from '../utils';

export const useCart = (
  isAuthReady: boolean, 
  isApproved: boolean, 
  loggedName: string,
  addAppNotification: (title: string, message: string) => void
) => {
  const [cart, setCart] = useState<(Product & { supplierName: string; quantity: number })[]>(() => {
    const cached = localStorage.getItem('cache_cart');
    return cached ? JSON.parse(cached) : [];
  });
  const [savedLists, setSavedLists] = useState<SavedList[]>(() => {
    const cached = localStorage.getItem('cache_savedLists');
    return cached ? JSON.parse(cached) : [];
  });
  const [isLoadingLists, setIsLoadingLists] = useState(false);

  useEffect(() => {
    localStorage.setItem('cache_cart', safeStringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('cache_savedLists', safeStringify(savedLists));
  }, [savedLists]);

  useEffect(() => {
    if (!isAuthReady || !isApproved) return;

    setIsLoadingLists(true);
    const q = query(
      collection(db, 'shopping_lists'), 
      orderBy('date', 'desc'), 
      limit(25)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const newList = { id: change.doc.id, ...change.doc.data() } as SavedList;
          // Se o documento for novo (não de snapshot inicial massivo) e não for do próprio usuário
          // Usamos um timestamp para evitar notificações de itens antigos no carregamento inicial
          const listDate = new Date(newList.date).getTime();
          if (listDate > Date.now() - 30000 && newList.createdBy !== loggedName) {
            addAppNotification(
              'Nova Lista de Compras',
              `"${newList.name}" foi criada por ${newList.createdBy || 'outro usuário'}.`
            );
          }
        }
      });

      const lists = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SavedList[];
      
      setSavedLists(lists);
      setIsLoadingLists(false);
    }, (error: any) => {
      handleFirestoreError(error, OperationType.GET, 'shopping_lists');
      const isQuota = extractErrorMessage(error).toLowerCase().includes('quota') || extractErrorMessage(error).toLowerCase().includes('resource-exhausted');
      if (!isQuota) console.error("Shopping lists sync error:", extractErrorMessage(error));
      setIsLoadingLists(false);
    });

    return () => unsubscribe();
  }, [isAuthReady, isApproved]);

  const refreshLists = async () => {
    // onSnapshot já lida com o refresh
  };

  const addToCart = (product: Product, supplierName: string, quantity: number = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.name === product.name && item.supplierName === supplierName);
      if (existing) {
        return prev.map(item => 
          item.name === product.name && item.supplierName === supplierName 
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { ...product, supplierName, quantity }];
    });
  };

  const updateCartQuantity = (name: string, supplierName: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.name === name && item.supplierName === supplierName) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (name: string, supplierName: string) => {
    setCart(prev => prev.filter(item => !(item.name === name && item.supplierName === supplierName)));
  };

  const clearCart = () => setCart([]);

  const finalizeList = async (listName: string, editingListId: string | null = null, shippingFee: number = 0) => {
    if (cart.length === 0) return null;

    const itemsTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const total = itemsTotal + shippingFee;
    const listData = cleanObject({
      name: listName,
      date: new Date().toISOString(),
      items: cart.map(item => cleanObject({ ...item, bought: !!(item as any).bought })),
      total,
      shippingFee,
      createdBy: loggedName
    });

    if (editingListId) {
      // Optimistic update
      setSavedLists(prev => prev.map(l => l.id === editingListId ? { id: editingListId, ...l, ...listData } : l));
      clearCart();
      
      try {
        await updateDoc(doc(db, 'shopping_lists', editingListId), listData);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `shopping_lists/${editingListId}`);
        console.warn("Could not sync list update:", err.message);
      }
      return { id: editingListId, ...listData };
    } else {
      // Optimistic local ID
      const tempId = 'temp-' + Date.now();
      const newList = { id: tempId, ...listData };
      setSavedLists(prev => [newList, ...prev]);
      clearCart();

      try {
        const docRef = await addDoc(collection(db, 'shopping_lists'), listData);
        // Replace temp ID with real ID
        setSavedLists(prev => prev.map(l => l.id === tempId ? { ...l, id: docRef.id } : l));
        return { id: docRef.id, ...listData };
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, 'shopping_lists');
        console.warn("Could not sync new list:", err.message);
        return newList;
      }
    }
  };

  const toggleSavedListItemBought = async (listId: string, productName: string, supplierName: string) => {
    const list = savedLists.find(l => l.id === listId);
    if (!list) return;

    const updatedItems = list.items.map(item => {
      if (item.name === productName && item.supplierName === supplierName) {
        return { ...item, bought: !item.bought };
      }
      return item;
    });

    // Optimistic update
    setSavedLists(prev => prev.map(l => l.id === listId ? { ...l, items: updatedItems } : l));
    
    try {
      if (!listId.startsWith('temp-')) {
        await updateDoc(doc(db, 'shopping_lists', listId), { items: updatedItems });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `shopping_lists/${listId}`);
      console.error("Error toggling bought status:", extractErrorMessage(e));
    }
  };

  const deleteSavedList = async (id: string) => {
    // Optimistic delete
    setSavedLists(prev => prev.filter(l => l.id !== id));
    
    try {
      if (!id.startsWith('temp-')) {
        await deleteDoc(doc(db, 'shopping_lists', id));
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `shopping_lists/${id}`);
      console.warn("Cloud delete failed:", err.message);
    }
  };

  const addItemToList = async (listId: string, product: Product, supplierName: string, quantity: number) => {
    const list = savedLists.find(l => l.id === listId);
    if (!list) return;

    const existingItemIndex = list.items.findIndex(item => item.name === product.name && item.supplierName === supplierName);
    let updatedItems = [...list.items];

    if (existingItemIndex !== -1) {
      updatedItems[existingItemIndex] = {
        ...updatedItems[existingItemIndex],
        quantity: updatedItems[existingItemIndex].quantity + quantity
      };
    } else {
      updatedItems.push({
        ...product,
        supplierName,
        quantity,
        bought: false
      });
    }

    const newTotal = updatedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0) + (list.shippingFee || 0);
    const newDate = new Date().toISOString();
    
    const updatedListData = { 
      items: updatedItems,
      total: newTotal,
      date: newDate
    };

    // Optimistic update
    setSavedLists(prev => prev.map(l => l.id === listId ? { ...l, ...updatedListData } : l));

    try {
      if (!listId.startsWith('temp-')) {
        await updateDoc(doc(db, 'shopping_lists', listId), updatedListData);
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `shopping_lists/${listId}`);
      console.warn("Cloud update failed:", err.message);
    }

    addAppNotification('Lista Atualizada', `O produto "${product.name}" foi adicionado à lista "${list.name}".`);
  };

  const updateProductPriceInLists = async (productName: string, supplierName: string, newPrice: number) => {
    const listsToSync: SavedList[] = [];
    
    const updatedLists = savedLists.map(list => {
      let listAffected = false;
      const updatedItems = list.items.map(item => {
        if (item.name === productName && item.supplierName === supplierName && !item.bought && item.price !== newPrice) {
          listAffected = true;
          return { ...item, price: newPrice };
        }
        return item;
      });

      if (listAffected) {
        const updatedList = {
          ...list,
          items: updatedItems,
          total: updatedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0) + (list.shippingFee || 0)
        };
        listsToSync.push(updatedList);
        return updatedList;
      }
      return list;
    });

    if (listsToSync.length === 0) return;

    setSavedLists(updatedLists);

    // Sync to Firestore
    for (const list of listsToSync) {
      if (!list.id.startsWith('temp-')) {
        try {
          await updateDoc(doc(db, 'shopping_lists', list.id), {
            items: list.items,
            total: list.total
          });
        } catch (err: any) {
          if (err.code === 'not-found' || err.message.toLowerCase().includes('not found') || err.message.includes('404')) {
            console.warn("Shopping list document not found in Firestore, skipping update:", list.id);
            continue;
          }
          handleFirestoreError(err, OperationType.UPDATE, `shopping_lists/${list.id}`);
          console.warn("Cloud sync failed during price update:", err.message);
        }
      }
    }
  };

  return {
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
  };
};
