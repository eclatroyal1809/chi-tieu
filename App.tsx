import React, { useState, useEffect } from 'react';
import { AccountType, Account, Transaction, SplitType, TransactionType } from './types';
import { INITIAL_ACCOUNTS, SPLIT_OPTIONS, MEO_NAME } from './constants';
import { AccountCard } from './components/AccountCard';
import { BillGenerator } from './components/BillGenerator';
import { MonthlyStats } from './components/MonthlyStats';
import { QRScannerModal } from './components/QRScannerModal';
import * as supabaseService from './services/supabaseService';
import { supabase } from './supabaseClient';
import { motion, AnimatePresence } from 'motion/react';
import DatePicker from 'react-datepicker';
import { vi } from 'date-fns/locale';

const formatShortWeekday = (nameOfDay: string) => {
    const name = nameOfDay.toLowerCase();
    if (name.includes('cn') || name.includes('chủ nhật') || name.includes('chủ')) return 'CN';
    if (name.includes('hai') || name.includes('2')) return 'T2';
    if (name.includes('ba') || name.includes('3')) return 'T3';
    if (name.includes('tư') || name.includes('4')) return 'T4';
    if (name.includes('năm') || name.includes('5')) return 'T5';
    if (name.includes('sáu') || name.includes('6')) return 'T6';
    if (name.includes('bảy') || name.includes('7')) return 'T7';
    return name.substring(0, 2).toUpperCase();
};

