import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { motion } from 'framer-motion';

interface AppLayoutProps {
  children: React.ReactNode;
  currentPage: any;
  setCurrentPage: (page: any) => void;
  isAdmin: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  handleLogout: () => void;
  loggedName: string;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  requestPermission: () => Promise<void>;
  notifications: any[];
  appNotifications: any[];
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (open: boolean) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  cart: any[];
  setIsCartOpen: (open: boolean) => void;
  isOffline: boolean;
  onReconnect: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  currentPage,
  setCurrentPage,
  isAdmin,
  setIsSettingsOpen,
  handleLogout,
  loggedName,
  isSidebarOpen,
  setIsSidebarOpen,
  requestPermission,
  notifications,
  appNotifications,
  isNotificationsOpen,
  setIsNotificationsOpen,
  markAllAsRead,
  clearNotifications,
  cart,
  setIsCartOpen,
  isOffline,
  onReconnect,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage} 
        isAdmin={isAdmin}
        setIsSettingsOpen={setIsSettingsOpen}
        handleLogout={handleLogout}
        loggedName={loggedName}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="flex-1 lg:ml-64 p-4 md:p-8 lg:p-12 w-full overflow-x-hidden min-h-screen transition-all">
        <div className="max-w-6xl mx-auto px-4 md:px-0">
          <Header
            requestPermission={requestPermission} 
            notifications={notifications}
            appNotifications={appNotifications}
            isNotificationsOpen={isNotificationsOpen}
            setIsNotificationsOpen={setIsNotificationsOpen}
            markAllAsRead={markAllAsRead}
            clearNotifications={clearNotifications}
            cart={cart}
            setIsCartOpen={setIsCartOpen}
            onMenuToggle={() => setIsSidebarOpen(true)}
            isOffline={isOffline}
            onReconnect={onReconnect}
          />
          {children}
        </div>
      </main>
    </div>
  );
};
