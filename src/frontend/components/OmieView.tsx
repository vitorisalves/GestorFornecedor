/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  RefreshCw, 
  Globe, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  Package,
  ShoppingCart
} from 'lucide-react';
import { ExternalProduct } from '../types';
import { formatCurrency } from '../utils';
import { AlertCircle, CheckCircle2, ShieldAlert, Zap } from 'lucide-react';

interface OmieViewProps {
  externalProducts: ExternalProduct[];
  externalSearchTerm: string;
  setExternalSearchTerm: (term: string) => void;
  isSyncingExternal: boolean;
  isTriggeringSync: boolean;
  apiHealth: { status: string; env_set: boolean; external_api?: string } | null;
  isCheckingHealth: boolean;
  checkApiHealth: () => void;
  triggerOmieSync: () => void;
  fetchExternalProducts: () => void;
  addToCart: (product: any, supplierName: string, quantity: number) => void;
  externalCurrentPage: number;
  setExternalCurrentPage: (page: number | ((prev: number) => number)) => void;
  externalItemsPerPage: number;
}

export const OmieView: React.FC<OmieViewProps> = ({
  externalProducts,
  externalSearchTerm,
  setExternalSearchTerm,
  isSyncingExternal,
  isTriggeringSync,
  apiHealth,
  isCheckingHealth,
  checkApiHealth,
  triggerOmieSync,
  fetchExternalProducts,
  addToCart,
  externalCurrentPage,
  setExternalCurrentPage,
  externalItemsPerPage
}) => {
  const [quantities, setQuantities] = React.useState<Record<string, string>>({});

  const handleQuantityChange = (key: string, value: string) => {
    if (value === '' || /^\d+$/.test(value)) {
      setQuantities(prev => ({ ...prev, [key]: value }));
    }
  };

  const handleQuantityBlur = (key: string) => {
    if (!quantities[key] || parseInt(quantities[key]) === 0) {
      setQuantities(prev => ({ ...prev, [key]: '1' }));
    }
  };

  const onAddToCart = (p: ExternalProduct) => {
    const key = p.codigo_produto || p.id;
    const qty = parseInt(quantities[key] || '1');
    const product = {
      name: p.descricao || p.name || 'Sem nome',
      price: p.valor_unitario || p.price || 0,
      category: 'Externo'
    };
    addToCart(product, 'OMIE', qty);
    setQuantities(prev => ({ ...prev, [key]: '1' }));
  };

  const filteredExternal = externalProducts.filter(p => 
    (p.descricao || p.name || '').toLowerCase().includes(externalSearchTerm.toLowerCase()) ||
    (p.codigo_produto || p.id || '').toString().toLowerCase().includes(externalSearchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredExternal.length / externalItemsPerPage);
  const startIndex = (externalCurrentPage - 1) * externalItemsPerPage;
  const paginatedProducts = filteredExternal.slice(startIndex, startIndex + externalItemsPerPage);

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
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Produtos Externos</h1>
          <p className="text-slate-500 font-medium mb-4">Integração direta com o catálogo Omie</p>
          
          <div className="flex items-center gap-2">
            {isCheckingHealth ? (
              <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-500 animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Verificando API...
              </div>
            ) : apiHealth ? (
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${
                apiHealth.external_api === 'online' ? 'bg-green-100 text-green-700' : 
                apiHealth.external_api === 'waking_up' ? 'bg-blue-100 text-blue-700' :
                'bg-red-100 text-red-700'
              }`}>
                {apiHealth.external_api === 'online' ? <CheckCircle2 className="w-3 h-3" /> : 
                 apiHealth.external_api === 'waking_up' ? <RefreshCw className="w-3 h-3 animate-spin" /> : 
                 <AlertCircle className="w-3 h-3" />}
                API Omie: {
                  apiHealth.external_api === 'online' ? 'Online' : 
                  apiHealth.external_api === 'waking_up' ? 'Acordando...' : 
                  'Offline/Erro'
                }
                {!apiHealth.env_set && <span className="ml-1 opacity-70">(URL Padrão)</span>}
              </div>
            ) : null}
            
            <button 
              onClick={checkApiHealth}
              disabled={isCheckingHealth}
              className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
              title="Recarregar Status da API"
            >
              <Zap className={`w-3 h-3 ${isCheckingHealth ? 'animate-pulse' : ''}`} />
            </button>
          </div>
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

      {apiHealth?.status !== 'ok' && !isCheckingHealth && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 bg-amber-50 border-2 border-amber-100 rounded-[2rem] flex flex-col md:flex-row items-center gap-6"
        >
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
            <ShieldAlert className="w-8 h-8 text-amber-600" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-lg font-black text-amber-900 mb-1">API Externa em Espera</h3>
            <p className="text-amber-700 font-medium text-sm leading-relaxed">
              A API de integração (Render.com) entra em modo de suspensão após algum tempo. 
              Isso pode causar erros de "Timeout" (10s) no Vercel. 
              <strong> Clique no botão abaixo para "acordar" a API antes de sincronizar.</strong>
            </p>
          </div>
          <button
            onClick={checkApiHealth}
            className="px-6 py-3 bg-white border-2 border-amber-200 text-amber-700 rounded-xl font-bold hover:bg-amber-100 transition-all shrink-0"
          >
            Acordar API agora
          </button>
        </motion.div>
      )}

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
                  
                  return (
                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-white transition-colors">
                            <Package className="w-6 h-6 text-slate-400" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{p.descricao || p.name || 'Sem nome'}</p>
                            <p className="text-xs text-slate-400 font-medium">{p.unidade || 'UN'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="font-mono text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
                          {p.codigo_produto || 'N/A'}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className={`font-black text-lg ${Number(p.stock || p.estoque_fisico || 0) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {p.stock || p.estoque_fisico || 0}
                          </span>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Estoque</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-xl font-black text-slate-900">
                          {formatCurrency(p.valor_unitario || p.price || 0)}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={quantities[String(codigo)] ?? '1'}
                              onChange={(e) => handleQuantityChange(String(codigo), e.target.value)}
                              onBlur={() => handleQuantityBlur(String(codigo))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  onAddToCart(p);
                                }
                              }}
                              className="w-14 px-2 py-2 bg-slate-100 border-2 border-transparent focus:border-indigo-600 rounded-lg text-center font-bold text-slate-900 outline-none text-sm"
                              placeholder="Qtd"
                            />
                            <button
                              onClick={() => onAddToCart(p)}
                              className="p-3 bg-slate-900 text-white rounded-xl hover:bg-green-600 transition-all active:scale-95 shadow-lg shadow-slate-100"
                              title="Adicionar ao Carrinho"
                            >
                              <ShoppingCart className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
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
    </motion.div>
  );
};
