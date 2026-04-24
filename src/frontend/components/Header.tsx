/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShoppingCart, Menu, CloudOff, RefreshCw } from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';
import { UINotification, AppNotification, CartItem } from '../types';

interface HeaderProps {
  notifications: UINotification[];
  appNotifications: AppNotification[];
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (open: boolean) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  cart: CartItem[];
  setIsCartOpen: (open: boolean) => void;
  onMenuToggle?: () => void;
  requestPermission?: () => void;
  isOffline?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  notifications,
  appNotifications,
  isNotificationsOpen,
  setIsNotificationsOpen,
  markAllAsRead,
  clearNotifications,
  cart,
  setIsCartOpen,
  onMenuToggle,
  requestPermission,
  isOffline
}) => {
  const cartItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <header className="flex justify-between items-center gap-4 mb-8 md:mb-12">
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-3 bg-white border-2 border-slate-100 text-slate-900 rounded-2xl hover:bg-slate-50 transition-all shadow-sm"
      >
        <Menu className="w-6 h-6" />
      </button>

      <div className="flex items-center gap-3 md:gap-4 ml-auto">
        {/* Indicador de Status de Sincronização */}
        {isOffline && (
          <div 
            className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-2 border-amber-100 text-amber-700 rounded-2xl shadow-sm animate-pulse cursor-help"
            title="Limite de leitura atingido. O app está carregando dados locais. O sincronismo voltará ao normal em breve."
          >
            <CloudOff className="w-5 h-5" />
            <span className="text-xs font-bold hidden sm:inline">MODO LOCAL (LIMITE ATINGIDO)</span>
          </div>
        )}

        {/* Botão do Carrinho */}
        <button
          onClick={() => setIsCartOpen(true)}
          className="relative p-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm group"
        >
          <ShoppingCart className="w-6 h-6" />
          {cartItemsCount > 0 && (
            <span className="absolute -top-2 -right-2 w-6 h-6 bg-indigo-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-lg group-hover:scale-110 transition-transform">
              {cartItemsCount}
            </span>
          )}
        </button>

        {/* Centro de Notificações */}
        <div className="bg-white border-2 border-slate-100 rounded-2xl shadow-sm hover:bg-slate-50 transition-all">
          <NotificationCenter 
            notifications={notifications}
            appNotifications={appNotifications}
            isOpen={isNotificationsOpen}
            setIsOpen={setIsNotificationsOpen}
            markAllAsRead={markAllAsRead}
            clearNotifications={clearNotifications}
            setIsCartOpen={setIsCartOpen}
            requestPermission={requestPermission}
          />
        </div>
      </div>
    </header>
  );
};
