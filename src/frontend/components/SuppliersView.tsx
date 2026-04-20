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
import { formatCurrency } from '../utils';

interface SuppliersViewProps {
  suppliers: Supplier[];
  allSuppliers: Supplier[];
  isLoading?: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  setIsAdding: (adding: boolean) => void;
  handleEditSupplier: (supplier: Supplier) => void;
  setSupplierToDelete: (id: string | null) => void;
  addToCart: (product: Product, supplierName: string, quantity: number) => void;
  handleExportExcel: () => void;
  handleImportExcel: (e: React.ChangeEvent<HTMLInputElement>) => void;
  activeTab?: 'fornecedores' | 'mercado' | 'materiais';
  onTabChange?: (tab: 'fornecedores' | 'mercado' | 'materiais') => void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  suppliers,
  allSuppliers,
  isLoading,
  searchTerm,
  setSearchTerm,
  setIsAdding,
  handleEditSupplier,
  setSupplierToDelete,
  addToCart,
  handleExportExcel,
  handleImportExcel,
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

  const onAddToCart = (product: any, supplierName: string, key: string) => {
    const qty = parseInt(quantities[key] || '1');
    addToCart(product, supplierName, qty);
    // Mantém o valor em 1 para a próxima adição
    setQuantities(prev => ({ ...prev, [key]: '1' }));
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.products.some(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const TabButton = ({ id, label }: { id: typeof activeSubTab, label: string }) => (
    <button
      onClick={() => setActiveSubTab(id)}
      className={`px-8 py-3 rounded-2xl font-black uppercase text-xs tracking-widest transition-all whitespace-nowrap ${
        activeSubTab === id 
          ? 'bg-slate-900 text-white shadow-lg shadow-slate-200 border-b-4 border-slate-700' 
          : 'bg-white text-slate-400 hover:text-slate-600 border-2 border-slate-100'
      }`}
    >
      {label}
    </button>
  );

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
          {isLoading && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"
              title="Sincronizando com a nuvem..."
            >
              <RefreshCcw className="w-6 h-6" />
            </motion.div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
        <TabButton id="fornecedores" label="Geral" />
        <TabButton id="mercado" label="Cesta" />
        <TabButton id="materiais" label="Lojas" />
      </div>

      {activeSubTab === 'fornecedores' && (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Lista de Fornecedores</h2>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
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
            <Search className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="Buscar..."
              className="w-full pl-12 md:pl-16 pr-4 py-4 md:py-5 bg-white border-2 border-slate-100 focus:border-indigo-500 rounded-2xl md:rounded-[2rem] outline-none transition-all shadow-sm text-base md:text-lg font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-6">
            {filteredSuppliers.map((supplier) => (
              <motion.div
                layout
                key={supplier.id}
                className="bg-white rounded-[2.5rem] border-2 border-slate-900 shadow-xl shadow-slate-100 overflow-hidden transition-all"
              >
                <div 
                  onClick={() => setExpandedSupplier(expandedSupplier === supplier.id ? null : supplier.id)}
                  className="p-5 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4 md:gap-6">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-900 rounded-2xl md:rounded-3xl flex items-center justify-center border-2 border-slate-900 shadow-lg shadow-slate-200">
                      <Building2 className="w-6 h-6 md:w-8 md:h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-0.5 md:mb-1 tracking-tighter uppercase">{supplier.name}</h3>
                      <div className="flex items-center gap-3 text-slate-900 font-black text-[10px] md:text-xs uppercase tracking-tight">
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 rounded-lg">
                          <Phone className="w-3.5 h-3.5 text-slate-900" />
                          {supplier.phone}
                        </span>
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 rounded-lg">
                          <Package className="w-3.5 h-3.5 text-slate-900" />
                          {supplier.products.length} itens
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between md:justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditSupplier(supplier)}
                        className="p-3 md:p-4 text-slate-900 hover:text-white hover:bg-slate-900 rounded-xl md:rounded-2xl transition-all border-2 border-transparent hover:border-slate-900"
                      >
                        <Pencil className="w-5 h-5 md:w-6 h-6" />
                      </button>
                      <button
                        onClick={() => setSupplierToDelete(supplier.id)}
                        className="p-3 md:p-4 text-slate-900 hover:text-white hover:bg-red-600 rounded-xl md:rounded-2xl transition-all border-2 border-transparent hover:border-red-600"
                      >
                        <Trash2 className="w-5 h-5 md:w-6 h-6" />
                      </button>
                    </div>
                    <button
                      onClick={() => setExpandedSupplier(expandedSupplier === supplier.id ? null : supplier.id)}
                      className="flex items-center gap-2 px-5 md:px-6 py-3 md:py-4 bg-slate-900 text-white rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs hover:bg-indigo-600 transition-all shadow-lg shadow-slate-200 border-b-4 border-slate-700 active:border-b-0"
                    >
                      {expandedSupplier === supplier.id ? <ChevronUp className="w-4 h-4 md:w-5 h-5" /> : <ChevronDown className="w-4 h-4 md:w-5 h-5" />}
                      {expandedSupplier === supplier.id ? 'Ocultar' : 'Produtos'}
                    </button>
                  </div>
                </div>

                <motion.div
                  initial={false}
                  animate={{ height: expandedSupplier === supplier.id ? 'auto' : 0 }}
                  className="overflow-hidden bg-slate-50/50"
                >
                  <div className="p-8 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {supplier.products.map((product, idx) => (
                        <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-indigo-200 transition-all">
                          <div>
                            <div className="flex justify-between items-start mb-3">
                              <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-black uppercase tracking-wider">
                                {product.category}
                              </span>
                              <span className="text-xl font-black text-indigo-600">
                                {formatCurrency(product.price)}
                              </span>
                            </div>
                            <h4 className="font-bold text-slate-900 mb-4">{product.name}</h4>
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-none">
                              <input
                                type="text"
                                value={quantities[`${supplier.id}-${idx}`] ?? '1'}
                                onChange={(e) => handleQuantityChange(`${supplier.id}-${idx}`, e.target.value)}
                                onBlur={() => handleQuantityBlur(`${supplier.id}-${idx}`)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    onAddToCart(product, supplier.name, `${supplier.id}-${idx}`);
                                  }
                                }}
                                className="w-16 px-2 py-3 bg-slate-100 border-2 border-transparent focus:border-indigo-600 rounded-xl text-center font-bold text-slate-900 outline-none transition-all"
                                placeholder="Qtd"
                              />
                            </div>
                            <button
                              onClick={() => onAddToCart(product, supplier.name, `${supplier.id}-${idx}`)}
                              className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-indigo-600 transition-all active:scale-95"
                            >
                              Adicionar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'mercado' && (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Produtos de Mercado</h2>
            <button
              onClick={() => handleAddChannelProduct('MERCADO')}
              className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 text-sm"
            >
              <Plus className="w-5 h-5" />
              Gerenciar Produtos
            </button>
          </div>

          {!marketSupplier || marketSupplier.products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem]">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <Package className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Canal Mercado</h3>
              <p className="text-slate-500 font-medium">Nenhum produto cadastrado no mercado ainda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {marketSupplier.products.map((product, idx) => (
                <div key={idx} className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-900 shadow-xl shadow-slate-100 flex flex-col justify-between group hover:border-indigo-200 transition-all">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="px-4 py-1.5 bg-slate-100 text-slate-500 rounded-full text-xs font-black uppercase tracking-wider">
                        {product.category}
                      </span>
                      <span className="text-2xl font-black text-indigo-600">
                        {formatCurrency(product.price)}
                      </span>
                    </div>
                    <h4 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-tight">{product.name}</h4>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-none">
                      <input
                        type="text"
                        value={quantities[`MERCADO-${idx}`] ?? '1'}
                        onChange={(e) => handleQuantityChange(`MERCADO-${idx}`, e.target.value)}
                        onBlur={() => handleQuantityBlur(`MERCADO-${idx}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            addToCart(product, 'MERCADO', Number(quantities[`MERCADO-${idx}`] ?? '1'));
                            setQuantities(prev => ({ ...prev, [`MERCADO-${idx}`]: '1' }));
                          }
                        }}
                        className="w-16 px-2 py-4 bg-slate-100 border-2 border-transparent focus:border-indigo-600 rounded-2xl text-center font-black text-slate-900 outline-none transition-all"
                        placeholder="Qtd"
                      />
                    </div>
                    <button
                      onClick={() => {
                        addToCart(product, 'MERCADO', Number(quantities[`MERCADO-${idx}`] ?? '1'));
                        setQuantities(prev => ({ ...prev, [`MERCADO-${idx}`]: '1' }));
                      }}
                      className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-600 transition-all active:scale-95 border-b-4 border-slate-700 active:border-b-0"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'materiais' && (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Produtos de Materiais</h2>
            <button
              onClick={() => handleAddChannelProduct('MATERIAIS')}
              className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 text-sm"
            >
              <Plus className="w-5 h-5" />
              Gerenciar Produtos
            </button>
          </div>

          {!materialsSupplier || materialsSupplier.products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem]">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <Package className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Canal Materiais</h3>
              <p className="text-slate-500 font-medium">Nenhum produto cadastrado em materiais ainda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {materialsSupplier.products.map((product, idx) => (
                <div key={idx} className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-900 shadow-xl shadow-slate-100 flex flex-col justify-between group hover:border-indigo-200 transition-all">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="px-4 py-1.5 bg-slate-100 text-slate-500 rounded-full text-xs font-black uppercase tracking-wider">
                        {product.category}
                      </span>
                      <span className="text-2xl font-black text-indigo-600">
                        {formatCurrency(product.price)}
                      </span>
                    </div>
                    <h4 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-tight">{product.name}</h4>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-none">
                      <input
                        type="text"
                        value={quantities[`MATERIAIS-${idx}`] ?? '1'}
                        onChange={(e) => handleQuantityChange(`MATERIAIS-${idx}`, e.target.value)}
                        onBlur={() => handleQuantityBlur(`MATERIAIS-${idx}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            addToCart(product, 'MATERIAIS', Number(quantities[`MATERIAIS-${idx}`] ?? '1'));
                            setQuantities(prev => ({ ...prev, [`MATERIAIS-${idx}`]: '1' }));
                          }
                        }}
                        className="w-16 px-2 py-4 bg-slate-100 border-2 border-transparent focus:border-indigo-600 rounded-2xl text-center font-black text-slate-900 outline-none transition-all"
                        placeholder="Qtd"
                      />
                    </div>
                    <button
                      onClick={() => {
                        addToCart(product, 'MATERIAIS', Number(quantities[`MATERIAIS-${idx}`] ?? '1'));
                        setQuantities(prev => ({ ...prev, [`MATERIAIS-${idx}`]: '1' }));
                      }}
                      className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-600 transition-all active:scale-95 border-b-4 border-slate-700 active:border-b-0"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};
