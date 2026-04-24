/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, doc, updateDoc, query, orderBy, deleteDoc, where } from 'firebase/firestore';
import { Reminder } from '../types';

export const useReminders = (isAuthReady: boolean, addAppNotification: (title: string, message: string) => void) => {
  const [reminders, setReminders] = useState<Reminder[]>(() => {
    const cached = localStorage.getItem('cache_reminders');
    return cached ? JSON.parse(cached) : [];
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('cache_reminders', JSON.stringify(reminders));
  }, [reminders]);

  const checkForDueReminders = (data: Reminder[]) => {
    const now = new Date();
    data.forEach(reminder => {
      if (!reminder.notified) {
        const remDate = new Date(reminder.date);
        if (remDate <= now) {
          addAppNotification(
            "Lembrete de Produto",
            `Está na hora de comprar: ${reminder.productName}`
          );
          // Mark as notified in local object
          reminder.notified = true;
          // Sync to DB
          if (reminder.id && !reminder.id.startsWith('temp-')) {
            updateDoc(doc(db, 'reminders', reminder.id), { notified: true }).catch(err => {
              console.warn("Could not sync reminder status:", err.message);
            });
          }
        }
      }
    });
  };

  const syncReminders = async (force = false) => {
    const CACHE_KEY = 'last_fetch_reminders';
    const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutos
    const lastFetch = localStorage.getItem(CACHE_KEY);

    if (!force && lastFetch && (Date.now() - parseInt(lastFetch)) < CACHE_TIMEOUT) {
      const cached = localStorage.getItem('cache_reminders');
      if (cached) {
        const data = JSON.parse(cached);
        setReminders(data);
        checkForDueReminders(data);
      }
      return;
    }

    try {
      const q = query(
        collection(db, 'reminders'), 
        where('notified', '==', false),
        orderBy('date', 'asc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Reminder[];
      
      setReminders(prev => {
        const optimisticReminders = prev.filter(r => r.id.startsWith('temp-'));
        const merged = [...data, ...optimisticReminders].sort((a,b) => a.date.localeCompare(b.date));
        return merged;
      });
      
      localStorage.setItem(CACHE_KEY, Date.now().toString());
      checkForDueReminders(data);
    } catch (err: any) {
      const isQuota = err.message.toLowerCase().includes('quota') || err.message.toLowerCase().includes('resource-exhausted');
      if (!isQuota) console.error("Reminders fetch error:", err);
    }
  };

  useEffect(() => {
    if (!isAuthReady) return;
    syncReminders();
    
    // Check dues every minute locally
    const interval = setInterval(() => {
      setReminders(prev => {
        const next = [...prev];
        checkForDueReminders(next);
        return next;
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [isAuthReady, addAppNotification]);

  const addReminder = async (productName: string, date: string) => {
    // Generate an optimistic local ID
    const tempId = 'temp-' + Date.now();
    const newReminder: Reminder = { id: tempId, productName, date, notified: false };
    
    // Add explicitly to local state (optimistic)
    setReminders(prev => [...prev, newReminder].sort((a,b) => a.date.localeCompare(b.date)));
    
    // Notification for confirmation
    addAppNotification(
      "Lembrete Criado",
      `Notificaremos você sobre "${productName}" em ${new Date(date).toLocaleString('pt-BR')}`
    );

    try {
      const docRef = await addDoc(collection(db, 'reminders'), {
        productName,
        date,
        notified: false
      });
      // Replace temporary ID with real Firestore ID
      setReminders(prev => prev.map(r => r.id === tempId ? { ...r, id: docRef.id } : r));
    } catch (err: any) {
      console.warn("Could not sync reminder to cloud:", err.message);
    }
  };

  const deleteReminder = async (id: string) => {
    // Optimistic delete
    setReminders(prev => prev.filter(r => r.id !== id));
    
    try {
      if (!id.startsWith('temp-')) {
        await deleteDoc(doc(db, 'reminders', id));
      }
    } catch (err: any) {
      console.warn("Cloud reminder delete failed:", err.message);
    }
  };

  return {
    reminders,
    refreshReminders: syncReminders,
    addReminder,
    deleteReminder,
    error
  };
};
