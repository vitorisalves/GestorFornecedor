import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Package, Trash2, UserPlus, User, Check } from 'lucide-react';
import { AuthorizedUser } from '../../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  newCategoryName: string;
  setNewCategoryName: (name: string) => void;
  handleAddCategory: () => void;
  authorizedUsers: AuthorizedUser[];
  updateUserStatus: (uid: string, status: 'approved' | 'denied') => void;
  setCategoryToDelete: (cat: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  categories,
  newCategoryName,
  setNewCategoryName,
  handleAddCategory,
  authorizedUsers,
  updateUserStatus,
  setCategoryToDelete
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
                onClick={onClose}
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
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                  <button
                    onClick={handleAddCategory}
                    className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
                  >
                    Adicionar
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <div key={cat} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold border border-slate-200 group">
                      {cat}
                      <button
                        onClick={() => setCategoryToDelete(cat)}
                        className="p-1 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        title="Excluir Categoria"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
                  {authorizedUsers.filter(u => u.status === 'pending').length === 0 ? (
                    <p className="text-slate-400 font-medium text-center py-8 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100">
                      Nenhuma solicitação pendente
                    </p>
                  ) : (
                    authorizedUsers.filter(u => u.status === 'pending').map(user => (
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
                            onClick={() => updateUserStatus(user.uid!, 'approved')}
                            className="p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-all"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => updateUserStatus(user.uid!, 'denied')}
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
  );
};
