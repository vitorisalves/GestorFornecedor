/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, FormEvent, KeyboardEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Phone, 
  Building2, 
  Package, 
  X, 
  Search,
  ChevronRight,
  UserPlus,
  Pencil,
  ShoppingCart,
  LayoutDashboard,
  LogOut,
  ArrowLeft,
  Minus,
  Check,
  ListChecks,
  History,
  Calendar,
  ChevronDown,
  ChevronUp,
  Settings,
  Tags,
  Download,
  Upload,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Product {
  name: string;
  price: number;
  category: string;
}

interface Supplier {
  id: string;
  name: string;
  phone: string;
  products: Product[];
}

interface CartItem extends Product {
  supplierName: string;
  quantity: number;
  bought?: boolean;
}

interface SavedList {
  id: string;
  name: string;
  date: string;
  items: CartItem[];
  total: number;
}

interface Notification {
  id: string;
  name: string;
  quantity: number;
}

interface AuthorizedUser {
  cpf: string;
  status: 'pending' | 'approved' | 'denied';
  requestDate: string;
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState<'suppliers' | 'shopping' | 'history'>('suppliers');
  const [loginCpf, setLoginCpf] = useState('');
  const [loggedCpf, setLoggedCpf] = useState('');
  const [loginError, setLoginError] = useState('');

