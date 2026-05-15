/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  name: string;
  price: number;
  category: string;
  lastPurchaseDate?: string;
  paymentMethod?: string;
}

export interface Supplier {
  id?: string;
  name: string;
  phone: string;
  products: Product[];
}

export interface UINotification {
  id: string;
  name: string;
  quantity: number;
  type?: 'cart' | 'info';
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
}

export interface CartItem extends Product {
  supplierName: string;
  quantity: number;
}

export interface SavedList {
  id: string;
  name: string;
  date: string;
  items: (Product & { supplierName: string; bought: boolean; quantity: number, deliveryId?: string })[];
  total: number;
  shippingFee: number;
  createdBy?: string;
}

export interface DeliveredProduct {
  id: string;
  name: string;
  supplierName: string;
  purchaseDate: string;
  delivered: boolean;
  deliveryDate?: string;
  forecastDate?: string;
  quantity?: number;
  deliveryTimeDays?: number;
}

export interface Reminder {
  id: string;
  productName: string;
  date: string;
  notified: boolean;
}

export interface AuthorizedUser {
  uid?: string;
  cpf: string;
  name: string;
  status: 'pending' | 'approved' | 'denied';
  requestDate?: string;
  lastLogin?: string;
  role?: 'admin' | 'user';
}
