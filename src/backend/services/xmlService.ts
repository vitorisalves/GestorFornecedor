import { XMLParser } from 'fast-xml-parser';

export class XMLService {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_"
    });
  }

  private getQuantity(val: any): string {
    if (val === undefined || val === null) return "0";
    if (typeof val === 'object') {
      if ("#text" in val) return (val["#text"] || "").toString();
      // Try to return the first value found if it's an object but not #text
      const values = Object.values(val);
      if (values.length > 0) return this.getQuantity(values[0]);
    }
    return val.toString();
  }

  private extractQuantity(prod: any): number {
    if (!prod) return 0;
    
    // Check specific fields that might hold quantity
    const fields = ['qTrib', 'qCom', 'qUnid', 'qVol', 'qBC'];
    for (const field of fields) {
        if (field in prod) {
            const strVal = this.getQuantity(prod[field]);
            const parsed = parseFloat(strVal.replace(',', '.'));
            if (!isNaN(parsed) && parsed > 0) return parsed;
        }
    }

    // Fallback: scan all keys
    for (const key in prod) {
        if (key.toLowerCase().startsWith('q')) {
            const strVal = this.getQuantity(prod[key]);
            const parsed = parseFloat(strVal.replace(',', '.'));
            if (!isNaN(parsed) && parsed > 0) return parsed;
        }
    }
    
    return 0;
  }

  public parseNFe(xmlData: string) {
    const jsonObj = this.parser.parse(xmlData);
    
    // Find infNFe in deeply nested structure
    let nfe = jsonObj.nfeProc?.NFe?.infNFe || jsonObj.NFe?.infNFe;
    
    // Fallback search
    if (!nfe) {
        const findInfNFe = (obj: any): any => {
            if (obj && typeof obj === 'object') {
                if ('infNFe' in obj) return obj.infNFe;
                for (const key in obj) {
                    const res = findInfNFe(obj[key]);
                    if (res) return res;
                }
            }
            return null;
        }
        nfe = findInfNFe(jsonObj);
    }

    if (!nfe) {
        throw new Error("Não foi possível encontrar a estrutura infNFe no XML.");
    }

    const id = nfe["@_Id"] || (nfe.emit?.CNPJ ? `${nfe.emit.CNPJ}_${nfe.ide?.nNF}` : null) || nfe.ide?.nNF || `unknown_${Date.now()}`;
    const supplierName = nfe.emit?.xNome || "Desconhecido";
    const items = nfe.det;
    
    const products = Array.isArray(items) 
      ? items.map(item => {
          return {
              code: item.prod?.cProd || "N/A",
              name: item.prod?.xProd || "N/A",
              quantity: this.extractQuantity(item.prod),
              qTrib: this.getQuantity(item.prod?.qTrib)
          };
      })
      : items ? [{
          code: items.prod?.cProd || "N/A",
          name: items.prod?.xProd || "N/A",
          quantity: this.extractQuantity(items.prod),
          qTrib: this.getQuantity(items.prod?.qTrib)
        }] : [];

    return {
      id,
      supplierName,
      date: nfe.ide?.dhEmi || new Date().toISOString(),
      products
    };
  }
}
