import React, { useRef, useState } from 'react';
import { FileUp, Loader2, CheckCircle2 } from 'lucide-react';

export const ImportInvoicesView: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [updatedCount, setUpdatedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
                console.error("Error processing file:", file.name, error);
                setError(`Erro ao processar ${file.name}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }

    setImportedCount(imported);
    setUpdatedCount(updated);
    setIsUploading(false);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Importar Notas Fiscais (XML)</h1>
      <div 
        className="border-2 border-dashed border-slate-300 rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <FileUp className="w-12 h-12 text-indigo-500 mb-4" />
        <p className="text-lg font-medium text-slate-700">Clique para selecionar arquivos XML ou pastas</p>
        <p className="text-sm text-slate-500">Suporta múltiplos arquivos</p>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          multiple
          // Para selecionar pastas (pode nao ser suportado em todos navegadores igual)
          // webkitdirectory="" 
          // directory=""
        />
      </div>
      {error && (
        <div className="mt-6 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}
      {isUploading && (
        <div className="mt-6 flex items-center gap-2 text-indigo-600">
          <Loader2 className="animate-spin" />
          <span>Processando arquivos...</span>
        </div>
      )}
      {importedCount > 0 || updatedCount > 0 ? (
        <div className="mt-6 p-4 bg-green-50 text-green-700 rounded-lg border border-green-200">
          <CheckCircle2 className="inline mr-2" />
          <span>{importedCount} arquivos novos importados com sucesso!</span>
          {updatedCount > 0 && (
              <span className="block mt-1 text-sm font-medium text-teal-700">
                  {updatedCount} arquivos foram atualizados (já existiam no banco).
              </span>
          )}
        </div>
      ) : null}
    </div>
  );
};
