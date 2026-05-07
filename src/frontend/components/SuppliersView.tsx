/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Search, 
  Building2, 
  Phone, 
  Package, 
  Pencil, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  Download,
  Upload,
  RefreshCcw
} from 'lucide-react';
import { Supplier, Product } from '../types';
import { formatCurrency, normalizeText } from '../utils';

interface SuppliersViewProps {
  suppliers: Supplier[];
  allSuppliers: Supplier[];
  isLoading?: boolean;
  onRefresh?: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  setIsAdding: (adding: boolean) => void;
  handleEditSupplier: (supplier: Supplier) => void;
  setSupplierToDelete: (id: string | null) => void;
  addToCart: (product: Product, supplierName: string, quantity: number) => void;
  handleExportExcel: () => void;
  handleImportExcel: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSyncSheets?: () => void;
  activeTab?: 'fornecedores' | 'mercado' | 'materiais';
  onTabChange?: (tab: 'fornecedores' | 'mercado' | 'materiais') => void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  suppliers,
  allSuppliers,
  isLoading,
  onRefresh,
  searchTerm,
  setSearchTerm,
  setIsAdding,
  handleEditSupplier,
  setSupplierToDelete,
  addToCart,
  handleExportExcel,
  handleImportExcel,
  handleSyncSheets,
  activeTab: externalTab,
  onTabChange
}) => {
  const [internalTab, setInternalTab] = React.useState<'fornecedores' | 'mercado' | 'materiais'>('fornecedores');
  const activeSubTab = externalTab || internalTab;
  const setActiveSubTab = onTabChange || setInternalTab;

  const [expandedSupplier, setExpandedSupplier] = React.useState<string | null>(null);
  const [quantities, setQuantities] = React.useState<Record<string, string>>({});

  const marketSupplier = allSuppliers.find(s => s.name.toUpperCase() === 'MERCADO');
  const materialsSupplier = allSuppliers.find(s => s.name.toUpperCase() === 'MATERIAIS');

  const handleAddChannelProduct = (channel: 'MERCADO' | 'MATERIAIS') => {
    const existingSupplier = allSuppliers.find(s => s.name.toUpperCase() === channel);
    if (existingSupplier) {
      handleEditSupplier(existingSupplier);
    } else {
      // Create a virtual supplier for this channel if it doesn't exist
      handleEditSupplier({
        id: `CHANNEL_${channel}`,
        name: channel,
        phone: '00000000000',
        products: []
      });
    }
  };

  const handleQuantityChange = (key: string, value: string) => {
    // Permite vazio ou apenas números
    if (value === '' || /^\d+$/.test(value)) {
      setQuantities(prev => ({ ...prev, [key]: value }));
    }
  };

  const handleQuantityBlur = (key: string) => {
    // Se estiver vazio ou zero, volta para 1
    if (!quantities[key] || parseInt(quantities[key]) === 0) {
      setQuantities(prev => ({ ...prev, [key]: '1' }));
    }
  };

  const adjustQuantity = (key: string, delta: number) => {
    setQuantities(prev => {
      const val = prev[key];
      const current = (val && !isNaN(parseInt(val))) ? parseInt(val) : 1;
      const newVal = Math.max(1, current + delta);
      return { ...prev, [key]: newVal.toString() };
    });
  };

  const onAddToCart = (product: any, supplierName: string, key: string) => {
    const val = quantities[key] || '1';
    const qty = parseInt(val);
    if (isNaN(qty) || qty < 1) return;
    addToCart(product, supplierName, qty);
    setQuantities(prev => ({ ...prev, [key]: '1' }));
  };

  const filteredSuppliers = suppliers
    .filter(s => {
      const normalizedSearch = normalizeText(searchTerm);
      return normalizeText(s.name).includes(normalizedSearch) ||
        s.products.some(p => normalizeText(p.name).includes(normalizedSearch));
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight mb-1 md:mb-2 text-balance">Gestão de Compras</h1>
            <p className="text-sm md:text-base text-slate-500 font-medium">Controle de fornecedores e itens por canal</p>
          </div>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className={`p-3 rounded-2xl transition-all ${isLoading ? 'bg-indigo-100 text-indigo-400' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 active:scale-95'}`}
            title="Sincronizar com a nuvem"
          >
            <RefreshCcw className={`w-6 h-6 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          {[
          { id: 'fornecedores', label: 'Geral' },
          { id: 'mercado', label: 'Mercado' },
          { id: 'materiais', label: 'Materiais' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`px-6 py-2 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${
              activeSubTab === tab.id 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'bg-white text-slate-400 hover:text-slate-600 border border-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'fornecedores' && (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Lista de Fornecedores</h2>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                onClick={handleSyncSheets}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 border-2 border-indigo-100 text-indigo-600 rounded-xl font-bold hover:bg-indigo-100 transition-all shadow-sm text-xs"
              >
                <RefreshCcw className="w-4 h-4" />
                Atualizar Planilha
              </button>
              <button
                onClick={handleExportExcel}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm text-xs"
              >
                <Download className="w-4 h-4" />
                Exportar
              </button>
              <label className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm cursor-pointer text-xs">
                <Upload className="w-4 h-4" />
                Importar
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
              </label>
              <button
                onClick={() => setIsAdding(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 text-xs"
              >
                <Plus className="w-4 h-4" />
                Novo
              </button>
            </div>
          </div>

          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="Buscar..."
              className="w-full pl-14 pr-4 py-4 bg-white border border-slate-200 focus:border-indigo-500 rounded-2xl outline-none transition-all shadow-sm text-base font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredSuppliers.map((supplier, sIdx) => (
              <motion.div
                layout
                key={`${supplier.id || 's'}-${sIdx}`}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-indigo-100"
              >
                <div 
                  onClick={() => setExpandedSupplier(expandedSupplier === supplier.id ? null : supplier.id)}
                  className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 md:w-14 md:h-14 bg-slate-900 rounded-xl flex items-center justify-center border border-slate-800 shadow-sm">
                      <Building2 className="w-6 h-6 md:w-7 md:h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 mb-0.5 md:mb-1 tracking-tight uppercase">{supplier.name}</h3>
                      <div className="flex items-center gap-3 text-slate-400 font-bold text-[10px] uppercase tracking-tight">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {supplier.phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          {supplier.products.length} itens
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between md:justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditSupplier(supplier)}
                        className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setSupplierToDelete(supplier.id)}
                        className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    <button
                      onClick={() => setExpandedSupplier(expandedSupplier === supplier.id ? null : supplier.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold uppercase text-[10px] transition-all border ${
                        expandedSupplier === supplier.id 
                          ? 'bg-slate-100 border-slate-200 text-slate-700' 
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      {expandedSupplier === supplier.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {expandedSupplier === supplier.id ? 'Ocultar' : 'Produtos'}
                    </button>
                  </div>
                </div>

                <motion.div
                  initial={false}
                  animate={{ height: expandedSupplier === supplier.id ? 'auto' : 0 }}
                  className="overflow-hidden bg-slate-50/20"
                >
                  <div className="p-6 pt-0 border-t border-slate-50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
                      {supplier.products
                        .filter(p => {
                          if (!searchTerm) return true;
                          const normalizedSearch = normalizeText(searchTerm);
                          return normalizeText(p.name).includes(normalizedSearch) || 
                            normalizeText(p.category).includes(normalizedSearch) ||
                            normalizeText(supplier.name).includes(normalizedSearch);
                        })
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((product, idx) => {
                          const qKey = `${supplier.id || 'sup'}-${String(product.name)}-${idx}`;
                          return (
                            <div key={qKey} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-indigo-200 transition-all">
                              <div>
                                <div className="flex justify-between items-start mb-3">
                                  <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-black uppercase tracking-wider">
                                    {product.category}
                                  </span>
                                  <span className="text-xl font-black text-indigo-600">
                                    {formatCurrency(product.price)}
                                  </span>
                                </div>
                                <h4 className="font-bold text-slate-900 mb-3">{product.name}</h4>
                                <div className="space-y-1.5 mb-6">
                                  {product.lastPurchaseDate && (
                                    <div className="flex items-center gap-2 bg-indigo-50/50 px-2 py-1 rounded-lg border border-indigo-100/50">
                                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                                      <span className="text-[9px] text-slate-500 font-bold uppercase">Última Compra:</span>
                                      <span className="text-[9px] text-indigo-700 font-black">{product.lastPurchaseDate}</span>
                                    </div>
                                  )}
                                  {product.paymentMethod && (
                                    <div className="flex items-center gap-2 bg-emerald-50/50 px-2 py-1 rounded-lg border border-emerald-100/50">
                                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                      <span className="text-[9px] text-slate-500 font-bold uppercase">Pagamento:</span>
                                      <span className="text-[9px] text-emerald-700 font-black">{product.paymentMethod}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col sm:flex-row gap-2 mt-auto">
                                <div className="flex items-center bg-slate-100 rounded-xl border-2 border-transparent focus-within:border-indigo-600 transition-all overflow-hidden shrink-0 h-11">
                                  <button 
                                    id={`dec-${qKey}`}
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      adjustQuantity(qKey, -1);
                                    }}
                                    className="w-9 h-full text-slate-400 hover:text-indigo-600 hover:bg-slate-200 transition-all active:scale-90 flex items-center justify-center"
                                  >
                                    <ChevronDown className="w-4 h-4 font-black" />
                                  </button>
                                  <input
                                    id={`qty-${qKey}`}
                                    type="text"
                                    value={quantities[qKey] ?? '1'}
                                    onChange={(e) => handleQuantityChange(qKey, e.target.value)}
                                    onBlur={() => handleQuantityBlur(qKey)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        onAddToCart(product, supplier.name, qKey);
                                      }
                                    }}
                                    className="w-10 h-full bg-transparent text-center font-bold text-slate-900 outline-none text-sm"
                                    placeholder="Qtd"
                                  />
                                  <button 
                                    id={`inc-${qKey}`}
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      adjustQuantity(qKey, 1);
                                    }}
                                    className="w-9 h-full text-slate-400 hover:text-indigo-600 hover:bg-slate-200 transition-all active:scale-90 flex items-center justify-center"
                                  >
                                    <ChevronUp className="w-4 h-4 font-black" />
                                  </button>
                                </div>
                                <button
                                  id={`add-${qKey}`}
                                  onClick={() => onAddToCart(product, supplier.name, qKey)}
                                  className="flex-1 h-11 bg-slate-900 text-white rounded-xl font-bold text-[10px] sm:text-xs hover:bg-indigo-600 transition-all active:scale-95"
                                >
                                  Adicionar
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'mercado' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Produtos de Mercado</h2>
            <button
              onClick={() => handleAddChannelProduct('MERCADO')}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md active:scale-95 text-xs"
            >
              <Plus className="w-4 h-4" />
              Gerenciar Produtos
            </button>
          </div>

          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="Buscar produtos no mercado..."
              className="w-full pl-14 pr-4 py-4 bg-white border border-slate-200 focus:border-indigo-500 rounded-2xl outline-none transition-all shadow-sm text-base font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {!marketSupplier || marketSupplier.products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white border border-dashed border-slate-200 rounded-2xl">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <Package className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight mb-2">Canal Mercado</h3>
              <p className="text-slate-500 text-sm">Nenhum produto cadastrado no mercado ainda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {marketSupplier.products
                .filter(p => {
                  const normalizedSearch = normalizeText(searchTerm);
                  return normalizeText(p.name).includes(normalizedSearch) || 
                    normalizeText(p.category).includes(normalizedSearch);
                })
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((product, idx) => {
                  const qKey = `MERCADO-${String(product.name)}-${idx}`;
                  return (
                    <div key={qKey} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-indigo-100 transition-all">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <span className="px-3 py-1 bg-slate-50 text-slate-400 border border-slate-100 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                            {product.category}
                          </span>
                          <span className="text-xl font-black text-indigo-600">
                            {formatCurrency(product.price)}
                          </span>
                        </div>
                        <h4 className="text-lg font-bold text-slate-700 mb-3 uppercase tracking-tight">{product.name}</h4>
                        <div className="space-y-1.5 mb-6">
                          {product.lastPurchaseDate && (
                            <div className="flex items-center gap-2 bg-indigo-50/50 px-2 py-1 rounded-lg border border-indigo-100/50">
                              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                              <span className="text-[9px] text-slate-500 font-bold uppercase">Última Compra:</span>
                              <span className="text-[9px] text-indigo-700 font-black">{product.lastPurchaseDate}</span>
                            </div>
                          )}
                          {product.paymentMethod && (
                            <div className="flex items-center gap-2 bg-emerald-50/50 px-2 py-1 rounded-lg border border-emerald-100/50">
                              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                              <span className="text-[9px] text-slate-500 font-bold uppercase">Pagamento:</span>
                              <span className="text-[9px] text-emerald-700 font-black">{product.paymentMethod}</span>
                            </div>
                          )}
                        </div>
                      </div>
                        <div className="flex flex-col sm:flex-row gap-2 mt-auto">
                          <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 focus-within:border-indigo-500 transition-all overflow-hidden h-11 shrink-0">
                            <button 
                              id={`dec-${qKey}`}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                adjustQuantity(qKey, -1);
                              }}
                              className="w-10 h-full text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-all active:scale-95 flex items-center justify-center"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            <input
                              id={`qty-${qKey}`}
                              type="text"
                              value={quantities[qKey] ?? '1'}
                              onChange={(e) => handleQuantityChange(qKey, e.target.value)}
                              onBlur={() => handleQuantityBlur(qKey)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  onAddToCart(product, 'MERCADO', qKey);
                                }
                              }}
                              className="w-10 h-full bg-transparent text-center font-bold text-slate-700 outline-none text-sm"
                              placeholder="Qtd"
                            />
                            <button 
                              id={`inc-${qKey}`}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                adjustQuantity(qKey, 1);
                              }}
                              className="w-10 h-full text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-all active:scale-95 flex items-center justify-center"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                          </div>
                          <button
                            id={`add-${qKey}`}
                            onClick={() => onAddToCart(product, 'MERCADO', qKey)}
                            className="flex-1 h-11 bg-slate-900 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-indigo-600 transition-all shadow-sm"
                          >
                            Adicionar
                          </button>
                        </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'materiais' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Produtos de Materiais</h2>
            <button
              onClick={() => handleAddChannelProduct('MATERIAIS')}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md active:scale-95 text-xs"
            >
              <Plus className="w-4 h-4" />
              Gerenciar Produtos
            </button>
          </div>

          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="Buscar materiais..."
              className="w-full pl-14 pr-4 py-4 bg-white border border-slate-200 focus:border-indigo-500 rounded-2xl outline-none transition-all shadow-sm text-base font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {!materialsSupplier || materialsSupplier.products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white border border-dashed border-slate-200 rounded-2xl">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <Package className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight mb-2">Canal Materiais</h3>
              <p className="text-slate-500 text-sm">Nenhum produto cadastrado em materiais ainda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {materialsSupplier.products
                .filter(p => {
                  const normalizedSearch = normalizeText(searchTerm);
                  return normalizeText(p.name).includes(normalizedSearch) || 
                    normalizeText(p.category).includes(normalizedSearch);
                })
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((product, idx) => {
                  const qKey = `MATERIAIS-${String(product.name)}-${idx}`;
                  return (
                    <div key={qKey} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-indigo-100 transition-all">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <span className="px-3 py-1 bg-slate-50 text-slate-400 border border-slate-100 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                            {product.category}
                          </span>
                          <span className="text-xl font-black text-indigo-600">
                            {formatCurrency(product.price)}
                          </span>
                        </div>
                        <h4 className="text-lg font-bold text-slate-700 mb-3 uppercase tracking-tight">{product.name}</h4>
                        <div className="space-y-1.5 mb-6">
                          {product.lastPurchaseDate && (
                            <div className="flex items-center gap-2 bg-indigo-50/50 px-2 py-1 rounded-lg border border-indigo-100/50">
                              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                              <span className="text-[9px] text-slate-500 font-bold uppercase">Última Compra:</span>
                              <span className="text-[9px] text-indigo-700 font-black">{product.lastPurchaseDate}</span>
                            </div>
                          )}
                          {product.paymentMethod && (
                            <div className="flex items-center gap-2 bg-emerald-50/50 px-2 py-1 rounded-lg border border-emerald-100/50">
                              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                              <span className="text-[9px] text-slate-500 font-bold uppercase">Pagamento:</span>
                              <span className="text-[9px] text-emerald-700 font-black">{product.paymentMethod}</span>
                            </div>
                          )}
                        </div>
                      </div>
                        <div className="flex flex-col sm:flex-row gap-2 mt-auto">
                          <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 focus-within:border-indigo-500 transition-all overflow-hidden h-11 shrink-0">
                            <button 
                              id={`dec-${qKey}`}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                adjustQuantity(qKey, -1);
                              }}
                              className="w-10 h-full text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-all active:scale-95 flex items-center justify-center"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            <input
                              id={`qty-${qKey}`}
                              type="text"
                              value={quantities[qKey] ?? '1'}
                              onChange={(e) => handleQuantityChange(qKey, e.target.value)}
                              onBlur={() => handleQuantityBlur(qKey)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  onAddToCart(product, 'MATERIAIS', qKey);
                                }
                              }}
                              className="w-10 h-full bg-transparent text-center font-bold text-slate-700 outline-none text-sm"
                              placeholder="Qtd"
                            />
                            <button 
                              id={`inc-${qKey}`}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                adjustQuantity(qKey, 1);
                              }}
                              className="w-10 h-full text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-all active:scale-95 flex items-center justify-center"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                          </div>
                          <button
                            id={`add-${qKey}`}
                            onClick={() => onAddToCart(product, 'MATERIAIS', qKey)}
                            className="flex-1 h-11 bg-slate-900 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-indigo-600 transition-all shadow-sm"
                          >
                            Adicionar
                          </button>
                        </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};
