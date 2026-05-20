import React, { useEffect, useState, useRef } from 'react';
import { Loader2, ChevronLeft, ChevronRight, Search, FileUp, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface Invoice {
    id: string;
    supplierName: string;
    date: string;
    products: { code: string; name: string; quantity?: number }[];
}

interface Forecast {
    productName: string;
    supplier: string;
    lastPurchase: string;
    avgIntervalDays: number;
    lastQuantity: number;
    predictedNextPurchase: string;
}

export const PurchaseForecastView: React.FC = () => {
    const [forecasts, setForecasts] = useState<Forecast[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [viewMode, setViewMode] = useState<'forecast' | 'import'>('forecast');
    const itemsPerPage = 20;

    // XML Import State
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [importedCount, setImportedCount] = useState(0);
    const [updatedCount, setUpdatedCount] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/xml/invoices?t=' + Date.now());
            if (!res.ok) throw new Error('Falha ao carregar notas fiscais');
            const data: Invoice[] = await res.json();

            // Sort by date ASC to ensure we keep the last supplier
            data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            const productHistory: Record<string, { dates: string[], name: string, supplier: string, lastQuantity: number }> = {};
            data.forEach(invoice => {
                const date = new Date(invoice.date).toISOString().split('T')[0];
                invoice.products.forEach(product => {
                    const key = product.code; // Group by product code only
                    if (!productHistory[key]) {
                        productHistory[key] = { dates: [], name: product.name, supplier: invoice.supplierName, lastQuantity: 0 };
                    }
                    // Always update to the latest supplier
                    productHistory[key].supplier = invoice.supplierName;
                    productHistory[key].lastQuantity = (product.quantity !== undefined ? product.quantity : 0);
                    if (!productHistory[key].dates.includes(date)) {
                        productHistory[key].dates.push(date);
                    }
                });
            });

            const computedForecasts: Forecast[] = Object.values(productHistory)
                .filter(data => data.dates.length >= 2)
                .map(data => {
                    const dates = data.dates.sort();
                    
                    let totalInterval = 0;
                    for (let i = 1; i < dates.length; i++) {
                        const diff = (new Date(dates[i]).getTime() - new Date(dates[i-1]).getTime()) / (1000 * 60 * 60 * 24);
                        totalInterval += diff;
                    }
                    const avgInterval = totalInterval / (dates.length - 1);
                    
                    const lastDate = new Date(dates[dates.length - 1]);
                    const nextDate = new Date(lastDate.getTime() + avgInterval * 24 * 60 * 60 * 1000);

                    return {
                        productName: data.name,
                        supplier: data.supplier,
                        lastPurchase: dates[dates.length - 1],
                        avgIntervalDays: Math.round(avgInterval),
                        lastQuantity: data.lastQuantity,
                        predictedNextPurchase: nextDate.toISOString().split('T')[0]
                    };
                })
                .sort((a, b) => new Date(a.predictedNextPurchase).getTime() - new Date(b.predictedNextPurchase).getTime());

            setForecasts(computedForecasts);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        setError(null);
        let imported = 0;
        let updated = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.name.endsWith('.xml')) {
                const reader = new FileReader();
                
                const fileContent = await new Promise<string>((resolve) => {
                    reader.onload = (e) => resolve(e.target?.result as string);
                    reader.readAsText(file);
                });

                try {
                    const response = await fetch('/api/xml/process', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ xmlData: fileContent })
                    });
                    
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Erro no servidor: ${errorText}`);
                    }
                    
                    const result = await response.json();
                    if (result.status === 'imported') {
                        imported++;
                    } else if (result.status === 'updated') {
                        updated++;
                    }
                } catch (error) {
                    const errMsg = error instanceof Error ? error.message : String(error);
                    setError(`Erro ao processar ${file.name}: ${errMsg}`);
                }
            }
        }

        setImportedCount(imported);
        setUpdatedCount(updated);
        setIsUploading(false);
        
        // Refresh forecast data after import
        fetchData();
    };

    const filteredForecasts = forecasts.filter(f =>
        (f.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
         f.supplier.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (filterDate === '' || new Date(f.predictedNextPurchase) >= new Date(filterDate))
    );

    const totalPages = Math.ceil(filteredForecasts.length / itemsPerPage);
    const paginatedForecasts = filteredForecasts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const formatDate = (date: string) => date.split('-').reverse().join('/');

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    if (loading && viewMode === 'forecast') return <div className="p-8"><Loader2 className="animate-spin text-indigo-600" /></div>;

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 space-y-8"
        >
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Previsão de Compra</h1>
                    <p className="text-slate-500 font-medium">Produtos sugeridos com base no histórico de compras.</p>
                </div>
                <div className="flex gap-4">
                    <div className="bg-slate-100 p-1 rounded-xl flex">
                        <button
                            onClick={() => setViewMode('forecast')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                viewMode === 'forecast' 
                                ? 'bg-white text-indigo-600 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            Previsão
                        </button>
                        <button
                            onClick={() => setViewMode('import')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                                viewMode === 'import' 
                                ? 'bg-white text-indigo-600 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <FileUp size={16} />
                            Importar XML
                        </button>
                    </div>
                </div>
            </div>

            {viewMode === 'forecast' ? (
                <>
                <div className="flex gap-2 justify-end">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Pesquisar produto ou fornecedor..."
                            value={searchTerm}
                            onChange={handleSearch}
                            className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-64"
                        />
                    </div>
                    <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => { setFilterDate(e.target.value); setCurrentPage(1); }}
                        className="px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-left">
                                <th className="p-4 text-slate-400 text-xs font-bold uppercase tracking-widest border-b">Produto</th>
                                <th className="p-4 text-slate-400 text-xs font-bold uppercase tracking-widest border-b">Fornecedor</th>
                                <th className="p-4 text-slate-400 text-xs font-bold uppercase tracking-widest border-b">Última Compra</th>
                                <th className="p-4 text-slate-400 text-xs font-bold uppercase tracking-widest border-b">Ciclo Médio</th>
                                <th className="p-4 text-slate-400 text-xs font-bold uppercase tracking-widest border-b">Qtde na Última Compra</th>
                                <th className="p-4 text-slate-400 text-xs font-bold uppercase tracking-widest border-b text-indigo-600">Previsão</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedForecasts.map(f => (
                                <tr key={`${f.productName}-${f.supplier}`} className="border-b border-slate-50 hover:bg-slate-50/50">
                                    <td className="p-4 font-bold text-slate-800">{f.productName}</td>
                                    <td className="p-4 text-sm text-slate-600">{f.supplier}</td>
                                    <td className="p-4 text-sm text-slate-600">{formatDate(f.lastPurchase)}</td>
                                    <td className="p-4 text-sm text-slate-600 font-mono">{f.avgIntervalDays} dias</td>
                                    <td className="p-4 text-sm text-slate-600 font-mono">{f.lastQuantity}</td>
                                    <td className="p-4 text-sm font-black text-indigo-600">{formatDate(f.predictedNextPurchase)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {totalPages > 1 && (
                        <div className="p-4 flex items-center justify-between border-t border-slate-100">
                            <button 
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 disabled:opacity-30"
                            >
                                <ChevronLeft />
                            </button>
                            <span className="text-sm font-bold text-slate-600">Página {currentPage} de {totalPages}</span>
                            <button 
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 disabled:opacity-30"
                            >
                                <ChevronRight />
                            </button>
                        </div>
                    )}
                </div>
                </>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
                    <h2 className="text-xl font-bold mb-6 text-slate-800">Importar XML</h2>
                    <div 
                        className="border-2 border-dashed border-slate-300 rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition-colors bg-slate-50 hover:bg-indigo-50"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <FileUp className="w-12 h-12 text-indigo-500 mb-4" />
                        <p className="text-lg font-medium text-slate-700">Clique para selecionar arquivos XML ou pastas</p>
                        <p className="text-sm text-slate-500 mt-2">Suporta múltiplos arquivos NFe/CTe</p>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            className="hidden" 
                            multiple
                            accept=".xml"
                        />
                    </div>
                    {error && (
                        <div className="mt-6 p-4 bg-red-100 text-red-700 rounded-lg">
                            {error}
                        </div>
                    )}
                    {isUploading && (
                        <div className="mt-6 flex items-center gap-3 text-indigo-600 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                            <Loader2 className="animate-spin w-5 h-5" />
                            <span className="font-medium">Processando arquivos...</span>
                        </div>
                    )}
                    {importedCount > 0 || updatedCount > 0 ? (
                        <div className="mt-6 p-4 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 flex flex-col gap-2">
                            <div className="flex items-center">
                                <CheckCircle2 className="w-5 h-5 mr-2 shrink-0" />
                                <span className="font-bold">{importedCount} arquivos novos importados com sucesso!</span>
                            </div>
                            {updatedCount > 0 && (
                                <span className="text-sm font-medium text-emerald-600 max-w-full">
                                    {updatedCount} arquivos foram atualizados (já existiam no histórico).
                                </span>
                            )}
                        </div>
                    ) : null}
                </div>
            )}
        </motion.div>
    );
};

