import React, { useEffect, useState } from 'react';
import { Loader2, ChevronLeft, ChevronRight, Search } from 'lucide-react';
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
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'forecast' | 'invoices'>('forecast');
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const itemsPerPage = 20;

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/xml/invoices?t=' + Date.now());
            if (!res.ok) throw new Error('Falha ao carregar notas fiscais');
            const data: Invoice[] = await res.json();
            setInvoices(data);

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

    const deleteInvoice = async (id: string) => {
        console.log("Tentando excluir invoice com ID:", id);
        try {
            console.log("Enviando requisição de deleção para /api/xml/invoices/delete com ID:", JSON.stringify({ id }));
            const res = await fetch(`/api/xml/invoices/delete`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            
            console.log("Resposta status:", res.status);
            const result = await res.json();
            console.log("Resposta da deleção (json):", result);
            
            if (!res.ok) throw new Error(`Falha ao excluir nota fiscal: ${result.error || res.statusText}`);
            
            console.log("Invoice excluída com sucesso.");
            alert('Nota fiscal excluída com sucesso!');
            fetchData();
        } catch (err) {
            console.error("Erro ao excluir invoice (catch block):", err);
            alert('Erro ao excluir nota fiscal: ' + err);
        }
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

    if (loading) return <div className="p-8"><Loader2 className="animate-spin text-indigo-600" /></div>;

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 space-y-8"
        >
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Previsão de Compra</h1>
                    <p className="text-slate-500 font-medium">Produtos sugeridos ou gestão de notas fiscais.</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setViewMode('forecast')}
                        className={`px-4 py-2 rounded-xl border ${viewMode === 'forecast' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}
                    >
                         Previsão
                    </button>
                    <button 
                        onClick={() => setViewMode('invoices')}
                        className={`px-4 py-2 rounded-xl border ${viewMode === 'invoices' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}
                    >
                         Notas Fiscais
                    </button>
                    {viewMode === 'forecast' && (
                        <>
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
                        </>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {viewMode === 'forecast' ? (
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
                ) : (
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-left">
                                <th className="p-4 text-slate-400 text-xs font-bold uppercase tracking-widest border-b">ID</th>
                                <th className="p-4 text-slate-400 text-xs font-bold uppercase tracking-widest border-b">Fornecedor</th>
                                <th className="p-4 text-slate-400 text-xs font-bold uppercase tracking-widest border-b">Data</th>
                                <th className="p-4 text-slate-400 text-xs font-bold uppercase tracking-widest border-b">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.map(i => (
                                <tr key={i.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                    <td className="p-4 font-bold text-slate-800">{i.id}</td>
                                    <td className="p-4 text-sm text-slate-600">{i.supplierName}</td>
                                    <td className="p-4 text-sm text-slate-600">{formatDate(i.date)}</td>
                                    <td className="p-4 text-sm">
                                        <button 
                                            onClick={() => deleteInvoice(i.id)}
                                            className="text-red-600 hover:text-red-800 font-bold"
                                        >
                                            Excluir
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {viewMode === 'forecast' && totalPages > 1 && (
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
        </motion.div>
    );
};
