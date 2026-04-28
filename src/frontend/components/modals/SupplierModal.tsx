import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { Product } from '../../types';
import { formatCurrency } from '../../utils';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSupplierId: string | null;
  name: string;
  setName: (name: string) => void;
  phone: string;
  setPhone: (phone: string) => void;
  productList: Product[];
  productName: string;
  setProductName: (name: string) => void;
  productPrice: string;
  setProductPrice: (price: string) => void;
  productCategory: string;
  setProductCategory: (cat: string) => void;
  categories: string[];
  editingProductIndex: number | null;
  productNameRef: React.RefObject<HTMLInputElement>;
  onAddProduct: () => void;
  onEditProduct: (index: number) => void;
  onRemoveProduct: (index: number) => void;
  onSave: (e: React.FormEvent) => void;
}

export const SupplierModal: React.FC<SupplierModalProps> = ({
  isOpen,
  onClose,
  editingSupplierId,
  name,
  setName,
  phone,
  setPhone,
  productList,
  productName,
  setProductName,
  productPrice,
  setProductPrice,
  productCategory,
  setProductCategory,
  categories,
  editingProductIndex,
  productNameRef,
  onAddProduct,
  onEditProduct,
  onRemoveProduct,
  onSave
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-5 md:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">
                  {editingSupplierId ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                </h2>
                <p className="text-xs md:text-sm text-slate-500 font-medium">Informações do parceiro e catálogo</p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 md:p-3 hover:bg-slate-200 rounded-xl md:rounded-2xl transition-all"
              >
                <X className="w-5 h-5 md:w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 md:p-8 space-y-6 md:space-y-10">
              {/* Info Básica */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-1.5 md:space-y-2">
                  <label className="text-xs md:text-sm font-bold text-slate-700 ml-1">Empresa</label>
                  <input
                    type="text"
                    placeholder="Ex: Distribuidora"
                    className="w-full px-5 md:px-6 py-3.5 md:py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl md:rounded-2xl outline-none transition-all font-medium text-sm md:text-base"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  <label className="text-xs md:text-sm font-bold text-slate-700 ml-1">Telefone</label>
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    className="w-full px-5 md:px-6 py-3.5 md:py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl md:rounded-2xl outline-none transition-all font-medium text-sm md:text-base"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Seção de Produtos */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                    <Package className="w-6 h-6 text-indigo-600" />
                    Catálogo de Produtos
                  </h3>
                  <span className="px-4 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black uppercase tracking-widest">
                    {productList.length} itens
                  </span>
                </div>

                <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100/50 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      ref={productNameRef}
                      type="text"
                      placeholder="Nome do produto"
                      className="px-6 py-4 bg-white border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-medium"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Preço (R$)"
                      className="px-6 py-4 bg-white border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-medium"
                      value={productPrice}
                      onChange={(e) => setProductPrice(e.target.value)}
                    />
                    <select
                      className="px-6 py-4 bg-white border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-medium appearance-none"
                      value={productCategory}
                      onChange={(e) => setProductCategory(e.target.value)}
                    >
                      <option value="">Categoria</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={onAddProduct}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
                  >
                    {editingProductIndex !== null ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    {editingProductIndex !== null ? 'Atualizar Produto' : 'Adicionar Produto ao Catálogo'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {productList.map((p, i) => {
                    const isEditingThis = editingProductIndex === i;
                    return (
                      <div key={i} className={`flex items-center justify-between p-4 bg-white border-2 rounded-2xl group transition-all ${isEditingThis ? 'border-indigo-500 shadow-lg shadow-indigo-50' : 'border-slate-100 hover:border-indigo-200'}`}>
                        <div className="flex-1">
                          <p className="font-bold text-slate-900">{p.name}</p>
                          <div className="flex items-center gap-3">
                            {isEditingThis ? (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-black text-indigo-600">R$</span>
                                <input
                                  type="number"
                                  className="w-24 px-2 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-sm font-black text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500"
                                  value={productPrice}
                                  onChange={(e) => setProductPrice(e.target.value)}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') onAddProduct();
                                  }}
                                />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.category}</span>
                              </div>
                            ) : (
                              <>
                                <span className="text-xs font-black text-indigo-600">{formatCurrency(p.price)}</span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.category}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className={`flex items-center gap-1 ${isEditingThis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-all`}>
                          {isEditingThis ? (
                            <button 
                              onClick={onAddProduct}
                              className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition-colors"
                              title="Salvar alteração"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          ) : (
                            <button onClick={() => onEditProduct(i)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => onRemoveProduct(i)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
              <button
                onClick={onClose}
                className="px-8 py-4 text-slate-500 font-bold hover:text-slate-900 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={onSave}
                disabled={!name || !phone || (productList.length === 0 && !productName.trim())}
                className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingSupplierId ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
