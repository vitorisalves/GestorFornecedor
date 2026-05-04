/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import * as XLSX from 'xlsx';
import { Supplier, Product } from '../types';
import { generateId } from '../utils';

export const useExcel = (suppliers: Supplier[], saveSupplier: (s: Supplier) => Promise<void>, addNotification: any) => {
  const handleExportExcel = () => {
    const exportData = suppliers.flatMap(supplier => 
      supplier.products.map(product => ({
        'Empresa Razão Social': supplier.name,
        'Telefone': supplier.phone,
        'Produto': product.name,
        'Preço': product.price,
        'Categoria': product.category
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
          const sName = row['Empresa Razão Social'] || row['Fornecedor'] || row['Empresa'] || row['Razão Social'] || row['Nome da Empresa'];
          const sPhone = row['Telefone'] || row['WhatsApp'] || row['Celular'] || '';
          const pName = row['Produto'] || row['Nome'] || row['Nome do Produto'] || row['Descrição'];
          
          let pPrice = 0;
          const rawPrice = row['Preço'] || row['Valor'] || row['Valor Unitário'] || row['Preço Unitário'] || row['Preço de Custo'];
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
          
          const pCat = row['Categoria'] || row['Grupo'] || 'Fornecedor';

          if (sName && pName) {
            const trimmedName = sName.toString().trim().toUpperCase();
            if (trimmedName === 'MERCADO' || trimmedName === 'MATERIAIS') {
              return; // Ignora canais protegidos
            }

            if (!newSuppliersMap[sName]) {
              newSuppliersMap[sName] = {
                id: generateId(),
                name: sName,
                phone: sPhone,
                products: []
              };
            }
            newSuppliersMap[sName].products.push({
              name: pName,
              price: pPrice,
              category: pCat
            });
          }
        });

        onDataLoaded(newSuppliersMap);
        // Clear input value so same file can be selected again
        e.target.value = '';
      } catch (err) {
        console.error('Erro na importação:', err);
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
      console.error('Erro na execução da importação:', err);
      addNotification('Erro ao salvar dados importados', 0);
    }
  };

  return {
    handleExportExcel,
    handleImportExcel,
    performImport
  };
};
