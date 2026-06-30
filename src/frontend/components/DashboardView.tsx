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
  Briefcase,
  Search,
  ArrowUpRight,
  ArrowDownRight
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
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { formatCurrency, safeStringify, handleFirestoreError, OperationType } from '../utils';
import { SavedList } from '../types';
import { analyzePrices } from '../utils/priceAnalysis';

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

  // States of invoices and suppliers for pricing dashboard
  const [invoices, setInvoices] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem('cached_dashboard_invoices');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [suppliers, setSuppliers] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem('cached_dashboard_suppliers');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [priceSearchQuery, setPriceSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Alertas de Aumento de Preço (Nova Tabela Temporária)
  const [priceIncreases, setPriceIncreases] = useState<any[]>([]);
  const [isPriceIncreasesLoading, setIsPriceIncreasesLoading] = useState(false);
  const [selectedIncreases, setSelectedIncreases] = useState<string[]>([]);

  const fetchPriceIncreases = async () => {
    setIsPriceIncreasesLoading(true);
    try {
      const res = await fetch('/api/xml/price-increases');
      if (res.ok) {
        const data = await res.json();
        setPriceIncreases(data);
      }
    } catch (err) {
      console.error("Erro ao buscar aumentos de preço:", err);
    } finally {
      setIsPriceIncreasesLoading(false);
    }
  };

  const handleDeleteIncrease = async (id: string) => {
    try {
      const res = await fetch('/api/xml/price-increases/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] })
      });
      if (res.ok) {
        setPriceIncreases(prev => prev.filter(item => item.id !== id));
        setSelectedIncreases(prev => prev.filter(item => item !== id));
      }
    } catch (err) {
      console.error("Erro ao deletar aumento de preço:", err);
    }
  };

  const handleBulkDeleteIncreases = async () => {
    if (selectedIncreases.length === 0) return;
    try {
      const res = await fetch('/api/xml/price-increases/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIncreases })
      });
      if (res.ok) {
        setPriceIncreases(prev => prev.filter(item => !selectedIncreases.includes(item.id)));
        setSelectedIncreases([]);
      }
    } catch (err) {
      console.error("Erro ao deletar aumentos em lote:", err);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedIncreases.length === priceIncreases.length) {
      setSelectedIncreases([]);
    } else {
      setSelectedIncreases(priceIncreases.map(item => item.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIncreases(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const fetchPricingData = async (force = false) => {
    const cacheDuration = 15 * 1000 * 60; // 15 minutes cache for high database reads saving
    const lastFetch = localStorage.getItem('dashboard_last_fetch');
    const now = Date.now();

    if (!force && lastFetch && (now - Number(lastFetch)) < cacheDuration) {
      return;
    }

    setIsPriceLoading(true);
    try {
      // Fetch invoices from backend cache
      const invoicesRes = await fetch('/api/xml/invoices');
      let invoicesData: any[] = [];
      if (invoicesRes.ok) {
        invoicesData = await invoicesRes.json();
      }

      // Fetch suppliers from backend cache with client-side fallback
      let suppliersData: any[] = [];
      try {
        const suppliersRes = await fetch('/api/xml/suppliers');
        if (suppliersRes.ok) {
          suppliersData = await suppliersRes.json();
        } else {
          const errData = await suppliersRes.json().catch(() => ({}));
          throw new Error(`Backend suppliers failed: ${errData.message || errData.error || suppliersRes.statusText}`);
        }
      } catch (backendErr) {
        console.warn("Falling back to client-side Firestore for suppliers:", backendErr);
        const suppSnap = await getDocs(collection(db, 'suppliers'));
        suppSnap.forEach(doc => {
          suppliersData.push({ id: doc.id, ...doc.data() });
        });
      }

      setInvoices(invoicesData);
      setSuppliers(suppliersData);
      localStorage.setItem('cached_dashboard_invoices', JSON.stringify(invoicesData));
      localStorage.setItem('cached_dashboard_suppliers', JSON.stringify(suppliersData));
      localStorage.setItem('dashboard_last_fetch', String(now));
    } catch (err) {
      console.error("Erro ao carregar dados de preços:", err);
    } finally {
      setIsPriceLoading(false);
    }
  };

  useEffect(() => {
    fetchPricingData();
    fetchPriceIncreases();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsChartReady(true);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Fetch xml_spendings with caching
  useEffect(() => {
    let active = true;
    const fetchSpendings = async () => {
      const cacheDuration = 30 * 1000 * 60; // 30 minutes cache for extreme read optimization
      const lastFetch = localStorage.getItem('xml_spendings_last_fetch');
      const cached = localStorage.getItem('cached_dashboard_xml_spendings');
      const now = Date.now();

      if (cached && lastFetch && (now - Number(lastFetch)) < cacheDuration) {
        if (active) {
          try {
            setXmlSpendings(JSON.parse(cached));
          } catch (e) {
            console.error("Erro ao fazer parse dos dados cacheados de gastos:", e);
          }
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      try {
        let items: any[] = [];
        try {
          const spendingsRes = await fetch('/api/xml/spendings');
          if (spendingsRes.ok) {
            items = await spendingsRes.json();
          } else {
            const errData = await spendingsRes.json().catch(() => ({}));
            throw new Error(`Backend spendings failed: ${errData.message || errData.error || spendingsRes.statusText}`);
          }
        } catch (backendErr) {
          console.warn("Falling back to client-side Firestore for spendings:", backendErr);
          const q = collection(db, 'xml_spendings');
          const snapshot = await getDocs(q);
          snapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() });
          });
        }

        if (active) {
          setXmlSpendings(items);
          localStorage.setItem('cached_dashboard_xml_spendings', JSON.stringify(items));
          localStorage.setItem('xml_spendings_last_fetch', String(now));
        }
      } catch (err: any) {
        console.error("Erro ao carregar dados XML de gastos:", err);
        if (cached && active) {
          try {
            setXmlSpendings(JSON.parse(cached));
          } catch (e) {
            console.error(e);
          }
        }
        handleFirestoreError(err, OperationType.GET, 'xml_spendings');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    fetchSpendings();
    return () => {
      active = false;
    };
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
            text: `Aviso: A nota com chave "${parsed.nfeKey}" do arquivo "${file.name}" já constava no sistema. Atualizando dados.` 
          });
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

          // Envia o XML para o endpoint central para extrair e armazenar os produtos e preços reais
          await fetch('/api/xml/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ xmlData: text })
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

    // Atualiza imediatamente o histórico de produtos e preços do XML
    await fetchPricingData(true);
    await fetchPriceIncreases();
  };

  const handleDeleteXmlSpending = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'xml_spendings', id));
      
      // Deleta também a fatura correspondente da API de faturas central
      try {
        await fetch(`/api/xml/invoices/${id}`, {
          method: 'DELETE'
        });
      } catch (apiErr) {
        console.error("Erro ao deletar fatura do banco de preços central:", apiErr);
      }

      await fetchPricingData(true);
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

  // Pricing Engine - Processes all invoices & suppliers to build price history and increases
  const priceAnalysis = useMemo(() => {
    return analyzePrices(invoices, suppliers);
  }, [invoices, suppliers]);

  const parsedSearchSuggestions = useMemo(() => {
    if (!priceSearchQuery.trim()) return [];
    const lower = priceSearchQuery.toLowerCase();
    return priceAnalysis.allProducts
      .filter(p => p.name.toLowerCase().includes(lower))
      .slice(0, 5);
  }, [priceSearchQuery, priceAnalysis]);

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

        {/* Tabela Temporária de Produtos com Aumento de Preço */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <div className="w-2.5 h-7 bg-amber-500 rounded-full animate-pulse" />
                Produtos com Aumento na Nota Atual
              </h2>
              <p className="text-slate-600 text-xs font-bold mt-1 uppercase tracking-wider">
                Comparação automática da última compra com a penúltima compra registrada para cada produto
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {selectedIncreases.length > 0 && (
                <button
                  onClick={handleBulkDeleteIncreases}
                  className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-black uppercase rounded-2xl transition-colors border-0 cursor-pointer font-bold"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir Selecionados ({selectedIncreases.length})
                </button>
              )}
              <button
                onClick={fetchPriceIncreases}
                disabled={isPriceIncreasesLoading}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-black uppercase rounded-2xl transition-colors border-0 cursor-pointer font-bold"
              >
                <RefreshCcw className={`w-3.5 h-3.5 ${isPriceIncreasesLoading ? 'animate-spin' : ''}`} />
                Atualizar Lista
              </button>
            </div>
          </div>

          {isPriceIncreasesLoading && priceIncreases.length === 0 ? (
            <div className="bg-slate-50 rounded-2xl p-8 text-center animate-pulse flex items-center justify-center">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Carregando aumentos...</span>
            </div>
          ) : priceIncreases.length === 0 ? (
            <div className="bg-slate-50 rounded-2xl p-10 text-center flex flex-col items-center justify-center border-2 border-dashed border-slate-200">
              <FileCheck2 className="w-12 h-12 text-slate-300" />
              <p className="text-slate-500 font-bold text-xs uppercase tracking-wide mt-3">Nenhum aumento pendente nesta lista</p>
              <p className="text-slate-400 text-[10px] uppercase tracking-wider mt-1">Os aumentos identificados nos próximos XMLs importados aparecerão aqui e persistirão até que você os exclua.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 pb-2">
                    <th className="py-3 pl-3 w-10">
                      <input
                        type="checkbox"
                        checked={priceIncreases.length > 0 && selectedIncreases.length === priceIncreases.length}
                        onChange={handleToggleSelectAll}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="text-[10px] font-black uppercase text-slate-400 py-3">Produto</th>
                    <th className="text-[10px] font-black uppercase text-slate-400 py-3">Fornecedor</th>
                    <th className="text-[10px] font-black uppercase text-slate-400 py-3 text-right">Preço Penúltimo</th>
                    <th className="text-[10px] font-black uppercase text-slate-400 py-3 text-right">Preço Último</th>
                    <th className="text-[10px] font-black uppercase text-slate-400 py-3 text-right">Aumento</th>
                    <th className="text-[10px] font-black uppercase text-slate-400 py-3 text-center">Data Importação</th>
                    <th className="text-[10px] font-black uppercase text-slate-400 py-3 text-right pr-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {priceIncreases.map((item) => {
                    let formattedDate = item.invoiceDate || "";
                    try {
                      if (formattedDate) {
                        const datePart = formattedDate.split('T')[0];
                        const parts = datePart.split('-');
                        if (parts.length === 3) {
                          formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                        }
                      }
                    } catch {}

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-3.5 pl-3">
                          <input
                            type="checkbox"
                            checked={selectedIncreases.includes(item.id)}
                            onChange={() => handleToggleSelect(item.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-3.5 pr-2">
                          <div className="font-bold text-slate-900 text-sm">
                            {item.productName}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">
                              CÓD: {item.productCode}
                            </span>
                            {item.alreadyImported && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                                NOTA JÁ IMPORTADA ANTERIORMENTE
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 text-slate-700 font-bold text-xs">
                          {item.supplierName}
                        </td>
                        <td className="py-3.5 text-right font-mono text-sm text-slate-500 font-bold">
                          {formatCurrency(item.oldPrice)}
                        </td>
                        <td className="py-3.5 text-right font-mono text-sm font-black text-slate-900">
                          {formatCurrency(item.newPrice)}
                        </td>
                        <td className="py-3.5 text-right">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-black tracking-tight">
                            <ArrowUpRight className="w-3.5 h-3.5 text-red-600 shrink-0" />
                            +{item.percentIncrease.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3.5 text-center text-slate-700 font-bold text-xs whitespace-nowrap">
                          {formattedDate}
                        </td>
                        <td className="py-3.5 text-right pr-3">
                          <button
                            onClick={() => handleDeleteIncrease(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all border-0 cursor-pointer bg-transparent"
                            title="Excluir da lista"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Painel de Análise de Preços de Produtos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* TOP 10 MAIORES AUMENTOS */}
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    <div className="w-2.5 h-6 bg-rose-600 rounded-full" />
                    Top 10 Maiores Aumentos (%)
                  </h2>
                  <p className="text-slate-500 text-[10px] font-bold mt-1 uppercase tracking-wider">
                    Produtos com maior aumento histórico baseado nos XMLs
                  </p>
                </div>
                {isPriceLoading && <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-black uppercase tracking-wider animate-pulse">Atualizando...</span>}
              </div>

              {priceAnalysis.topIncreases.length === 0 ? (
                <div className="bg-slate-50 rounded-2xl p-8 text-center flex flex-col items-center justify-center border-2 border-dashed border-slate-200">
                  <TrendingUp className="w-10 h-10 text-slate-300" />
                  <p className="text-slate-500 font-bold text-[11px] uppercase tracking-wide mt-2">Nenhum aumento de preço detectado ainda</p>
                  <p className="text-slate-400 text-[9px] uppercase tracking-wider mt-1">É necessário ter pelo menos 2 compras de um produto com preços diferentes para calcular a variação.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 pb-2">
                        <th className="text-[10px] font-black uppercase text-slate-400 py-3">Produto</th>
                        <th className="text-[10px] font-black uppercase text-slate-400 py-3 text-right">Preço Antigo</th>
                        <th className="text-[10px] font-black uppercase text-slate-400 py-3 text-right">Preço Novo</th>
                        <th className="text-[10px] font-black uppercase text-slate-400 py-3 text-right">Aumento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {priceAnalysis.topIncreases.map((prod, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="py-3.5 pr-2">
                            <div className="font-bold text-slate-900 text-sm lines-clamp-1 group-hover:text-indigo-700 transition-colors">
                              {prod.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                              {prod.suppliers[0] || 'Desconhecido'}
                            </div>
                          </td>
                          <td className="py-3.5 text-right font-mono text-sm text-slate-500">
                            {formatCurrency(prod.oldestPrice)}
                          </td>
                          <td className="py-3.5 text-right font-mono text-sm font-bold text-slate-900">
                            {formatCurrency(prod.currentPrice)}
                          </td>
                          <td className="py-3.5 text-right">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-black tracking-tight">
                              <ArrowUpRight className="w-3.5 h-3.5 text-red-600 shrink-0" />
                              +{prod.totalPercentChange.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            <div className="pt-4 border-t border-slate-50 flex justify-between items-center mt-6">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total analisado: {priceAnalysis.allProducts.length} produtos</span>
              <button 
                onClick={() => fetchPricingData(true)} 
                type="button" 
                disabled={isPriceLoading}
                className="flex items-center gap-1.5 text-[10px] font-black text-indigo-700 hover:text-indigo-950 uppercase cursor-pointer bg-transparent border-0 disabled:opacity-50 font-bold transition-colors"
              >
                <RefreshCcw className={`w-3 h-3 ${isPriceLoading ? 'animate-spin' : ''}`} />
                Sincronizar base
              </button>
            </div>
          </div>

          {/* SISTEMA DE PESQUISA E CONSULTA HISTÓRICA */}
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <div className="w-2.5 h-6 bg-indigo-700 rounded-full" />
                  Pesquisa Histórica de Preço
                </h2>
                <p className="text-slate-500 text-[10px] font-bold mt-1 uppercase tracking-wider">
                  Consulte a oscliação de qualquer produto nas últimas 5 compras
                </p>
              </div>

              {/* Barra de Busca de Preços */}
              <div className="relative mb-6">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="DIGITE O NOME DO PRODUTO PARA BUSCAR..."
                  value={priceSearchQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPriceSearchQuery(value);
                    if (!value) {
                      setSelectedProduct(null);
                      setShowSearchDropdown(false);
                    } else {
                      setShowSearchDropdown(true);
                    }
                  }}
                  onFocus={() => {
                    if (priceSearchQuery.trim()) {
                      setShowSearchDropdown(true);
                    }
                  }}
                  onBlur={() => {
                    // Small delay to allow clicking suggestions before hiding dropdown
                    setTimeout(() => {
                      setShowSearchDropdown(false);
                    }, 200);
                  }}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-850 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase tracking-wide transition-all"
                />

                {/* Dropdown de sugestões */}
                {showSearchDropdown && parsedSearchSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                    {parsedSearchSuggestions.map((prod, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault(); // Previne o desfoque imediato que causa o fechamento precoce do dropdown
                          setSelectedProduct(prod);
                          setPriceSearchQuery(prod.name);
                          setShowSearchDropdown(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0 flex justify-between items-center group cursor-pointer"
                      >
                        <div className="truncate max-w-[70%]">
                          <div className="font-bold text-slate-800 text-xs truncate group-hover:text-indigo-700">
                            {prod.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 truncate">
                            {prod.suppliers.join(', ')}
                          </div>
                        </div>
                        <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg whitespace-nowrap ${
                          prod.totalPercentChange > 0 
                            ? 'bg-red-50 text-red-700' 
                            : prod.totalPercentChange < 0 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : 'bg-slate-100 text-slate-600'
                        }`}>
                          {prod.totalPercentChange > 0 ? '+' : ''}
                          {prod.totalPercentChange.toFixed(1)}%
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tabela das 5 Últimas compras do produto selecionado */}
              {selectedProduct ? (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                    <div className="max-w-[70%]">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Produto Selecionado</div>
                      <div className="font-black text-slate-900 text-sm mt-0.5 truncate">{selectedProduct.name}</div>
                      <div className="text-[11px] text-slate-500 font-bold mt-1 uppercase truncate">Fornecedores: {selectedProduct.suppliers.join(', ')}</div>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Variação Geral</div>
                      <div className={`text-lg font-black tracking-tight mt-0.5 ${
                        selectedProduct.totalPercentChange > 0 
                          ? 'text-red-600' 
                          : selectedProduct.totalPercentChange < 0 
                            ? 'text-emerald-700' 
                            : 'text-slate-600'
                      }`}>
                        {selectedProduct.totalPercentChange > 0 ? '▲ +' : selectedProduct.totalPercentChange < 0 ? '▼ ' : ''}
                        {selectedProduct.totalPercentChange.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Histórico (Até 5 últimas compras)</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 pb-1">
                            <th className="text-[10px] font-black uppercase text-slate-400 py-2">Data</th>
                            <th className="text-[10px] font-black uppercase text-slate-400 py-2">Fornecedor</th>
                            <th className="text-[10px] font-black uppercase text-slate-400 py-2 text-right">Qtd</th>
                            <th className="text-[10px] font-black uppercase text-slate-400 py-2 text-right">Preço Un.</th>
                            <th className="text-[10px] font-black uppercase text-slate-400 py-2 text-right">Var %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {selectedProduct.history.slice(-5).reverse().map((hist: any, hIdx: number) => {
                            let formattedDate = hist.date;
                            try {
                              if (hist.date) {
                                const datePart = hist.date.split('T')[0];
                                const parts = datePart.split('-');
                                if (parts.length === 3) {
                                  formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                                }
                              }
                            } catch {}

                            return (
                              <tr key={hIdx} className="hover:bg-slate-50/35 transition-colors">
                                <td className="py-2.5 font-bold text-slate-800 text-xs whitespace-nowrap">{formattedDate}</td>
                                <td className="py-2.5 text-slate-600 text-xs truncate max-w-[120px]">{hist.supplierName}</td>
                                <td className="py-2.5 text-right text-slate-500 font-mono text-xs">{hist.quantity}</td>
                                <td className="py-2.5 text-right text-slate-900 font-mono font-bold text-sm">{formatCurrency(hist.price)}</td>
                                <td className="py-2.5 text-right pr-1">
                                  {hist.percentChange === 0 ? (
                                    <span className="text-xs font-black text-slate-400">-</span>
                                  ) : (
                                    <span className={`inline-flex items-center gap-0.5 text-xs font-black ${
                                      hist.percentChange > 0 
                                        ? 'text-red-600' 
                                        : 'text-emerald-700'
                                    }`}>
                                      {hist.percentChange > 0 ? (
                                        <>
                                          <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                          +{hist.percentChange.toFixed(1)}%
                                        </>
                                      ) : (
                                        <>
                                          <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                          {hist.percentChange.toFixed(1)}%
                                        </>
                                      )}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-2xl p-10 text-center flex flex-col items-center justify-center border-2 border-dashed border-slate-200">
                  <Search className="w-10 h-10 text-slate-300 animate-bounce" />
                  <p className="text-slate-500 font-bold text-[11px] uppercase tracking-wide mt-3">Pronto para pesquisar</p>
                  <p className="text-slate-400 text-[9px] uppercase tracking-wider mt-1">Busque qualquer produto acima para carregar o histórico de compras.</p>
                </div>
              )}
            </div>
            
            <div className="pt-4 border-t border-slate-50 flex justify-between items-center mt-6">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Dica: Selecione as sugestões rápidas enquanto digita</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