export default function App() {
  // State
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  // Active Tab - 3 tabs: Home, History, Shop
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'shop'>('home');
  const [historyFilter, setHistoryFilter] = useState<'MEO' | 'ME' | 'BILL'>('MEO');
  
  const [showBill, setShowBill] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  
  // Delete Confirmation State
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);

  // Edit Transaction State
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDate, setEditDate] = useState<Date>(new Date());

  // State for viewing history bill
  const [viewingBill, setViewingBill] = useState<{
      transactions: Transaction[],
      date: string,
      totalPaid: number
  } | null>(null);

  // Quick Add State (Home)
  const [qaType, setQaType] = useState<TransactionType.EXPENSE | TransactionType.INCOME>(TransactionType.EXPENSE);
  const [qaAmount, setQaAmount] = useState('');
  const [qaDesc, setQaDesc] = useState('');
  const [qaAccount, setQaAccount] = useState<AccountType>(AccountType.MB);
  const [qaSplit, setQaSplit] = useState<SplitType>(SplitType.SHARED);
  const [qaDate, setQaDate] = useState<Date>(new Date());

  // Transfer State
  const [transferAmount, setTransferAmount] = useState('');
  const [transferFrom, setTransferFrom] = useState<AccountType>(AccountType.MB);
  const [transferTo, setTransferTo] = useState<AccountType>(AccountType.CASH);

  // Shop State
  const [activeShop] = useState<string>('elank');
  const [shopView, setShopView] = useState<'finance' | 'orders' | 'inventory'>('finance');

  const [products, setProducts] = useState<any[]>([]);
  const [combos, setCombos] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [shopFinances, setShopFinances] = useState<any[]>([]);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editProdForm, setEditProdForm] = useState({ name: '', originalPrice: '', sellingPrice: '' });

  const [invForm, setInvForm] = useState({ name: '', originalPrice: '', sellingPrice: '', stock: '1', date: new Date(), accountId: AccountType.MB });
  const [ordForm, setOrdForm] = useState({ channel: 'Shopee', name: '', phone: '', address: '', productId: '', qty: '1', deposit: '', depositAccountId: AccountType.MB, shipping: '', voucher: '', paymentFee: '', status: 'Chưa Gửi Hàng', paymentMethod: 'Đang Thanh Toán' });
  const [financeToDelete, setFinanceToDelete] = useState<string|null>(null);
  const [ordItems, setOrdItems] = useState<{productId: string, qty: string, price?: string, comboId?: string, isCombo?: boolean}[]>([
    { productId: '', qty: '1', price: '' },
    { productId: '', qty: '1', price: '' }
  ]);
  const [finForm, setFinForm] = useState({ type: 'INCOME', amount: '', desc: '', category: 'Khác', date: new Date(), accountId: AccountType.MB });
  
  const [orderTab, setOrderTab] = useState<'list' | 'create'>('list');

  const BASE_FEE = 0;

  // Initial Data Fetching
  useEffect(() => {
    const loadData = async () => {
        setIsLoading(true);
        
        if ((supabase as any).supabaseUrl && (supabase as any).supabaseUrl.includes('your-project')) {
             setConfigError("Vui lòng cấu hình Supabase URL và Key trong file supabaseClient.ts hoặc biến môi trường.");
             setIsLoading(false);
             return;
        }

        try {
            await supabaseService.seedAccountsIfEmpty(INITIAL_ACCOUNTS);
            
            const [fetchedAccounts, fetchedTransactions, fetchedShopProducts, fetchedShopCombos, fetchedShopOrders, fetchedShopFinances] = await Promise.all([
                supabaseService.getAccounts(),
                supabaseService.getTransactions(),
                supabaseService.getShopProducts(),
                supabaseService.getShopCombos(activeShop).catch(() => []),
                supabaseService.getShopOrders(),
                supabaseService.getShopFinances()
            ]);

            // Filter out TET_SAVING completely as requested
            const cleanAccounts = fetchedAccounts.filter(a => a.id !== AccountType.TET_SAVING);
            setAccounts(cleanAccounts);
            setTransactions(fetchedTransactions);
            setProducts(fetchedShopProducts);
            setCombos(fetchedShopCombos);
            setOrders(fetchedShopOrders);
            setShopFinances(fetchedShopFinances);
        } catch (error) {
            console.error("Failed to load data from Supabase:", error);
            setConfigError("Không thể kết nối đến dữ liệu. Vui lòng kiểm tra cấu hình Supabase.");
        } finally {
            setIsLoading(false);
        }
    };

    loadData();
  }, [activeShop]);

  // Derived Values
  const totalBalance = accounts
    .filter(a => a.id !== AccountType.TET_SAVING)
    .reduce((acc, curr) => acc + curr.balance, 0);
  
  const transactionDebt = transactions
    .filter(t => !t.isSettled && t.type !== TransactionType.TRANSFER && t.type !== TransactionType.SETTLEMENT)
    .reduce((sum, t) => {
      if (t.type === TransactionType.EXPENSE) {
          if (t.splitType === SplitType.MEO_ONLY) return sum + t.amount;
          if (t.splitType === SplitType.SHARED) return sum + (t.amount / 2);
          if (t.splitType === SplitType.MEO_PAID) return sum - t.amount;
      }
      if (t.type === TransactionType.INCOME && t.splitType === SplitType.MEO_PAID) {
          return sum - t.amount;
      }
      return sum;
    }, 0);
  
  const meoDebt = transactionDebt - BASE_FEE;
  const isCredit = meoDebt < 0; 

  // Helpers
  const formatNumberInput = (value: string) => {
    const raw = value.replace(/\D/g, '');
    if (!raw) return '';
    return new Intl.NumberFormat('vi-VN').format(parseInt(raw, 10));
  };

  const parseSmartAmount = (val: string): number => {
    let clean = val.replace(/\./g, '').replace(/,/g, '').replace(/\D/g, ''); 
    if (!clean) return 0;
    let num = parseInt(clean, 10);
    if (num > 0 && num < 1000) {
        return num * 1000;
    }
    return num;
  };

  // Smart Amount Suggestions generator
  // Ví dụ: nhập 1 -> 1.000, 10.000, 100.000, 1.000.000
  // nhập 10 -> 10.000, 100.000, 1.000.000, 10.000.000
  const getAmountSuggestions = (val: string): number[] => {
    const raw = val.replace(/\D/g, '');
    if (!raw) {
      return [20000, 50000, 100000, 200000, 500000];
    }
    const n = parseInt(raw, 10);
    if (isNaN(n) || n <= 0) return [];

    const list: number[] = [];
    if (n < 1000) {
      list.push(n * 1000);
      list.push(n * 10000);
      list.push(n * 100000);
      if (n * 1000000 <= 100000000) {
        list.push(n * 1000000);
      }
    } else if (n < 100000) {
      list.push(n);
      list.push(n * 10);
      list.push(n * 100);
    } else {
      list.push(n);
    }
    return Array.from(new Set(list)).filter(v => v <= 1000000000);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const formatShortCurrency = (amount: number) => {
     if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'tr';
     if (amount >= 1000) return (amount / 1000).toFixed(0) + 'k';
     return amount;
  };

  const groupTransactionsByDate = (txs: Transaction[]) => {
      const groups: { [key: string]: Transaction[] } = {};
      txs.forEach(tx => {
          const date = new Date(tx.date);
          const today = new Date();
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);

          let key = date.toLocaleDateString('vi-VN');
          if (date.toDateString() === today.toDateString()) key = 'Hôm nay';
          else if (date.toDateString() === yesterday.toDateString()) key = 'Hôm qua';
          
          if (!groups[key]) groups[key] = [];
          groups[key].push(tx);
      });
      return groups;
  };

  // Logic Handlers
  const handleUpdateBalance = async (id: string, newBalance: number) => {
    try {
        await supabaseService.updateAccountBalance(id, newBalance);
        setAccounts(prev => prev.map(acc => acc.id === id ? { ...acc, balance: newBalance } : acc));
    } catch (error) {
        console.error("Error updating balance", error);
        alert("Có lỗi khi cập nhật số dư!");
    }
  };

  const handleDeleteTransaction = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    if (tx.isSettled && tx.type !== TransactionType.SETTLEMENT && tx.type !== TransactionType.INCOME) {
        alert('Giao dịch này đã được quyết toán. Vui lòng xoá Hoá đơn thanh toán tương ứng trước.');
        return;
    }

    setDeletingTx(tx);
  };

  const confirmDelete = async () => {
    if (!deletingTx) return;
    const { id, amount, accountId, toAccountId, type, splitType } = deletingTx;

    const updates: { id: string, amount: number }[] = [];
    const getAccountBalance = (accId: string) => accounts.find(a => a.id === accId)?.balance || 0;

    if (type === TransactionType.TRANSFER && toAccountId) {
        updates.push({ id: accountId, amount: getAccountBalance(accountId) + amount });
        updates.push({ id: toAccountId, amount: getAccountBalance(toAccountId) - amount });
    } else {
        let newBalance = getAccountBalance(accountId);
        if (type === TransactionType.INCOME || type === TransactionType.SETTLEMENT) {
            newBalance -= amount;
        } else if (type === TransactionType.EXPENSE) {
             if (splitType !== SplitType.MEO_PAID) {
                 newBalance += amount;
             }
        }
        updates.push({ id: accountId, amount: newBalance });
    }

    try {
        for (const update of updates) {
            await supabaseService.updateAccountBalance(update.id, update.amount);
        }
        await supabaseService.deleteTransaction(id);

        if (type === TransactionType.SETTLEMENT) {
            await supabaseService.updateTransactionsAsUnsettled(id);
            setTransactions(prev => prev.map(t => {
                if (t.settlementId === id) {
                    return { ...t, isSettled: false, settlementId: undefined };
                }
                return t;
            }).filter(t => t.id !== id));
        } else {
            setTransactions(prev => prev.filter(t => t.id !== id));
        }

        setAccounts(prev => prev.map(acc => {
            const update = updates.find(u => u.id === acc.id);
            return update ? { ...acc, balance: update.amount } : acc;
        }));
    } catch (error) {
        console.error("Error deleting transaction", error);
        alert("Có lỗi khi xoá giao dịch!");
    }
    setDeletingTx(null);
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTx(tx);
    setEditAmount(tx.amount.toString());
    setEditDesc(tx.description);
    setEditDate(new Date(tx.date));
  };

  const confirmEdit = async () => {
    if (!editingTx) return;
    
    const newAmount = parseSmartAmount(editAmount);
    if (newAmount <= 0 || !editDesc.trim()) {
        alert("Vui lòng nhập đầy đủ thông tin hợp lệ!");
        return;
    }

    const { id, amount: oldAmount, accountId, type, splitType } = editingTx;
    const amountDiff = newAmount - oldAmount;
    
    const updates: { id: string, amount: number }[] = [];
    const getAccountBalance = (accId: string) => accounts.find(a => a.id === accId)?.balance || 0;

    if (amountDiff !== 0 && type !== TransactionType.TRANSFER) {
        let newBalance = getAccountBalance(accountId);
        if (type === TransactionType.INCOME || type === TransactionType.SETTLEMENT) {
            newBalance += amountDiff;
        } else if (type === TransactionType.EXPENSE) {
            if (splitType !== SplitType.MEO_PAID) {
                newBalance -= amountDiff;
            }
        }
        updates.push({ id: accountId, amount: newBalance });
    } else if (amountDiff !== 0 && type === TransactionType.TRANSFER) {
        alert("Không hỗ trợ sửa số tiền chuyển khoản. Vui lòng xoá và tạo lại.");
        return;
    }

    const updatedTx: Transaction = {
        ...editingTx,
        amount: newAmount,
        description: editDesc,
        date: editDate.toISOString()
    };

    try {
        for (const update of updates) {
            await supabaseService.updateAccountBalance(update.id, update.amount);
        }
        await supabaseService.updateTransaction(updatedTx);

        setTransactions(prev => prev.map(t => t.id === id ? updatedTx : t));
        if (updates.length > 0) {
            setAccounts(prev => prev.map(acc => {
                const update = updates.find(u => u.id === acc.id);
                return update ? { ...acc, balance: update.amount } : acc;
            }));
        }
        setEditingTx(null);
    } catch (error) {
        console.error("Error updating transaction", error);
        alert("Có lỗi khi cập nhật giao dịch!");
    }
  };

  // Mèo nạp quỹ 300k
  const handleMeoDeposit = async () => {
    const AMOUNT = 300000;
    const mbAcc = accounts.find(a => a.id === AccountType.MB);
    if (!mbAcc) {
        alert("Không tìm thấy ví MB Bank!");
        return;
    }

    if (!window.confirm("Xác nhận Mèo nạp quỹ 300.000đ vào MB Bank?")) return;

    const newTx: Transaction = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        description: "Mèo đóng quỹ",
        amount: AMOUNT,
        accountId: AccountType.MB,
        splitType: SplitType.MEO_PAID,
        type: TransactionType.INCOME,
        isSettled: false
    };

    const newBalance = mbAcc.balance + AMOUNT;

    try {
        await Promise.all([
            supabaseService.addTransaction(newTx),
            supabaseService.updateAccountBalance(AccountType.MB, newBalance)
        ]);
        setTransactions(prev => [newTx, ...prev]);
        setAccounts(prev => prev.map(a => a.id === AccountType.MB ? {...a, balance: newBalance} : a));
    } catch (e) {
        console.error("Lỗi nạp quỹ", e);
        alert("Lỗi kết nối khi nạp quỹ.");
    }
  };

  const handleQuickAdd = async () => {
    if (!qaDesc || !qaAmount) return;

    const amountVal = parseSmartAmount(qaAmount);
    if (amountVal <= 0) return;

    const newTx: Transaction = {
        id: Date.now().toString(),
        date: qaDate.toISOString(),
        description: qaDesc,
        amount: amountVal,
        accountId: qaAccount,
        splitType: qaType === TransactionType.INCOME ? SplitType.ME_ONLY : qaSplit,
        type: qaType,
        isSettled: qaType === TransactionType.INCOME ? true : false
    };

    const currentAcc = accounts.find(a => a.id === qaAccount);
    if (!currentAcc) return;

    let newBalance = currentAcc.balance;
    if (qaType === TransactionType.INCOME) {
        newBalance += amountVal;
    } else {
        if (qaSplit !== SplitType.MEO_PAID) {
             newBalance -= amountVal;
        }
    }

    try {
        const promises: Promise<any>[] = [supabaseService.addTransaction(newTx)];
        if (newBalance !== currentAcc.balance) {
            promises.push(supabaseService.updateAccountBalance(qaAccount, newBalance));
        }

        await Promise.all(promises);

        setTransactions(prev => [newTx, ...prev]);
        setAccounts(prev => prev.map(acc => 
            acc.id === qaAccount ? { ...acc, balance: newBalance } : acc
        ));

        setQaDesc('');
        setQaAmount('');
        setQaSplit(SplitType.SHARED);
        setQaDate(new Date());
    } catch (error) {
        console.error("Error adding transaction", error);
        alert("Lỗi kết nối. Vui lòng thử lại.");
    }
  };

  // Standardized internal transfer without TET_SAVING
  const handleTransfer = async () => {
    const amountVal = parseSmartAmount(transferAmount);
    if (amountVal <= 0) return;
    if (transferFrom === transferTo) return;

    const fromAcc = accounts.find(a => a.id === transferFrom);
    const toAcc = accounts.find(a => a.id === transferTo);
    if (!fromAcc || !toAcc) return;

    const newTx: Transaction = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      description: `Chuyển tiền: ${fromAcc.name} → ${toAcc.name}`,
      amount: amountVal,
      accountId: transferFrom,
      toAccountId: transferTo,
      splitType: SplitType.ME_ONLY,
      type: TransactionType.TRANSFER,
      isSettled: true
    };

    const newFromBalance = fromAcc.balance - amountVal;
    const newToBalance = toAcc.balance + amountVal;

    try {
        await Promise.all([
            supabaseService.addTransaction(newTx),
            supabaseService.updateAccountBalance(transferFrom, newFromBalance),
            supabaseService.updateAccountBalance(transferTo, newToBalance)
        ]);

        setTransactions(prev => [newTx, ...prev]);
        setAccounts(prev => prev.map(acc => {
            if (acc.id === transferFrom) return { ...acc, balance: newFromBalance };
            if (acc.id === transferTo) return { ...acc, balance: newToBalance };
            return acc;
        }));

        setTransferAmount('');
        setShowTransfer(false);
    } catch (error) {
        console.error("Error transferring", error);
        alert("Lỗi chuyển tiền.");
    }
  };

  const handleLogQRTransfer = async (data: {
    amount: number;
    description: string;
    account: AccountType;
    splitType: SplitType;
    date: Date;
  }) => {
    try {
      const newTx: Transaction = {
        id: 'qr-' + Date.now().toString(),
        date: data.date.toISOString(),
        description: data.description,
        amount: data.amount,
        accountId: data.account,
        splitType: data.splitType,
        type: TransactionType.EXPENSE,
        isSettled: false
      };
      await supabaseService.addTransaction(newTx);
      const targetAcc = accounts.find(a => a.id === data.account);
      if (targetAcc) {
        let newBal = targetAcc.balance;
        if (data.splitType !== SplitType.MEO_PAID) {
          newBal -= data.amount;
        }
        await supabaseService.updateAccountBalance(data.account, newBal);
        setAccounts(prev => prev.map(a => a.id === data.account ? { ...a, balance: newBal } : a));
      }
      setTransactions(prev => [newTx, ...prev]);
    } catch (err) {
      console.error("Error logging QR transfer:", err);
    }
  };

  const handleSettleDebts = async (txIds: string[], finalPayment: number, surplus: number) => {
    const settlementId = 'settle-' + Date.now().toString();
    const newTransactions: Transaction[] = [];

    if (finalPayment > 0) {
        newTransactions.push({
            id: settlementId,
            date: new Date().toISOString(),
            description: `Mèo thanh toán nợ`,
            amount: finalPayment,
            accountId: AccountType.MB,
            splitType: SplitType.MEO_PAID, 
            type: TransactionType.SETTLEMENT,
            isSettled: true
        });
    }

    if (surplus !== 0) {
        newTransactions.push({
            id: 'surplus-' + Date.now().toString(),
            date: new Date().toISOString(),
            description: surplus > 0 ? 'Dư kỳ trước (Kết chuyển)' : 'Nợ cũ kỳ trước (Chưa trả hết)',
            amount: Math.abs(surplus),
            accountId: AccountType.MB,
            splitType: surplus > 0 ? SplitType.MEO_PAID : SplitType.MEO_ONLY, 
            type: TransactionType.EXPENSE,
            isSettled: false
        });
    }

    try {
        const promises = [];
        for (const tx of newTransactions) {
            promises.push(supabaseService.addTransaction(tx));
        }
        if (txIds.length > 0) {
            promises.push(supabaseService.updateTransactionsAsSettled(txIds, settlementId));
        }
        if (finalPayment > 0) {
            const mbAcc = accounts.find(a => a.id === AccountType.MB);
            if (mbAcc) {
                promises.push(supabaseService.updateAccountBalance(AccountType.MB, mbAcc.balance + finalPayment));
            }
        }

        await Promise.all(promises);

        setAccounts(prev => prev.map(acc => 
            acc.id === AccountType.MB && finalPayment > 0
                ? { ...acc, balance: acc.balance + finalPayment } 
                : acc
        ));

        setTransactions(prev => {
            const updated = prev.map(t => {
                if (txIds.includes(t.id)) {
                    return { ...t, isSettled: true, settlementId: settlementId };
                }
                return t;
            });
            return [...newTransactions, ...updated];
        });

        setShowBill(false);
    } catch (error) {
        console.error("Error settling debts", error);
        alert("Lỗi khi quyết toán.");
    }
  };

  const handleViewBill = (settlementTx: Transaction) => {
    const billTransactions = transactions.filter(t => t.settlementId === settlementTx.id);
    setViewingBill({
        transactions: billTransactions,
        date: settlementTx.date,
        totalPaid: settlementTx.amount
    });
  };

  // --- RENDERS ---

  // HOME SCREEN (Apple Wallet & Less-is-more aesthetic)
  const renderHome = () => {
    const visibleAccounts = accounts.filter(a => a.id !== AccountType.TET_SAVING);

    return (
      <div className="space-y-5 pb-28 pt-2">
        {/* Apple Wallet Style Hero Card */}
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1c1c1e] via-[#121214] to-[#000000] p-6 text-white shadow-[0_12px_32px_rgba(0,0,0,0.15)] border border-white/[0.08]">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-white/[0.06] to-transparent rounded-full -mr-16 -mt-16 pointer-events-none blur-2xl"></div>
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-5">
              <div>
                <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-1.5">Tổng tài sản</p>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">{formatCurrency(totalBalance)}</h1>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowQRScanner(true)}
                  className="h-10 px-3.5 rounded-full bg-white/[0.12] hover:bg-white/[0.2] border border-white/15 flex items-center gap-1.5 text-white active:scale-95 transition-all text-xs font-semibold backdrop-blur-md shadow-sm"
                  title="Quét mã QR để chuyển tiền"
                >
                  <span className="material-symbols-rounded text-lg">qr_code_scanner</span>
                  <span>Quét QR</span>
                </button>
                <button 
                  onClick={() => setShowBill(true)}
                  className="w-10 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all"
                  title="Xem hoá đơn quyết toán"
                >
                  <span className="material-symbols-rounded text-lg">receipt_long</span>
                </button>
              </div>
            </div>

            {/* Mèo Debt / Credit Status Bar */}
            <div className="bg-white/[0.06] backdrop-blur-md rounded-2xl p-3.5 border border-white/[0.08] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  isCredit ? 'bg-[#34c759]/20 text-[#34c759]' : 'bg-[#ff9500]/20 text-[#ff9500]'
                }`}>
                  <span className="material-symbols-rounded text-base">{isCredit ? 'account_balance_wallet' : 'person'}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-semibold text-white/50 tracking-wider">
                    {isCredit ? 'Mèo có dư' : 'Mèo đang nợ'}
                  </p>
                  <p className="text-sm font-semibold tracking-tight text-white truncate">
                    {formatCurrency(Math.abs(meoDebt))}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button 
                  onClick={handleMeoDeposit}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all flex items-center gap-1 border border-white/10"
                >
                  <span className="material-symbols-rounded text-sm">add</span>
                  300k
                </button>
                <button 
                  onClick={() => setShowBill(true)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#0071e3] hover:bg-[#0077ed] active:scale-95 text-white transition-all shadow-sm"
                >
                  Chốt sổ
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Apple Monthly Activity Widget */}
        <MonthlyStats transactions={transactions} />

        {/* Apple Pay-style Quick Add Card with Smart Amount Suggestions */}
        <div className="bg-white rounded-[28px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-black/[0.05]">
          <div className="flex justify-between items-center mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Ghi chép giao dịch</p>
            <span className="text-[11px] font-medium text-[#86868b]">{qaDate.toLocaleDateString('vi-VN')}</span>
          </div>

          {/* Segmented Control: Chi tiêu | Thu nhập */}
          <div className="flex bg-[#f5f5f7] p-1 rounded-full mb-4 relative">
            <button
              onClick={() => setQaType(TransactionType.EXPENSE)}
              className={`flex-1 py-2 rounded-full text-xs font-semibold transition-all relative z-10 flex items-center justify-center gap-1.5 ${
                qaType === TransactionType.EXPENSE ? 'text-[#1d1d1f] bg-white shadow-sm' : 'text-[#86868b]'
              }`}
            >
              <span className="material-symbols-rounded text-sm">arrow_upward</span>
              Chi tiêu
            </button>
            <button
              onClick={() => setQaType(TransactionType.INCOME)}
              className={`flex-1 py-2 rounded-full text-xs font-semibold transition-all relative z-10 flex items-center justify-center gap-1.5 ${
                qaType === TransactionType.INCOME ? 'text-[#34c759] bg-white shadow-sm' : 'text-[#86868b]'
              }`}
            >
              <span className="material-symbols-rounded text-sm">arrow_downward</span>
              Thu nhập
            </button>
          </div>

          {/* Hero Amount Input */}
          <div className="mb-2 text-center">
            <div className="inline-flex items-baseline justify-center">
              <input 
                type="text"
                inputMode="numeric"
                value={qaAmount}
                onChange={(e) => setQaAmount(formatNumberInput(e.target.value))}
                placeholder="0"
                className={`text-4xl sm:text-5xl font-semibold tracking-tight text-center outline-none bg-transparent placeholder-black/15 max-w-[280px] ${
                  qaType === TransactionType.INCOME ? 'text-[#34c759]' : 'text-[#1d1d1f]'
                }`}
              />
              <span className="text-sm font-semibold text-[#86868b] ml-1">₫</span>
            </div>
            {qaAmount && (
              <p className="text-xs font-medium text-[#86868b] mt-0.5">
                {formatCurrency(parseSmartAmount(qaAmount))}
              </p>
            )}
          </div>

          {/* Smart Amount Suggestions Chips */}
          <div className="mb-5">
            <p className="text-[10px] text-center font-semibold text-[#86868b] uppercase tracking-wider mb-1.5">
              Gợi ý số tiền nhanh
            </p>
            <div className="flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-1 flex-wrap">
              {getAmountSuggestions(qaAmount).map((sugg) => (
                <button
                  key={sugg}
                  type="button"
                  onClick={() => setQaAmount(formatNumberInput(sugg.toString()))}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all active:scale-95 border ${
                    parseSmartAmount(qaAmount) === sugg
                      ? 'bg-[#1d1d1f] text-white border-[#1d1d1f] shadow-sm'
                      : 'bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border-black/[0.04]'
                  }`}
                >
                  {formatCurrency(sugg)}
                </button>
              ))}
            </div>
          </div>

          {/* Input Details */}
          <div className="space-y-3 mb-5">
            {/* Description Row */}
            <div className="bg-[#f5f5f7] rounded-2xl px-4 py-3 flex items-center gap-2.5 border border-black/[0.03]">
              <span className="material-symbols-rounded text-[#86868b] text-base">edit_note</span>
              <input 
                type="text" 
                value={qaDesc}
                onChange={(e) => setQaDesc(e.target.value)}
                placeholder={qaType === TransactionType.INCOME ? "Nguồn thu nhập (Lương, thưởng...)" : "Nội dung chi tiêu (Cà phê, đi chợ...)"}
                className="w-full text-sm font-medium text-[#1d1d1f] placeholder-[#86868b]/60 outline-none bg-transparent"
              />
            </div>

            {/* Date Picker Row */}
            <div className="bg-[#f5f5f7] rounded-2xl px-4 py-3 flex items-center gap-2.5 border border-black/[0.03]">
              <span className="material-symbols-rounded text-[#86868b] text-base">calendar_today</span>
              <DatePicker 
                selected={qaDate} 
                onChange={(date: Date | null) => date && setQaDate(date)} 
                dateFormat="dd/MM/yyyy"
                locale={vi}
                formatWeekDay={formatShortWeekday}
                className="w-full text-sm font-medium text-[#1d1d1f] outline-none bg-transparent cursor-pointer"
                wrapperClassName="flex-1"
              />
            </div>

            {/* Wallet Selection Capsules */}
            <div>
              <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider mb-2 px-1">Ví thanh toán</p>
              <div className="grid grid-cols-3 gap-2">
                {[AccountType.MB, AccountType.TCB, AccountType.CASH].map(type => {
                  const acc = accounts.find(a => a.id === type);
                  if (!acc) return null;
                  const isSelected = qaAccount === acc.id;
                  return (
                    <button
                      key={acc.id}
                      onClick={() => setQaAccount(acc.id as AccountType)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-medium transition-all active:scale-[0.98] border text-center truncate ${
                        isSelected 
                          ? 'bg-[#1d1d1f] text-white border-[#1d1d1f] shadow-sm' 
                          : 'bg-[#f5f5f7] text-[#1d1d1f] border-transparent hover:border-black/10'
                      }`}
                    >
                      {acc.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Split Options - Only for Expense */}
            {qaType === TransactionType.EXPENSE && (
              <div className="pt-1">
                <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider mb-2 px-1">Phân bổ chi phí</p>
                <div className="grid grid-cols-2 gap-2">
                  {SPLIT_OPTIONS.map(opt => {
                    const isSelected = qaSplit === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setQaSplit(opt.id as SplitType)}
                        className={`p-2.5 rounded-xl text-xs font-medium border text-left flex items-center gap-2 transition-all active:scale-[0.98] ${
                          isSelected
                            ? 'bg-[#0071e3]/10 border-[#0071e3] text-[#0071e3] font-semibold'
                            : 'bg-[#f5f5f7] border-transparent text-[#1d1d1f] hover:border-black/10'
                        }`}
                      >
                        <span className="material-symbols-rounded text-sm shrink-0">{opt.icon}</span>
                        <span className="truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Action Button */}
          <button
            onClick={handleQuickAdd}
            disabled={!qaAmount || !qaDesc}
            className={`w-full py-3.5 rounded-full font-medium text-sm text-white shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
              !qaAmount || !qaDesc
                ? 'bg-black/20 text-white/50 cursor-not-allowed'
                : 'bg-[#1d1d1f] hover:bg-black text-white'
            }`}
          >
            <span className="material-symbols-rounded text-base">check</span>
            {qaType === TransactionType.INCOME ? 'Lưu thu nhập' : (qaSplit === SplitType.MEO_PAID ? 'Xác nhận Mèo trả' : 'Lưu chi tiêu')}
          </button>
        </div>

        {/* My Wallets & Cards Section - Clean 2x2 Grid of all active accounts */}
        <div>
          <div className="flex justify-between items-center mb-3.5 px-1">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Tài chính cá nhân</p>
              <h3 className="text-base font-semibold text-[#1d1d1f]">Ví & Thẻ của tôi</h3>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowQRScanner(true)}
                className="text-xs font-semibold text-[#0071e3] bg-[#0071e3]/10 hover:bg-[#0071e3]/15 active:scale-95 px-3 py-1.5 rounded-full flex items-center gap-1 transition-all"
              >
                <span className="material-symbols-rounded text-base">qr_code_scanner</span>
                Quét QR
              </button>
              <button 
                onClick={() => setShowTransfer(true)}
                className="text-xs font-medium text-[#1d1d1f] bg-white border border-black/[0.08] active:bg-[#f5f5f7] px-3 py-1.5 rounded-full flex items-center gap-1 transition-all active:scale-95 shadow-sm"
              >
                <span className="material-symbols-rounded text-base">swap_horiz</span>
                Chuyển ví
              </button>
            </div>
          </div>

          {/* 4 Clean Apple Wallet Cards */}
          <div className="grid grid-cols-2 gap-3">
            {visibleAccounts.map(acc => (
              <AccountCard key={acc.id} account={acc} onUpdateBalance={handleUpdateBalance} />
            ))}
          </div>
        </div>
      </div>
    );
  };

  // HISTORY SCREEN (Apple Wallet Feed)
  const renderHistory = () => {
    const filteredTransactions = transactions.filter(t => {
      if (historyFilter === 'BILL') {
        return t.type === TransactionType.SETTLEMENT;
      }
      if (historyFilter === 'ME') {
        return (
          (t.splitType === SplitType.ME_ONLY || t.splitType === SplitType.SHARED || t.type === TransactionType.TRANSFER || t.type === TransactionType.INCOME) && 
          t.type !== TransactionType.SETTLEMENT
        );
      }
      if (historyFilter === 'MEO') {
        return (
          (t.splitType === SplitType.SHARED || t.splitType === SplitType.MEO_ONLY || t.splitType === SplitType.MEO_PAID) && 
          t.type !== TransactionType.SETTLEMENT
        );
      }
      return true;
    });

    const groupedTxs = groupTransactionsByDate(filteredTransactions);
    const sortedDates = Object.keys(groupedTxs).sort((a, b) => {
      if (a === 'Hôm nay') return -1;
      if (b === 'Hôm nay') return 1;
      if (a === 'Hôm qua') return -1;
      if (b === 'Hôm qua') return 1;
      return new Date(b.split('/').reverse().join('-')).getTime() - new Date(a.split('/').reverse().join('-')).getTime();
    });

    const totalIn = filteredTransactions
      .filter(t => t.type === TransactionType.INCOME || t.splitType === SplitType.MEO_PAID || t.type === TransactionType.SETTLEMENT)
      .reduce((sum, t) => sum + (t.splitType === SplitType.SHARED ? t.amount / 2 : t.amount), 0);
    
    const totalOut = filteredTransactions
      .filter(t => t.type === TransactionType.EXPENSE && t.splitType !== SplitType.MEO_PAID)
      .reduce((sum, t) => sum + (t.splitType === SplitType.SHARED ? t.amount / 2 : t.amount), 0);

    return (
      <div className="pb-28 pt-2 space-y-5">
        {/* Header & Segment Filter */}
        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Lịch sử giao dịch</p>
            <h2 className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">Dòng tiền</h2>
          </div>
          
          <div className="flex bg-[#e5e5ea] p-1 rounded-full">
            {(['MEO', 'ME', 'BILL'] as const).map((filter) => (
              <button 
                key={filter}
                onClick={() => setHistoryFilter(filter)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  historyFilter === filter 
                    ? 'bg-white text-[#1d1d1f] shadow-sm' 
                    : 'text-[#86868b] hover:text-[#1d1d1f]'
                }`}
              >
                {filter === 'MEO' ? 'Mèo' : filter === 'ME' ? 'Tôi' : 'Hoá đơn'}
              </button>
            ))}
          </div>
        </div>

        {/* Minimalist Summary Pills */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-black/[0.05] shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34c759]"></span>
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Tổng thu</p>
            </div>
            <p className="text-lg font-semibold text-[#1d1d1f]">{formatShortCurrency(totalIn)}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-black/[0.05] shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff3b30]"></span>
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Tổng chi</p>
            </div>
            <p className="text-lg font-semibold text-[#1d1d1f]">{formatShortCurrency(totalOut)}</p>
          </div>
        </div>
        
        {/* Transaction Grouped List */}
        {sortedDates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-black/[0.04] flex items-center justify-center text-[#86868b] mb-3">
              <span className="material-symbols-rounded text-2xl">receipt_long</span>
            </div>
            <p className="text-sm font-semibold text-[#1d1d1f]">Không có giao dịch</p>
            <p className="text-xs text-[#86868b] mt-1">Các giao dịch phát sinh sẽ hiển thị tại đây</p>
          </div>
        ) : (
          <div className="space-y-5">
            {sortedDates.map(date => (
              <div key={date}>
                <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-2 px-2">
                  {date}
                </p>

                <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.02)] border border-black/[0.05] divide-y divide-black/[0.04] overflow-hidden">
                  {groupedTxs[date].map((t) => {
                    const isMeoPaid = t.splitType === SplitType.MEO_PAID;
                    const isTransfer = t.type === TransactionType.TRANSFER;
                    const isSettlement = t.type === TransactionType.SETTLEMENT;
                    const isShared = t.splitType === SplitType.SHARED;
                    const isIncome = t.type === TransactionType.INCOME;
                    const displayAmount = isShared ? t.amount / 2 : t.amount;

                    return (
                      <div key={t.id} className="p-3.5 flex items-center gap-3 hover:bg-black/[0.01] transition-colors">
                        <div 
                          onClick={() => isSettlement && handleViewBill(t)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isSettlement ? 'bg-[#5856d6]/10 text-[#5856d6]' :
                            isMeoPaid || isIncome ? 'bg-[#34c759]/10 text-[#34c759]' :
                            isTransfer ? 'bg-[#0071e3]/10 text-[#0071e3]' :
                            'bg-black/[0.04] text-[#1d1d1f]'
                          } ${isSettlement ? 'cursor-pointer' : ''}`}
                        >
                          <span className="material-symbols-rounded text-lg">
                            {isSettlement ? 'receipt' : isMeoPaid ? 'price_check' : isIncome ? 'trending_up' : isTransfer ? 'swap_horiz' : 'shopping_bag'}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0" onClick={() => isSettlement && handleViewBill(t)}>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <h5 className="font-semibold text-xs text-[#1d1d1f] truncate">{t.description}</h5>
                            {t.isSettled && !isSettlement && (
                              <span className="material-symbols-rounded text-xs text-[#0071e3]" title="Đã quyết toán">verified</span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1.5 text-[10px] text-[#86868b]">
                            <span>{accounts.find(a => a.id === t.accountId)?.name}</span>
                            {isTransfer && t.toAccountId && (
                              <span>→ {accounts.find(a => a.id === t.toAccountId)?.name}</span>
                            )}
                            {!isTransfer && !isSettlement && !isIncome && (
                              <>
                                <span>·</span>
                                <span>{SPLIT_OPTIONS.find(o => o.id === t.splitType)?.label}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <p className={`font-semibold text-xs tracking-tight ${
                            isSettlement ? 'text-[#5856d6]' :
                            isMeoPaid || isIncome ? 'text-[#34c759]' :
                            isTransfer ? 'text-[#86868b]' :
                            'text-[#1d1d1f]'
                          }`}>
                            {isMeoPaid || isSettlement || isIncome ? '+' : isTransfer ? '' : '-'}{formatShortCurrency(displayAmount)}
                          </p>
                          
                          {(!t.isSettled || t.type === TransactionType.SETTLEMENT || (t.type === TransactionType.INCOME && t.splitType === SplitType.MEO_PAID)) ? (
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleEditTransaction(t); }} 
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.04] transition-colors"
                              >
                                <span className="material-symbols-rounded text-sm">edit</span>
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(t.id); }} 
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors"
                              >
                                <span className="material-symbols-rounded text-sm">delete</span>
                              </button>
                            </div>
                          ) : (
                            <div className="w-6 h-6 flex items-center justify-center text-[#86868b]/40" title="Đã khoá">
                              <span className="material-symbols-rounded text-xs">lock</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // SHOP SCREEN (Apple Store Manager aesthetic)
  const renderShop = () => {
    const activeFinances = shopFinances.filter(f => f.shopId === activeShop).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const shopIncome = activeFinances.filter(f => f.type === 'INCOME').reduce((s, f) => s + f.amount, 0);
    const shopExpense = activeFinances.filter(f => f.type === 'EXPENSE').reduce((s, f) => s + f.amount, 0);
    const shopProfit = shopIncome - shopExpense;

    const FINANCE_CATEGORIES = [
      'Doanh thu trực tiếp', 'Doanh thu sàn TMĐT', 'Văn phòng phẩm', 'Vật tư đóng gói', 
      'In ấn - Sản xuất', 'Tiền vận chuyển', 'Quảng cáo', 'Khác'
    ];

    const handleAddFinance = async () => {
      if (!finForm.amount || !finForm.desc) return alert('Vui lòng nhập đủ thông tin');
      
      const newFinance = {
        id: Date.now().toString(),
        shopId: activeShop,
        type: finForm.type as 'INCOME' | 'EXPENSE',
        amount: parseSmartAmount(finForm.amount),
        description: finForm.desc,
        category: finForm.category,
        date: finForm.date.toISOString()
      };
      
      try {
        setIsLoading(true);
        await supabaseService.addShopFinance(newFinance);
        setShopFinances(prev => [newFinance, ...prev]);
        setFinForm({ type: 'INCOME', amount: '', desc: '', category: 'Khác', date: new Date(), accountId: AccountType.MB });
      } catch (error) {
        console.error("Error adding finance:", error);
        alert("Lỗi khi thêm giao dịch");
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div className="pb-28 pt-2 space-y-5">
        {/* Shop Header */}
        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Kinh doanh</p>
            <h2 className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">Elank Studio</h2>
          </div>
          <div className="bg-white border border-black/[0.06] py-1.5 px-3 rounded-full text-xs font-medium text-[#1d1d1f] shadow-sm flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#34c759]"></span>
            <span>Đang mở</span>
          </div>
        </div>

        {/* Apple Segmented View Switcher */}
        <div className="bg-[#e5e5ea] p-1 rounded-full flex">
          {(['finance', 'orders', 'inventory'] as const).map(view => (
            <button
              key={view}
              onClick={() => setShopView(view)}
              className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all ${
                shopView === view 
                  ? 'bg-white text-[#1d1d1f] shadow-sm' 
                  : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              {view === 'finance' ? 'Tài chính' : view === 'orders' ? 'Đơn hàng' : 'Kho hàng'}
            </button>
          ))}
        </div>

        {/* Sub-view: Finance */}
        {shopView === 'finance' && (
          <div className="space-y-4">
            {/* Profit Card */}
            <div className="bg-gradient-to-br from-[#1c1c1e] to-[#000000] rounded-3xl p-6 text-white shadow-sm border border-white/10">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1">Lợi nhuận ròng</p>
              <h3 className="text-3xl font-semibold tracking-tight text-white mb-4">{formatCurrency(shopProfit)}</h3>
              
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10 text-xs">
                <div>
                  <span className="text-[#86868b] block mb-0.5">Tổng thu</span>
                  <span className="font-semibold text-[#34c759]">{formatCurrency(shopIncome)}</span>
                </div>
                <div>
                  <span className="text-[#86868b] block mb-0.5">Tổng chi</span>
                  <span className="font-semibold text-[#ff3b30]">{formatCurrency(shopExpense)}</span>
                </div>
              </div>
            </div>

            {/* Quick Add Finance Transaction */}
            <div className="bg-white rounded-3xl p-5 border border-black/[0.05] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Ghi nhận thu / chi shop</p>
              
              <div className="flex bg-[#f5f5f7] p-1 rounded-full">
                <button 
                  onClick={() => setFinForm({...finForm, type: 'INCOME'})}
                  className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    finForm.type === 'INCOME' ? 'bg-white text-[#34c759] shadow-sm' : 'text-[#86868b]'
                  }`}
                >
                  Thu vào
                </button>
                <button 
                  onClick={() => setFinForm({...finForm, type: 'EXPENSE'})}
                  className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    finForm.type === 'EXPENSE' ? 'bg-white text-[#ff3b30] shadow-sm' : 'text-[#86868b]'
                  }`}
                >
                  Chi ra
                </button>
              </div>

              <input 
                type="text" 
                placeholder="Số tiền (VNĐ)" 
                value={finForm.amount} 
                onChange={e => setFinForm({...finForm, amount: formatNumberInput(e.target.value)})}
                className="w-full bg-[#f5f5f7] border border-black/[0.04] px-4 py-3 rounded-2xl text-sm font-semibold outline-none text-[#1d1d1f]"
              />

              <div className="grid grid-cols-2 gap-2">
                <select 
                  value={finForm.category} 
                  onChange={e => setFinForm({...finForm, category: e.target.value})}
                  className="w-full bg-[#f5f5f7] border border-black/[0.04] px-3.5 py-3 rounded-2xl text-xs font-medium outline-none text-[#1d1d1f]"
                >
                  {FINANCE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select 
                  value={finForm.accountId} 
                  onChange={e => setFinForm({...finForm, accountId: e.target.value as AccountType})}
                  className="w-full bg-[#f5f5f7] border border-black/[0.04] px-3.5 py-3 rounded-2xl text-xs font-medium outline-none text-[#1d1d1f]"
                >
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              <input 
                type="text" 
                placeholder="Ghi chú giao dịch..." 
                value={finForm.desc} 
                onChange={e => setFinForm({...finForm, desc: e.target.value})}
                className="w-full bg-[#f5f5f7] border border-black/[0.04] px-4 py-3 rounded-2xl text-sm outline-none text-[#1d1d1f] placeholder-[#86868b]/60"
              />

              <button 
                onClick={handleAddFinance}
                className="w-full py-3 bg-[#1d1d1f] hover:bg-black text-white font-medium rounded-full text-xs active:scale-[0.98] transition-all shadow-sm"
              >
                Lưu giao dịch shop
              </button>
            </div>

            {/* Finance History List */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider px-2">Giao dịch gần đây</p>
              {activeFinances.length === 0 ? (
                <p className="text-center text-xs text-[#86868b] py-6">Chưa có giao dịch shop nào</p>
              ) : (
                <div className="bg-white rounded-2xl border border-black/[0.05] divide-y divide-black/[0.04] overflow-hidden">
                  {activeFinances.slice(0, 15).map(f => (
                    <div key={f.id} className="p-3.5 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-semibold text-[#1d1d1f] text-xs">{f.description}</p>
                        <p className="text-[10px] text-[#86868b] mt-0.5">{f.category} · {new Date(f.date).toLocaleDateString('vi-VN')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${f.type === 'INCOME' ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
                          {f.type === 'INCOME' ? '+' : '-'}{formatCurrency(f.amount)}
                        </span>
                        <button
                          onClick={async () => {
                            if (financeToDelete !== f.id) {
                              setFinanceToDelete(f.id);
                              return;
                            }
                            try {
                              await supabaseService.deleteShopFinance(f.id);
                              setShopFinances(prev => prev.filter(x => x.id !== f.id));
                              setFinanceToDelete(null);
                            } catch (e) {
                              alert('Lỗi xoá giao dịch shop');
                            }
                          }}
                          className={`p-1 rounded-full text-xs ${financeToDelete === f.id ? 'bg-[#ff3b30] text-white px-2' : 'text-[#86868b] hover:text-[#ff3b30]'}`}
                        >
                          {financeToDelete === f.id ? 'Xoá?' : <span className="material-symbols-rounded text-sm">delete</span>}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sub-view: Orders */}
        {shopView === 'orders' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <p className="text-xs font-semibold text-[#86868b] uppercase">Đơn hàng ({orders.filter(o => o.shopId === activeShop).length})</p>
              <button 
                onClick={() => setOrderTab(orderTab === 'list' ? 'create' : 'list')}
                className="text-xs font-medium text-[#1d1d1f] bg-white border border-black/[0.08] px-3 py-1.5 rounded-full shadow-sm"
              >
                {orderTab === 'list' ? '+ Tạo đơn' : 'Danh sách'}
              </button>
            </div>

            {orderTab === 'create' ? (
              <div className="bg-white rounded-3xl p-5 border border-black/[0.05] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Thông tin đơn hàng mới</p>
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="text" 
                    placeholder="Tên khách hàng" 
                    value={ordForm.name} 
                    onChange={e => setOrdForm({...ordForm, name: e.target.value})}
                    className="w-full bg-[#f5f5f7] border border-black/[0.04] px-3.5 py-2.5 rounded-xl text-xs outline-none"
                  />
                  <select 
                    value={ordForm.channel} 
                    onChange={e => setOrdForm({...ordForm, channel: e.target.value})}
                    className="w-full bg-[#f5f5f7] border border-black/[0.04] px-3.5 py-2.5 rounded-xl text-xs outline-none"
                  >
                    <option value="Shopee">Shopee</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Zalo">Zalo</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-[#86868b] uppercase">Sản phẩm bán</p>
                  {ordItems.map((it, idx) => (
                    <div key={idx} className="flex gap-2">
                      <select 
                        value={it.productId} 
                        onChange={e => setOrdItems(ordItems.map((x, i) => i === idx ? {...x, productId: e.target.value} : x))}
                        className="flex-1 bg-[#f5f5f7] border border-black/[0.04] px-3 py-2 rounded-xl text-xs outline-none truncate"
                      >
                        <option value="">-- Chọn sản phẩm --</option>
                        {products.filter(p => p.shopId === activeShop).map(p => (
                          <option key={p.id} value={p.id}>{p.name} (Tồn: {p.stock})</option>
                        ))}
                      </select>
                      <input 
                        type="number" 
                        placeholder="SL" 
                        value={it.qty} 
                        onChange={e => setOrdItems(ordItems.map((x, i) => i === idx ? {...x, qty: e.target.value} : x))}
                        className="w-16 bg-[#f5f5f7] border border-black/[0.04] px-2 py-2 rounded-xl text-xs text-center outline-none"
                      />
                    </div>
                  ))}
                  <button 
                    onClick={() => setOrdItems([...ordItems, { productId: '', qty: '1', price: '' }])}
                    className="text-[11px] font-medium text-[#0071e3] hover:underline"
                  >
                    + Thêm sản phẩm
                  </button>
                </div>

                <button 
                  onClick={async () => {
                    if (!ordForm.name) return alert('Vui lòng nhập tên khách hàng');
                    const selected = ordItems.filter(i => i.productId);
                    if (selected.length === 0) return alert('Vui lòng chọn ít nhất 1 sản phẩm');
                    
                    setIsLoading(true);
                    try {
                      let total = 0;
                      const detail = selected.map(i => {
                        const p = products.find(pp => pp.id === i.productId);
                        const q = parseInt(i.qty) || 1;
                        const price = Number(p?.sellingPrice) || 0;
                        total += price * q;
                        return { productId: i.productId, qty: q, unitPrice: price };
                      });

                      const newOrder = {
                        id: Date.now().toString(),
                        shopId: activeShop,
                        channel: ordForm.channel,
                        name: ordForm.name,
                        phone: ordForm.phone,
                        address: ordForm.address,
                        productId: JSON.stringify(detail),
                        qty: detail.reduce((s, d) => s + d.qty, 0),
                        deposit: parseSmartAmount(ordForm.deposit) || 0,
                        shipping: parseSmartAmount(ordForm.shipping) || 0,
                        voucher: parseSmartAmount(ordForm.voucher) || 0,
                        paymentFee: 0,
                        status: 'Chưa Gửi Hàng',
                        paymentMethod: 'Đang Thanh Toán',
                        totalAmount: total,
                        netRevenue: total,
                        date: new Date().toISOString()
                      };

                      await supabaseService.addShopOrder(newOrder);
                      setOrders([newOrder, ...orders]);
                      alert('Tạo đơn hàng thành công!');
                      setOrderTab('list');
                    } catch (e) {
                      alert('Lỗi tạo đơn hàng');
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  className="w-full py-3 bg-[#1d1d1f] hover:bg-black text-white font-medium rounded-full text-xs active:scale-[0.98] transition-all"
                >
                  Tạo đơn hàng
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {orders.filter(o => o.shopId === activeShop).map(order => (
                  <div key={order.id} className="bg-white p-4 rounded-2xl border border-black/[0.05] text-xs space-y-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-[#1d1d1f]">{order.name}</span>
                      <span className="text-[10px] bg-[#f5f5f7] px-2 py-0.5 rounded-full font-medium text-[#86868b]">{order.channel}</span>
                    </div>
                    <div className="flex justify-between text-[#86868b] text-[11px]">
                      <span>{new Date(order.date).toLocaleDateString('vi-VN')}</span>
                      <span className="font-semibold text-[#1d1d1f]">{formatCurrency(order.totalAmount || 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sub-view: Inventory */}
        {shopView === 'inventory' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-black/[0.05] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Nhập hàng mới</p>
              <input 
                type="text" 
                placeholder="Tên sản phẩm" 
                value={invForm.name} 
                onChange={e => setInvForm({...invForm, name: e.target.value})}
                className="w-full bg-[#f5f5f7] border border-black/[0.04] px-3.5 py-2.5 rounded-xl text-xs outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="text" 
                  placeholder="Giá nhập gốc" 
                  value={invForm.originalPrice} 
                  onChange={e => setInvForm({...invForm, originalPrice: formatNumberInput(e.target.value)})}
                  className="w-full bg-[#f5f5f7] border border-black/[0.04] px-3.5 py-2.5 rounded-xl text-xs outline-none"
                />
                <input 
                  type="text" 
                  placeholder="Giá bán niêm yết" 
                  value={invForm.sellingPrice} 
                  onChange={e => setInvForm({...invForm, sellingPrice: formatNumberInput(e.target.value)})}
                  className="w-full bg-[#f5f5f7] border border-black/[0.04] px-3.5 py-2.5 rounded-xl text-xs outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="number" 
                  placeholder="Số lượng" 
                  value={invForm.stock} 
                  onChange={e => setInvForm({...invForm, stock: e.target.value})}
                  className="w-full bg-[#f5f5f7] border border-black/[0.04] px-3.5 py-2.5 rounded-xl text-xs outline-none"
                />
                <button 
                  onClick={async () => {
                    if (!invForm.name || !invForm.originalPrice || !invForm.sellingPrice) return alert('Vui lòng nhập đủ thông tin');
                    setIsLoading(true);
                    const newProd = {
                      id: Date.now().toString(),
                      shopId: activeShop,
                      name: invForm.name,
                      originalPrice: parseSmartAmount(invForm.originalPrice),
                      sellingPrice: parseSmartAmount(invForm.sellingPrice),
                      stock: parseInt(invForm.stock) || 0,
                      importDate: new Date().toISOString()
                    };
                    try {
                      await supabaseService.addShopProduct(newProd);
                      setProducts([newProd, ...products]);
                      setInvForm({ name: '', originalPrice: '', sellingPrice: '', stock: '1', date: new Date(), accountId: AccountType.MB });
                      alert('Thêm sản phẩm thành công!');
                    } catch (e) {
                      alert('Lỗi thêm sản phẩm');
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  className="w-full py-2.5 bg-[#1d1d1f] hover:bg-black text-white font-medium rounded-xl text-xs active:scale-[0.98] transition-all"
                >
                  + Thêm kho
                </button>
              </div>
            </div>

            {/* Product List */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider px-2">Danh sách kho hàng ({products.filter(p => p.shopId === activeShop).length})</p>
              <div className="bg-white rounded-2xl border border-black/[0.05] divide-y divide-black/[0.04] overflow-hidden">
                {products.filter(p => p.shopId === activeShop).map(p => (
                  <div key={p.id} className="p-3.5 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-semibold text-[#1d1d1f]">{p.name}</p>
                      <p className="text-[10px] text-[#86868b] mt-0.5">Vốn: {formatCurrency(p.originalPrice)} · Bán: {formatCurrency(p.sellingPrice)}</p>
                    </div>
                    <span className="font-semibold text-xs px-2.5 py-1 bg-[#f5f5f7] rounded-full text-[#1d1d1f]">
                      Tồn: {p.stock}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] font-sans text-[#1d1d1f] selection:bg-black/10">
      <main className="max-w-md mx-auto min-h-screen relative bg-[#f5f5f7] shadow-sm overflow-hidden px-4 pt-safe pb-safe">
        
        {/* Loading Overlay */}
        <AnimatePresence>
            {isLoading && (
                <motion.div 
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="fixed inset-0 bg-white/90 backdrop-blur-xl z-[100] flex flex-col items-center justify-center p-8"
                >
                    <div className="w-12 h-12 rounded-full border-2 border-black/15 border-t-black animate-spin mb-4"></div>
                    <p className="text-xs font-semibold tracking-wider uppercase text-[#86868b]">Mèo Finance</p>
                </motion.div>
            )}
        </AnimatePresence>
        
        {/* Error State */}
        {configError && !isLoading && (
             <div className="fixed inset-0 bg-white z-[110] flex flex-col items-center justify-center p-8 text-center">
                <span className="material-symbols-rounded text-4xl text-[#ff3b30] mb-3">cloud_off</span>
                <h3 className="text-lg font-semibold text-[#1d1d1f] mb-1">Không thể tải dữ liệu</h3>
                <p className="text-xs text-[#86868b] mb-6">{configError}</p>
                <button 
                    onClick={() => window.location.reload()}
                    className="px-6 py-2.5 bg-[#1d1d1f] text-white font-medium rounded-full text-xs active:scale-95 transition-all"
                >
                    Thử lại
                </button>
             </div>
        )}

        {/* Tab Views */}
        <AnimatePresence mode="wait">
            {activeTab === 'home' && (
                <motion.div
                    key="home"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                >
                    {renderHome()}
                </motion.div>
            )}
            {activeTab === 'history' && (
                <motion.div
                    key="history"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                >
                    {renderHistory()}
                </motion.div>
            )}
            {activeTab === 'shop' && (
                <motion.div
                    key="shop"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                >
                    {renderShop()}
                </motion.div>
            )}
        </AnimatePresence>

        {/* Apple iOS Floating Bottom Dock (3 tabs: Ví tiền, Lịch sử, Cửa hàng) */}
        <div className="fixed bottom-5 left-0 right-0 z-40 px-4 pointer-events-none">
            <div className="bg-white/85 backdrop-blur-2xl px-3 py-2 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.08)] border border-black/[0.08] max-w-[280px] mx-auto flex justify-between items-center pointer-events-auto">
                <button 
                    onClick={() => setActiveTab('home')}
                    className={`flex-1 py-1.5 px-3 rounded-full flex flex-col items-center justify-center transition-all active:scale-95 duration-200 ${
                      activeTab === 'home' ? 'text-[#1d1d1f] bg-black/[0.06] font-semibold' : 'text-[#86868b] hover:text-[#1d1d1f]'
                    }`}
                >
                    <span className="material-symbols-rounded text-xl">account_balance_wallet</span>
                    <span className="text-[10px] mt-0.5 tracking-tight">Ví tiền</span>
                </button>

                <button 
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 py-1.5 px-3 rounded-full flex flex-col items-center justify-center transition-all active:scale-95 duration-200 ${
                      activeTab === 'history' ? 'text-[#1d1d1f] bg-black/[0.06] font-semibold' : 'text-[#86868b] hover:text-[#1d1d1f]'
                    }`}
                >
                    <span className="material-symbols-rounded text-xl">receipt_long</span>
                    <span className="text-[10px] mt-0.5 tracking-tight">Lịch sử</span>
                </button>

                <button 
                    onClick={() => setActiveTab('shop')}
                    className={`flex-1 py-1.5 px-3 rounded-full flex flex-col items-center justify-center transition-all active:scale-95 duration-200 ${
                      activeTab === 'shop' ? 'text-[#1d1d1f] bg-black/[0.06] font-semibold' : 'text-[#86868b] hover:text-[#1d1d1f]'
                    }`}
                >
                    <span className="material-symbols-rounded text-xl">storefront</span>
                    <span className="text-[10px] mt-0.5 tracking-tight">Cửa hàng</span>
                </button>
            </div>
        </div>

        {/* Transfer Modal with Amount Suggestions */}
        {showTransfer && (
            <div className="fixed inset-0 z-50 flex items-end justify-center">
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setShowTransfer(false)}></div>
                <div className="bg-white w-full max-w-md rounded-t-[32px] p-6 shadow-2xl relative z-10 pb-[calc(env(safe-area-inset-bottom)+2rem)] animate-slide-up border-t border-black/[0.06]">
                    <div className="w-10 h-1 bg-black/15 rounded-full mx-auto mb-6"></div>
                    
                    <h3 className="text-lg font-semibold mb-5 text-[#1d1d1f]">Chuyển tiền nội bộ</h3>
                    
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 bg-[#f5f5f7] p-3.5 rounded-2xl border border-black/[0.04]">
                            <div>
                                <label className="text-[10px] text-[#86868b] font-semibold uppercase mb-1 block">Từ ví</label>
                                <select 
                                    value={transferFrom} 
                                    onChange={(e) => setTransferFrom(e.target.value as AccountType)}
                                    className="w-full bg-transparent font-semibold text-xs text-[#1d1d1f] outline-none"
                                >
                                    {accounts.filter(a => a.id !== AccountType.TET_SAVING).map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="text-right">
                                <label className="text-[10px] text-[#86868b] font-semibold uppercase mb-1 block">Đến ví</label>
                                <select 
                                    value={transferTo} 
                                    onChange={(e) => setTransferTo(e.target.value as AccountType)}
                                    className="w-full bg-transparent font-semibold text-xs text-[#0071e3] outline-none text-right"
                                >
                                    {accounts.filter(a => a.id !== AccountType.TET_SAVING).map(acc => (
                                        <option key={acc.id} value={acc.id} disabled={acc.id === transferFrom}>{acc.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-1.5 block">Nhập số tiền</label>
                            <input 
                                type="text"
                                inputMode="numeric"
                                value={transferAmount}
                                onChange={(e) => setTransferAmount(formatNumberInput(e.target.value))}
                                placeholder="0"
                                className="w-full bg-[#f5f5f7] border border-black/[0.06] rounded-2xl px-4 py-3.5 text-2xl font-semibold text-[#1d1d1f] outline-none focus:border-[#1d1d1f]"
                            />
                            {/* Suggestions in Transfer */}
                            <div className="flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-1 mt-2.5 flex-wrap">
                              {getAmountSuggestions(transferAmount).map((sugg) => (
                                <button
                                  key={sugg}
                                  type="button"
                                  onClick={() => setTransferAmount(formatNumberInput(sugg.toString()))}
                                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all active:scale-95 border ${
                                    parseSmartAmount(transferAmount) === sugg
                                      ? 'bg-[#1d1d1f] text-white border-[#1d1d1f] shadow-sm'
                                      : 'bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border-black/[0.04]'
                                  }`}
                                >
                                  {formatCurrency(sugg)}
                                </button>
                              ))}
                            </div>
                        </div>

                        <button 
                            onClick={handleTransfer}
                            disabled={!transferAmount || transferFrom === transferTo}
                            className="w-full py-3.5 bg-[#1d1d1f] hover:bg-black text-white font-medium rounded-full text-sm active:scale-[0.98] transition-all disabled:opacity-40"
                        >
                            Xác nhận chuyển
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* QR Scanner & Transfer Modal */}
        <QRScannerModal
            isOpen={showQRScanner}
            onClose={() => setShowQRScanner(false)}
            accounts={accounts}
            onLogTransaction={handleLogQRTransfer}
            getAmountSuggestions={getAmountSuggestions}
            formatCurrency={formatCurrency}
        />

        {/* Bill Modal (Creation & History) */}
        {showBill && (
            <BillGenerator 
                transactions={transactions} 
                onClose={() => setShowBill(false)} 
                onSettle={handleSettleDebts}
            />
        )}
        {viewingBill && (
            <BillGenerator 
                transactions={viewingBill.transactions} 
                onClose={() => setViewingBill(null)} 
                onSettle={() => {}}
                isHistorical={true}
                historicalDate={viewingBill.date}
                historicalTotalPaid={viewingBill.totalPaid}
            />
        )}

        {/* Delete Modal */}
        {deletingTx && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeletingTx(null)}></div>
                <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative z-10 text-center border border-black/[0.06]">
                    <div className="w-12 h-12 rounded-full bg-[#ff3b30]/10 text-[#ff3b30] flex items-center justify-center mb-3 mx-auto">
                        <span className="material-symbols-rounded text-2xl">delete</span>
                    </div>
                    <h3 className="text-base font-semibold text-[#1d1d1f] mb-1">Xoá giao dịch?</h3>
                    <p className="text-xs text-[#86868b] mb-6">"{deletingTx.description}" sẽ được xoá và số dư ví sẽ được hoàn lại.</p>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setDeletingTx(null)}
                            className="flex-1 py-2.5 bg-[#f5f5f7] text-[#1d1d1f] font-medium rounded-full text-xs"
                        >
                            Hủy
                        </button>
                        <button 
                            onClick={confirmDelete}
                            className="flex-1 py-2.5 bg-[#ff3b30] text-white font-medium rounded-full text-xs shadow-sm"
                        >
                            Xoá ngay
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Edit Modal with Suggestions */}
        {editingTx && (
            <div className="fixed inset-0 z-50 flex items-end justify-center">
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditingTx(null)}></div>
                <div className="bg-white w-full max-w-md rounded-t-[32px] p-6 shadow-2xl relative z-10 pb-[calc(env(safe-area-inset-bottom)+2rem)] animate-slide-up border-t border-black/[0.06]">
                    <div className="w-10 h-1 bg-black/15 rounded-full mx-auto mb-6"></div>
                    <h3 className="text-base font-semibold mb-4 text-[#1d1d1f]">Chỉnh sửa giao dịch</h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-1 block">Số tiền</label>
                            <input 
                                type="text"
                                inputMode="numeric"
                                value={editAmount}
                                onChange={(e) => setEditAmount(formatNumberInput(e.target.value))}
                                className="w-full bg-[#f5f5f7] border border-black/[0.06] rounded-2xl px-4 py-3 text-xl font-semibold text-[#1d1d1f] outline-none"
                            />
                            {/* Suggestions in Edit */}
                            <div className="flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-1 mt-2.5 flex-wrap">
                              {getAmountSuggestions(editAmount).map((sugg) => (
                                <button
                                  key={sugg}
                                  type="button"
                                  onClick={() => setEditAmount(formatNumberInput(sugg.toString()))}
                                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all active:scale-95 border ${
                                    parseSmartAmount(editAmount) === sugg
                                      ? 'bg-[#1d1d1f] text-white border-[#1d1d1f] shadow-sm'
                                      : 'bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border-black/[0.04]'
                                  }`}
                                >
                                  {formatCurrency(sugg)}
                                </button>
                              ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-1 block">Nội dung</label>
                            <input 
                                type="text"
                                value={editDesc}
                                onChange={(e) => setEditDesc(e.target.value)}
                                className="w-full bg-[#f5f5f7] border border-black/[0.06] rounded-2xl px-4 py-3 text-sm font-medium text-[#1d1d1f] outline-none"
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button 
                                onClick={() => setEditingTx(null)}
                                className="flex-1 py-3 bg-[#f5f5f7] text-[#1d1d1f] font-medium rounded-full text-xs"
                            >
                                Hủy
                            </button>
                            <button 
                                onClick={confirmEdit}
                                className="flex-1 py-3 bg-[#1d1d1f] text-white font-medium rounded-full text-xs shadow-sm"
                            >
                                Lưu thay đổi
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </main>

      <style>{`
        @keyframes slide-up {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
        }
        .animate-slide-up {
            animation: slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
}
