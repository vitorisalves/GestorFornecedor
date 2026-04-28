import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, Minus, Plus, Trash2, Check } from 'lucide-react';
import { CartItem } from '../../types';
import { formatCurrency } from '../../utils';

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  listName: string;
  setListName: (name: string) => void;
  updateCartQuantity: (name: string, supplier: string, delta: number) => void;
  removeFromCart: (name: string, supplier: string) => void;
  finalizeList: () => void;
  isFinalizing: boolean;
  clearCart: () => void;
}

export const CartModal: React.FC<CartModalProps> = ({
  isOpen,
  onClose,
  cart,
  listName,
  setListName,
  updateCartQuantity,
  removeFromCart,
  finalizeList,
  isFinalizing,
  clearCart
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
            className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-5 md:p-8 border-b-2 border-slate-900 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-900 rounded-xl md:rounded-2xl flex items-center justify-center shadow-xl shadow-slate-200">
                  <ShoppingCart className="w-5 h-5 md:w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter leading-tight">Carrinho</h2>
                  <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">{cart.length} itens</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 md:p-3 hover:bg-slate-200 rounded-xl md:rounded-2xl transition-all border-2 border-transparent hover:border-slate-900 text-slate-900"
              >
                <X className="w-5 h-5 md:w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6 text-slate-900">
              {cart.length > 0 && (
                <div className="space-y-4 pb-6 border-b-2 border-slate-900">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-900 ml-1 uppercase tracking-widest">Identificação da Lista</label>
                    <input
                      type="text"
                      placeholder="Ex: COMPRA SEMANAL - ABRIL"
                      className="w-full px-6 py-4 bg-white border-2 border-slate-900 focus:ring-4 focus:ring-indigo-100 rounded-2xl outline-none transition-all font-black text-slate-900 placeholder:text-slate-200 uppercase tracking-tight"
                      value={listName}
                      onChange={(e) => setListName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && listName.trim() && !isFinalizing) {
                          finalizeList();
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {cart.length === 0 ? (
                <div className="text-center py-24 text-slate-400">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-dashed border-slate-200">
                    <ShoppingCart className="w-10 h-10 opacity-10" />
                  </div>
                  <p className="text-xl font-black uppercase tracking-tighter text-slate-900">O carrinho está vazio</p>
                  <p className="font-bold text-slate-400">Adicione produtos para começar.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-6 bg-white rounded-3xl border-2 border-slate-900 shadow-xl shadow-slate-100/50">
                      <div className="flex-1">
                        <p className="text-lg font-black text-slate-900 tracking-tight uppercase leading-tight">{item.name}</p>
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-1 leading-tight">
                          {item.supplierName}
                        </p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded-xl border-2 border-slate-900">
                          <button onClick={() => updateCartQuantity(item.name, item.supplierName, -1)} className="text-slate-900 hover:text-red-600 transition-colors">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center font-black text-slate-900 text-lg tabular-nums">{item.quantity}</span>
                          <button onClick={() => updateCartQuantity(item.name, item.supplierName, 1)} className="text-slate-900 hover:text-green-600 transition-colors">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-right min-w-[100px]">
                          <p className="text-xl font-black text-slate-900 tracking-tighter tabular-nums">{formatCurrency(item.price * item.quantity)}</p>
                        </div>
                        <button onClick={() => removeFromCart(item.name, item.supplierName)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                          <Trash2 className="w-6 h-6" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-4 bg-slate-900 border-t-2 border-slate-900 flex items-center justify-between gap-4">
                <div className="shrink-0">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 leading-none">Total da Operação</p>
                  <p className="text-2xl font-black text-white tracking-tighter tabular-nums leading-none">
                    {formatCurrency(cart.reduce((acc, item) => acc + (item.price * item.quantity), 0))}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-1 justify-end max-w-[320px]">
                  <button
                    onClick={finalizeList}
                    disabled={!listName.trim() || isFinalizing}
                    className="flex-1 py-3 bg-white text-slate-900 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-green-500 hover:text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border-b-2 border-slate-200 active:border-b-0"
                  >
                    {isFinalizing ? (
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
                    onClick={clearCart}
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
  );
};
