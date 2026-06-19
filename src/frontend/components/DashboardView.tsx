/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  TrendingUp, 
  Calendar as CalendarIcon, 
  Download,
  AlertCircle,
  Clock,
  RefreshCcw,
  Upload,
  FileText,
  Trash2,
  XCircle,
  FileCheck2,
  HelpCircle,
  Briefcase
} from 'lucide-react';
import { 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  AreaChart,
  Area,
  XAxis,
  YAxis
} from 'recharts';
import { format, isWithinInterval, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { domToCanvas } from 'modern-screenshot';

import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { formatCurrency, safeStringify, handleFirestoreError, OperationType } from '../utils';
import { SavedList } from '../types';

interface DashboardViewProps {
  savedLists?: SavedList[];
}

export const DashboardView: React.FC<DashboardViewProps> = () => {
  const [startDate, setStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [isChartReady, setIsChartReady] = useState(false);
  
  // Real-time XML Spendings State with localStorage caching
  const [xmlSpendings, setXmlSpendings] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem('cached_dashboard_xml_spendings');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_dashboard_xml_spendings');
      return cached ? false : true;
    } catch {
      return true;
    }
  });
  
  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [xmlLogs, setXmlLogs] = useState<{ type: 'success' | 'warning' | 'error', text: string }[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsChartReady(true);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Fetch / Listen to xml_spendings real-time
  useEffect(() => {
    const q = collection(db, 'xml_spendings');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setXmlSpendings(items);
      try {
        localStorage.setItem('cached_dashboard_xml_spendings', JSON.stringify(items));
      } catch (err) {
        console.error("Erro ao salvar cache local:", err);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Erro ao carregar dados XML de gastos:", error);
      setIsLoading(false);
      handleFirestoreError(error, OperationType.GET, 'xml_spendings');
    });
    return () => unsubscribe();
  }, []);

  const expenseChartRef = useRef<HTMLDivElement>(null);

  // Parse XML Function
  const parseNFeXml = (xmlText: string, fileName: string) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    const parserError = xmlDoc.getElementsByTagName("parsererror");
    if (parserError.length > 0) {
      throw new Error(`Erro ao parsing do XML de ${fileName}`);
    }

    // Identificação da Nota (nfeKey) para prevenção de duplicidade
    const infNFeEl = xmlDoc.getElementsByTagName("infNFe")[0];
    let nfeKey = infNFeEl?.getAttribute("Id") || "";
    if (nfeKey.startsWith("NFe")) {
      nfeKey = nfeKey.substring(3);
    }
    if (!nfeKey) {
      nfeKey = xmlDoc.getElementsByTagName("chNFe")[0]?.textContent || "";
    }
    if (!nfeKey) {
      const cNPJ = xmlDoc.getElementsByTagName("CNPJ")[0]?.textContent || "";
      const nNF = xmlDoc.getElementsByTagName("nNF")[0]?.textContent || "";
      nfeKey = cNPJ && nNF ? `${cNPJ}_${nNF}` : `${fileName}_${Date.now()}`;
    }

    // Identificar Data de Emissão (dhEmi)
    const ideEl = xmlDoc.getElementsByTagName("ide")[0];
    const dhEmiRaw = ideEl?.getElementsByTagName("dhEmi")[0]?.textContent || 
                     xmlDoc.getElementsByTagName("dhEmi")[0]?.textContent || 
                     ideEl?.getElementsByTagName("dEmi")[0]?.textContent || 
                     xmlDoc.getElementsByTagName("dEmi")[0]?.textContent || 
                     new Date().toISOString();

    let dhEmi = dhEmiRaw;
    if (dhEmiRaw.includes("T")) {
      dhEmi = dhEmiRaw.split("T")[0];
    }

    // Identificar Valor Total da Nota, preferindo vNF (Valor da Nota) para o Gasto Mensal Real
    const vTotTribText = xmlDoc.getElementsByTagName("vNF")[0]?.textContent || 
                         xmlDoc.getElementsByTagName("vTotTrib")[0]?.textContent || 
                         "0";
    const vTotTrib = parseFloat(vTotTribText.replace(",", ".")) || 0;

    const emitEl = xmlDoc.getElementsByTagName("emit")[0];
    const supplierName = emitEl?.getElementsByTagName("xNome")[0]?.textContent || 
                         xmlDoc.getElementsByTagName("xNome")[0]?.textContent || 
                         "FORNECEDOR XML";

    return { nfeKey, dhEmi, vTotTrib, supplierName };
  };

  const processXmlFiles = async (files: File[]) => {
    setIsUploading(true);
    const logs: { type: 'success' | 'warning' | 'error', text: string }[] = [];
    let earliestDate: Date | null = null;
    let latestDate: Date | null = null;

    for (const file of files) {
      try {
        if (!file.name.toLowerCase().endsWith('.xml')) {
          logs.push({ type: 'error', text: `Arquivo "${file.name}" inválido. Não é um arquivo XML.` });
          continue;
        }

        const text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
          reader.readAsText(file);
        });

        const parsed = parseNFeXml(text, file.name);

        // Identificação nas notas para duplicados
        const alreadyExists = xmlSpendings.some(item => item.id === parsed.nfeKey);
        if (alreadyExists) {
          logs.push({ 
            type: 'warning', 
            text: `Aviso: A nota com chave "${parsed.nfeKey}" do arquivo "${file.name}" já foi enviada anteriormente.` 
          });
          continue;
        }

        // Salvar apenas os dados necessários do XML no Banco de Dados
        const docRef = doc(db, 'xml_spendings', parsed.nfeKey);
        try {
          await setDoc(docRef, {
            id: parsed.nfeKey,
            supplierName: parsed.supplierName,
            dhEmi: parsed.dhEmi,
            vTotTrib: parsed.vTotTrib,
            fileName: file.name
          });
        } catch (setDocErr) {
          handleFirestoreError(setDocErr, OperationType.WRITE, `xml_spendings/${parsed.nfeKey}`);
          throw setDocErr;
        }

        const parsedDate = new Date(parsed.dhEmi + 'T00:00:00');
        if (!isNaN(parsedDate.getTime())) {
          if (!earliestDate || parsedDate < earliestDate) earliestDate = parsedDate;
          if (!latestDate || parsedDate > latestDate) latestDate = parsedDate;
        }

        logs.push({ 
          type: 'success', 
          text: `Sucesso: Nota de "${parsed.supplierName}" (R$ ${parsed.vTotTrib.toFixed(2)}) importada.` 
        });

      } catch (err: any) {
        logs.push({ type: 'error', text: `Erro em ${file.name}: ${err.message}` });
      }
    }

    if (earliestDate && latestDate) {
      setStartDate(format(startOfMonth(earliestDate), 'yyyy-MM-dd'));
      setEndDate(format(endOfMonth(latestDate), 'yyyy-MM-dd'));
    }

    setXmlLogs(prev => [...logs, ...prev]);
    setIsUploading(false);
  };

  const handleDeleteXmlSpending = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'xml_spendings', id));
    } catch (err) {
      console.error("Erro ao deletar gasto XML:", err);
      handleFirestoreError(err, OperationType.DELETE, `xml_spendings/${id}`);
    }
  };

  // Filtered expense data within selected dates
  const expenseData = useMemo(() => {
    const dayMap = new Map<string, number>();
    
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');
    
    // Initialize interval days list
    let current = new Date(start);
    while (current <= end) {
      dayMap.set(format(current, 'dd/MM'), 0);
      current.setDate(current.getDate() + 1);
    }

    xmlSpendings.forEach(spending => {
      if (!spending.dhEmi) return;
      const spendingDate = parseISO(spending.dhEmi);
      if (isWithinInterval(spendingDate, { start, end })) {
        const dateKey = format(spendingDate, 'dd/MM');
        const amount = spending.vTotTrib || 0;
        const currentVal = dayMap.get(dateKey) || 0;
        dayMap.set(dateKey, currentVal + amount);
      }
    });

    return Array.from(dayMap.entries()).map(([name, valor]) => ({ name, valor }));
  }, [xmlSpendings, startDate, endDate]);

  // Totals calculations
  const totalExpense = useMemo(() => {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');
    
    return xmlSpendings.reduce((acc, spending) => {
      if (!spending.dhEmi) return acc;
      const spendingDate = parseISO(spending.dhEmi);
      if (isWithinInterval(spendingDate, { start, end })) {
        return acc + (spending.vTotTrib || 0);
      }
      return acc;
    }, 0);
  }, [xmlSpendings, startDate, endDate]);

  const activeInvoicesCount = useMemo(() => {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');
    
    return xmlSpendings.filter(spending => {
      if (!spending.dhEmi) return false;
      const spendingDate = parseISO(spending.dhEmi);
      return isWithinInterval(spendingDate, { start, end });
    }).length;
  }, [xmlSpendings, startDate, endDate]);

  const averageInvoiceValue = useMemo(() => {
    return activeInvoicesCount > 0 ? totalExpense / activeInvoicesCount : 0;
  }, [totalExpense, activeInvoicesCount]);

  // List of invoices inside range
  const invoicesInRange = useMemo(() => {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');
    
    return xmlSpendings.filter(spending => {
      if (!spending.dhEmi) return false;
      const spendingDate = parseISO(spending.dhEmi);
      return isWithinInterval(spendingDate, { start, end });
    }).sort((a, b) => new Date(b.dhEmi).getTime() - new Date(a.dhEmi).getTime());
  }, [xmlSpendings, startDate, endDate]);

  // Generate PDF Report
  const generateReport = async () => {
    if (!expenseChartRef.current) return;

    try {
      const canvas = await domToCanvas(expenseChartRef.current, {
        scale: 2,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      
      pdf.setFontSize(20);
      pdf.setTextColor(30, 41, 59);
      pdf.text('Relatório de Gastos Mensais - XML', 20, 20);
      
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Período: ${format(parseISO(startDate), 'dd/MM/yyyy')} até ${format(parseISO(endDate), 'dd/MM/yyyy')}`, 20, 28);
      pdf.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 20, 33);
      
      const imgWidth = pageWidth - 40;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 20, 45, imgWidth, imgHeight);
      
      const tableData = invoicesInRange.map(inv => [
        inv.supplierName,
        format(parseISO(inv.dhEmi), 'dd/MM/yyyy'),
        inv.id,
        formatCurrency(inv.vTotTrib)
      ]);
      
      const tableHeaders = ['Fornecedor', 'Emissão', 'Chave de Acesso', 'Valor Total'];

      autoTable(pdf, {
        startY: imgHeight + 60,
        head: [tableHeaders],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        margin: { left: 20, right: 20 }
      });
      
      const finalY = (pdf as any).lastAutoTable.finalY + 15;
      pdf.setFontSize(14);
      pdf.setTextColor(30, 41, 59);
      pdf.text(`Gasto Total no Período (XML): ${formatCurrency(totalExpense)}`, 20, finalY);

      pdf.save(`relatorio-gastos-xml-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar relatório jspdf:', error);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto pb-24">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-indigo-700 animate-pulse" />
            Dashboard XML
          </h1>
          <p className="text-slate-700 text-sm font-bold mt-1">Análise de gastos reais baseado exclusivamente nos XMLs importados.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100 shadow-inner">
            <div className="flex items-center gap-2 px-3">
              <CalendarIcon className="w-4 h-4 text-indigo-500" />
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-0 text-sm font-black text-slate-900 focus:outline-none uppercase cursor-pointer"
              />
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div className="flex items-center gap-2 px-3">
              <CalendarIcon className="w-4 h-4 text-indigo-500" />
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-0 text-sm font-black text-slate-900 focus:outline-none uppercase cursor-pointer"
              />
            </div>
          </div>

          <input
            type="file"
            accept=".xml"
            multiple
            onChange={(e) => e.target.files && processXmlFiles(Array.from(e.target.files))}
            className="hidden"
            id="dashboard-xml-file-picker"
          />
          <label 
            htmlFor="dashboard-xml-file-picker" 
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded-2xl transition-all shadow-sm cursor-pointer whitespace-nowrap font-bold"
          >
            <Upload className="w-4 h-4" />
            Importar XML
          </label>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Spend */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-24 h-24 text-indigo-700" />
          </div>
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Gasto no Período (XML)</p>
          <h3 className="text-3xl font-black text-indigo-700 tracking-tighter">
            {isLoading ? "Carregando..." : formatCurrency(totalExpense)}
          </h3>
          <p className="text-xs text-slate-500 font-bold mt-2">Data de Emissão (dhEmi) filtrada</p>
        </div>

        {/* Invoices Amount */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
            <FileText className="w-24 h-24 text-emerald-600" />
          </div>
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Notas Emitidas no Período</p>
          <h3 className="text-3xl font-black text-emerald-600 tracking-tighter">
            {isLoading ? "..." : `${activeInvoicesCount} notas`}
          </h3>
          <p className="text-xs text-slate-500 font-bold mt-2">Total geral enviado: {xmlSpendings.length}</p>
        </div>

        {/* Invoice Average */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
            <FileCheck2 className="w-24 h-24 text-blue-600" />
          </div>
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Ticket Médio por Nota</p>
          <h3 className="text-3xl font-black text-blue-600 tracking-tighter">
            {isLoading ? "..." : formatCurrency(averageInvoiceValue)}
          </h3>
          <p className="text-xs text-slate-500 font-bold mt-2">Gasto total / notas do período</p>
        </div>
      </div>

      {/* Uploading & Logs Panel */}
      {(isUploading || xmlLogs.length > 0) && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Histórico de Importação de XMLs</span>
              {isUploading && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 rounded-full">
                  <RefreshCcw className="w-3 h-3 text-indigo-600 animate-spin" />
                  <span className="text-[9px] font-black uppercase text-indigo-700">Analisando Arquivos...</span>
                </div>
              )}
            </div>
            {xmlLogs.length > 0 && (
              <button 
                onClick={() => setXmlLogs([])}
                className="text-[10px] font-bold text-slate-400 hover:text-slate-600 border-0 bg-transparent uppercase cursor-pointer"
              >
                Limpar Log
              </button>
            )}
          </div>
          
          {xmlLogs.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 max-h-48 overflow-y-auto space-y-2">
              {xmlLogs.map((log, idx) => (
                <div 
                  key={idx} 
                  className={`text-[10px] font-semibold leading-relaxed border-b border-slate-100 last:border-b-0 pb-1.5 flex items-start gap-2 ${
                    log.type === 'error' 
                      ? 'text-rose-600' 
                      : log.type === 'warning' 
                        ? 'text-amber-600 font-bold' 
                        : 'text-emerald-700'
                  }`}
                >
                  {log.type === 'error' && <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                  {log.type === 'warning' && <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 animate-bounce" />}
                  {log.type === 'success' && <FileCheck2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                  <span>{log.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main content sequence layout */}
      <div className="space-y-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm" ref={expenseChartRef}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <div className="w-2.5 h-7 bg-indigo-700 rounded-full" />
                Gasto Mensal Real (XML)
              </h2>
              <p className="text-slate-600 text-[10px] font-black mt-1 uppercase tracking-wider">Histórico baseado na data de emissão das notas</p>
            </div>
            <button 
              onClick={generateReport}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-xl hover:bg-indigo-100 transition-colors border-0 font-bold"
            >
              <Download className="w-3 h-3" />
              Gerar PDF
            </button>
          </div>

          <div className="relative h-[350px] w-full min-h-[350px]">
            {isLoading ? (
              <div className="w-full h-full bg-slate-50 rounded-2xl animate-pulse flex items-center justify-center">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Carregando dados...</span>
              </div>
            ) : isChartReady && expenseData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={350}>
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
                    formatter={(value: number) => [formatCurrency(value), 'Valor da Nota']}
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
            ) : (
              <div className="w-full h-full bg-slate-50 rounded-2xl flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-slate-200">
                <AlertCircle className="w-12 h-12 text-slate-300" />
                <p className="text-slate-500 font-bold text-xs uppercase tracking-wide mt-2">Nenhum dado encontrado no intervalo selecionado</p>
                <p className="text-slate-400 text-[10px] uppercase tracking-wider mt-1">Importe novos arquivos XML para visualizar os gastos.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
