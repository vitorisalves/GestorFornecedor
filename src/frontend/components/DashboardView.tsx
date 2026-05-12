/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  TrendingUp, 
  Package, 
  Calendar as CalendarIcon, 
  Download,
  AlertCircle,
  Clock,
  ArrowRight,
  Filter,
  CheckCircle2,
  RefreshCcw,
  Sparkles
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  Cell,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { format, isWithinInterval, startOfMonth, endOfMonth, parseISO, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { domToCanvas } from 'modern-screenshot';

import { GoogleGenAI, Type } from "@google/genai";

import { SavedList } from '../types';
import { formatCurrency, normalizeText } from '../utils';

interface SpreadsheetItem {
  id: string;
  name: string;
  quantity: number;
  type: 'embalagem' | 'insumo';
}

interface DashboardViewProps {
  savedLists: SavedList[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({ savedLists }) => {
  const [startDate, setStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [spreadsheetData, setSpreadsheetData] = useState<SpreadsheetItem[]>([]);
  const [isLoadingSpreadsheet, setIsLoadingSpreadsheet] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [aiMappings, setAiMappings] = useState<Record<string, string>>({});
  const [isMatchingAI, setIsMatchingAI] = useState(false);
  
  const expenseChartRef = useRef<HTMLDivElement>(null);
  const quantityChartRef = useRef<HTMLDivElement>(null);

  // Filtered lists based on selected date range
  const filteredLists = useMemo(() => {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');
    
    return savedLists.filter(list => {
      const listDate = parseISO(list.date);
      return isWithinInterval(listDate, { start, end });
    });
  }, [savedLists, startDate, endDate]);

  // Gemini AI Matching Logic
  const performAIMatching = async (currentSpreadsheetData: SpreadsheetItem[], currentLists: SavedList[]) => {
    if (currentSpreadsheetData.length === 0 || currentLists.length === 0) return;
    
    setIsMatchingAI(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      // Limit total tokens/names to avoid 500 errors on extremely large datasets
      const spreadsheetNames = Array.from(new Set(currentSpreadsheetData.map(d => d.name.trim()))).slice(0, 150);
      const shoppingItemNames = Array.from(new Set(
        currentLists.flatMap(l => l.items.filter(i => i.bought).map(i => i.name.trim()))
      )).slice(0, 150);

      if (shoppingItemNames.length === 0) {
        setAiMappings({});
        return;
      }

      const prompt = `
        Mapeie os nomes dos itens da LISTA DE COMPRAS para os nomes oficiais da PLANILHA DE METAS.
        
        RETORNE APENAS UM JSON no seguinte formato:
        {
          "NOME_NA_LISTA": "NOME_OFICIAL_NA_PLANILHA"
        }

        PLANILHA (Nomes Oficiais):
        ${spreadsheetNames.join('\n')}

        LISTA (Nomes Manuais):
        ${shoppingItemNames.join('\n')}
      `;

      // Try with a small timeout/retry or just catch and provide silent fallback
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      });

      const responseText = response.text;
      
      let mapping = {};
      try {
        mapping = JSON.parse(responseText || '{}');
      } catch (parseError) {
        console.error('Falha ao analisar JSON da AI:', responseText);
        // Tenta extrair JSON se houver markdown ou outros textos
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            mapping = JSON.parse(jsonMatch[0]);
          } catch (e) {
            console.error('Falha na segunda tentativa de parse JSON');
          }
        }
      }
      
      console.log('AI Logic - New Product Mappings:', mapping);
      setAiMappings(mapping);
    } catch (error) {
      console.error('Error during AI product matching:', error);
    } finally {
      setIsMatchingAI(false);
    }
  };

  // Spreadsheet ID: 1LaE1o-zv0ZSaQHo1-_Z7LZZZxgCehi-kO2nzYt1AQHo
  const fetchSpreadsheet = async () => {
    setIsLoadingSpreadsheet(true);
    try {
      // Use export format with timestamp to avoid cache
      const timestamp = new Date().getTime();
      const SHEET_ID = '1EarQhvZBT65Ptf-LULWnAfS844WSL7i8mryNRmt-qDY';
      const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&t=${timestamp}`;
      
      const response = await fetch(SPREADSHEET_URL);
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const parsedItems: SpreadsheetItem[] = results.data.map((row: any, idx: number) => {
            // Flexible header detection
            const name = row['PRODUTO'] || row['Produto'] || row['name'] || row['Name'] || Object.values(row)[0] || '';
            const qtyStr = String(row['QUANTIDADE'] || row['Quantidade'] || row['qty'] || row['Quantity'] || Object.values(row)[1] || '0');
            const quantity = parseFloat(qtyStr.replace('.', '').replace(',', '.')) || 0;
            
            let type: 'embalagem' | 'insumo' = 'insumo';
            const lowerName = String(name).toLowerCase();
            if (lowerName.trim().startsWith('emb')) {
              type = 'embalagem';
            } else if (lowerName.trim().startsWith('i')) {
              type = 'insumo';
            }

            return {
              id: `sheet-${idx}`,
              name: String(name),
              quantity,
              type
            };
          });
          const filtered = parsedItems.filter(item => item.name && item.name !== 'undefined');
          setSpreadsheetData(filtered);
          setLastUpdated(new Date());
          
          // Trigger AI matching after load
          performAIMatching(filtered, filteredLists);
        },
        error: (err) => {
          console.error('Error parsing CSV:', err);
        }
      });
    } catch (error) {
      console.error('Error fetching spreadsheet:', error);
    } finally {
      setIsLoadingSpreadsheet(false);
    }
  };

  useEffect(() => {
    fetchSpreadsheet();
  }, []);

  // Sync AI when dates or lists change
  useEffect(() => {
    if (spreadsheetData.length > 0 && filteredLists.length > 0) {
      const timer = setTimeout(() => {
        performAIMatching(spreadsheetData, filteredLists);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [filteredLists, spreadsheetData.length]);

  // Chart 1 Data: Monthly Expense
  const expenseData = useMemo(() => {
    const dayMap = new Map<string, number>();
    
    // Initialize day map for the range
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');
    let current = new Date(start);
    while (current <= end) {
      dayMap.set(format(current, 'dd/MM'), 0);
      current.setDate(current.getDate() + 1);
    }

    filteredLists.forEach(list => {
      const dateKey = format(parseISO(list.date), 'dd/MM');
      const boughtTotal = list.items.reduce((acc, item) => {
        return item.bought ? acc + (item.price * item.quantity) : acc;
      }, 0);
      
      const currentVal = dayMap.get(dateKey) || 0;
      dayMap.set(dateKey, currentVal + boughtTotal);
    });

    return Array.from(dayMap.entries()).map(([name, valor]) => ({ name, valor }));
  }, [filteredLists, startDate, endDate]);

  const totalExpense = useMemo(() => expenseData.reduce((acc, d) => acc + d.valor, 0), [expenseData]);

  // Chart 2 Data: Quantity Comparison
  // Matching strategy: Spreadsheet items to shopping list items
  const quantityData = useMemo(() => {
    if (spreadsheetData.length === 0) return [];

    const matches = spreadsheetData.map(target => {
      let purchasedQty = 0;
      filteredLists.forEach(list => {
        list.items.forEach(item => {
          // SE O ITEM ESTIVER MARCADO (BOUGHT), ELE ENTRA NO CÁLCULO
          if (!item.bought) return;

      // 1. AI Mapping Check (Primary)
          // We normalize the key to be more resilient
          const itemKey = item.name.trim();
          const aiMatchName = aiMappings[itemKey];
          const isAIMatch = aiMatchName === target.name;

          // 2. Normalization Fallback
          const normalizedTarget = normalizeText(target.name).trim().toLowerCase();
          const targetSearch = normalizedTarget.replace(/^(emb|i)\s+/, '').trim();
          const normalizedItem = normalizeText(item.name).trim().toLowerCase();
          
          const isExact = normalizedItem === normalizedTarget;
          const containsSearch = targetSearch.length > 2 && 
            (normalizedItem.includes(targetSearch) || targetSearch.includes(normalizedItem));
          
          const itemSearch = normalizedItem.replace(/^(emb|i)\s+/, '').trim();
          const isSearchMatch = itemSearch === targetSearch && targetSearch.length > 0;

          if (isAIMatch || isExact || isSearchMatch || containsSearch) {
            purchasedQty += item.quantity;
          }
        });
      });

      return {
        name: target.name,
        planejado: target.quantity,
        comprado: purchasedQty,
        percent: target.quantity > 0 ? (purchasedQty / target.quantity) * 100 : 0,
        type: target.type
      };
    });

    return matches.sort((a, b) => b.percent - a.percent);
  }, [spreadsheetData, filteredLists, aiMappings]);

  const generateReport = async (chartId: 'expense' | 'quantity') => {
    const chartRef = chartId === 'expense' ? expenseChartRef : quantityChartRef;
    if (!chartRef.current) return;

    try {
      const canvas = await domToCanvas(chartRef.current, {
        scale: 2,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      
      // Header
      pdf.setFontSize(20);
      pdf.setTextColor(30, 41, 59); // slate-800
      pdf.text(chartId === 'expense' ? 'Relatório de Gastos Mensais' : 'Relatório de Metas de Compra', 20, 20);
      
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139); // slate-500
      pdf.text(`Período: ${format(parseISO(startDate), 'dd/MM/yyyy')} até ${format(parseISO(endDate), 'dd/MM/yyyy')}`, 20, 28);
      pdf.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 20, 33);
      
      // Charts usually look better if we limit width
      const imgWidth = pageWidth - 40;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 20, 45, imgWidth, imgHeight);
      
      // Data Table
      const tableData = chartId === 'expense' 
        ? expenseData.filter(d => d.valor > 0).map(d => [d.name, formatCurrency(d.valor)])
        : quantityData.map(d => [
            d.name, 
            d.type === 'embalagem' ? Math.round(d.planejado) : `${d.planejado.toFixed(2)}kg`,
            d.type === 'embalagem' ? Math.round(d.comprado) : `${d.comprado.toFixed(2)}kg`,
            `${d.percent.toFixed(1)}%`
          ]);
      
      const tableHeaders = chartId === 'expense' 
        ? ['Data', 'Gasto']
        : ['Produto', 'Meta', 'Comprado', 'Progresso'];

      autoTable(pdf, {
        startY: imgHeight + 60,
        head: [tableHeaders],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] }, // Indigo
        margin: { left: 20, right: 20 }
      });

      // Summary
      if (chartId === 'expense') {
        const finalY = (pdf as any).lastAutoTable.finalY + 15;
        pdf.setFontSize(14);
        pdf.setTextColor(30, 41, 59);
        pdf.text(`Gasto Total no Período: ${formatCurrency(totalExpense)}`, 20, finalY);
      }

      pdf.save(`relatorio-${chartId}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto pb-24">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-indigo-700" />
            Dashboard
          </h1>
          <p className="text-slate-700 text-sm font-bold mt-1">Análise de gastos e metas de suprimentos.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => performAIMatching(spreadsheetData, filteredLists)}
            disabled={isMatchingAI || spreadsheetData.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase transition-all border ${
              isMatchingAI 
                ? 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed' 
                : 'bg-white text-indigo-700 border-indigo-100 hover:bg-indigo-50 shadow-sm'
            }`}
          >
            <Sparkles className={`w-3 h-3 ${isMatchingAI ? 'animate-pulse' : ''}`} />
            {isMatchingAI ? 'Mapeando com IA...' : 'Sincronizar com IA'}
          </button>

          <button
            onClick={fetchSpreadsheet}
            disabled={isLoadingSpreadsheet}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase transition-all border ${
              isLoadingSpreadsheet 
                ? 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed' 
                : 'bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50 shadow-sm'
            }`}
          >
            <RefreshCcw className={`w-3 h-3 ${isLoadingSpreadsheet ? 'animate-spin' : ''}`} />
            Sincronizar Planilha
          </button>
          
          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 px-3">
              <CalendarIcon className="w-4 h-4 text-slate-400" />
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-0 text-sm font-black text-slate-900 focus:outline-none uppercase"
              />
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div className="flex items-center gap-2 px-3">
              <CalendarIcon className="w-4 h-4 text-slate-400" />
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-0 text-sm font-black text-slate-900 focus:outline-none uppercase"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-24 h-24 text-indigo-600" />
          </div>
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Gasto Total no Período</p>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(totalExpense)}</h3>
          <p className="text-xs text-indigo-700 font-bold mt-2">Baseado em itens marcados na lista</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
            <Package className="w-24 h-24 text-emerald-600" />
          </div>
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Produtos com Meta</p>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{spreadsheetData.length}</h3>
          <p className="text-xs text-emerald-700 font-bold mt-2">Itens da planilha de planejado</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
            <CheckCircle2 className="w-24 h-24 text-amber-600" />
          </div>
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Listas no Período</p>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{filteredLists.length}</h3>
          <p className="text-xs text-amber-700 font-bold mt-2">Total de listas de compras criadas</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-8">
        
        {/* Chart 1: Gasto Mensal */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm" ref={expenseChartRef}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <div className="w-2.5 h-7 bg-indigo-700 rounded-full" />
                Gasto Mensal
              </h2>
              <p className="text-slate-600 text-[10px] font-black mt-1 uppercase tracking-wider">Acompanhamento diário de compras finalizadas</p>
            </div>
            <button 
              onClick={() => generateReport('expense')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase rounded-xl hover:bg-indigo-100 transition-colors border-0"
            >
              <Download className="w-3 h-3" />
              PDF
            </button>
          </div>

          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={expenseData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#0f172a', fontSize: 13, fontWeight: 800 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#0f172a', fontSize: 13, fontWeight: 800 }}
                  tickFormatter={(val) => `R$${val}`}
                />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  labelStyle={{ fontWeight: 800, marginBottom: '4px', color: '#1e293b' }}
                  itemStyle={{ color: '#0f172a', fontWeight: 800 }}
                  formatter={(value: number) => [formatCurrency(value), 'Gasto']}
                />
                <Area 
                  type="monotone" 
                  dataKey="valor" 
                  stroke="#4f46e5" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorExpense)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Comparativo de Quantidades */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm" ref={quantityChartRef}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <div className="w-2.5 h-7 bg-emerald-600 rounded-full" />
                Meta vs Comprado
                {Object.keys(aiMappings).length > 0 && (
                  <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-[8px] font-black border border-indigo-100 animate-in fade-in zoom-in duration-500">
                    <Sparkles className="w-2 h-2" />
                    MATCH IA ATIVO
                  </span>
                )}
              </h2>
              <p className="text-slate-600 text-[10px] font-black mt-1 uppercase tracking-wider">Comparação de volumes planejados vs realizados</p>
            </div>
            <button 
              onClick={() => generateReport('quantity')}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase rounded-xl hover:bg-emerald-100 transition-colors border-0"
            >
              <Download className="w-3 h-3" />
              PDF
            </button>
          </div>

          {isLoadingSpreadsheet ? (
            <div className="flex flex-col items-center justify-center h-[400px] gap-4">
              <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-slate-400 text-xs font-bold uppercase">Sincronizando com planilha de metas...</p>
            </div>
          ) : quantityData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] gap-4">
              <AlertCircle className="w-12 h-12 text-slate-200" />
              <p className="text-slate-400 text-xs font-bold uppercase text-center max-w-xs">Nenhum dado encontrado para comparação no período selecionado.</p>
            </div>
          ) : (
            <div className="w-full" style={{ height: `${Math.max(450, quantityData.length * 40)}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={quantityData} layout="vertical" margin={{ left: 60, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#0f172a', fontSize: 13, fontWeight: 800 }} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#0f172a', fontSize: 12, fontWeight: 900, width: 250 }}
                    width={180}
                  />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    labelStyle={{ fontWeight: 800, marginBottom: '4px', color: '#1e293b' }}
                    itemStyle={{ color: '#0f172a', fontWeight: 800 }}
                    formatter={(value: number, name: string, props: any) => {
                      const item = props.payload;
                      const unit = item.type === 'embalagem' ? 'und' : 'kg';
                      return [`${value.toFixed(2)}${unit}`, name];
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: 900, textTransform: 'uppercase' }} />
                  <Bar dataKey="planejado" name="Meta Planejada" fill="#cbd5e1" radius={[0, 4, 4, 0]} barSize={20} />
                  <Bar dataKey="comprado" name="Quantidade Comprada" fill="#059669" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
