import { Account, AccountType } from './types';

export const INITIAL_ACCOUNTS: Account[] = [
  { id: AccountType.CASH, name: 'Tiền mặt', balance: 0, color: 'bg-green-500', icon: 'payments' },
  { id: AccountType.MB, name: 'MB Bank (Khả dụng)', balance: 0, color: 'bg-blue-600', icon: 'account_balance' },
  { id: AccountType.TCB, name: 'Techcombank', balance: 0, color: 'bg-red-500', icon: 'credit_card' },
  { id: AccountType.SAVING, name: 'Tiết kiệm', balance: 0, color: 'bg-purple-500', icon: 'savings' },
  { id: AccountType.TET_SAVING, name: 'Tiết kiệm ăn Tết', balance: 0, color: 'bg-pink-500', icon: 'celebration' },
];

export const SPLIT_OPTIONS = [
  { id: 'SHARED', label: 'Chung (50/50)', icon: 'group', desc: 'Tôi trả, chia đôi' },
  { id: 'ME_ONLY', label: 'Tôi dùng', icon: 'person', desc: 'Tôi trả, tôi dùng' },
  { id: 'MEO_ONLY', label: 'Mèo dùng', icon: 'pets', desc: 'Tôi trả, Mèo dùng' },
  { id: 'MEO_PAID', label: 'Mèo chi', icon: 'price_check', desc: 'Mèo trả tiền cho tôi' },
];

export const MEO_NAME = "Mèo";
