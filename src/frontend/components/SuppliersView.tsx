/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
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
  Upload
} from 'lucide-react';
import { Supplier } from '../types';
import { formatCurrency } from '../utils';

interface SuppliersViewProps {
  suppliers: Supplier[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  setIsAdding: (adding: boolean) => void;
  handleEditSupplier: (supplier: Supplier) => void;
  setSupplierToDelete: (id: string) => void;
  addToCart: (product: any, supplierName: string) => void;
  handleExportExcel: () => void;
  handleImportExcel: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  suppliers,
  searchTerm,
  setSearchTerm,
  setIsAdding,
  handleEditSupplier,
  setSupplierToDelete,
  addToCart,
  handleExportExcel,
  handleImportExcel
}) => {
  const [expandedSupplier, setExpandedSupplier] = React.useState<string | null>(null);

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.products.some(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Fornecedores</h1>
          <p className="text-slate-500 font-medium">Gerencie seus parceiros e catálogo de produtos</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-6 py-4 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download className="w-5 h-5" />
            Exportar
          </button>
          <label className="flex items-center gap-2 px-6 py-4 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all shadow-sm cursor-pointer">
            <Upload className="w-5 h-5" />
            Importar
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
          </label>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
          >
            <Plus className="w-6 h-6" />
            Novo Fornecedor
          </button>
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
        <input
          type="text"
          placeholder="Buscar por fornecedor ou produto..."
          className="w-full pl-16 pr-6 py-5 bg-white border-2 border-slate-100 focus:border-indigo-500 rounded-[2rem] outline-none transition-all shadow-sm text-lg font-medium"
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
              className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center border-2 border-slate-900 shadow-lg shadow-slate-200">
                  <Building2 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 mb-1 tracking-tighter uppercase">{supplier.name}</h3>
                  <div className="flex items-center gap-4 text-slate-900 font-black text-xs uppercase tracking-tight">
                    <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg">
                      <Phone className="w-4 h-4 text-slate-900" />
                      {supplier.phone}
                    </span>
                    <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg">
                      <Package className="w-4 h-4 text-slate-900" />
                      {supplier.products.length} produtos
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleEditSupplier(supplier)}
                  className="p-4 text-slate-900 hover:text-white hover:bg-slate-900 rounded-2xl transition-all border-2 border-transparent hover:border-slate-900"
                >
                  <Pencil className="w-6 h-6" />
                </button>
                <button
                  onClick={() => setSupplierToDelete(supplier.id)}
                  className="p-4 text-slate-900 hover:text-white hover:bg-red-600 rounded-2xl transition-all border-2 border-transparent hover:border-red-600"
                >
                  <Trash2 className="w-6 h-6" />
                </button>
                <button
                  onClick={() => setExpandedSupplier(expandedSupplier === supplier.id ? null : supplier.id)}
                  className="flex items-center gap-2 px-6 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs hover:bg-indigo-600 transition-all shadow-lg shadow-slate-200 border-b-4 border-slate-700 active:border-b-0"
                >
                  {expandedSupplier === supplier.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  {expandedSupplier === supplier.id ? 'Ocultar' : 'Ver Produtos'}
                </button>
              </div>
            </div>

            <motion.div
              initial={false}
              animate={{ height: expandedSupplier === supplier.id ? 'auto' : 0 }}
              className="overflow-hidden bg-slate-50/50"
            >
              <div className="p-8 pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      <button
                        onClick={() => addToCart(product, supplier.name)}
                        className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-indigo-600 transition-all active:scale-95"
                      >
                        Adicionar ao Carrinho
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
