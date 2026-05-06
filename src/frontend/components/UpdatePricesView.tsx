import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Upload, 
  FileText, 
  Camera, 
  FileCode, 
  X, 
  Check, 
  ArrowRight,
  Plus,
  ListChecks,
  AlertCircle,
  Building2,
  Tag,
  Loader2,
  ChevronRight,
  Save,
  Pencil,
  Link as LinkIcon,
  Link2Off,
  Search,
  Trash2
} from 'lucide-react';
import { Product, Supplier } from '../types';
import { formatCurrency, extractErrorMessage } from '../utils';
import { processDocumentWithAI, ExtractedProduct } from '../../services/geminiService';

// Simple fuzzy matching helper
const stringSimilarity = (s1: string, s2: string): number => {
  const v1 = s1.toLowerCase().trim();
  const v2 = s2.toLowerCase().trim();
  if (v1 === v2) return 1;
  if (!v1 || !v2) return 0;
  
  // Check if one contains the other
  if (v1.includes(v2) || v2.includes(v1)) {
    return Math.min(v1.length, v2.length) / Math.max(v1.length, v2.length) * 0.9;
  }
  
  const words1 = v1.split(/\s+/).filter(w => w.length > 2);
  const words2 = v2.split(/\s+/).filter(w => w.length > 2);
  if (words1.length === 0 || words2.length === 0) return 0;

  const common = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));
  return common.length / Math.max(words1.length, words2.length);
};

interface UpdatePricesViewProps {
  suppliers: Supplier[];
  categories: string[];
  saveSupplier: (s: Supplier) => Promise<void>;
  addNotification: (msg: string, qty: number, type?: 'cart' | 'info') => void;
}

interface MatchResult {
  extracted: ExtractedProduct;
  originalReadName: string; // Store name as read by AI before any user/match overrides
  existingProduct?: Product;
  supplier?: Supplier;
  isNew: boolean;
  // User configurations for new products
  selectedContext?: 'suppliers' | 'mercado' | 'materiais';
  selectedSupplierId?: string;
  selectedCategory?: string;
}

