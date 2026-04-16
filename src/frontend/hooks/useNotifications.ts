/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Notification, AppNotification } from '../types';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [appNotifications, setAppNotifications] = useState<AppNotification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const addNotification = (name: string, quantity: number) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, name, quantity }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  };

  const addAppNotification = (title: string, message: string) => {
    const newNotif: AppNotification = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      message,
      date: new Date().toISOString(),
      read: false
    };
    setAppNotifications(prev => [newNotif, ...prev]);
  };

  const markAllAsRead = () => {
    setAppNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setAppNotifications([]);
  };

  return {
    notifications,
    appNotifications,
    isNotificationsOpen,
    setIsNotificationsOpen,
    addNotification,
    addAppNotification,
    markAllAsRead,
    clearNotifications
  };
};
