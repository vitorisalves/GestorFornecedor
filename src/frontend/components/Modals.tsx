/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Plus, 
  Trash2, 
  Pencil, 
  ShoppingCart, 
  Minus, 
  Package,
  Settings,
  UserPlus,
  Check,
  User
} from 'lucide-react';
import { Supplier, Product, CartItem, AuthorizedUser } from '../types';
import { formatCurrency } from '../utils';

interface ModalsProps {
  isAdding: boolean;
  setIsAdding: (open: boolean) => void;
  editingSupplierId: string | null;
  newName: string;
  setNewName: (name: string) => void;
  newPhone: string;
  setNewPhone: (phone: string) => void;
  productList: Product[];
  newProductName: string;
  setNewProductName: (name: string) => void;
  newProductPrice: string;
  setNewProductPrice: (price: string) => void;
  newProductCategory: string;
  setNewProductCategory: (cat: string) => void;
  categories: string[];
  editingProductIndex: number | null;
  productNameRef: React.RefObject<HTMLInputElement>;
  addProduct: () => void;
  handleEditProduct: (index: number) => void;
  removeProduct: (index: number) => void;
  handleAddSupplier: (e: React.FormEvent) => void;
  resetForm: () => void;

  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  cart: CartItem[];
  listName: string;
  setListName: (name: string) => void;
  updateCartQuantity: (name: string, supplier: string, delta: number) => void;
  removeFromCart: (name: string, supplier: string) => void;
  finalizeList: () => void;
  isFinalizing?: boolean;
  clearCart: () => void;

  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  newCategoryName: string;
  setNewCategoryName: (name: string) => void;
  handleAddCategory: () => void;
  authorizedUsers: AuthorizedUser[];
  updateUserStatus: (uid: string, status: 'approved' | 'denied') => void;
  removeUserRequest: (uid: string) => void;

  supplierToDelete: string | null;
  setSupplierToDelete: (id: string | null) => void;
  confirmDelete: () => void;

  listToDelete: string | null;
  setListToDelete: (id: string | null) => void;
  confirmDeleteList: () => void;
}

