/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Building2, 
  ShoppingCart, 
  ListChecks, 
  Globe, 
  Bell, 
  LogOut,
  Settings
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  setCurrentPage: (page: any) => void;
  isAdmin: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  handleLogout: () => void;
  loggedName: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  setCurrentPage,
  isAdmin,
  setIsSettingsOpen,
  handleLogout,
  loggedName
}) => {
  const menuItems = [
    { id: 'suppliers', label: 'Fornecedores', icon: Building2 },
    { id: 'shopping', label: 'Fazer Compras', icon: ShoppingCart },
    { id: 'history', label: 'Minhas Listas', icon: ListChecks },
    { id: 'omie', label: 'Produtos Externos', icon: Globe },
    { id: 'reminders', label: 'Lembretes', icon: Bell },
  ];

  return (
    <div className="w-72 bg-white border-r-2 border-slate-900 flex flex-col h-screen sticky top-0">
      <div className="p-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center shadow-xl shadow-slate-200">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <span className="text-3xl font-black text-slate-900 tracking-tighter">LABARR</span>
        </div>

        <nav className="space-y-3">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-black transition-all border-2 ${
                currentPage === item.id
                  ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200'
                  : 'text-slate-900 border-transparent hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <item.icon className={`w-6 h-6 ${currentPage === item.id ? 'text-white' : 'text-slate-900'}`} />
              <span className="uppercase tracking-tight text-sm">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t-2 border-slate-900 space-y-2 bg-slate-50/50">
        {isAdmin && (
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-black text-slate-900 hover:bg-slate-200 transition-all border-2 border-transparent hover:border-slate-900"
          >
            <Settings className="w-5 h-5 text-slate-900" />
            <span className="uppercase tracking-tight text-xs">Configurações</span>
          </button>
        )}
        
        <div className="px-5 py-4 mb-2 bg-white border-2 border-slate-900 rounded-2xl">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Operador Ativo</p>
          <p className="text-xs font-black text-slate-900 truncate uppercase">{loggedName}</p>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-black text-red-600 hover:bg-red-600 hover:text-white transition-all border-2 border-transparent hover:border-red-600"
        >
          <LogOut className="w-5 h-5" />
          <span className="uppercase tracking-tight text-xs">Encerrar Sessão</span>
        </button>
      </div>
    </div>
  );
};
