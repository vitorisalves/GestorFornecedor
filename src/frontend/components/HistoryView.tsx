/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  User, 
  ListChecks, 
  Trash2, 
  Pencil, 
  Check, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { SavedList } from '../types';
import { formatCurrency, formatDate } from '../utils';

interface HistoryViewProps {
  savedLists: SavedList[];
  editSavedList: (list: SavedList) => void;
  deleteSavedList: (id: string) => void;
  toggleSavedListItemBought: (listId: string, productName: string, supplierName: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  savedLists,
  editSavedList,
  deleteSavedList,
  toggleSavedListItemBought
}) => {
  const [expandedList, setExpandedList] = React.useState<string | null>(null);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="space-y-8"
    >
      <div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Minhas Listas</h1>
        <p className="text-slate-500 font-medium">Histórico de compras e listas salvas</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {savedLists.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] p-20 border-4 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
            <ListChecks className="w-20 h-20 mb-6 opacity-20" />
            <p className="text-xl font-black uppercase tracking-tighter">Nenhuma lista encontrada</p>
            <p className="font-bold text-slate-500">Suas listas finalizadas aparecerão aqui.</p>
          </div>
        ) : (
          savedLists.map((list) => {
            const isCompleted = list.items.length > 0 && list.items.every(item => item.bought);
            
            return (
              <motion.div
                layout
                key={list.id}
                className={`bg-white rounded-[2.5rem] border-2 shadow-xl overflow-hidden transition-all ${
                  isCompleted ? 'border-green-600 shadow-green-100/20' : 'border-slate-900 shadow-slate-200/50'
                }`}
              >
                <div 
                  onClick={() => setExpandedList(expandedList === list.id ? null : list.id)}
                  className={`p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer transition-colors ${
                    isCompleted ? 'bg-green-50/40 hover:bg-green-100/40' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-6">
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center transition-colors border-2 ${
                      isCompleted ? 'bg-green-600 border-green-700' : 'bg-slate-900 border-slate-900'
                    }`}>
                      {isCompleted ? (
                        <Check className="w-8 h-8 text-white" />
                      ) : (
                        <Calendar className="w-8 h-8 text-white" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{list.name}</h3>
                        {isCompleted && (
                          <span className="px-3 py-1 bg-green-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 border border-green-700">
                            <Check className="w-3 h-3" />
                            Concluída
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-slate-900 font-black text-xs uppercase tracking-tight">
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg">
                          <Calendar className="w-4 h-4 text-slate-900" />
                          {formatDate(list.date)}
                        </span>
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg">
                          <User className="w-4 h-4 text-slate-900" />
                          {list.createdBy || 'Sistema'}
                        </span>
                        <span className="px-3 py-1 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
                          {list.items.length} itens
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right mr-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total da Lista</p>
                      <p className="text-3xl font-black text-slate-900 tabular-nums tracking-tighter">{formatCurrency(list.total)}</p>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => editSavedList(list)}
                        className="p-4 text-slate-900 hover:text-white hover:bg-slate-900 rounded-2xl transition-all border-2 border-transparent hover:border-slate-900"
                      >
                        <Pencil className="w-6 h-6" />
                      </button>
                      <button
                        onClick={() => deleteSavedList(list.id)}
                        className="p-4 text-slate-900 hover:text-white hover:bg-red-600 rounded-2xl transition-all border-2 border-transparent hover:border-red-600"
                      >
                        <Trash2 className="w-6 h-6" />
                      </button>
                      <button
                        onClick={() => setExpandedList(expandedList === list.id ? null : list.id)}
                        className="p-4 text-slate-900 hover:text-white hover:bg-slate-900 rounded-2xl transition-all border-2 border-transparent hover:border-slate-900"
                      >
                        {expandedList === list.id ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                      </button>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedList === list.id && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden bg-slate-50 border-t-2 border-slate-900"
                    >
                      <div className="p-8">
                        <div className="bg-white rounded-3xl border-2 border-slate-900 overflow-hidden shadow-inner">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-slate-900 border-b-2 border-slate-900">
                                <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest">Produto</th>
                                <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest">Fornecedor</th>
                                <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest text-center">Qtd</th>
                                <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest text-right">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y-2 divide-slate-100">
                              {list.items.map((item, idx) => (
                                <tr key={idx} className={`group hover:bg-slate-50 transition-colors ${item.bought ? 'bg-slate-50/50' : ''}`}>
                                  <td className="px-6 py-4">
                                    <button
                                      onClick={() => toggleSavedListItemBought(list.id, item.name, item.supplierName)}
                                      className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${
                                        item.bought 
                                          ? 'bg-green-600 border-green-700 text-white' 
                                          : 'border-slate-900 hover:bg-slate-900 hover:text-white'
                                      }`}
                                    >
                                      {item.bought && <Check className="w-5 h-5" />}
                                    </button>
                                  </td>
                                  <td className="px-6 py-4">
                                    <p className={`text-lg font-black text-slate-900 tracking-tight ${item.bought ? 'line-through opacity-40 text-slate-400' : ''}`}>{item.name}</p>
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{item.category}</p>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest block leading-tight">
                                      {item.supplierName}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-center font-black text-slate-900 text-lg tabular-nums">{item.quantity}</td>
                                  <td className="px-6 py-4 text-right font-black text-slate-900 text-lg tabular-nums">
                                    {formatCurrency(item.price * item.quantity)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
          );
        })
      )}
      </div>
    </motion.div>
  );
};