export const Modals: React.FC<ModalsProps> = (props) => {
  return (
    <>
      {/* Modal: Adicionar/Editar Fornecedor */}
      <AnimatePresence>
        {props.isAdding && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    {props.editingSupplierId ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                  </h2>
                  <p className="text-slate-500 font-medium">Preencha as informações do parceiro e seus produtos</p>
                </div>
                <button 
                  onClick={() => { props.setIsAdding(false); props.resetForm(); }}
                  className="p-3 hover:bg-slate-200 rounded-2xl transition-all"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-10">
                {/* Info Básica */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Nome da Empresa</label>
                    <input
                      type="text"
                      placeholder="Ex: Distribuidora Labarr"
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-medium"
                      value={props.newName}
                      onChange={(e) => props.setNewName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Telefone / WhatsApp</label>
                    <input
                      type="text"
                      placeholder="(00) 00000-0000"
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-medium"
                      value={props.newPhone}
                      onChange={(e) => props.setNewPhone(e.target.value)}
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
                      {props.productList.length} itens
                    </span>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100/50 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input
                        ref={props.productNameRef}
                        type="text"
                        placeholder="Nome do produto"
                        className="px-6 py-4 bg-white border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-medium"
                        value={props.newProductName}
                        onChange={(e) => props.setNewProductName(e.target.value)}
                      />
                      <input
                        type="number"
                        placeholder="Preço (R$)"
                        className="px-6 py-4 bg-white border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-medium"
                        value={props.newProductPrice}
                        onChange={(e) => props.setNewProductPrice(e.target.value)}
                      />
                      <select
                        className="px-6 py-4 bg-white border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-medium appearance-none"
                        value={props.newProductCategory}
                        onChange={(e) => props.setNewProductCategory(e.target.value)}
                      >
                        <option value="">Categoria</option>
                        {props.categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={props.addProduct}
                      className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
                    >
                      {props.editingProductIndex !== null ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                      {props.editingProductIndex !== null ? 'Atualizar Produto' : 'Adicionar Produto ao Catálogo'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {props.productList.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl group hover:border-indigo-200 transition-all">
                        <div>
                          <p className="font-bold text-slate-900">{p.name}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-indigo-600">{formatCurrency(p.price)}</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.category}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => props.handleEditProduct(i)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => props.removeProduct(i)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
                <button
                  onClick={() => { props.setIsAdding(false); props.resetForm(); }}
                  className="px-8 py-4 text-slate-500 font-bold hover:text-slate-900 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={props.handleAddSupplier}
                  disabled={!props.newName || !props.newPhone || props.productList.length === 0}
                  className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {props.editingSupplierId ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Carrinho / Finalizar Lista */}
      <AnimatePresence>
        {props.isCartOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b-2 border-slate-900 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl shadow-slate-200">
                    <ShoppingCart className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Seu Carrinho</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{props.cart.length} itens selecionados</p>
                  </div>
                </div>
                <button 
                  onClick={() => props.setIsCartOpen(false)}
                  className="p-3 hover:bg-slate-200 rounded-2xl transition-all border-2 border-transparent hover:border-slate-900 text-slate-900"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {props.cart.length > 0 && (
                  <div className="space-y-4 pb-6 border-b-2 border-slate-900">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-900 ml-1 uppercase tracking-widest">Identificação da Lista</label>
                      <input
                        type="text"
                        placeholder="Ex: COMPRA SEMANAL - ABRIL"
                        className="w-full px-6 py-4 bg-white border-2 border-slate-900 focus:ring-4 focus:ring-indigo-100 rounded-2xl outline-none transition-all font-black text-slate-900 placeholder:text-slate-200 uppercase tracking-tight"
                        value={props.listName}
                        onChange={(e) => props.setListName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && props.listName.trim() && !props.isFinalizing) {
                            props.finalizeList();
                          }
                        }}
                      />
                    </div>
                  </div>
                )}

                {props.cart.length === 0 ? (
                  <div className="text-center py-24 text-slate-400">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-dashed border-slate-200">
                      <ShoppingCart className="w-10 h-10 opacity-10" />
                    </div>
                    <p className="text-xl font-black uppercase tracking-tighter text-slate-900">O carrinho está vazio</p>
                    <p className="font-bold text-slate-400">Adicione produtos para começar.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {props.cart.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-6 bg-white rounded-3xl border-2 border-slate-900 shadow-xl shadow-slate-100/50">
                        <div className="flex-1">
                          <p className="text-lg font-black text-slate-900 tracking-tight uppercase leading-tight">{item.name}</p>
                          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-1 leading-tight">
                            {item.supplierName}
                          </p>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded-xl border-2 border-slate-900">
                            <button onClick={() => props.updateCartQuantity(item.name, item.supplierName, -1)} className="text-slate-900 hover:text-red-600 transition-colors">
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center font-black text-slate-900 text-lg tabular-nums">{item.quantity}</span>
                            <button onClick={() => props.updateCartQuantity(item.name, item.supplierName, 1)} className="text-slate-900 hover:text-green-600 transition-colors">
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-right min-w-[100px]">
                            <p className="text-xl font-black text-slate-900 tracking-tighter tabular-nums">{formatCurrency(item.price * item.quantity)}</p>
                          </div>
                          <button onClick={() => props.removeFromCart(item.name, item.supplierName)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                            <Trash2 className="w-6 h-6" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {props.cart.length > 0 && (
                <div className="p-4 bg-slate-900 border-t-2 border-slate-900 flex items-center justify-between gap-4">
                  <div className="shrink-0">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 leading-none">Total da Operação</p>
                    <p className="text-2xl font-black text-white tracking-tighter tabular-nums leading-none">
                      {formatCurrency(props.cart.reduce((acc, item) => acc + (item.price * item.quantity), 0))}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-1 justify-end max-w-[320px]">
                    <button
                      onClick={props.finalizeList}
                      disabled={!props.listName.trim() || props.isFinalizing}
                      className="flex-1 py-3 bg-white text-slate-900 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-green-500 hover:text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border-b-2 border-slate-200 active:border-b-0"
                    >
                      {props.isFinalizing ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                          className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full"
                        />
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Finalizar
                        </>
                      )}
                    </button>
                    
                    <button 
                      onClick={props.clearCart}
                      className="p-3 bg-red-600 text-white rounded-xl shadow-lg shadow-red-900/20 hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center flex-shrink-0"
                      title="Limpar Tudo"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Configurações (Admin) */}
      <AnimatePresence>
        {props.isSettingsOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-3xl max-h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg">
                    <Settings className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">Painel de Controle</h2>
                    <p className="text-slate-500 font-medium">Administração do sistema</p>
                  </div>
                </div>
                <button 
                  onClick={() => props.setIsSettingsOpen(false)}
                  className="p-3 hover:bg-slate-200 rounded-2xl transition-all"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-12">
                {/* Categorias */}
                <section className="space-y-6">
                  <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                    <Package className="w-6 h-6 text-indigo-600" />
                    Gerenciar Categorias
                  </h3>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="Nova categoria..."
                      className="flex-1 px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-medium"
                      value={props.newCategoryName}
                      onChange={(e) => props.setNewCategoryName(e.target.value)}
                    />
                    <button
                      onClick={props.handleAddCategory}
                      className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
                    >
                      Adicionar
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {props.categories.map(cat => (
                      <span key={cat} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold border border-slate-200">
                        {cat}
                      </span>
                    ))}
                  </div>
                </section>

                {/* Usuários */}
                <section className="space-y-6">
                  <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                    <UserPlus className="w-6 h-6 text-indigo-600" />
                    Solicitações de Acesso
                  </h3>
                  <div className="space-y-3">
                    {props.authorizedUsers.filter(u => u.status === 'pending').length === 0 ? (
                      <p className="text-slate-400 font-medium text-center py-8 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100">
                        Nenhuma solicitação pendente
                      </p>
                    ) : (
                      props.authorizedUsers.filter(u => u.status === 'pending').map(user => (
                        <div key={user.uid} className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-3xl shadow-sm">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                              <User className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{user.name || 'Sem nome'}</p>
                              <p className="text-xs text-slate-400 font-bold">CPF: {user.cpf}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => props.updateUserStatus(user.uid!, 'approved')}
                              className="p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-all"
                            >
                              <Check className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => props.updateUserStatus(user.uid!, 'denied')}
                              className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Confirmação de Exclusão (Fornecedor) */}
      <AnimatePresence>
        {props.supplierToDelete && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Excluir Fornecedor?</h3>
              <p className="text-slate-500 font-medium mb-8">Esta ação não pode ser desfeita e removerá todos os produtos associados.</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => props.setSupplierToDelete(null)}
                  className="py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={props.confirmDelete}
                  className="py-4 bg-red-500 text-white rounded-2xl font-bold shadow-lg shadow-red-100 hover:bg-red-600 transition-all"
                >
                  Sim, Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Confirmação de Exclusão (Lista) */}
      <AnimatePresence>
        {props.listToDelete && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Excluir Lista?</h3>
              <p className="text-slate-500 font-medium mb-8">A lista será removida permanentemente do seu histórico.</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => props.setListToDelete(null)}
                  className="py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={props.confirmDeleteList}
                  className="py-4 bg-red-500 text-white rounded-2xl font-bold shadow-lg shadow-red-100 hover:bg-red-600 transition-all"
                >
                  Sim, Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