export const UpdatePricesView: React.FC<UpdatePricesViewProps> = ({
  suppliers,
  categories,
  saveSupplier,
  addNotification
}) => {
  const [prompt, setPrompt] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [quotaError, setQuotaError] = useState(false);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const [linkingIndex, setLinkingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const flatProducts = useMemo(() => {
    return suppliers.flatMap(s => s.products.map(p => ({ ...p, supplier: s })));
  }, [suppliers]);

  const filteredSearchProducts = useMemo(() => {
    if (!searchProductQuery.trim()) return [];
    const lower = searchProductQuery.toLowerCase();
    return flatProducts
      .filter(p => p.name.toLowerCase().includes(lower))
      .slice(0, 10);
  }, [flatProducts, searchProductQuery]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setQuotaError(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const validTypes = ['image/jpeg', 'image/png', 'application/pdf', 'text/xml', 'application/xml'];
      
      if (validTypes.includes(file.type) || file.name.endsWith('.xml')) {
        setSelectedFile(file);
        setQuotaError(false);
      } else {
        addNotification("Formato de arquivo não suportado", 0, 'info');
      }
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const processAI = async () => {
    setIsProcessing(true);
    setQuotaError(false);
    try {
      let fileData;
      if (selectedFile) {
        const b64 = await fileToBase64(selectedFile);
        fileData = {
          mimeType: selectedFile.type,
          data: b64
        };
      }

      const existingNames = Array.from(new Set(suppliers.flatMap(s => s.products.map(p => p.name))));
      const extracted = await processDocumentWithAI(fileData, prompt, existingNames);
      
      const results: MatchResult[] = extracted.map(item => {
        let matchedProduct: Product | undefined;
        let matchedSupplier: Supplier | undefined;
        let bestScore = 0;
        const originalName = item.rawName || item.name;

        // 1. Tentar match exato primeiro (IA foi instruída a retornar o nome exato se vinculou)
        for (const s of suppliers) {
          const p = s.products.find(p => p.name.toLowerCase() === item.name.toLowerCase());
          if (p) {
            matchedProduct = p;
            matchedSupplier = s;
            bestScore = 1;
            break;
          }
        }

        // 2. Se não achou exato, tenta fuzzy match como fallback
        if (!matchedProduct) {
          for (const s of suppliers) {
            for (const p of s.products) {
              const score = stringSimilarity(p.name, item.name);
              if (score > 0.6 && score > bestScore) {
                bestScore = score;
                matchedProduct = p;
                matchedSupplier = s;
              }
            }
          }
        }

        return {
          extracted: item,
          originalReadName: originalName,
          existingProduct: matchedProduct,
          supplier: matchedSupplier,
          isNew: !matchedProduct || bestScore < 0.85, // Mark as new if score is low
          selectedContext: matchedSupplier?.name.toUpperCase() === 'MERCADO' ? 'mercado' : 
                           matchedSupplier?.name.toUpperCase() === 'MATERIAIS' ? 'materiais' : 'suppliers',
          selectedSupplierId: matchedSupplier?.id,
          selectedCategory: matchedProduct?.category || item.category || (categories.length > 0 ? categories[0] : 'Fornecedor')
        };
      });

      setMatchResults(results);
      // Limpar campos após processamento bem sucedido
      setPrompt('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      const errorMsg = extractErrorMessage(error);
      console.error("Erro no processamento AI:", errorMsg);
      
      if (errorMsg.toLowerCase().includes('quota') || errorMsg.toLowerCase().includes('429') || errorMsg.toLowerCase().includes('limit')) {
        setQuotaError(true);
        addNotification("Limite da IA atingido. Tente novamente mais tarde.", 0, 'info');
      } else {
        addNotification(`Erro: ${errorMsg}`, 0, 'info');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdate = async () => {
    const updatedSuppliers = new Map<string, Supplier>();

    for (const res of matchResults) {
      // Determina qual fornecedor alvo usar baseado no contexto
      let targetSupplier: Supplier | undefined;
      
      if (res.selectedContext === 'mercado') {
        targetSupplier = suppliers.find(s => s.name.toUpperCase() === 'MERCADO');
        if (!targetSupplier) {
           // Mock de fornecedor novo se não existir
           targetSupplier = { name: 'MERCADO', phone: '', products: [] };
        }
      } else if (res.selectedContext === 'materiais') {
        targetSupplier = suppliers.find(s => s.name.toUpperCase() === 'MATERIAIS');
        if (!targetSupplier) {
           targetSupplier = { name: 'MATERIAIS', phone: '', products: [] };
        }
      } else {
        targetSupplier = suppliers.find(s => s.id === res.selectedSupplierId);
      }

      if (targetSupplier) {
        const sId = targetSupplier.id || `NEW_${targetSupplier.name}`;
        const s = updatedSuppliers.get(sId) || { ...targetSupplier };
        
        if (!res.isNew && res.existingProduct) {
          // Atualização de produto existente (pode ter mudado de fornecedor/contexto?)
          // Se mudou de fornecedor, remove do antigo e adiciona no novo? 
          // Para simplificar, vamos apenas atualizar no fornecedor atual se o contexto for o mesmo
          const pIdx = s.products.findIndex(p => p.name === res.existingProduct?.name);
          if (pIdx !== -1) {
            s.products[pIdx] = { ...s.products[pIdx], price: res.extracted.price };
          } else {
            // Se o produto não está neste fornecedor (mudança de contexto), adicionamos
            s.products.push({
              name: res.extracted.name,
              price: res.extracted.price,
              category: res.selectedCategory || 'Fornecedor'
            });
          }
        } else {
          // Novo produto
          s.products.push({
            name: res.extracted.name,
            price: res.extracted.price,
            category: res.selectedCategory || 'Fornecedor'
          });
        }
        updatedSuppliers.set(sId, s);
      }
    }

    // Salvar mudanças
    for (const s of Array.from(updatedSuppliers.values())) {
      await saveSupplier(s);
    }

    addNotification("Sincronização concluída!", matchResults.length, 'info');
    setMatchResults([]);
    setPrompt('');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const updateItemConfig = (index: number, updates: Partial<MatchResult>) => {
    setMatchResults(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const next = { ...item, ...updates };
      
      // Se mudar o contexto para mercado/materiais, pré-seleciona o fornecedor correspondente
      if (updates.selectedContext === 'mercado') {
        const s = suppliers.find(sup => sup.name.toUpperCase() === 'MERCADO');
        next.selectedSupplierId = s?.id || 'MERCADO';
      } else if (updates.selectedContext === 'materiais') {
        const s = suppliers.find(sup => sup.name.toUpperCase() === 'MATERIAIS');
        next.selectedSupplierId = s?.id || 'MATERIAIS';
      }
      
      return next;
    }));
  };

  const removeItem = (index: number) => {
    if (window.confirm("Deseja realmente remover este produto da extração?")) {
      setMatchResults(prev => prev.filter((_, i) => i !== index));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-20"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Atualizar Preços</h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">
            Inteligência Artificial para atualização automática de catálogo
          </p>
        </div>
        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0">
          <Sparkles className="w-8 h-8 text-indigo-600" />
        </div>
      </div>

      {!matchResults.length ? (
        <div className="space-y-8">
          <AnimatePresence>
            {quotaError && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 32 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl flex flex-col md:flex-row items-center gap-6 shadow-sm">
                  <div className="w-12 h-12 bg-amber-500 text-white rounded-xl flex items-center justify-center shrink-0">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div className="text-center md:text-left flex-1">
                    <h3 className="text-lg font-bold text-amber-900 uppercase tracking-tight">Limite de IA Atingido</h3>
                    <p className="text-amber-700 text-sm">O Google liberou o uso gratuito, mas há um limite de requisições por minuto. Por favor, aguarde alguns instantes e tente novamente.</p>
                  </div>
                  <button 
                    onClick={() => setQuotaError(false)}
                    className="px-4 py-2 bg-amber-500 text-white font-bold rounded-xl uppercase tracking-widest text-[10px] hover:bg-amber-600 transition-colors"
                  >
                    Entendi
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-3">
                <FileText className="w-5 h-5 text-indigo-600" />
                Prompt ou Contexto
              </h3>
              <textarea
                placeholder="Ex: Atualize o preço da Farinha de Trigo para R$ 5,50 e adicione um novo produto 'Fermento Seco' por R$ 2,00 do fornecedor Atacadão."
                className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition-all font-medium text-slate-700 resize-none text-sm"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            <button
              onClick={processAI}
              disabled={isProcessing || (!prompt && !selectedFile)}
              className={`w-full py-4 rounded-xl font-bold text-lg uppercase tracking-widest flex items-center justify-center gap-4 transition-all shadow-md active:translate-y-0.5 ${
                isProcessing ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  Atualizar
                </>
              )}
            </button>
          </div>

          <div className="space-y-6">
            <div 
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`bg-white p-8 h-full rounded-2xl border-2 border-dashed transition-all cursor-pointer group flex flex-col items-center justify-center text-center space-y-4 ${
                isDragging ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-indigo-400'
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,application/pdf,text/xml"
              />
              
              {selectedFile ? (
                <div className="space-y-4">
                  <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto">
                    {selectedFile.type.includes('image') ? <Camera className="w-10 h-10" /> : <FileCode className="w-10 h-10" />}
                  </div>
                  <div className="w-full px-4 overflow-hidden">
                    <p className="font-black text-slate-900 text-lg break-all">{selectedFile.name}</p>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                    className="text-red-600 font-black uppercase tracking-widest text-xs hover:underline"
                  >
                    Remover Arquivo
                  </button>
                </div>
              ) : (
                <>
                  <div className="w-20 h-20 bg-slate-50 text-slate-300 group-hover:text-slate-900 group-hover:bg-indigo-50 rounded-3xl flex items-center justify-center transition-all">
                    <Upload className="w-10 h-10" />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-xl">Upload de Nota Fiscal</p>
                    <p className="text-slate-400 font-bold text-sm">Arraste ou clique para selecionar</p>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest bg-slate-50 px-3 py-2 rounded-xl">
                      <Camera className="w-4 h-4" /> IMG
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest bg-slate-50 px-3 py-2 rounded-xl">
                      <FileText className="w-4 h-4" /> PDF
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest bg-slate-50 px-3 py-2 rounded-xl">
                      <FileCode className="w-4 h-4" /> XML
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      ) : (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900">Resultados da Extração</h2>
            <div className="flex gap-4">
              <button 
                onClick={() => setMatchResults([])}
                className="px-5 py-2.5 bg-white border border-slate-200 font-bold uppercase tracking-widest text-[10px] rounded-xl hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleUpdate}
                className="px-5 py-2.5 bg-indigo-600 text-white font-bold uppercase tracking-widest text-[10px] rounded-xl shadow-md hover:bg-indigo-700 transition-all flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Confirmar Tudo
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {matchResults.map((res, i) => (
              <div 
                key={i}
                className={`bg-white p-5 rounded-2xl border flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 transition-all ${
                  res.isNew ? 'border-indigo-100' : 'border-emerald-100'
                } shadow-sm hover:shadow-md`}
              >
                {/* Left: Product Info */}
                <div className="flex gap-4 items-center flex-1 w-full min-w-0">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    res.isNew ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {res.isNew ? <Plus className="w-6 h-6" /> : <Check className="w-6 h-6" />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 group/name max-w-full">
                      <input 
                        type="text"
                        className="font-black text-slate-900 text-lg uppercase tracking-tight bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-indigo-500 outline-none w-full transition-all"
                        value={res.extracted.name}
                        onChange={(e) => updateItemConfig(i, { extracted: { ...res.extracted, name: e.target.value } })}
                      />
                      <Pencil className="w-4 h-4 text-slate-300 group-hover/name:text-indigo-400 transition-colors shrink-0" />
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                       {res.isNew ? (
                         <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-2 py-0.5 bg-indigo-50 rounded">Novo Produto</span>
                       ) : (
                         <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest px-2 py-0.5 bg-emerald-50 rounded">Sugestão de Vínculo</span>
                       )}
                       {res.supplier && <span className="text-slate-400 font-bold text-xs shrink-0">· {res.supplier.name}</span>}
                       
                       <div className="flex gap-4">
                         <button 
                          onClick={() => {
                            setLinkingIndex(i);
                            setSearchProductQuery('');
                          }}
                          className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:underline whitespace-nowrap"
                         >
                           <LinkIcon className="w-3 h-3" />
                           {res.existingProduct ? 'Trocar Vínculo' : 'Vincular Existente'}
                         </button>

                         {!res.isNew && (
                           <button 
                             onClick={() => {
                               updateItemConfig(i, {
                                 existingProduct: undefined,
                                 supplier: undefined,
                                 isNew: true,
                                 extracted: { ...res.extracted, name: res.originalReadName }
                               });
                             }}
                             className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1 hover:underline whitespace-nowrap"
                           >
                             <Link2Off className="w-3 h-3" />
                             Remover Vínculo
                           </button>
                         )}
                       </div>
                    </div>
                  </div>
                </div>

                {/* Right: Price and Config */}
                <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-8 w-full lg:w-auto shrink-0">
                  <div className="flex items-center gap-4 bg-slate-50 px-6 py-3 rounded-2xl border-2 border-slate-100 shrink-0 w-full sm:w-auto">
                    {!res.isNew && res.existingProduct && (
                      <>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Antigo</p>
                          <p className="text-slate-500 line-through font-bold">{formatCurrency(res.existingProduct.price)}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300" />
                      </>
                    )}
                    <div className="text-right flex-1 sm:flex-initial">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Novo</p>
                      <p className="text-xl font-black text-slate-900">{formatCurrency(res.extracted.price)}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2 w-full sm:w-auto min-w-0 sm:min-w-[250px] shrink-0">
                    <div className="flex items-center gap-2 bg-white border-2 border-slate-200 p-2 rounded-xl">
                      <ListChecks className="w-4 h-4 text-slate-400 shrink-0" />
                      <select 
                        className="text-xs font-black uppercase tracking-tight outline-none w-full bg-transparent"
                        value={res.selectedContext}
                        onChange={(e) => updateItemConfig(i, { selectedContext: e.target.value as any })}
                      >
                        <option value="suppliers">Fornecedores</option>
                        <option value="mercado">Mercado</option>
                        <option value="materiais">Materiais</option>
                      </select>
                    </div>

                    {res.selectedContext === 'suppliers' && (
                      <div className="flex items-center gap-2 bg-white border-2 border-slate-200 p-2 rounded-xl animate-in fade-in slide-in-from-top-1">
                        <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                        <select 
                          className="text-xs font-black uppercase tracking-tight outline-none w-full bg-transparent"
                          value={res.selectedSupplierId || ''}
                          onChange={(e) => updateItemConfig(i, { selectedSupplierId: e.target.value })}
                        >
                          <option value="">Selecionar Fornecedor</option>
                          {suppliers.filter(s => s.name.toUpperCase() !== 'MERCADO' && s.name.toUpperCase() !== 'MATERIAIS').map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex items-center gap-2 bg-white border-2 border-slate-200 p-2 rounded-xl">
                      <Tag className="w-4 h-4 text-slate-400 shrink-0" />
                      <select 
                        className="text-xs font-black uppercase tracking-tight outline-none w-full bg-transparent"
                        value={res.selectedCategory || ''}
                        onChange={(e) => updateItemConfig(i, { selectedCategory: e.target.value })}
                      >
                        <option value="">Selecionar Categoria</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  <button 
                    onClick={() => removeItem(i)}
                    className="p-4 bg-red-50 text-red-500 rounded-2xl border-2 border-red-100 hover:bg-red-500 hover:text-white hover:border-red-600 transition-all shrink-0 w-full sm:w-auto flex items-center justify-center"
                    title="Remover produto da extração"
                  >
                    <Trash2 className="w-6 h-6" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Vínculo de Produto Centralizado */}
      <AnimatePresence>
        {linkingIndex !== null && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLinkingIndex(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                    <LinkIcon className="w-6 h-6 text-indigo-600" />
                    Vincular Produto Existente
                  </h3>
                  <button onClick={() => setLinkingIndex(null)} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    autoFocus
                    type="text"
                    placeholder="Pesquisar por nome, marca ou fornecedor..."
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition-all font-medium text-slate-700"
                    value={searchProductQuery}
                    onChange={(e) => setSearchProductQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {filteredSearchProducts.length > 0 ? (
                  filteredSearchProducts.map((p, pIdx) => (
                    <button
                      key={pIdx}
                      onClick={() => {
                        if (linkingIndex !== null) {
                          updateItemConfig(linkingIndex, {
                            extracted: { ...matchResults[linkingIndex].extracted, name: p.name },
                            existingProduct: p,
                            supplier: p.supplier,
                            isNew: false,
                            selectedSupplierId: p.supplier.id,
                            selectedContext: p.supplier.name.toUpperCase() === 'MERCADO' ? 'mercado' : 
                                             p.supplier.name.toUpperCase() === 'MATERIAIS' ? 'materiais' : 'suppliers',
                            selectedCategory: p.category
                          });
                          setLinkingIndex(null);
                        }
                      }}
                      className="w-full flex items-center justify-between p-4 hover:bg-indigo-50 rounded-xl transition-all border border-transparent hover:border-indigo-100 text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white border border-slate-100 rounded-lg flex items-center justify-center text-slate-300 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-all">
                          <Check className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-all" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-700 uppercase text-xs tracking-tight">{p.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{p.supplier.name}</span>
                            <span className="w-1 h-1 bg-slate-200 rounded-full" />
                            <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">{p.category}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-indigo-600 text-base tracking-tight">{formatCurrency(p.price)}</p>
                      </div>
                    </button>
                  ))
                ) : searchProductQuery ? (
                  <div className="py-12 text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-50 text-slate-100 rounded-full flex items-center justify-center mx-auto">
                      <Search className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-lg">Nenhum resultado</p>
                      <p className="text-slate-400 text-sm">Tente termos mais genéricos</p>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-50 text-slate-100 rounded-full flex items-center justify-center mx-auto">
                      <ListChecks className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-400">Digite para começar a busca</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setLinkingIndex(null)}
                  className="px-6 py-2 bg-white border border-slate-200 rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-sm hover:shadow-md transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
