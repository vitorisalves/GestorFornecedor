/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Package,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { Supplier, Product } from '../types';
import { formatCurrency } from '../utils';

interface ShoppingViewProps {
  suppliers: Supplier[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  shoppingQuantities: Record<string, number | string>;
  setShoppingQuantities: React.Dispatch<React.SetStateAction<Record<string, number | string>>>;
  addToCart: (product: Product, supplierName: string, quantity: number) => void;
}

export const ShoppingView: React.FC<ShoppingViewProps> = ({
  suppliers,
  searchTerm,
  setSearchTerm,
  shoppingQuantities,
  setShoppingQuantities,
  addToCart
}) => {
  const [expandedCategory, setExpandedCategory] = React.useState<string | null>(null);

  const categories = Array.from(new Set(suppliers.flatMap(s => s.products.map(p => p.category))));
  
  const productsByCategory = categories.reduce((acc, cat) => {
    const category = cat as string;
    const products = suppliers.flatMap(s => 
      s.products
        .filter(p => p.category === category)
        .filter(p => 
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .map(p => ({ ...p, supplierName: s.name }))
    );
    if (products.length > 0) acc[category] = products;
    return acc;
  }, {} as Record<string, any[]>);

  const handleQtyChange = (id: string, delta: number) => {
    setShoppingQuantities(prev => {
      const current = Number(prev[id] || 1);
      return { ...prev, [id]: Math.max(1, current + delta) };
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="space-y-8"
    >
      <div>
        <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight mb-1 md:mb-2 text-balance">Fazer Compras</h1>
        <p className="text-sm md:text-base text-slate-500 font-medium">Selecione os produtos para sua nova lista</p>
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

      <div className="space-y-4">
        {Object.entries(productsByCategory).map(([category, products]) => (
          <div key={category} className="bg-white rounded-[2rem] border-2 border-slate-50 shadow-sm overflow-hidden">
            <button
              onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
              className="w-full p-4 md:p-6 flex items-center justify-between hover:bg-slate-50 transition-all"
            >
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-50 rounded-xl md:rounded-2xl flex items-center justify-center">
                  <Package className="w-5 h-5 md:w-6 h-6 text-indigo-600" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg md:text-xl font-black text-slate-900">{category}</h3>
                  <p className="text-[10px] md:text-sm text-slate-500 font-bold uppercase tracking-tight">{products.length} itens</p>
                </div>
              </div>
              {expandedCategory === category ? <ChevronUp className="w-5 h-5 md:w-6 h-6 text-slate-400" /> : <ChevronDown className="w-5 h-5 md:w-6 h-6 text-slate-400" />}
            </button>

            <AnimatePresence>
              {expandedCategory === category && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-6 pt-0 border-t border-slate-50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
                      {products.map((product, idx) => {
                        const id = `${product.supplierName}-${product.name}`;
                        const qty = shoppingQuantities[id] || 1;
                        
                        return (
                          <div key={idx} className="bg-white p-6 rounded-[2rem] border-2 border-slate-900 flex flex-col justify-between shadow-xl shadow-slate-100 hover:shadow-indigo-100/50 transition-all group">
                            <div>
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest leading-none">
                                  {product.supplierName}
                                </span>
                                <span className="text-xl font-black text-slate-900 tabular-nums">
                                  {formatCurrency(product.price)}
                                </span>
                              </div>
                              <h4 className="font-black text-slate-900 mb-6 uppercase tracking-tight text-lg leading-tight">{product.name}</h4>
                            </div>

                            <div className="space-y-4">
                              <div className="flex items-center justify-center gap-4 bg-slate-100 p-2 rounded-2xl border-2 border-slate-900 shadow-inner">
                                <button
                                  onClick={() => handleQtyChange(id, -1)}
                                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-900 border-2 border-transparent hover:border-slate-900 hover:text-white text-slate-900 transition-all font-black"
                                >
                                  <Minus className="w-5 h-5" />
                                </button>
                                <input
                                  type="number"
                                  className="w-12 text-center font-black text-slate-900 bg-transparent outline-none text-xl tabular-nums"
                                  value={qty}
                                  onChange={(e) => setShoppingQuantities(prev => ({ ...prev, [id]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      addToCart(product, product.supplierName, Number(qty));
                                      setShoppingQuantities(prev => ({ ...prev, [id]: 1 }));
                                    }
                                  }}
                                />
                                <button
                                  onClick={() => handleQtyChange(id, 1)}
                                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-900 border-2 border-transparent hover:border-slate-900 hover:text-white text-slate-900 transition-all font-black"
                                >
                                  <Plus className="w-5 h-5" />
                                </button>
                              </div>
                              <button
                                onClick={() => {
                                  addToCart(product, product.supplierName, Number(qty));
                                  setShoppingQuantities(prev => ({ ...prev, [id]: 1 }));
                                }}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-indigo-600 transition-all border-b-4 border-slate-700 active:border-b-0 shadow-lg shadow-slate-200"
                              >
                                <ShoppingCart className="w-5 h-5" />
                                Adicionar ao Carrinho
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
