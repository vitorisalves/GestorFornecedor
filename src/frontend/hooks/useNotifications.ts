/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { UINotification, AppNotification } from '../types';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<UINotification[]>([]);
  const [appNotifications, setAppNotifications] = useState<AppNotification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const requestPermission = async () => {
    console.log('Solicitando permissão de notificação...');
    if (!('Notification' in window)) {
      alert('Seu navegador não suporta notificações nativas.');
      return;
    }
    
    try {
      // Alguns navegadores mais antigos usam callback, mas a maioria moderna usa Promise
      const permission = await Notification.requestPermission();
      console.log('Resultado da permissão:', permission);
      
      if (permission === 'granted') {
        try {
          new Notification('Notificações Ativadas!', {
            body: 'Você agora receberá alertas neste dispositivo.',
            icon: 'https://img.icons8.com/color/192/shopping-cart.png'
          });
        } catch (e) {
          console.warn('Erro ao criar notificação de teste:', e);
        }
      } else if (permission === 'denied') {
        alert('Permissão negada. Você precisa habilitar as notificações nas configurações do seu navegador ou celular para este site.');
      }
    } catch (error) {
      console.error('Erro ao solicitar permissão:', error);
      alert('Erro ao ativar notificações. Verifique se você está em uma conexão segura (HTTPS) e fora de janelas privadas.');
    }
  };

  const addNotification = (name: string, quantity: number, type: 'cart' | 'info' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, name, quantity, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  };

  const addAppNotification = (title: string, message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotif: AppNotification = {
      id,
      title,
      message,
      date: new Date().toISOString(),
      read: false
    };

    // Notificação Nativa do Navegador
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { 
          body: message,
          icon: 'https://img.icons8.com/color/192/shopping-cart.png'
        });
      } catch (e) {
        console.warn('Erro ao enviar notificação nativa:', e);
      }
    }

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
    clearNotifications,
    requestPermission
  };
};
