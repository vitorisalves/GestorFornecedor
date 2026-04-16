/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { Reminder } from '../types';

export const useReminders = (isAuthReady: boolean, addAppNotification: (title: string, message: string) => void) => {
  const [reminders, setReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    if (!isAuthReady) return;

    const q = query(collection(db, 'reminders'), orderBy('date', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Reminder[];
      setReminders(data);

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

  return {
    reminders,
    addReminder
  };
};
