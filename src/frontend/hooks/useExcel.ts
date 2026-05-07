/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import * as XLSX from 'xlsx';
import { Supplier, Product } from '../types';
import { generateId, extractErrorMessage } from '../utils';

export const useExcel = (suppliers: Supplier[], saveSupplier: (s: Supplier) => Promise<void>, addNotification: any) => {
  const handleExportExcel = () => {
    const exportData = suppliers.flatMap(supplier => 
      supplier.products.map(product => ({
        'Empresa Razão Social': supplier.name,
        'Telefone': supplier.phone,
        'Produto': product.name,
        'Preço': product.price,
        'Categoria': product.category,
        'Ultima Data Compra': product.lastPurchaseDate || '',
        'Forma de Pagamento': product.paymentMethod || ''
      }))
    );

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fornecedores");
    XLSX.writeFile(workbook, "Labarr_Fornecedores.xlsx");
    addNotification('Exportação concluída!', 0);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>, onDataLoaded: (data: Record<string, Supplier>) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (rawData.length === 0) {
          addNotification('Arquivo vazio ou inválido', 0);
          return;
        }

        const newSuppliersMap: Record<string, Supplier> = {};

        rawData.forEach((row: any) => {
          const findVal = (row: any, keywords: string[]) => {
            const keys = Object.keys(row);
            const match = keys.find(k => {
              const cleanK = k.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              return keywords.some(kw => {
                const cleanKW = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return cleanK === cleanKW || cleanK.includes(cleanKW);
              });
            });
            return match ? row[match] : null;
          };

          const sName = findVal(row, ['Empresa Razão Social', 'Fornecedor', 'Empresa', 'Razão Social', 'Nome da Empresa']);
          const sPhone = findVal(row, ['Telefone', 'WhatsApp', 'Celular', 'Contato']) || '';
          const pName = findVal(row, ['Produto', 'Nome', 'Nome do Produto', 'Descrição', 'Item']);
          
          let pPrice = 0;
          const rawPrice = findVal(row, ['Preço', 'Valor', 'Valor Unitário', 'Preço Unitário', 'Preço de Custo', 'Custo']);
          if (typeof rawPrice === 'number') {
            pPrice = rawPrice;
          } else if (rawPrice) {
            const strPrice = rawPrice.toString().trim();
            if (strPrice.includes(',')) {
              pPrice = parseFloat(strPrice.replace(/\./g, '').replace(',', '.'));
            } else {
              pPrice = parseFloat(strPrice);
            }
          }
          
          const pCat = findVal(row, ['Categoria', 'Grupo', 'Seção']) || 'Fornecedor';
          const pLastDate = findVal(row, ['Ultima Data Compra', 'Data Compra', 'Última Data', 'Data', 'Data de Compra', 'Ult. Compra']) || "";
          const pPayMethod = findVal(row, ['Forma de Pagamento', 'Pagamento', 'Pagto', 'Forma Pagto', 'Meio de Pagamento', 'Tipo de Pagamento']) || "";

          if ((sName || pName) && pName) {
            const finalSName = (sName || 'DIVERSOS').toString().trim().toUpperCase();
            if (finalSName === 'MERCADO' || finalSName === 'MATERIAIS') {
              return; // Ignora canais protegidos
            }

            if (!newSuppliersMap[finalSName]) {
              newSuppliersMap[finalSName] = {
                id: generateId(),
                name: finalSName,
                phone: sPhone.toString(),
                products: []
              };
            }
            newSuppliersMap[finalSName].products.push({
              name: pName.toString(),
              price: pPrice,
              category: pCat.toString(),
              lastPurchaseDate: pLastDate.toString(),
              paymentMethod: pPayMethod.toString()
            });
          }
        });

        onDataLoaded(newSuppliersMap);
        // Clear input value so same file can be selected again
        e.target.value = '';
      } catch (err) {
        console.error('Erro na importação:', extractErrorMessage(err));
        addNotification('Erro ao processar arquivo Excel', 0);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const performImport = async (data: Record<string, Supplier>, replace: boolean, deleteAllSuppliers: () => Promise<void>) => {
    try {
      if (replace) {
        await deleteAllSuppliers();
      }

      const existingNames = new Set(suppliers.map(s => s.name.trim().toUpperCase()));
      const importedSuppliers = Object.values(data);
      let addedCount = 0;

      for (const supplier of importedSuppliers) {
        // Se não for substituir, verificamos duplicatas pelo nome
        if (!replace && existingNames.has(supplier.name.trim().toUpperCase())) {
          continue;
        }
        await saveSupplier(supplier);
        addedCount++;
      }

      if (addedCount === 0 && !replace) {
        addNotification('Todos os fornecedores já existem na lista.', 0);
      } else {
        addNotification(replace ? 'Lista substituída com sucesso!' : 'Importação concluída com sucesso!', addedCount);
      }
    } catch (err) {
      console.error('Erro na execução da importação:', extractErrorMessage(err));
      addNotification('Erro ao salvar dados importados', 0);
    }
  };

  const handleSyncSheets = async (onDataLoaded: (data: Record<string, Supplier>) => void) => {
    try {
      addNotification('Sincronizando com Google Sheets...', 0);
      const response = await fetch('/api/excel-sync');
      if (!response.ok) throw new Error('Falha na resposta do servidor');
      
      const { data } = await response.json();
      if (!data || Object.keys(data).length === 0) {
        addNotification('Nenhum dado encontrado na planilha', 0);
        return;
      }

      // Garantir que todos os fornecedores tenham um ID
      const sanitizedData: Record<string, Supplier> = {};
      Object.entries(data).forEach(([name, supplier]: [string, any]) => {
        sanitizedData[name] = {
          ...supplier,
          id: supplier.id || generateId()
        };
      });

      onDataLoaded(sanitizedData);
    } catch (err) {
      console.error('Erro na sincronização:', extractErrorMessage(err));
      addNotification('Erro ao sincronizar com Google Sheets', 0);
    }
  };

  return {
    handleExportExcel,
    handleImportExcel,
    handleSyncSheets,
    performImport
  };
};