  const [authorizedUsers, setAuthorizedUsers] = useState<AuthorizedUser[]>(() => {
    const saved = localStorage.getItem('labarr_authorized_users');
    return saved ? JSON.parse(saved) : [];
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem('labarr_suppliers');
    return saved ? JSON.parse(saved) : [];
  });
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('labarr_categories');
    return saved ? JSON.parse(saved) : ['Embalagens', 'Ingredientes', 'Limpeza', 'Escritório', 'Outros'];
  });
  const [isAdding, setIsAdding] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('labarr_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [savedLists, setSavedLists] = useState<SavedList[]>(() => {
    const saved = localStorage.getItem('labarr_lists');
    return saved ? JSON.parse(saved) : [];
  });
  const [listName, setListName] = useState('');
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);
  const [listToDelete, setListToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [shoppingQuantities, setShoppingQuantities] = useState<Record<string, number>>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');

  const productNameRef = useRef<HTMLInputElement>(null);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('labarr_suppliers', JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem('labarr_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('labarr_lists', JSON.stringify(savedLists));
  }, [savedLists]);

  useEffect(() => {
    localStorage.setItem('labarr_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('labarr_authorized_users', JSON.stringify(authorizedUsers));
  }, [authorizedUsers]);

  // Form state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  
  // Product Form state
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [productList, setProductList] = useState<Product[]>([]);
  const [editingProductIndex, setEditingProductIndex] = useState<number | null>(null);

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    const adminCpf = '05839352144';
    const cleanCpf = loginCpf.replace(/\D/g, '');

    if (cleanCpf.length !== 11) {
      setLoginError('CPF inválido. Digite os 11 números.');
      return;
    }

    if (cleanCpf === adminCpf) {
      setIsLoggedIn(true);
      setLoggedCpf(cleanCpf);
      setLoginError('');
      return;
    }

    const user = authorizedUsers.find(u => u.cpf === cleanCpf);

    if (user) {
      if (user.status === 'approved') {
        setIsLoggedIn(true);
        setLoggedCpf(cleanCpf);
        setLoginError('');
      } else if (user.status === 'pending') {
        setLoginError('Aguardando liberação do administrador.');
      } else {
        setLoginError('Seu acesso foi negado pelo administrador.');
      }
    } else {
      // New request
      const newUser: AuthorizedUser = {
        cpf: cleanCpf,
        status: 'pending',
        requestDate: new Date().toISOString()
      };
      setAuthorizedUsers([...authorizedUsers, newUser]);
      setLoginError('Solicitação enviada. Aguarde a liberação do administrador.');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setLoginCpf('');
    setLoggedCpf('');
  };

  const updateUserStatus = (cpf: string, status: 'approved' | 'denied') => {
    setAuthorizedUsers(prev => prev.map(u => u.cpf === cpf ? { ...u, status } : u));
  };

  const removeUserRequest = (cpf: string) => {
    setAuthorizedUsers(prev => prev.filter(u => u.cpf !== cpf));
  };

  const addProduct = () => {
    if (newProductName.trim() && newProductPrice && newProductCategory.trim()) {
      if (!categories.includes(newProductCategory.trim())) {
        addNotification('Selecione uma categoria válida', 0);
        return;
      }
      const product: Product = {
        name: newProductName.trim(),
        price: parseFloat(newProductPrice),
        category: newProductCategory.trim()
      };
      
      if (editingProductIndex !== null) {
        const updatedList = [...productList];
        updatedList[editingProductIndex] = product;
        setProductList(updatedList);
        setEditingProductIndex(null);
      } else {
        setProductList([...productList, product]);
      }
      
      setNewProductName('');
      setNewProductPrice('');
      setNewProductCategory('');
      productNameRef.current?.focus();
    }
  };

  const handleEditProduct = (index: number) => {
    const product = productList[index];
    setNewProductName(product.name);
    setNewProductPrice(product.price.toString());
    setNewProductCategory(product.category);
    setEditingProductIndex(index);
  };

  const removeProduct = (index: number) => {
    setProductList(productList.filter((_, i) => i !== index));
    if (editingProductIndex === index) {
      setEditingProductIndex(null);
      setNewProductName('');
      setNewProductPrice('');
      setNewProductCategory('');
    }
  };

  const handleAddSupplier = (e: FormEvent) => {
    e.preventDefault();
    if (!newName || !newPhone || productList.length === 0) return;

    if (editingSupplierId) {
      // Update existing supplier
      setSuppliers(suppliers.map(s => 
        s.id === editingSupplierId 
          ? { ...s, name: newName, phone: newPhone, products: productList }
          : s
      ));
    } else {
      // Create new supplier
      const supplier: Supplier = {
        id: crypto.randomUUID(),
        name: newName,
        phone: newPhone,
        products: productList,
      };
      setSuppliers([supplier, ...suppliers]);
    }

    resetForm();
    setIsAdding(false);
    setEditingSupplierId(null);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplierId(supplier.id);
    setNewName(supplier.name);
    setNewPhone(supplier.phone);
    setProductList(supplier.products);
    setIsAdding(true);
  };

  const resetForm = () => {
    setNewName('');
    setNewPhone('');
    setNewProductName('');
    setNewProductPrice('');
    setNewProductCategory('');
    setProductList([]);
    setEditingProductIndex(null);
    setEditingSupplierId(null);
  };

  const confirmDelete = () => {
    if (supplierToDelete) {
      setSuppliers(suppliers.filter(s => s.id !== supplierToDelete));
      setSupplierToDelete(null);
    }
  };

  const addNotification = (name: string, quantity: number) => {
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11));
    setNotifications(prev => [...prev, { id, name, quantity }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 2500);
  };

  const addToCart = (product: Product, supplierName: string, quantity: number = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.name === product.name && item.supplierName === supplierName);
      if (existing) {
        return prev.map(item => 
          (item.name === product.name && item.supplierName === supplierName)
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { ...product, supplierName, quantity, bought: false }];
    });
    addNotification(product.name, quantity);
  };

  const toggleSavedListItemBought = (listId: string, productName: string, supplierName: string) => {
    setSavedLists(prev => prev.map(list => {
      if (list.id === listId) {
        return {
          ...list,
          items: list.items.map(item => 
            (item.name === productName && item.supplierName === supplierName)
              ? { ...item, bought: !item.bought }
              : item
          )
        };
      }
      return list;
    }));
  };

  const updateCartQuantity = (productName: string, supplierName: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.name === productName && item.supplierName === supplierName) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (productName: string, supplierName: string) => {
    setCart(prev => prev.filter(item => !(item.name === productName && item.supplierName === supplierName)));
  };

  const clearCart = () => {
    setCart([]);
    setListName('');
    setEditingListId(null);
  };

  const finalizeList = () => {
    if (!listName.trim()) {
      addNotification('Dê um nome para a lista', 0);
      return;
    }

    const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const newList: SavedList = {
      id: editingListId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11)),
      name: listName.trim(),
      date: new Date().toLocaleString('pt-BR'),
      items: [...cart],
      total
    };

    if (editingListId) {
      setSavedLists(prev => prev.map(l => l.id === editingListId ? newList : l));
    } else {
      setSavedLists(prev => [newList, ...prev]);
    }

    setCart([]);
    setListName('');
    setEditingListId(null);
    setIsCartOpen(false);
    setCurrentPage('history');
    addNotification('Lista finalizada!', 1);
  };

  const editSavedList = (list: SavedList) => {
    setCart(list.items);
    setListName(list.name);
    setEditingListId(list.id);
    setIsCartOpen(true);
  };

  const deleteSavedList = (id: string) => {
    setListToDelete(id);
  };

  const confirmDeleteList = () => {
    if (listToDelete) {
      setSavedLists(prev => prev.filter(l => l.id !== listToDelete));
      setListToDelete(null);
    }
  };

  const handleAddCategory = () => {
    if (newCategoryName.trim() && !categories.includes(newCategoryName.trim())) {
      setCategories([...categories, newCategoryName.trim()]);
      setNewCategoryName('');
    }
  };

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

  const handleImportExcel = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
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

        rawData.forEach(row => {
          // Normalize keys (trim and handle case-insensitivity)
          const normalizedRow: any = {};
          Object.keys(row).forEach(key => {
            normalizedRow[key.trim()] = row[key];
          });

          const supplierName = normalizedRow['Empresa Razão Social'] || normalizedRow['Fornecedor'] || normalizedRow['Nome'];
          const phone = normalizedRow['Telefone'] || '';
          const productName = normalizedRow['Produto'] || normalizedRow['Nome do Produto'];
          const priceStr = normalizedRow['Valor Unitário'] || normalizedRow['Preço'] || normalizedRow['Valor'] || '0';
          const price = typeof priceStr === 'number' ? priceStr : parseFloat(priceStr.toString().replace(',', '.'));
          const category = normalizedRow['Categoria'] || 'Importado';

          if (!supplierName || !productName) return;

          const sName = supplierName.toString().trim();
          const pName = productName.toString().trim();

          if (!newSuppliersMap[sName]) {
            newSuppliersMap[sName] = {
              id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11)),
              name: sName,
              phone: phone.toString().trim(),
              products: []
            };
          }

          // Check for duplicate products within the same supplier in the import file
          if (!newSuppliersMap[sName].products.find(p => p.name === pName)) {
            newSuppliersMap[sName].products.push({
              name: pName,
              price: isNaN(price) ? 0 : price,
              category: category.toString().trim()
            });
          }
        });

        const importedSuppliers = Object.values(newSuppliersMap);
        if (importedSuppliers.length > 0) {
          setSuppliers(prev => {
            const merged = [...prev];
            importedSuppliers.forEach(imp => {
              const existingIdx = merged.findIndex(s => s.name.toLowerCase() === imp.name.toLowerCase());
              if (existingIdx >= 0) {
                const existingProducts = [...merged[existingIdx].products];
                imp.products.forEach(p => {
                  if (!existingProducts.find(ep => ep.name.toLowerCase() === p.name.toLowerCase())) {
                    existingProducts.push(p);
                  }
                });
                merged[existingIdx] = {
                  ...merged[existingIdx],
                  products: existingProducts,
                  phone: imp.phone || merged[existingIdx].phone
                };
              } else {
                merged.push(imp);
              }
            });
            return merged;
          });
          addNotification('Importação concluída!', importedSuppliers.length);
        } else {
          addNotification('Nenhum dado válido encontrado', 0);
        }
      } catch (error) {
        console.error('Erro na importação:', error);
        addNotification('Erro ao ler o arquivo', 0);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // Reset input
  };

  const handleProductKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addProduct();
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.products.some(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="bg-indigo-600 p-8 text-center">
            <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Labarr Gestor</h1>
            <p className="text-indigo-100 text-sm mt-1">Acesse sua conta para gerenciar</p>
          </div>
          
          <form onSubmit={handleLogin} className="p-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Digite seu CPF</label>
                <input 
                  type="text" 
                  maxLength={14}
                  value={loginCpf}
                  onChange={(e) => {
                    let val = e.target.value.replace(/\D/g, '');
                    if (val.length <= 11) {
                      // Simple mask
                      if (val.length > 9) val = val.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
                      else if (val.length > 6) val = val.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');
                      else if (val.length > 3) val = val.replace(/(\d{3})(\d{3})/, '$1.$2');
                      setLoginCpf(val);
                    }
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-center text-lg font-bold tracking-widest"
                  placeholder="000.000.000-00"
                />
              </div>
            </div>

            {loginError && (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-500 text-sm font-medium text-center"
              >
                {loginError}
              </motion.p>
            )}

            <button 
              type="submit"
              className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
            >
              Entrar no Sistema
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Labarr Gestor</h1>
            </div>
            
            <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setCurrentPage('suppliers')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${currentPage === 'suppliers' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Fornecedores
              </button>
              <button 
                onClick={() => setCurrentPage('shopping')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${currentPage === 'shopping' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <ShoppingCart className="w-4 h-4" />
                Compras
              </button>
              <button 
                onClick={() => setCurrentPage('history')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${currentPage === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <History className="w-4 h-4" />
                Histórico
              </button>
            </nav>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
              title="Lista de Compras"
            >
              <ListChecks className="w-6 h-6" />
              {cart.length > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                  {cart.length}
                </span>
              )}
            </button>

            {currentPage === 'suppliers' && (
              <button 
                onClick={() => setIsAdding(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Novo Fornecedor</span>
              </button>
            )}
            {loggedCpf === '05839352144' && (
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                title="Configurações"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {currentPage === 'suppliers' ? (
        <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Search and Stats */}
        <div className="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por nome ou produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          <div className="text-sm text-slate-500 font-medium">
            {suppliers.length} fornecedores cadastrados
          </div>
        </div>

        {/* Supplier List */}
        <div className="grid gap-6">
          <AnimatePresence mode="popLayout">
            {filteredSuppliers.length > 0 ? (
              filteredSuppliers.map((supplier) => (
                <motion.div
                  key={supplier.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-xl font-bold text-slate-800">{supplier.name}</h3>
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono">
                            ID: {supplier.id.slice(0, 8)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-indigo-500" />
                            {supplier.phone}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleEditSupplier(supplier)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Editar fornecedor"
                        >
                          <Pencil className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setSupplierToDelete(supplier.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Excluir fornecedor"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                        <Package className="w-3 h-3" />
                        Produtos e Detalhes
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {supplier.products.map((product, idx) => (
                          <div 
                            key={idx}
                            className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex flex-col gap-1"
                          >
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-slate-700 text-sm">{product.name}</span>
                              <span className="text-indigo-600 font-bold text-sm">
                                R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-tight bg-white px-1.5 py-0.5 rounded border border-slate-100 self-start">
                              {product.category}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300"
              >
                <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-medium text-slate-600">Nenhum fornecedor encontrado</h3>
                <p className="text-slate-400 text-sm mt-1">Comece adicionando um novo fornecedor ao sistema.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      ) : currentPage === 'shopping' ? (
        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Lista de Compras</h2>
              <p className="text-slate-500 text-sm">Todos os produtos disponíveis de todos os fornecedores</p>
            </div>
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar produtos ou fornecedores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Produto</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Categoria</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Fornecedor</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Preço</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.flatMap(s => s.products.map(p => ({ ...p, supplierName: s.name })))
                  .filter(item => 
                    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.category.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{item.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-tight bg-slate-100 px-2 py-1 rounded">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-slate-300" />
                          {item.supplierName}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-bold text-indigo-600">
                          R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                            <button 
                              onClick={() => {
                                const key = `${item.supplierName}-${item.name}`;
                                const current = shoppingQuantities[key] || 1;
                                setShoppingQuantities({ ...shoppingQuantities, [key]: Math.max(1, current - 1) });
                              }}
                              className="p-1 hover:bg-white rounded text-slate-500 transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input 
                              type="number"
                              min="1"
                              value={shoppingQuantities[`${item.supplierName}-${item.name}`] || 1}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                const key = `${item.supplierName}-${item.name}`;
                                setShoppingQuantities({ ...shoppingQuantities, [key]: isNaN(val) ? 1 : Math.max(1, val) });
                              }}
                              className="text-xs font-bold w-10 text-center bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button 
                              onClick={() => {
                                const key = `${item.supplierName}-${item.name}`;
                                const current = shoppingQuantities[key] || 1;
                                setShoppingQuantities({ ...shoppingQuantities, [key]: current + 1 });
                              }}
                              className="p-1 hover:bg-white rounded text-slate-500 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <button 
                            onClick={() => {
                              const qty = shoppingQuantities[`${item.supplierName}-${item.name}`] || 1;
                              addToCart({ name: item.name, price: item.price, category: item.category }, item.supplierName, qty);
                              // Reset quantity after adding
                              setShoppingQuantities({ ...shoppingQuantities, [`${item.supplierName}-${item.name}`]: 1 });
                            }}
                            className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-all shadow-sm flex items-center gap-1.5 text-xs font-bold"
                            title="Adicionar à lista"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            Add
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                {suppliers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center text-slate-400 italic">
                      Nenhum fornecedor cadastrado para listar produtos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      ) : (
        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800">Histórico de Listas</h2>
            <p className="text-slate-500 text-sm">Suas listas de compras finalizadas</p>
          </div>

          <div className="grid gap-4">
            {savedLists.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <History className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium">Nenhuma lista salva ainda</p>
                <p className="text-slate-400 text-sm mt-1">Finalize uma lista de compras para vê-la aqui.</p>
              </div>
            ) : (
              savedLists.map((list) => {
                const isConcluded = list.items.length > 0 && list.items.every(item => item.bought);
                
                return (
                  <motion.div 
                    key={list.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-white p-6 rounded-2xl border transition-all shadow-sm flex flex-col gap-6 ${isConcluded ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl transition-colors ${isConcluded ? 'bg-emerald-500 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                          {isConcluded ? <Check className="w-6 h-6" /> : <ListChecks className="w-6 h-6" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-bold text-slate-800">{list.name}</h3>
                            {isConcluded && (
                              <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Concluída
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {list.date}
                            </span>
                            <span>•</span>
                            <span>{list.items.length} itens</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between md:justify-end gap-6">
                        <div className="text-right">
                          <div className="text-xs text-slate-400 uppercase font-bold">Total</div>
                          <div className="text-lg font-bold text-indigo-600">
                            R$ {list.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => editSavedList(list)}
                            className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all"
                            title="Editar lista"
                          >
                            <Pencil className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => deleteSavedList(list.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Excluir lista"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-4 border-t border-slate-100">
                      {list.items.map((item, i) => (
                        <button
                          key={i}
                          onClick={() => toggleSavedListItemBought(list.id, item.name, item.supplierName)}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${item.bought ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100 hover:border-slate-200'}`}
                        >
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${item.bought ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300'}`}>
                            {item.bought && <Check className="w-3.5 h-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-bold truncate ${item.bought ? 'text-emerald-800 line-through' : 'text-slate-700'}`}>
                              {item.name}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <span>{item.quantity}x</span>
                              <span>•</span>
                              <span className="truncate">{item.supplierName}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </main>
      )}

      {/* Shopping List Sidebar */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-[80] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-6 h-6 text-indigo-600" />
                  <h2 className="text-xl font-bold text-slate-800">
                    {editingListId ? 'Editando Lista' : 'Minha Lista'}
                  </h2>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="p-4 bg-indigo-50/50 border-b border-slate-100">
                <label className="block text-[10px] uppercase font-bold text-indigo-400 mb-1 px-2">Nome da Lista</label>
                <input 
                  type="text"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && finalizeList()}
                  placeholder="Ex: Compra Semanal, Estoque Abril..."
                  className="w-full px-4 py-2 bg-white border border-indigo-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                />
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <ShoppingCart className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-medium">Sua lista está vazia</p>
                    <p className="text-slate-400 text-sm mt-1">Adicione produtos da página de compras.</p>
                  </div>
                ) : (
                  cart.map((item, idx) => (
                    <motion.div 
                      key={`${item.supplierName}-${item.name}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-4 rounded-2xl border border-slate-100 bg-slate-50 space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-slate-800">{item.name}</h4>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Building2 className="w-3 h-3" />
                            {item.supplierName}
                          </div>
                        </div>
                        <button 
                          onClick={() => removeFromCart(item.name, item.supplierName)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
                          <button 
                            onClick={() => updateCartQuantity(item.name, item.supplierName, -1)}
                            className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-500 transition-colors"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <input 
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val)) {
                                updateCartQuantity(item.name, item.supplierName, val - item.quantity);
                              }
                            }}
                            className="text-sm font-bold w-10 text-center bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button 
                            onClick={() => updateCartQuantity(item.name, item.supplierName, 1)}
                            className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-500 transition-colors"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-400">Total</div>
                          <div className="font-bold text-indigo-600">
                            R$ {(item.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-6 border-t border-slate-100 bg-slate-50 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Total da Lista</span>
                    <span className="text-2xl font-bold text-slate-800">
                      R$ {cart.reduce((acc, item) => acc + (item.price * item.quantity), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={clearCart}
                      className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-white transition-colors"
                    >
                      Limpar
                    </button>
                    <button 
                      onClick={finalizeList}
                      className="flex-1 px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      {editingListId ? 'Salvar Alterações' : 'Finalizar Lista'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Supplier Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h2 className="text-xl font-bold text-slate-800">
                  {editingSupplierId ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                </h2>
                <button 
                  onClick={() => {
                    setIsAdding(false);
                    resetForm();
                  }}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleAddSupplier} className="p-6 space-y-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Nome da Empresa
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        required
                        type="text" 
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Ex: Tech Solutions Ltda"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Telefone
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        required
                        type="tel" 
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-500" />
                    Adicionar Produtos
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-1">
                      <input 
                        ref={productNameRef}
                        type="text" 
                        value={newProductName}
                        onChange={(e) => setNewProductName(e.target.value)}
                        onKeyDown={handleProductKeyDown}
                        placeholder="Nome do produto"
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                      />
                    </div>
                    <div className="flex gap-2 md:col-span-2">
                      <input 
                        type="number" 
                        value={newProductPrice}
                        onChange={(e) => setNewProductPrice(e.target.value)}
                        onKeyDown={handleProductKeyDown}
                        placeholder="Preço (R$)"
                        className="w-24 px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                      />
                      <input 
                        list="category-list"
                        value={newProductCategory}
                        onChange={(e) => setNewProductCategory(e.target.value)}
                        onKeyDown={handleProductKeyDown}
                        placeholder="Categoria"
                        className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                      />
                      <datalist id="category-list">
                        {categories.map(cat => (
                          <option key={cat} value={cat} />
                        ))}
                      </datalist>
                      <button 
                        type="button"
                        onClick={addProduct}
                        className={`${editingProductIndex !== null ? 'bg-amber-500' : 'bg-indigo-600'} text-white p-2 rounded-xl hover:opacity-90 transition-colors shadow-lg shadow-indigo-500/20`}
                      >
                        {editingProductIndex !== null ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {productList.length === 0 ? (
                      <div className="text-center py-4 text-slate-400 text-sm italic">
                        Nenhum produto adicionado à lista
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        {productList.map((product, index) => (
                          <motion.div 
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            key={index}
                            className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 font-bold text-xs">
                                {index + 1}
                              </div>
                              <div>
                                <div className="text-sm font-bold text-slate-700">{product.name}</div>
                                <div className="text-[10px] text-slate-400 uppercase font-bold">{product.category}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-sm font-bold text-indigo-600">R$ {product.price.toFixed(2)}</span>
                              <div className="flex items-center gap-1">
                                <button 
                                  type="button"
                                  onClick={() => handleEditProduct(index)}
                                  className="p-1.5 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => removeProduct(index)}
                                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4 sticky bottom-0 bg-white pb-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!newName || !newPhone || productList.length === 0}
                  >
                    {editingSupplierId ? 'Atualizar Fornecedor' : 'Salvar Fornecedor'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {supplierToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSupplierToDelete(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Excluir Fornecedor?</h2>
              <p className="text-slate-500 text-sm mb-8">
                Esta ação não pode ser desfeita. Todos os dados deste fornecedor serão removidos permanentemente.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setSupplierToDelete(null)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* List Delete Confirmation Modal */}
      <AnimatePresence>
        {listToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setListToDelete(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Excluir Lista?</h2>
              <p className="text-slate-500 text-sm mb-8">
                Esta ação removerá permanentemente esta lista do seu histórico.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setListToDelete(null)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDeleteList}
                  className="flex-1 px-4 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-xl font-bold text-slate-800">Configurações</h2>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Tags className="w-4 h-4 text-indigo-500" />
                    Gerenciar Categorias
                  </h3>
                  
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                      placeholder="Nova categoria..."
                      className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                    />
                    <button 
                      onClick={handleAddCategory}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20 text-sm font-bold"
                    >
                      Adicionar
                    </button>
                  </div>

                  <div className="grid gap-2">
                    {categories.map((cat, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm group"
                      >
                        <span className="text-sm font-medium text-slate-700">{cat}</span>
                        <button 
                          onClick={() => setCategories(categories.filter((_, i) => i !== index))}
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
                    Dados (Excel)
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={handleExportExcel}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-white transition-all text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Exportar
                    </button>
                    <label className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all text-sm cursor-pointer shadow-lg shadow-indigo-500/20">
                      <Upload className="w-4 h-4" />
                      Importar
                      <input 
                        type="file" 
                        accept=".xlsx, .xls" 
                        className="hidden" 
                        onChange={handleImportExcel}
                      />
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                    O arquivo deve conter as colunas:<br/>
                    <span className="font-bold">Empresa Razão Social</span>, <span className="font-bold">Produto</span>, <span className="font-bold">Telefone</span> e <span className="font-bold">Valor Unitário</span>.
                  </p>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-indigo-500" />
                    Gerenciar Acessos
                  </h3>
                  
                  <div className="space-y-2">
                    {authorizedUsers.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4 italic">Nenhuma solicitação de acesso.</p>
                    ) : (
                      authorizedUsers.map((user) => (
                        <div 
                          key={user.cpf}
                          className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100"
                        >
                          <div>
                            <div className="text-sm font-bold text-slate-700">
                              {user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(user.requestDate).toLocaleDateString()}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            {user.status === 'pending' ? (
                              <>
                                <button 
                                  onClick={() => updateUserStatus(user.cpf, 'approved')}
                                  className="p-1.5 bg-emerald-100 text-emerald-600 hover:bg-emerald-200 rounded-lg transition-all"
                                  title="Aprovar"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => updateUserStatus(user.cpf, 'denied')}
                                  className="p-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-all"
                                  title="Negar"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                                  user.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                                }`}>
                                  {user.status === 'approved' ? 'Aprovado' : 'Negado'}
                                </span>
                                <button 
                                  onClick={() => removeUserRequest(user.cpf)}
                                  className="p-1.5 text-slate-300 hover:text-slate-500 hover:bg-slate-200 rounded-lg transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className="bg-white border border-slate-200 shadow-xl rounded-2xl p-4 flex items-center gap-4 min-w-[240px] pointer-events-auto"
            >
              <div className="bg-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center text-white">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  {n.quantity > 0 ? 'Adicionado' : 'Aviso'}
                </div>
                <div className="text-sm font-bold text-slate-800 line-clamp-1">{n.name}</div>
              </div>
              {n.quantity > 0 && (
                <div className="bg-slate-100 px-2 py-1 rounded-lg text-xs font-bold text-slate-600">
                  x{n.quantity}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
