/**
 * View para seleção e adição de produtos ao carrinho de compras.
 * Organiza os produtos por categoria e permite busca global.
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Package,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
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

/**
 * Interface estendida para incluir o nome do fornecedor no objeto do produto
 */
interface ProductWithSupplier extends Product {
  supplierName: string;
}

export const ShoppingView: React.FC<ShoppingViewProps> = ({
  suppliers,
  searchTerm,
  setSearchTerm,
  shoppingQuantities,
  setShoppingQuantities,
  addToCart
}) => {
  // Estado para controlar qual categoria está expandida no momento
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  /**
   * Processa e agrupa os produtos por categoria, filtrando pelo termo de busca.
   * Memorizado para evitar reprocessamento desnecessário a cada render.
   */
  const productsByCategory = useMemo(() => {
    const acc: Record<string, ProductWithSupplier[]> = {};
    const lowerSearch = searchTerm.toLowerCase();

    suppliers.forEach(supplier => {
      supplier.products.forEach(product => {
        const matchesSearch = 
          product.name.toLowerCase().includes(lowerSearch) ||
          supplier.name.toLowerCase().includes(lowerSearch) ||
          product.category?.toLowerCase().includes(lowerSearch);

        if (matchesSearch) {
          const category = product.category || 'Fornecedor';
          if (!acc[category]) acc[category] = [];
          acc[category].push({ ...product, supplierName: supplier.name });
        }
      });
    });

    return acc;
  }, [suppliers, searchTerm]);

  /**
   * Atualiza a quantidade de um produto específico
   */
  const handleQtyChange = (uniqueId: string, delta: number) => {
    setShoppingQuantities(prev => {
      const current = Number(prev[uniqueId] || 1);
      const nextValue = Math.max(1, current + delta);
      return { ...prev, [uniqueId]: nextValue };
    });
  };

  /**
   * Finaliza a adição ao carrinho e reseta a quantidade para o padrão (1)
   */
  const handleAddToCart = (product: ProductWithSupplier, uniqueId: string) => {
    const qty = Number(shoppingQuantities[uniqueId] || 1);
    addToCart(product, product.supplierName, qty);
    setShoppingQuantities(prev => ({ ...prev, [uniqueId]: 1 }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-8"
    >
      {/* Cabeçalho da View */}
      <div>
        <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight mb-1 md:mb-2 text-balance">
          Fazer Compras
        </h1>
        <p className="text-sm md:text-base text-slate-500 font-medium">
          Selecione os produtos para sua nova lista
        </p>
      </div>

      {/* Barra de Busca Customizada */}
      <div className="relative group">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
        <input
          type="text"
          placeholder="Buscar por produto, fornecedor ou categoria..."
          className="w-full pl-14 pr-4 py-4 bg-white border border-slate-200 focus:border-indigo-500 rounded-2xl outline-none transition-all shadow-sm text-base font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Listagem por Categorias (Acordeão) */}
      <div className="space-y-4">
        {Object.entries(productsByCategory).map(([category, products]) => (
          <div key={category} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Cabeçalho da Categoria */}
            <button
              onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
              className="w-full p-4 md:p-6 flex items-center justify-between hover:bg-slate-50 transition-all text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 md:w-11 md:h-11 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <Package className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{category}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                    {products.length} {products.length === 1 ? 'item' : 'itens'}
                  </p>
                </div>
              </div>
              {expandedCategory === category ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </button>

            {/* Conteúdo da Categoria (Lista de Produtos) */}
            <AnimatePresence>
              {expandedCategory === category && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="p-4 md:p-6 pt-0 border-t border-slate-50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
                      {products.map((product) => {
                        const uniqueId = `${product.supplierName}-${product.name}`;
                        const qty = shoppingQuantities[uniqueId] || 1;
                        
                        return (
                          <div 
                            key={uniqueId} 
                            className="bg-white p-5 rounded-2xl border border-slate-100 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-indigo-100 transition-all"
                          >
                            <div>
                              <div className="flex justify-between items-start mb-3">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[120px]">
                                  {product.supplierName}
                                </span>
                                <span className="text-base font-black text-slate-900 tabular-nums">
                                  {formatCurrency(product.price)}
                                </span>
                              </div>
                              <h4 className="font-bold text-slate-700 mb-3 uppercase tracking-tight text-sm leading-tight">
                                {product.name}
                              </h4>
                              <div className="space-y-1 mb-4">
                                {product.lastPurchaseDate && (
                                  <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-bold uppercase">
                                    <span className="w-1 h-1 bg-indigo-400 rounded-full" />
                                    Últ. Compra: <span className="text-slate-900">{product.lastPurchaseDate}</span>
                                  </div>
                                )}
                                {product.paymentMethod && (
                                  <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-bold uppercase">
                                    <span className="w-1 h-1 bg-emerald-400 rounded-full" />
                                    Pagto: <span className="text-slate-900">{product.paymentMethod}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="space-y-3">
                              {/* Controle de Quantidade */}
                              <div className="flex items-center justify-center gap-3 bg-slate-50 p-1 rounded-xl border border-slate-200">
                                <button
                                  onClick={() => handleQtyChange(uniqueId, -1)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-500 transition-all active:scale-90"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <input
                                  type="number"
                                  className="w-10 text-center font-bold text-slate-700 bg-transparent outline-none text-base tabular-nums"
                                  value={qty}
                                  onChange={(e) => setShoppingQuantities(prev => ({ ...prev, [uniqueId]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddToCart(product, uniqueId);
                                  }}
                                />
                                <button
                                  onClick={() => handleQtyChange(uniqueId, 1)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-500 transition-all active:scale-90"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              
                              {/* Botão de Adição ao Carrinho */}
                              <button
                                onClick={() => handleAddToCart(product, uniqueId)}
                                className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-indigo-600 transition-all shadow-sm"
                              >
                                <ShoppingCart className="w-4 h-4" />
                                Adicionar
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

