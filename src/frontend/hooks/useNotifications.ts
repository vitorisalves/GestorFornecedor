/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import { UINotification, AppNotification } from '../types';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<UINotification[]>([]);
  const [appNotifications, setAppNotifications] = useState<AppNotification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      alert('Seu navegador não suporta notificações nativas.');
      return;
    }
    
    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        if ('vibrate' in navigator) {
          navigator.vibrate([100, 50, 100]);
        }
        new Notification('Notificações Ativadas!', {
          body: 'Você agora receberá alertas de lembretes e listas neste dispositivo.',
          icon: 'https://img.icons8.com/color/192/shopping-cart.png',
          tag: 'welcome-notif'
        });
      } else if (permission === 'denied') {
        alert('Permissão negada. Ative as notificações nas configurações do navegador/celular para receber lembretes.');
      }
    } catch (error) {
      console.error('Erro ao solicitar permissão:', error);
    }
  };

  const addNotification = useCallback((name: string, quantity: number, type: 'cart' | 'info' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, name, quantity, type }]);
    
    // Pequena vibração ao adicionar ao carrinho
    if (type === 'cart' && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  }, []);

  const addAppNotification = useCallback((title: string, message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotif: AppNotification = {
      id,
      title,
      message,
      date: new Date().toISOString(),
      read: false
    };

// Notificação Nativa do Navegador (Sistema/Celular)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        const options: any = {
          body: message,
          icon: 'https://img.icons8.com/color/192/shopping-cart.png',
          badge: 'https://img.icons8.com/color/48/shopping-cart.png',
          tag: title.replace(/\s+/g, '-').toLowerCase(),
          requireInteraction: true,
          vibrate: [200, 100, 200]
        };

        try {
          // Tentativa usando Service Worker (Melhor para celular/bloqueio)
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
              registration.showNotification(title, options);
            });
          } else {
            // Fallback para notificação simples
            new Notification(title, options);
          }
        } catch (e) {
          console.warn('Erro ao enviar notificação:', e);
        }
      }
    }

    setAppNotifications(prev => [newNotif, ...prev]);
  }, []);

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
