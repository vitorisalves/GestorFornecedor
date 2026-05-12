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
  Truck,
  Bell, 
  LogOut,
  Settings,
  Store,
  Hammer,
  Sparkles,
  X,
  LayoutDashboard
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
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'suppliers', label: 'Fornecedores', icon: Building2 },
    { id: 'mercado', label: 'Mercado', icon: Store },
    { id: 'materiais', label: 'Materiais', icon: Hammer },
    { id: 'shopping', label: 'Fazer Compras', icon: ShoppingCart },
    { id: 'history', label: 'Minhas Listas', icon: ListChecks },
    { id: 'delivered', label: 'Produtos Entregues', icon: Truck },
    { id: 'reminders', label: 'Lembretes', icon: Bell },
    { id: 'update-prices', label: 'Atualizar Preços', icon: Sparkles },
  ];

  return (
    <>
      <div 
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <aside className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col h-screen overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent z-[100] shrink-0 transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8">
          <div className="flex items-center justify-between mb-10">
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-white rounded-2xl overflow-hidden flex items-center justify-center shadow-sm border border-slate-100 shrink-0">
                <img 
                  src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTF8VmLyweYpbSL_D3D1F-hsvmGwm9EHcPi5A&s" 
                  alt="Logo" 
                  className="w-full h-full object-cover p-1"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="text-3xl font-black text-slate-800 tracking-tighter uppercase">LABARR</span>
            </div>
            <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-slate-900 absolute right-4 top-4">
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { setCurrentPage(item.id); onClose(); }}
                className={`flex items-center gap-4 px-4 py-3 font-bold transition-all cursor-pointer w-[190px] rounded-[12px] border-0 ${
                  currentPage === item.id
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="w-6 flex justify-center shrink-0">
                  <item.icon className={`w-5 h-5 ${currentPage === item.id ? 'text-white' : 'text-slate-400'}`} />
                </div>
                <span className="uppercase tracking-tight text-xs whitespace-nowrap">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

      <div className="mt-auto p-6 border-t border-slate-100 space-y-2 bg-slate-50/30">
        {isAdmin && (
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-[190px] flex items-center gap-4 px-4 py-3 rounded-[12px] border-0 font-bold text-slate-600 hover:bg-slate-100 transition-all"
          >
            <div className="w-6 flex justify-center shrink-0">
              <Settings className="w-5 h-5 text-slate-400" />
            </div>
            <span className="uppercase tracking-tight text-xs whitespace-nowrap">Configurações</span>
          </button>
        )}
        
        <div className="px-4 py-3 mb-2 bg-white border border-slate-100 rounded-xl">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Operador Ativo</p>
          <p className="text-[11px] font-bold text-slate-700 truncate uppercase">{loggedName}</p>
        </div>

        <button
          onClick={() => { handleLogout(); onClose(); }}
          className="w-[190px] flex items-center gap-4 px-4 py-3 rounded-[12px] border-0 font-bold text-red-500 hover:bg-red-50 transition-all font-sans"
        >
          <div className="w-6 flex justify-center shrink-0">
            <LogOut className="w-5 h-5 text-slate-400" />
          </div>
          <span className="uppercase tracking-tight text-xs whitespace-nowrap">Sair</span>
        </button>
      </div>
    </aside>
    </>
  );
};
