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
  Settings,
  Store,
  Hammer,
  X
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  setCurrentPage: (page: any) => void;
  isAdmin: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  handleLogout: () => void;
  loggedName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  setCurrentPage,
  isAdmin,
  setIsSettingsOpen,
  handleLogout,
  loggedName,
  isOpen,
  onClose
}) => {
  const menuItems = [
    { id: 'suppliers', label: 'Fornecedores', icon: Building2 },
    { id: 'mercado', label: 'Mercado', icon: Store },
    { id: 'materiais', label: 'Materiais', icon: Hammer },
    { id: 'shopping', label: 'Fazer Compras', icon: ShoppingCart },
    { id: 'history', label: 'Minhas Listas', icon: ListChecks },
    { id: 'omie', label: 'Produtos Externos', icon: Globe },
    { id: 'reminders', label: 'Lembretes', icon: Bell },
  ];

  return (
    <>
      <div 
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <aside className={`fixed inset-y-0 left-0 w-72 bg-white border-r-2 border-slate-900 flex flex-col h-screen overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent z-[100] shrink-0 transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8">
          <div className="flex items-center justify-between mb-10">
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="w-24 h-24 md:w-28 md:h-28 bg-white rounded-3xl overflow-hidden flex items-center justify-center shadow-xl shadow-slate-200 border-2 border-slate-900 shrink-0">
                <img 
                  src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTF8VmLyweYpbSL_D3D1F-hsvmGwm9EHcPi5A&s" 
                  alt="Logo" 
                  className="w-full h-full object-cover p-1"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="text-4xl font-black text-slate-900 tracking-tighter uppercase">LABARR</span>
            </div>
            <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-slate-900 absolute right-4 top-4">
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav className="space-y-3">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { setCurrentPage(item.id); onClose(); }}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-black transition-all border-2 cursor-pointer ${
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
    </aside>
    </>
  );
};
