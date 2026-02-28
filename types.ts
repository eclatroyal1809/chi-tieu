
export enum AccountType {
  CASH = 'CASH',
  MB = 'MB',
  TCB = 'TCB',
  SAVING = 'SAVING',
  TET_SAVING = 'TET_SAVING'
}

export enum SplitType {
  ME_ONLY = 'ME_ONLY', // Tôi dùng
  MEO_ONLY = 'MEO_ONLY', // Mèo dùng
  SHARED = 'SHARED', // Chung (50/50)
  MEO_PAID = 'MEO_PAID' // Mèo chi (Trả nợ)
}

export enum TransactionType {
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER',
  SETTLEMENT = 'SETTLEMENT', // Thanh toán nợ (Bill)
  INCOME = 'INCOME' // Thu nhập
}

export interface Account {
  id: AccountType;
  name: string;
  balance: number;
  color: string;
  icon: string;
}

export interface Transaction {
  id: string;
  date: string; // ISO string
  description: string;
  amount: number;
  accountId: AccountType; // From Account
  toAccountId?: AccountType; // To Account (only for transfers)
  splitType: SplitType;
  type: TransactionType;
  isSettled: boolean;
  settlementId?: string; // ID của Bill thanh toán (nếu đã trả)
}

export interface ShopProduct {
  id: string;
  shopId: string;
  name: string;
  originalPrice: number;
  sellingPrice: number;
  stock: number;
  importDate: string;
}

export interface ShopOrder {
  id: string;
  shopId: string;
  channel: string;
  name: string;
  phone: string;
  address: string;
  productId: string;
  qty: number;
  deposit: number;
  shipping: number;
  voucher: number;
  paymentFee: number;
  status: string;
  paymentMethod: string;
  totalAmount: number;
  netRevenue: number;
  date: string;
}

export interface ShopFinance {
  id: string;
  shopId: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string;
  category: string;
  date: string;
}
