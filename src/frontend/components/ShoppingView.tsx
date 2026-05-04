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
        <Search className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
        <input
          type="text"
          placeholder="Buscar por produto, fornecedor ou categoria..."
          className="w-full pl-12 md:pl-16 pr-4 py-4 md:py-5 bg-white border-2 border-slate-100 focus:border-indigo-500 rounded-2xl md:rounded-[2rem] outline-none transition-all shadow-sm text-base md:text-lg font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Listagem por Categorias (Acordeão) */}
      <div className="space-y-4">
        {Object.entries(productsByCategory).map(([category, products]) => (
          <div key={category} className="bg-white rounded-[2rem] border-2 border-slate-50 shadow-sm overflow-hidden">
            {/* Cabeçalho da Categoria */}
            <button
              onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
              className="w-full p-4 md:p-6 flex items-center justify-between hover:bg-slate-50 transition-all text-left"
            >
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-50 rounded-xl md:rounded-2xl flex items-center justify-center">
                  <Package className="w-5 h-5 md:w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-black text-slate-900">{category}</h3>
                  <p className="text-[10px] md:text-sm text-slate-500 font-bold uppercase tracking-tight">
                    {products.length} {products.length === 1 ? 'item' : 'itens'}
                  </p>
                </div>
              </div>
              {expandedCategory === category ? (
                <ChevronUp className="w-6 h-6 text-slate-400" />
              ) : (
                <ChevronDown className="w-6 h-6 text-slate-400" />
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
                  <div className="p-4 md:p-8 pt-0 border-t border-slate-50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
                      {products.map((product) => {
                        const uniqueId = `${product.supplierName}-${product.name}`;
                        const qty = shoppingQuantities[uniqueId] || 1;
                        
                        return (
                          <div 
                            key={uniqueId} 
                            className="bg-white p-5 rounded-[1.5rem] md:rounded-[2rem] border-2 border-slate-900 flex flex-col justify-between shadow-xl shadow-slate-100 hover:shadow-indigo-100/50 transition-all hover:-translate-y-1"
                          >
                            <div>
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[120px]">
                                  {product.supplierName}
                                </span>
                                <span className="text-lg font-black text-slate-900 tabular-nums">
                                  {formatCurrency(product.price)}
                                </span>
                              </div>
                              <h4 className="font-black text-slate-900 mb-6 uppercase tracking-tight text-base md:text-lg leading-tight">
                                {product.name}
                              </h4>
                            </div>

                            <div className="space-y-4">
                              {/* Controle de Quantidade */}
                              <div className="flex items-center justify-center gap-3 bg-slate-50 p-1.5 rounded-xl border-2 border-slate-900">
                                <button
                                  onClick={() => handleQtyChange(uniqueId, -1)}
                                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-900 hover:text-white text-slate-900 transition-all active:scale-90"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <input
                                  type="number"
                                  className="w-10 text-center font-black text-slate-900 bg-transparent outline-none text-lg tabular-nums"
                                  value={qty}
                                  onChange={(e) => setShoppingQuantities(prev => ({ ...prev, [uniqueId]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddToCart(product, uniqueId);
                                  }}
                                />
                                <button
                                  onClick={() => handleQtyChange(uniqueId, 1)}
                                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-900 hover:text-white text-slate-900 transition-all active:scale-90"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                              
                              {/* Botão de Adição ao Carrinho */}
                              <button
                                onClick={() => handleAddToCart(product, uniqueId)}
                                className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-indigo-600 transition-all border-b-4 border-slate-700 active:border-b-0 shadow-lg shadow-slate-200"
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

