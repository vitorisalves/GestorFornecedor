/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, query, orderBy, deleteDoc } from 'firebase/firestore';
import { Reminder } from '../types';

export const useReminders = (isAuthReady: boolean, addAppNotification: (title: string, message: string) => void) => {
  const [reminders, setReminders] = useState<Reminder[]>(() => {
    const cached = localStorage.getItem('cache_reminders');
    return cached ? JSON.parse(cached) : [];
  });

  useEffect(() => {
    if (!isAuthReady) return;

    const q = query(collection(db, 'reminders'), orderBy('date', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Reminder[];
      setReminders(data);
      localStorage.setItem('cache_reminders', JSON.stringify(data));

      // Check for dues
      const now = new Date();
      data.forEach(reminder => {
        if (!reminder.notified) {
          const remDate = new Date(reminder.date);
          if (remDate <= now) {
            addAppNotification(
              "Lembrete de Produto",
              `Está na hora de comprar: ${reminder.productName}`
            );
            updateDoc(doc(db, 'reminders', reminder.id), { notified: true });
          }
        }
      });
    }, (error) => {
      const isQuota = error.message.toLowerCase().includes('quota');
      if (!isQuota) console.error("Reminders listener error:", error);
      const cached = localStorage.getItem('cache_reminders');
      if (cached) setReminders(JSON.parse(cached));
    });

    return () => unsub();
  }, [isAuthReady, addAppNotification]);

  const addReminder = async (productName: string, date: string) => {
    await addDoc(collection(db, 'reminders'), {
      productName,
      date,
      notified: false
    });
  };

  const deleteReminder = async (id: string) => {
    await deleteDoc(doc(db, 'reminders', id));
  };

  return {
    reminders,
    addReminder,
    deleteReminder
  };
};
