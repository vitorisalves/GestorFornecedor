/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { 
  Search, 
  RefreshCw, 
  Globe, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  Package
} from 'lucide-react';
import { ExternalProduct } from '../types';
import { formatCurrency } from '../utils';

interface OmieViewProps {
  externalProducts: ExternalProduct[];
  externalSearchTerm: string;
  setExternalSearchTerm: (term: string) => void;
  isSyncingExternal: boolean;
  isTriggeringSync: boolean;
  triggerOmieSync: () => void;
  fetchExternalProducts: () => void;
  addToManager: (codigo: any) => void;
  managedProducts: any[];
  externalCurrentPage: number;
  setExternalCurrentPage: (page: number) => void;
  externalItemsPerPage: number;
}

export const OmieView: React.FC<OmieViewProps> = ({
  externalProducts,
  externalSearchTerm,
  setExternalSearchTerm,
  isSyncingExternal,
  isTriggeringSync,
  triggerOmieSync,
  fetchExternalProducts,
  addToManager,
  managedProducts,
  externalCurrentPage,
  setExternalCurrentPage,
  externalItemsPerPage
}) => {
  const filteredExternal = externalProducts.filter(p => 
    (p.descricao || p.name || '').toLowerCase().includes(externalSearchTerm.toLowerCase()) ||
    (p.codigo || p.sku || '').toString().toLowerCase().includes(externalSearchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredExternal.length / externalItemsPerPage);
  const startIndex = (externalCurrentPage - 1) * externalItemsPerPage;
  const paginatedProducts = filteredExternal.slice(startIndex, startIndex + externalItemsPerPage);

  const isManaged = (codigo: string) => {
    return managedProducts.some(mp => String(mp.codigo_produto) === String(codigo));
  };

  const PaginationControls = () => (
    <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-y border-slate-200">
      <div className="text-sm text-slate-500">
        Mostrando <span className="font-bold text-slate-900">{Math.min(startIndex + 1, filteredExternal.length)}</span> até <span className="font-bold text-slate-900">{Math.min(startIndex + paginatedProducts.length, filteredExternal.length)}</span> de <span className="font-bold text-slate-900">{filteredExternal.length}</span> produtos
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setExternalCurrentPage(1)}
          disabled={externalCurrentPage === 1}
          className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Primeira Página"
        >
          <ChevronsLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => setExternalCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={externalCurrentPage === 1}
          className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-1 px-4">
          <span className="text-sm font-bold text-slate-900">Página {externalCurrentPage}</span>
          <span className="text-sm text-slate-400">de {totalPages || 1}</span>
        </div>

        <button
          onClick={() => setExternalCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={externalCurrentPage === totalPages || totalPages === 0}
          className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <button
          onClick={() => setExternalCurrentPage(totalPages)}
          disabled={externalCurrentPage === totalPages || totalPages === 0}
          className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Última Página"
        >
          <ChevronsRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Produtos Externos</h1>
          <p className="text-slate-500 font-medium">Integração direta com o catálogo Omie</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchExternalProducts}
            disabled={isSyncingExternal}
            className="flex items-center gap-2 px-6 py-4 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isSyncingExternal ? 'animate-spin' : ''}`} />
            Atualizar Lista
          </button>
          <button
            onClick={triggerOmieSync}
            disabled={isTriggeringSync}
            className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isTriggeringSync ? 'animate-spin' : ''}`} />
            Forçar Sincronização
          </button>
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
        <input
          type="text"
          placeholder="Buscar por nome ou código SKU..."
          className="w-full pl-16 pr-6 py-5 bg-white border-2 border-slate-100 focus:border-indigo-500 rounded-[2rem] outline-none transition-all shadow-sm text-lg font-medium"
          value={externalSearchTerm}
          onChange={(e) => {
            setExternalSearchTerm(e.target.value);
            setExternalCurrentPage(1);
          }}
        />
      </div>

      <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 shadow-sm overflow-hidden">
        <PaginationControls />
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Produto</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Código/SKU</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estoque</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Preço</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isSyncingExternal ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 font-bold">Carregando catálogo completo...</p>
                  </td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <Globe className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500 font-bold">Nenhum produto encontrado</p>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p, idx) => {
                  const codigo = p.codigo_produto || p.id || '';
                  const managed = isManaged(String(codigo));
                  
                  return (
                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-white transition-colors">
                            <Package className="w-6 h-6 text-slate-400" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{p.descricao || p.name || p.description}</p>
                            <p className="text-xs text-slate-400 font-medium">{p.unidade || 'UN'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="font-mono text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
                          {p.codigo || p.sku || 'N/A'}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className={`font-black text-lg ${Number(p.stock || p.stockQuantity || 0) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {p.stock || p.stockQuantity || p.estoque_fisico || 0}
                          </span>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Disponível</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-xl font-black text-slate-900">
                          {formatCurrency(p.valor_unitario || p.price || 0)}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button
                          onClick={() => addToManager(codigo)}
                          disabled={managed}
                          className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                            managed 
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95'
                          }`}
                        >
                          {managed ? 'Já Adicionado' : 'Adicionar ao Labarr'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls />
      </div>
    </div>
  );
};
