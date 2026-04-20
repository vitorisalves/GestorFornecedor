/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellRing, X, Trash2, Check } from 'lucide-react';
import { Notification, AppNotification } from '../types';
import { formatDate } from '../utils';

interface NotificationCenterProps {
  notifications: Notification[];
  appNotifications: AppNotification[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  setIsCartOpen?: (open: boolean) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  appNotifications,
  isOpen,
  setIsOpen,
  markAllAsRead,
  clearNotifications,
  setIsCartOpen
}) => {
  const unreadCount = appNotifications.filter(n => !n.read).length;

  return (
    <>
      {/* Floating Notifications */}
      <div className="fixed bottom-6 right-6 left-6 md:left-auto z-50 flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className="bg-slate-900 text-white px-5 py-3 md:px-6 md:py-4 rounded-xl md:rounded-2xl shadow-2xl flex items-center gap-3 md:gap-4 border border-white/10 backdrop-blur-xl pointer-events-auto min-w-[260px] md:min-w-[300px]"
            >
              <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-500/20 rounded-full flex items-center justify-center">
                <Bell className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm text-slate-200">{notif.name}</p>
                {notif.quantity > 0 && (
                  <p className="text-xs text-slate-400">Quantidade: {notif.quantity}</p>
                )}
              </div>
              {setIsCartOpen && notif.type === 'cart' && (
                <button
                  onClick={() => setIsCartOpen(true)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black rounded-lg transition-colors pointer-events-auto"
                >
                  VER CARRINHO
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Notification Panel Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 hover:text-indigo-600 transition-colors"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-6 h-6 animate-pulse" />
        ) : (
          <Bell className="w-6 h-6" />
        )}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, x: 400 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 400 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-[70] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Notificações</h2>
                  <p className="text-sm text-slate-500">{unreadCount} novas mensagens</p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {appNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
                    <Bell className="w-12 h-12 opacity-20" />
                    <p>Nenhuma notificação por aqui</p>
                  </div>
                ) : (
                  appNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        notif.read 
                          ? 'bg-white border-slate-100' 
                          : 'bg-indigo-50 border-indigo-100 shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h3 className={`font-semibold text-sm ${notif.read ? 'text-slate-700' : 'text-indigo-900'}`}>
                          {notif.title}
                        </h3>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {formatDate(notif.date)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {appNotifications.length > 0 && (
                <div className="p-4 border-t border-slate-100 bg-slate-50 grid grid-cols-2 gap-3">
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-white border border-indigo-100 rounded-xl hover:bg-indigo-50 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Ler todas
                  </button>
                  <button
                    onClick={clearNotifications}
                    className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-100 rounded-xl hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Limpar
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
