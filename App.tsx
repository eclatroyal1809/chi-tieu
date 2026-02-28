import React, { useState, useEffect } from 'react';
import { AccountType, Account, Transaction, SplitType, TransactionType } from './types';
import { INITIAL_ACCOUNTS, SPLIT_OPTIONS } from './constants';
import { AccountCard } from './components/AccountCard';
import { BillGenerator } from './components/BillGenerator';
import { MonthlyStats } from './components/MonthlyStats';
import * as supabaseService from './services/supabaseService';
import { supabase } from './supabaseClient'; // Import to check config
import { motion, AnimatePresence } from 'motion/react';
import DatePicker from 'react-datepicker';
import { vi } from 'date-fns/locale';

const formatShortWeekday = (nameOfDay: string) => {
    const name = nameOfDay.toLowerCase();
    if (name.includes('chủ nhật')) return 'CN';
    if (name.includes('hai')) return 'T2';
    if (name.includes('ba')) return 'T3';
    if (name.includes('tư')) return 'T4';
    if (name.includes('năm')) return 'T5';
    if (name.includes('sáu')) return 'T6';
    if (name.includes('bảy')) return 'T7';
    return nameOfDay.substring(0, 3);
};

export default function App() {
  // State
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'shop'>('home');
  const [historyFilter, setHistoryFilter] = useState<'MEO' | 'ME' | 'BILL'>('MEO');
  
  const [showBill, setShowBill] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  
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
  
  // Edit TET_SAVING State
  const [isEditingTetSaving, setIsEditingTetSaving] = useState(false);
  const [tempTetSavingBalance, setTempTetSavingBalance] = useState('');
  
  // Shop State
  const [activeShop, setActiveShop] = useState<'eclat' | 'elank'>('eclat');
  const [shopView, setShopView] = useState<'overview' | 'inventory' | 'finance' | 'orders'>('overview');

  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [shopFinances, setShopFinances] = useState<any[]>([]);

  const [invForm, setInvForm] = useState({ name: '', originalPrice: '', sellingPrice: '', stock: '1', date: new Date() });
  const [ordForm, setOrdForm] = useState({ channel: 'Shopee', name: '', phone: '', address: '', productId: '', qty: '1', deposit: '', shipping: '', voucher: '', paymentFee: '', status: 'Chưa Gửi Hàng', paymentMethod: 'Đang Thanh Toán' });
  const [finForm, setFinForm] = useState({ type: 'INCOME', amount: '', desc: '', category: 'Khác', date: new Date() });
  
  const [orderTab, setOrderTab] = useState<'list' | 'create'>('list');

  // Constant Base Fee (Initial Deposit/Credit)
  // UPDATE: Set to 0 as requested. Mèo has no initial deposit.
  const BASE_FEE = 0;

  // Initial Data Fetching
  useEffect(() => {
    const loadData = async () => {
        setIsLoading(true);
        
        // Check if Supabase is configured with default/placeholder values
        // @ts-ignore - Accessing internal property if needed, or just checking known placeholders
        if ((supabase as any).supabaseUrl && (supabase as any).supabaseUrl.includes('your-project')) {
             setConfigError("Vui lòng cấu hình Supabase URL và Key trong file supabaseClient.ts hoặc biến môi trường.");
             setIsLoading(false);
             return;
        }

        try {
            // Seed initial accounts if first run
            await supabaseService.seedAccountsIfEmpty(INITIAL_ACCOUNTS);
            await supabaseService.ensureTetSavingExists(INITIAL_ACCOUNTS);
            
            // Fetch data concurrently
            const [fetchedAccounts, fetchedTransactions, fetchedShopProducts, fetchedShopOrders, fetchedShopFinances] = await Promise.all([
                supabaseService.getAccounts(),
                supabaseService.getTransactions(),
                supabaseService.getShopProducts(),
                supabaseService.getShopOrders(),
                supabaseService.getShopFinances()
            ]);

            setAccounts(fetchedAccounts);
            setTransactions(fetchedTransactions);
            setProducts(fetchedShopProducts);
            setOrders(fetchedShopOrders);
            setShopFinances(fetchedShopFinances);
        } catch (error) {
            console.error("Failed to load data from Supabase:", error);
            // Don't show alert loop, just UI state
            setConfigError("Không thể kết nối đến dữ liệu. Vui lòng kiểm tra cấu hình Supabase.");
        } finally {
            setIsLoading(false);
        }
    };

    loadData();
  }, []);

  // Derived Values
  const totalBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0);
  
  // Calculate Debt
  const activeTransactions = transactions.filter(t => !t.isSettled && t.type !== TransactionType.TRANSFER && t.type !== TransactionType.SETTLEMENT && t.type !== TransactionType.INCOME);
  
  // Logic: Nợ = Chi tiêu (cho Mèo) - Các khoản Mèo đã đóng (INCOME + MEO_PAID)
  // Tuy nhiên, logic hiện tại đang tách biệt.
  // Để đơn giản:
  // 1. TransactionDebt tính toán các khoản chi tiêu chưa thanh toán.
  // 2. Nếu có Income từ Mèo (SplitType.MEO_PAID), nó sẽ làm giảm nợ.
  const transactionDebt = transactions
    .filter(t => !t.isSettled && t.type !== TransactionType.TRANSFER && t.type !== TransactionType.SETTLEMENT)
    .reduce((sum, t) => {
      // Nếu là chi tiêu
      if (t.type === TransactionType.EXPENSE) {
          if (t.splitType === SplitType.MEO_ONLY) return sum + t.amount;
          if (t.splitType === SplitType.SHARED) return sum + (t.amount / 2);
          if (t.splitType === SplitType.MEO_PAID) return sum - t.amount; // Mèo trả hộ -> Tôi nợ Mèo (Giảm nợ của Mèo)
      }
      // Nếu là thu nhập (Mèo đóng tiền)
      if (t.type === TransactionType.INCOME && t.splitType === SplitType.MEO_PAID) {
          return sum - t.amount; // Mèo đóng tiền -> Giảm nợ
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
        // Optimistic update
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
        // Allow deleting settled INCOME if it was a fund deposit
        alert('Giao dịch này đã được quyết toán (lock). Vui lòng xoá Bill (Thanh toán nợ) tương ứng trước để mở khoá.');
        return;
    }

    setDeletingTx(tx);
  };

  const confirmDelete = async () => {
    if (!deletingTx) return;
    const { id, amount, accountId, toAccountId, type, splitType } = deletingTx;

    // Calculate new balances locally to send to DB
    const updates: { id: string, amount: number }[] = [];
    const getAccountBalance = (accId: string) => accounts.find(a => a.id === accId)?.balance || 0;

    if (type === TransactionType.TRANSFER && toAccountId) {
        // Revert transfer: Add back to Source, Subtract from Dest
        updates.push({ id: accountId, amount: getAccountBalance(accountId) + amount });
        updates.push({ id: toAccountId, amount: getAccountBalance(toAccountId) - amount });
    } else {
        // Single account impact
        let newBalance = getAccountBalance(accountId);
        
        // LOGIC XOÁ: Đảo ngược lại hành động lúc tạo
        if (type === TransactionType.INCOME || type === TransactionType.SETTLEMENT) {
            // Lúc tạo là cộng tiền -> Xoá là trừ tiền
            newBalance -= amount;
        } else if (type === TransactionType.EXPENSE) {
             if (splitType === SplitType.MEO_PAID) {
                 // Mèo chi -> Không ảnh hưởng số dư -> Xoá cũng không đổi
             } else {
                 // Lúc tạo là chi tiêu (Trừ tiền) -> Xoá là cộng tiền
                 newBalance += amount;
             }
        }

        updates.push({ id: accountId, amount: newBalance });
    }

    try {
        // 1. Update Balances in DB
        for (const update of updates) {
            await supabaseService.updateAccountBalance(update.id, update.amount);
        }

        // 2. Delete Transaction in DB
        await supabaseService.deleteTransaction(id);

        // 3. Handle Settlement Un-linking
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

        // 4. Update Local Accounts State
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

    // Update balance if amount changed and it's not a transfer (we disable editing amount for transfers to keep it simple)
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
        alert("Không hỗ trợ sửa số tiền của giao dịch chuyển khoản. Vui lòng xoá và tạo lại.");
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

  // TÍNH NĂNG MỚI: Mèo nạp quỹ 300k
  const handleMeoDeposit = async () => {
    const AMOUNT = 300000;
    const mbAcc = accounts.find(a => a.id === AccountType.MB);
    if (!mbAcc) {
        alert("Không tìm thấy ví MB Bank!");
        return;
    }

    // Xác nhận
    if (!window.confirm("Xác nhận Mèo đóng quỹ 300.000đ vào MB Bank?")) return;

    // Tạo giao dịch Income
    const newTx: Transaction = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        description: "Mèo đóng quỹ",
        amount: AMOUNT,
        accountId: AccountType.MB,
        splitType: SplitType.MEO_PAID, // Đánh dấu là Mèo trả để giảm nợ trong tính toán
        type: TransactionType.INCOME, // Tiền vào
        isSettled: false // Chưa settle để hiển thị trong lịch sử tính toán (như một khoản giảm trừ)
    };

    const newBalance = mbAcc.balance + AMOUNT;

    try {
        await Promise.all([
            supabaseService.addTransaction(newTx),
            supabaseService.updateAccountBalance(AccountType.MB, newBalance)
        ]);
        
        // Update Local State
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

    // Calculate new balance
    const currentAcc = accounts.find(a => a.id === qaAccount);
    if (!currentAcc) return;

    let newBalance = currentAcc.balance;
    if (qaType === TransactionType.INCOME) {
        newBalance += amountVal;
    } else {
        // Expense
        if (qaSplit === SplitType.MEO_PAID) {
             // Mèo chi -> Không trừ tiền của mình
        } else {
             newBalance -= amountVal;
        }
    }

    try {
        const promises: Promise<any>[] = [supabaseService.addTransaction(newTx)];
        
        // Chỉ update balance nếu có thay đổi
        if (newBalance !== currentAcc.balance) {
            promises.push(supabaseService.updateAccountBalance(qaAccount, newBalance));
        }

        await Promise.all(promises);

        // Optimistic UI Update
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
      description: `Chuyển tiền: ${fromAcc.name} -> ${toAcc.name}`,
      amount: amountVal,
      accountId: transferFrom,
      toAccountId: transferTo,
      splitType: SplitType.ME_ONLY,
      type: TransactionType.TRANSFER,
      isSettled: true
    };

    let newFromBalance = fromAcc.balance;
    let newToBalance = toAcc.balance;
    let mbBalanceUpdate: number | null = null;

    if (transferFrom === AccountType.MB && transferTo === AccountType.TET_SAVING) {
        // MB -> TET_SAVING: MB (Thực tế) unchanged, TET_SAVING increases
        newFromBalance = fromAcc.balance;
        newToBalance = toAcc.balance + amountVal;
    } else if (transferFrom === AccountType.TET_SAVING && transferTo === AccountType.MB) {
        // TET_SAVING -> MB: MB (Thực tế) unchanged, TET_SAVING decreases
        newFromBalance = fromAcc.balance - amountVal;
        newToBalance = toAcc.balance;
    } else if (transferTo === AccountType.TET_SAVING) {
        // Other -> TET_SAVING: Other decreases, TET_SAVING increases, MB (Thực tế) increases
        newFromBalance = fromAcc.balance - amountVal;
        newToBalance = toAcc.balance + amountVal;
        const mbAcc = accounts.find(a => a.id === AccountType.MB);
        if (mbAcc) mbBalanceUpdate = mbAcc.balance + amountVal;
    } else if (transferFrom === AccountType.TET_SAVING) {
        // TET_SAVING -> Other: TET_SAVING decreases, Other increases, MB (Thực tế) decreases
        newFromBalance = fromAcc.balance - amountVal;
        newToBalance = toAcc.balance + amountVal;
        const mbAcc = accounts.find(a => a.id === AccountType.MB);
        if (mbAcc) mbBalanceUpdate = mbAcc.balance - amountVal;
    } else {
        // Normal transfer
        newFromBalance = fromAcc.balance - amountVal;
        newToBalance = toAcc.balance + amountVal;
    }

    try {
        const promises = [
            supabaseService.addTransaction(newTx),
            supabaseService.updateAccountBalance(transferFrom, newFromBalance),
            supabaseService.updateAccountBalance(transferTo, newToBalance)
        ];
        
        if (mbBalanceUpdate !== null) {
            promises.push(supabaseService.updateAccountBalance(AccountType.MB, mbBalanceUpdate));
        }

        await Promise.all(promises);

        setTransactions(prev => [newTx, ...prev]);
        setAccounts(prev => prev.map(acc => {
            if (acc.id === transferFrom) return { ...acc, balance: newFromBalance };
            if (acc.id === transferTo) return { ...acc, balance: newToBalance };
            if (mbBalanceUpdate !== null && acc.id === AccountType.MB) return { ...acc, balance: mbBalanceUpdate };
            return acc;
        }));

        setTransferAmount('');
        setShowTransfer(false);
    } catch (error) {
        console.error("Error transferring", error);
        alert("Lỗi chuyển tiền.");
    }
  };

  const handleSettleDebts = async (txIds: string[], finalPayment: number, surplus: number) => {
    const settlementId = 'settle-' + Date.now().toString();
    const newTransactions: Transaction[] = [];

    // 1. Prepare Settlement Transaction
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

    // 2. Prepare Surplus Transaction
    if (surplus !== 0) {
        newTransactions.push({
            id: 'surplus-' + Date.now().toString(),
            date: new Date().toISOString(),
            description: surplus > 0 ? 'Dư kỳ trước (Kết chuyển)' : 'Nợ cũ kỳ trước (Chưa trả hết)',
            amount: Math.abs(surplus),
            accountId: AccountType.MB, // Virtual/Tracking
            splitType: surplus > 0 ? SplitType.MEO_PAID : SplitType.MEO_ONLY, 
            type: TransactionType.EXPENSE,
            isSettled: false
        });
    }

    try {
        // Execute Supabase Updates
        const promises = [];
        
        // Add new transactions
        for (const tx of newTransactions) {
            promises.push(supabaseService.addTransaction(tx));
        }
        
        // Update old transactions as settled
        if (txIds.length > 0) {
            promises.push(supabaseService.updateTransactionsAsSettled(txIds, settlementId));
        }

        // Update MB Balance if payment made
        if (finalPayment > 0) {
            const mbAcc = accounts.find(a => a.id === AccountType.MB);
            if (mbAcc) {
                promises.push(supabaseService.updateAccountBalance(AccountType.MB, mbAcc.balance + finalPayment));
            }
        }

        await Promise.all(promises);

        // Update Local State
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

  // --- Render (Almost same, just added loading overlay) ---
  const renderHome = () => (
    <div className="space-y-6 pb-32 animate-fade-in">
      {/* Header Card */}
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] p-6 text-white shadow-xl shadow-indigo-200">
         <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
         <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500 opacity-20 rounded-full blur-xl"></div>
         <div className="relative z-10">
             <div className="flex justify-between items-start mb-6">
                 <div>
                     <p className="text-indigo-100 text-sm font-medium mb-1 opacity-80">Tổng tài sản</p>
                     <h1 className="text-4xl font-bold tracking-tight">{formatCurrency(totalBalance)}</h1>
                 </div>
                 <button 
                    onClick={() => setShowBill(true)}
                    className="bg-white/20 backdrop-blur-md hover:bg-white/30 active:scale-95 transition-all p-3 rounded-2xl border border-white/10"
                 >
                     <span className="material-symbols-rounded text-white block text-2xl">receipt_long</span>
                 </button>
             </div>

             <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/5">
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg ${
                     isCredit ? 'bg-emerald-500 shadow-emerald-900/20' : 'bg-rose-400 shadow-rose-900/20'
                 }`}>
                     <span className="material-symbols-rounded">{isCredit ? 'savings' : 'pets'}</span>
                 </div>
                 <div className="flex-1">
                     <p className={`text-xs font-medium ${isCredit ? 'text-emerald-200' : 'text-indigo-100'}`}>
                         {isCredit ? 'Mèo đang có (Dư)' : 'Mèo đang nợ'}
                     </p>
                     <p className="text-lg font-bold">
                         {formatCurrency(Math.abs(meoDebt))}
                     </p>
                 </div>
                 
                 {/* QUICK DEPOSIT BUTTON - FIXED STYLE TO AVOID WHITE/INVISIBLE ISSUE */}
                 <button 
                     onClick={handleMeoDeposit}
                     className="bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow-lg shadow-emerald-900/20 active:scale-95 transition-all border border-emerald-400/50"
                 >
                     <span className="material-symbols-rounded text-base">add_circle</span>
                     Nạp 300k
                 </button>
             </div>
         </div>
      </div>

      {/* Monthly Stats */}
      <MonthlyStats transactions={transactions} />

      {/* Quick Add */}
      <div>
         <div className="bg-white rounded-[32px] p-5 shadow-lg shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
             
             {/* Transaction Type Switcher */}
             <div className="flex bg-slate-100 p-1 rounded-2xl mb-6 relative">
                 <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-all duration-300 ease-spring ${
                     qaType === TransactionType.INCOME ? 'left-[calc(50%+2px)]' : 'left-1'
                 }`}></div>
                 <button
                    onClick={() => setQaType(TransactionType.EXPENSE)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all relative z-10 flex items-center justify-center gap-2 ${
                        qaType === TransactionType.EXPENSE ? 'text-slate-800' : 'text-slate-400'
                    }`}
                 >
                    <span className="material-symbols-rounded text-lg">shopping_bag</span>
                    Chi tiêu
                 </button>
                 <button
                    onClick={() => setQaType(TransactionType.INCOME)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all relative z-10 flex items-center justify-center gap-2 ${
                        qaType === TransactionType.INCOME ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                 >
                    <span className="material-symbols-rounded text-lg">attach_money</span>
                    Thu nhập
                 </button>
             </div>

             <div className="flex flex-col gap-5 mb-6">
                 <div className="relative">
                     <input 
                         type="text"
                         inputMode="numeric"
                         value={qaAmount}
                         onChange={(e) => setQaAmount(formatNumberInput(e.target.value))}
                         placeholder="0"
                         className={`w-full text-5xl font-bold tracking-tight placeholder-slate-200 outline-none bg-transparent transition-colors ${
                             qaType === TransactionType.INCOME ? 'text-emerald-600' : 'text-slate-800'
                         }`}
                     />
                     <span className="absolute top-1/2 -translate-y-1/2 right-0 text-slate-400 text-sm font-medium">VNĐ</span>
                     {qaAmount && (
                         <p className={`text-xs font-bold mt-2 flex items-center gap-1 w-fit px-2 py-1 rounded-lg ${
                             qaType === TransactionType.INCOME 
                             ? 'text-emerald-700 bg-emerald-50' 
                             : 'text-indigo-700 bg-indigo-50'
                         }`}>
                             <span className="material-symbols-rounded text-[14px]">auto_awesome</span>
                             {formatCurrency(parseSmartAmount(qaAmount))}
                         </p>
                     )}
                 </div>
                 
                 <div className="w-full h-[1px] bg-slate-100"></div>
                 
                 <div className="flex items-center gap-3">
                     <span className="material-symbols-rounded text-slate-400">calendar_month</span>
                     <DatePicker 
                         selected={qaDate} 
                         onChange={(date: Date | null) => date && setQaDate(date)} 
                         dateFormat="dd/MM/yyyy"
                         locale={vi}
                         formatWeekDay={formatShortWeekday}
                         className="w-full text-sm font-medium text-slate-700 outline-none bg-transparent cursor-pointer"
                         wrapperClassName="flex-1"
                     />
                 </div>

                 <div className="w-full h-[1px] bg-slate-100"></div>

                 <div className="flex items-center gap-3">
                     <span className="material-symbols-rounded text-slate-400">edit_note</span>
                     <input 
                         type="text" 
                         value={qaDesc}
                         onChange={(e) => setQaDesc(e.target.value)}
                         placeholder={qaType === TransactionType.INCOME ? "Nguồn thu nhập..." : "Nội dung chi tiêu..."}
                         className="w-full text-lg font-medium text-slate-700 placeholder-slate-300 outline-none bg-transparent"
                     />
                 </div>
             </div>

             <div className="mb-5">
                 <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                     {[AccountType.MB, AccountType.TCB, AccountType.CASH].map(type => {
                         const acc = accounts.find(a => a.id === type);
                         if(!acc) return null;
                         const isSelected = qaAccount === acc.id;
                         return (
                            <button
                                key={acc.id}
                                onClick={() => setQaAccount(acc.id as AccountType)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap active:scale-95 ${
                                    isSelected 
                                    ? `bg-slate-800 text-white border-slate-800 shadow-md shadow-slate-200` 
                                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                }`}
                            >
                                <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : acc.color}`}></div>
                                {acc.name}
                            </button>
                         );
                     })}
                 </div>
             </div>

             {/* Split Options - ONLY FOR EXPENSE */}
             {qaType === TransactionType.EXPENSE && (
                 <div className="mb-6 animate-fade-in">
                     <div className="grid grid-cols-2 gap-3">
                         {SPLIT_OPTIONS.map(opt => {
                             const isSelected = qaSplit === opt.id;
                             const isMeoPaid = opt.id === 'MEO_PAID';
                             return (
                                 <button
                                    key={opt.id}
                                    onClick={() => setQaSplit(opt.id as SplitType)}
                                    className={`px-3 py-3 rounded-2xl text-sm font-medium border text-left flex items-center gap-3 transition-all active:scale-95 ${
                                        isSelected
                                        ? (isMeoPaid 
                                            ? 'bg-cyan-50 border-cyan-500 text-cyan-800 shadow-sm' 
                                            : 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm')
                                        : 'bg-white border-slate-200 text-slate-500'
                                    }`}
                                 >
                                     <span className={`material-symbols-rounded text-xl ${
                                         isSelected ? '' : 'text-slate-400'
                                     }`}>{opt.icon}</span>
                                     <span className="font-bold">{opt.label}</span>
                                 </button>
                             )
                         })}
                     </div>
                 </div>
             )}

             <button
                 onClick={handleQuickAdd}
                 disabled={!qaAmount || !qaDesc}
                 className={`w-full py-4 rounded-2xl font-bold text-lg text-white shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 ${
                    !qaAmount || !qaDesc ? 'bg-slate-300 opacity-50 shadow-none' : 
                    qaType === TransactionType.INCOME ? 'bg-cyan-500 hover:bg-cyan-600 shadow-cyan-200' :
                    qaSplit === SplitType.MEO_PAID ? 'bg-cyan-600 hover:bg-cyan-700 shadow-cyan-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                 }`}
             >
                 <span className="material-symbols-rounded text-2xl">check</span>
                 {qaType === TransactionType.INCOME ? 'Lưu thu nhập' : (qaSplit === SplitType.MEO_PAID ? 'Xác nhận Mèo trả' : 'Lưu chi tiêu')}
             </button>
         </div>
      </div>

      {/* Accounts */}
      <div>
        <div className="flex justify-between items-center mb-4 px-1">
            <h3 className="font-bold text-slate-800 text-lg">Ví của tôi</h3>
            <button 
                onClick={() => setShowTransfer(true)}
                className="text-xs font-bold text-blue-600 bg-blue-50 active:bg-blue-100 px-4 py-2 rounded-full flex items-center gap-1 transition-all active:scale-95"
            >
                <span className="material-symbols-rounded text-lg">swap_horiz</span>
                Chuyển tiền
            </button>
        </div>

        {/* Tiết kiệm ăn Tết */}
        <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-3xl p-5 text-white shadow-lg shadow-pink-200 mb-4 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
            <div className="flex justify-between items-center relative z-10">
                <div className="flex-1 mr-4">
                    <p className="text-pink-100 text-sm font-medium mb-1 flex items-center gap-1">
                        <span className="material-symbols-rounded text-sm">celebration</span>
                        Tiết kiệm ăn Tết
                    </p>
                    {isEditingTetSaving ? (
                        <input
                            type="text"
                            inputMode="numeric"
                            className="w-full text-3xl font-bold tracking-tight border-b border-white/50 focus:border-white focus:outline-none bg-transparent placeholder-white/50"
                            value={tempTetSavingBalance}
                            onChange={(e) => setTempTetSavingBalance(formatNumberInput(e.target.value))}
                            autoFocus
                            onBlur={() => {
                                const raw = tempTetSavingBalance.replace(/\./g, '');
                                const val = parseFloat(raw);
                                if (!isNaN(val)) {
                                    handleUpdateBalance(AccountType.TET_SAVING, val);
                                }
                                setIsEditingTetSaving(false);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const raw = tempTetSavingBalance.replace(/\./g, '');
                                    const val = parseFloat(raw);
                                    if (!isNaN(val)) {
                                        handleUpdateBalance(AccountType.TET_SAVING, val);
                                    }
                                    setIsEditingTetSaving(false);
                                }
                            }}
                        />
                    ) : (
                        <h2 
                            className="text-3xl font-bold tracking-tight cursor-pointer"
                            onClick={() => {
                                setTempTetSavingBalance(formatNumberInput((accounts.find(a => a.id === AccountType.TET_SAVING)?.balance || 0).toString()));
                                setIsEditingTetSaving(true);
                            }}
                        >
                            {formatCurrency(accounts.find(a => a.id === AccountType.TET_SAVING)?.balance || 0)}
                        </h2>
                    )}
                    <div className="mt-3 bg-white/10 rounded-xl p-3 border border-white/10 flex gap-4">
                        <div className="flex-1">
                            <p className="text-[10px] text-pink-100 mb-0.5 uppercase tracking-wider font-medium">Thực tế</p>
                            <p className="text-sm font-bold">
                                {formatCurrency(accounts.find(a => a.id === AccountType.MB)?.balance || 0)}
                            </p>
                        </div>
                        <div className="w-px bg-white/20"></div>
                        <div className="flex-1">
                            <p className="text-[10px] text-pink-100 mb-0.5 uppercase tracking-wider font-medium">Khả dụng</p>
                            <p className="text-sm font-bold">
                                {formatCurrency((accounts.find(a => a.id === AccountType.MB)?.balance || 0) - (accounts.find(a => a.id === AccountType.TET_SAVING)?.balance || 0))}
                            </p>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={() => {
                        setTransferFrom(AccountType.MB);
                        setTransferTo(AccountType.TET_SAVING);
                        setShowTransfer(true);
                    }}
                    className="bg-white/20 hover:bg-white/30 active:scale-95 transition-all p-3 rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-1 min-w-[80px]"
                >
                    <span className="material-symbols-rounded text-white block">add_card</span>
                    <span className="text-[10px] font-bold">Gửi thêm</span>
                </button>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
            {accounts.filter(acc => acc.id !== AccountType.TET_SAVING).map(acc => (
                <AccountCard key={acc.id} account={acc} onUpdateBalance={handleUpdateBalance} />
            ))}
        </div>
      </div>
    </div>
  );

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
              // Hiển thị cả Thu nhập do Mèo đóng (INCOME + MEO_PAID)
              return (
                  (t.splitType === SplitType.SHARED || t.splitType === SplitType.MEO_ONLY || t.splitType === SplitType.MEO_PAID) 
                  && t.type !== TransactionType.SETTLEMENT
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

      return (
        <div className="pb-32 animate-fade-in">
            <div className="flex items-center justify-between mb-6 px-1">
                <h2 className="text-2xl font-bold text-slate-800">Lịch sử</h2>
                
                <div className="flex bg-slate-200 p-1 rounded-xl">
                    {['MEO', 'ME', 'BILL'].map((filter) => (
                        <button 
                            key={filter}
                            onClick={() => setHistoryFilter(filter as any)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                historyFilter === filter ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                            }`}
                        >
                            {filter === 'MEO' ? 'Mèo' : filter === 'ME' ? 'Tôi' : 'Bill'}
                        </button>
                    ))}
                </div>
            </div>
            
            {sortedDates.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <span className="material-symbols-rounded text-4xl text-slate-300">
                            {historyFilter === 'BILL' ? 'receipt_long' : 'history'}
                        </span>
                    </div>
                    <p className="font-medium">Chưa có giao dịch</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {sortedDates.map(date => (
                        <div key={date}>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">{date}</h4>
                            <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden">
                                {groupedTxs[date].map((t, index) => {
                                    const isMeoPaid = t.splitType === SplitType.MEO_PAID;
                                    const isTransfer = t.type === TransactionType.TRANSFER;
                                    const isSettlement = t.type === TransactionType.SETTLEMENT;
                                    const isShared = t.splitType === SplitType.SHARED;
                                    const isIncome = t.type === TransactionType.INCOME;
                                    const isLast = index === groupedTxs[date].length - 1;
                                    
                                    const displayAmount = isShared ? t.amount / 2 : t.amount;

                                    return (
                                        <div key={t.id} className={`p-4 flex items-center gap-4 active:bg-slate-50 transition-colors ${!isLast ? 'border-b border-slate-50' : ''}`}>
                                            {/* Icon Box */}
                                            <div 
                                                onClick={() => isSettlement && handleViewBill(t)}
                                                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                                                isSettlement ? 'bg-purple-100 text-purple-600' :
                                                isMeoPaid || (isIncome && isMeoPaid) ? 'bg-emerald-100 text-emerald-600' :
                                                isIncome ? 'bg-emerald-100 text-emerald-600' :
                                                isTransfer ? 'bg-indigo-50 text-indigo-600' :
                                                'bg-slate-100 text-slate-500'
                                            }`}>
                                                <span className="material-symbols-rounded text-xl">
                                                    {isSettlement ? 'receipt' : 
                                                     isMeoPaid ? 'price_check' : 
                                                     isIncome ? 'trending_up' :
                                                     isTransfer ? 'swap_horiz' : 'shopping_bag'}
                                                </span>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0" onClick={() => isSettlement && handleViewBill(t)}>
                                                <h5 className="font-bold text-slate-800 text-sm truncate">{t.description}</h5>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                     <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold truncate max-w-[80px]">
                                                        {accounts.find(a => a.id === t.accountId)?.name}
                                                        {isTransfer && ` → ${accounts.find(a => a.id === t.toAccountId)?.name}`}
                                                     </span>
                                                     {!isTransfer && !isSettlement && !isIncome && (
                                                         <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                                             t.splitType === 'ME_ONLY' ? 'bg-slate-100 text-slate-500' :
                                                             isMeoPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
                                                         }`}>
                                                             {SPLIT_OPTIONS.find(o => o.id === t.splitType)?.label}
                                                         </span>
                                                     )}
                                                     {isIncome && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-700">
                                                            {isMeoPaid ? 'Mèo đóng quỹ' : 'Thu nhập'}
                                                        </span>
                                                     )}
                                                </div>
                                            </div>

                                            {/* Amount */}
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <p className={`font-bold text-sm ${
                                                        isSettlement ? 'text-purple-600' :
                                                        isMeoPaid || isIncome ? 'text-emerald-600' :
                                                        isTransfer ? 'text-slate-600' : 'text-slate-800'
                                                    }`}>
                                                        {isMeoPaid || isSettlement || isIncome ? '+' : isTransfer ? '' : '-'}{formatShortCurrency(displayAmount)}
                                                    </p>
                                                </div>
                                                
                                                {/* Edit & Delete Buttons */}
                                                {!t.isSettled || t.type === TransactionType.SETTLEMENT || (t.type === TransactionType.INCOME && t.splitType === SplitType.MEO_PAID) ? (
                                                    <div className="flex items-center gap-1">
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEditTransaction(t);
                                                            }}
                                                            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-all active:scale-90"
                                                        >
                                                            <span className="material-symbols-rounded text-lg">edit</span>
                                                        </button>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteTransaction(t.id);
                                                            }}
                                                            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all active:scale-90"
                                                        >
                                                            <span className="material-symbols-rounded text-lg">delete</span>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="w-8 h-8 flex items-center justify-center text-slate-200">
                                                        <span className="material-symbols-rounded text-lg">lock</span>
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

  const renderShopInventory = () => {
      const activeProducts = products.filter(p => p.shopId === activeShop);
      
      const handleAddProduct = async () => {
          if (!invForm.name || !invForm.originalPrice || !invForm.sellingPrice) return alert('Vui lòng nhập đủ thông tin');
          const newProd = {
              id: Date.now().toString(),
              shopId: activeShop,
              name: invForm.name,
              originalPrice: parseSmartAmount(invForm.originalPrice),
              sellingPrice: parseSmartAmount(invForm.sellingPrice),
              stock: parseInt(invForm.stock) || 0,
              importDate: invForm.date.toISOString()
          };
          
          try {
              await supabaseService.addShopProduct(newProd);
              setProducts([newProd, ...products]);
              setInvForm({ name: '', originalPrice: '', sellingPrice: '', stock: '1', date: new Date() });
          } catch (error) {
              console.error("Error adding product:", error);
              alert("Lỗi khi thêm sản phẩm");
          }
      };

      return (
          <div className="space-y-6 animate-fade-in">
              <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-4">Thêm sản phẩm mới</h3>
                  <div className="space-y-3">
                      <input type="text" placeholder="Tên sản phẩm" value={invForm.name} onChange={e => setInvForm({...invForm, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-indigo-500" />
                      <div className="grid grid-cols-2 gap-3">
                          <input type="text" placeholder="Giá gốc" value={invForm.originalPrice} onChange={e => setInvForm({...invForm, originalPrice: formatNumberInput(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-indigo-500" />
                          <input type="text" placeholder="Giá bán (các kênh khác)" value={invForm.sellingPrice} onChange={e => setInvForm({...invForm, sellingPrice: formatNumberInput(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-indigo-500" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                          <input type="number" placeholder="Số lượng" value={invForm.stock} onChange={e => setInvForm({...invForm, stock: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-indigo-500" />
                          <div className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm outline-none focus-within:border-indigo-500 flex items-center">
                              <DatePicker selected={invForm.date} onChange={(date: Date | null) => date && setInvForm({...invForm, date})} dateFormat="dd/MM/yyyy" locale={vi} formatWeekDay={formatShortWeekday} className="w-full bg-transparent outline-none" wrapperClassName="flex-1" />
                          </div>
                      </div>
                      <button onClick={handleAddProduct} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-md shadow-indigo-200 active:scale-95 transition-all mt-2">Thêm vào kho</button>
                  </div>
              </div>

              <div className="space-y-3">
                  <h3 className="font-bold text-slate-800 px-1">Danh sách sản phẩm</h3>
                  {activeProducts.length === 0 ? (
                      <p className="text-center text-slate-400 py-4 text-sm">Kho hàng trống</p>
                  ) : (
                      activeProducts.map(p => (
                          <div key={p.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                              <div>
                                  <h4 className="font-bold text-slate-800">{p.name}</h4>
                                  <p className="text-xs text-slate-500 mt-1">Kho: <span className="font-bold text-indigo-600">{p.stock}</span> • Nhập: {new Date(p.importDate).toLocaleDateString('vi-VN')}</p>
                              </div>
                              <div className="text-right">
                                  <p className="text-sm font-bold text-slate-800">{formatCurrency(p.sellingPrice)}</p>
                                  <p className="text-[10px] text-orange-500 font-bold mt-0.5">Shopee: {formatCurrency(p.sellingPrice * 1.3)}</p>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>
      );
  };

  const renderShopOrders = () => {
      const activeProducts = products.filter(p => p.shopId === activeShop && p.stock > 0);
      const activeOrders = orders.filter(o => o.shopId === activeShop).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const selectedProduct = activeProducts.find(p => p.id === ordForm.productId);
      const isShopee = ordForm.channel === 'Shopee';
      
      let productPrice = selectedProduct ? selectedProduct.sellingPrice : 0;
      if (isShopee) productPrice = productPrice * 1.3;
      
      const qty = parseInt(ordForm.qty) || 1;
      const totalOrder = productPrice * qty;
      const voucher = parseSmartAmount(ordForm.voucher) || 0;
      const baseForFee = Math.max(0, totalOrder - voucher);
      
      const fixedFee = isShopee ? baseForFee * 0.14 : 0;
      const serviceFee = isShopee ? 3000 : 0;
      const vat = isShopee ? baseForFee * 0.01 : 0;
      const pit = isShopee ? baseForFee * 0.005 : 0;
      const paymentFee = isShopee ? (parseSmartAmount(ordForm.paymentFee) || 0) : 0;
      const shipping = parseSmartAmount(ordForm.shipping) || 0;
      const deposit = parseSmartAmount(ordForm.deposit) || 0;
      
      const netRevenue = totalOrder - fixedFee - serviceFee - vat - pit - paymentFee;

      const handleCreateOrder = async () => {
          if (!ordForm.name || !ordForm.productId) return alert('Vui lòng nhập tên KH và chọn sản phẩm');
          
          const newOrder = {
              id: Date.now().toString(),
              shopId: activeShop,
              ...ordForm,
              totalAmount: totalOrder,
              netRevenue,
              date: new Date().toISOString()
          };
          
          try {
              await supabaseService.addShopOrder(newOrder);
              const product = products.find(p => p.id === ordForm.productId);
              if (product) {
                  await supabaseService.updateShopProductStock(product.id, product.stock - qty);
              }
              
              setOrders([newOrder, ...orders]);
              setProducts(products.map(p => p.id === ordForm.productId ? { ...p, stock: p.stock - qty } : p));
              
              alert('Tạo đơn hàng thành công!');
              setOrdForm({ channel: 'Shopee', name: '', phone: '', address: '', productId: '', qty: '1', deposit: '', shipping: '', voucher: '', paymentFee: '', status: 'Chưa Gửi Hàng', paymentMethod: 'Đang Thanh Toán' });
              setOrderTab('list');
          } catch (error) {
              console.error("Error creating order:", error);
              alert("Lỗi khi tạo đơn hàng");
          }
      };

      const handleUpdateOrder = async (orderId: string, field: string, value: string) => {
          const order = orders.find(o => o.id === orderId);
          if (!order) return;
          
          const updatedOrder = { ...order, [field]: value };
          
          try {
              await supabaseService.updateShopOrder(orderId, { [field]: value });
              
              if (field === 'paymentMethod' && ['Ví ShopeePay', 'Tiền Mặt', 'TECHCOMBANK'].includes(value) && order.paymentMethod !== value) {
                  const newFinance = {
                      id: Date.now().toString(),
                      shopId: activeShop,
                      type: 'INCOME',
                      amount: order.netRevenue,
                      description: `Thanh toán đơn hàng ${order.channel} - ${order.name} (${value})`,
                      category: order.channel === 'Shopee' ? 'Doanh thu sàn TMĐT' : 'Doanh thu trực tiếp',
                      date: new Date().toISOString()
                  };
                  await supabaseService.addShopFinance(newFinance);
                  setShopFinances([newFinance, ...shopFinances]);
                  alert(`Đã tự động tạo phiếu thu ${formatCurrency(order.netRevenue)} vào Sổ quỹ!`);
              }
              
              setOrders(orders.map(o => o.id === orderId ? updatedOrder : o));
          } catch (error) {
              console.error("Error updating order:", error);
              alert("Lỗi khi cập nhật đơn hàng");
          }
      };

      return (
          <div className="space-y-6 animate-fade-in">
              <div className="flex bg-slate-100 p-1 rounded-xl relative">
                   <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm transition-all duration-300 ease-spring ${
                       orderTab === 'create' ? 'left-[calc(50%+2px)]' : 'left-1'
                   }`}></div>
                   <button onClick={() => setOrderTab('list')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all relative z-10 ${orderTab === 'list' ? 'text-indigo-600' : 'text-slate-400'}`}>Theo dõi đơn</button>
                   <button onClick={() => setOrderTab('create')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all relative z-10 ${orderTab === 'create' ? 'text-indigo-600' : 'text-slate-400'}`}>Tạo đơn mới</button>
              </div>

              {orderTab === 'create' ? (
                  <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100">
                      <h3 className="font-bold text-slate-800 mb-4">Tạo đơn hàng mới</h3>
                      
                      <div className="space-y-4">
                          <div>
                              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Kênh bán hàng</label>
                              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                  {['Shopee', 'Facebook', 'Instagram', 'Zalo'].map(c => (
                                      <button key={c} onClick={() => setOrdForm({...ordForm, channel: c})} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${ordForm.channel === c ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                                          {c}
                                      </button>
                                  ))}
                              </div>
                          </div>

                          <div className="space-y-3">
                              <input type="text" placeholder="Tên khách hàng" value={ordForm.name} onChange={e => setOrdForm({...ordForm, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-indigo-500" />
                              <div className="grid grid-cols-2 gap-3">
                                  <input type="tel" placeholder="Số điện thoại" value={ordForm.phone} onChange={e => setOrdForm({...ordForm, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-indigo-500" />
                                  <input type="text" placeholder="Tiền cọc" value={ordForm.deposit} onChange={e => setOrdForm({...ordForm, deposit: formatNumberInput(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-indigo-500" />
                              </div>
                              <input type="text" placeholder="Địa chỉ giao hàng" value={ordForm.address} onChange={e => setOrdForm({...ordForm, address: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-indigo-500" />
                          </div>

                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                              <label className="text-xs font-bold text-slate-500 mb-2 block">Sản phẩm</label>
                              <select value={ordForm.productId} onChange={e => setOrdForm({...ordForm, productId: e.target.value})} className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-indigo-500 mb-3 font-medium">
                                  <option value="">-- Chọn sản phẩm --</option>
                                  {activeProducts.map(p => (
                                      <option key={p.id} value={p.id}>{p.name} (Kho: {p.stock})</option>
                                  ))}
                              </select>
                              
                              {selectedProduct && (
                                  <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-100">
                                      <span className="text-sm font-bold text-slate-700">Đơn giá: <span className="text-indigo-600">{formatCurrency(productPrice)}</span></span>
                                      <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold text-slate-500">SL:</span>
                                          <input type="number" min="1" max={selectedProduct.stock} value={ordForm.qty} onChange={e => setOrdForm({...ordForm, qty: e.target.value})} className="w-16 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg text-sm outline-none text-center font-bold" />
                                      </div>
                                  </div>
                              )}
                          </div>

                          <div className="space-y-3">
                              <input type="text" placeholder="Phí vận chuyển" value={ordForm.shipping} onChange={e => setOrdForm({...ordForm, shipping: formatNumberInput(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-indigo-500" />
                              
                              {isShopee && (
                                  <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 space-y-3">
                                      <h4 className="text-xs font-bold text-orange-600 uppercase">Phí Shopee</h4>
                                      <input type="text" placeholder="Trợ giá Voucher (trừ vào net)" value={ordForm.voucher} onChange={e => setOrdForm({...ordForm, voucher: formatNumberInput(e.target.value)})} className="w-full bg-white border border-orange-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-orange-500" />
                                      <input type="text" placeholder="Phí thanh toán (tự nhập)" value={ordForm.paymentFee} onChange={e => setOrdForm({...ordForm, paymentFee: formatNumberInput(e.target.value)})} className="w-full bg-white border border-orange-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-orange-500" />
                                      
                                      <div className="text-xs text-orange-700 space-y-1 mt-2 bg-white p-3 rounded-lg border border-orange-100">
                                          <div className="flex justify-between"><span>Tổng đơn (sau voucher):</span> <span className="font-bold">{formatCurrency(baseForFee)}</span></div>
                                          <div className="flex justify-between"><span>Phí cố định (14%):</span> <span className="font-bold">-{formatCurrency(fixedFee)}</span></div>
                                          <div className="flex justify-between"><span>Phí dịch vụ:</span> <span className="font-bold">-3.000 đ</span></div>
                                          <div className="flex justify-between"><span>Thuế GTGT (1%):</span> <span className="font-bold">-{formatCurrency(vat)}</span></div>
                                          <div className="flex justify-between"><span>Thuế TNCN (0.5%):</span> <span className="font-bold">-{formatCurrency(pit)}</span></div>
                                      </div>
                                  </div>
                              )}
                          </div>

                          <div className="bg-slate-800 text-white p-4 rounded-xl mt-4">
                              <div className="flex justify-between items-center mb-1">
                                  <span className="text-sm text-slate-300">Tổng thu dự kiến (Net):</span>
                                  <span className="text-xl font-bold text-emerald-400">{formatCurrency(netRevenue)}</span>
                              </div>
                          </div>

                          <button onClick={handleCreateOrder} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-md shadow-blue-200 active:scale-95 transition-all">Tạo đơn hàng</button>
                      </div>
                  </div>
              ) : (
                  <div className="space-y-4">
                      {activeOrders.length === 0 ? (
                          <p className="text-center text-slate-400 py-8 text-sm">Chưa có đơn hàng nào</p>
                      ) : (
                          activeOrders.map(o => (
                              <div key={o.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                  <div className="flex justify-between items-start mb-3">
                                      <div>
                                          <div className="flex items-center gap-2 mb-1">
                                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                                  o.channel === 'Shopee' ? 'bg-orange-100 text-orange-600' :
                                                  o.channel === 'Facebook' ? 'bg-blue-100 text-blue-600' :
                                                  o.channel === 'Instagram' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-500'
                                              }`}>{o.channel}</span>
                                              <span className="text-xs font-bold text-slate-800">{o.name}</span>
                                          </div>
                                          <p className="text-[10px] text-slate-500">{new Date(o.date).toLocaleDateString('vi-VN')} • {products.find(p => p.id === o.productId)?.name} (x{o.qty})</p>
                                      </div>
                                      <div className="text-right">
                                          <p className="text-sm font-bold text-emerald-600">{formatCurrency(o.netRevenue)}</p>
                                      </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-50">
                                      <div>
                                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Trạng thái</label>
                                          <select 
                                              value={o.status} 
                                              onChange={e => handleUpdateOrder(o.id, 'status', e.target.value)}
                                              className={`w-full text-xs font-bold p-2 rounded-lg outline-none border ${
                                                  o.status === 'Thành Công' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                  o.status === 'Đang Giao' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                  o.status === 'Đã Đặt Cọc' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                  'bg-slate-50 text-slate-600 border-slate-200'
                                              }`}
                                          >
                                              {['Chưa Gửi Hàng', 'Đã Đặt Cọc', 'Đang Giao', 'Thành Công'].map(s => (
                                                  <option key={s} value={s}>{s}</option>
                                              ))}
                                          </select>
                                      </div>
                                      <div>
                                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Thanh toán</label>
                                          <select 
                                              value={o.paymentMethod} 
                                              onChange={e => handleUpdateOrder(o.id, 'paymentMethod', e.target.value)}
                                              className={`w-full text-xs font-bold p-2 rounded-lg outline-none border ${
                                                  o.paymentMethod !== 'Đang Thanh Toán' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-600 border-slate-200'
                                              }`}
                                          >
                                              {['Đang Thanh Toán', 'Ví ShopeePay', 'Tiền Mặt', 'TECHCOMBANK'].map(s => (
                                                  <option key={s} value={s}>{s}</option>
                                              ))}
                                          </select>
                                      </div>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              )}
          </div>
      );
  };

  const renderShopFinance = () => {
      const activeFinances = shopFinances.filter(f => f.shopId === activeShop).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const totalIncome = activeFinances.filter(f => f.type === 'INCOME').reduce((sum, f) => sum + f.amount, 0);
      const totalExpense = activeFinances.filter(f => f.type === 'EXPENSE').reduce((sum, f) => sum + f.amount, 0);
      const balance = totalIncome - totalExpense;

      const FINANCE_CATEGORIES = [
          'Văn phòng phẩm', 'Vật tư đóng gói', 'In ấn - Sản xuất', 'Công nợ', 
          'Tiền vận chuyển', 'Doanh thu sàn TMĐT', 'Doanh thu trực tiếp', 
          'Khác', 'Đặt cọc', 'NHÀ ĐẦU TƯ', 'Quảng cáo'
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
              await supabaseService.addShopFinance(newFinance);
              setShopFinances([newFinance, ...shopFinances]);
              setFinForm({ type: 'INCOME', amount: '', desc: '', category: 'Khác', date: new Date() });
          } catch (error) {
              console.error("Error adding finance:", error);
              alert("Lỗi khi thêm giao dịch");
          }
      };

      return (
          <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 p-4 rounded-[20px] border border-emerald-100">
                      <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Tổng thu</p>
                      <p className="text-lg font-bold text-emerald-700">{formatCurrency(totalIncome)}</p>
                  </div>
                  <div className="bg-rose-50 p-4 rounded-[20px] border border-rose-100">
                      <p className="text-xs font-bold text-rose-600 uppercase mb-1">Tổng chi</p>
                      <p className="text-lg font-bold text-rose-700">{formatCurrency(totalExpense)}</p>
                  </div>
                  <div className="col-span-2 bg-slate-800 p-5 rounded-[24px] text-white shadow-lg shadow-slate-200">
                      <p className="text-sm font-medium text-slate-300 mb-1">Lợi nhuận ròng</p>
                      <p className="text-3xl font-bold">{formatCurrency(balance)}</p>
                  </div>
              </div>

              <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-4">Thêm giao dịch</h3>
                  <div className="flex bg-slate-100 p-1 rounded-xl mb-4 relative">
                       <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm transition-all duration-300 ease-spring ${
                           finForm.type === 'EXPENSE' ? 'left-[calc(50%+2px)]' : 'left-1'
                       }`}></div>
                       <button onClick={() => setFinForm({...finForm, type: 'INCOME'})} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all relative z-10 ${finForm.type === 'INCOME' ? 'text-emerald-600' : 'text-slate-400'}`}>Thu</button>
                       <button onClick={() => setFinForm({...finForm, type: 'EXPENSE'})} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all relative z-10 ${finForm.type === 'EXPENSE' ? 'text-rose-600' : 'text-slate-400'}`}>Chi</button>
                  </div>
                  <div className="space-y-3">
                      <input type="text" placeholder="Số tiền" value={finForm.amount} onChange={e => setFinForm({...finForm, amount: formatNumberInput(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-indigo-500 font-bold" />
                      <select value={finForm.category} onChange={e => setFinForm({...finForm, category: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-indigo-500 font-medium">
                          {FINANCE_CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                          ))}
                      </select>
                      <input type="text" placeholder="Nội dung" value={finForm.desc} onChange={e => setFinForm({...finForm, desc: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm outline-none focus:border-indigo-500" />
                      <div className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm outline-none focus-within:border-indigo-500 flex items-center">
                          <DatePicker selected={finForm.date} onChange={(date: Date | null) => date && setFinForm({...finForm, date})} dateFormat="dd/MM/yyyy" locale={vi} formatWeekDay={formatShortWeekday} className="w-full bg-transparent outline-none" wrapperClassName="flex-1" />
                      </div>
                      <button onClick={handleAddFinance} className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl shadow-md shadow-slate-200 active:scale-95 transition-all mt-2">Lưu giao dịch</button>
                  </div>
              </div>

              <div className="space-y-3">
                  <h3 className="font-bold text-slate-800 px-1">Lịch sử giao dịch</h3>
                  {activeFinances.length === 0 ? (
                      <p className="text-center text-slate-400 py-4 text-sm">Chưa có giao dịch</p>
                  ) : (
                      activeFinances.map(f => (
                          <div key={f.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${f.type === 'INCOME' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                      <span className="material-symbols-rounded">{f.type === 'INCOME' ? 'trending_up' : 'trending_down'}</span>
                                  </div>
                                  <div>
                                      <h4 className="font-bold text-slate-800 text-sm">{f.description}</h4>
                                      <div className="flex items-center gap-2 mt-0.5">
                                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">{f.category || 'Khác'}</span>
                                          <p className="text-xs text-slate-500">{new Date(f.date).toLocaleDateString('vi-VN')}</p>
                                      </div>
                                  </div>
                              </div>
                              <p className={`font-bold text-sm ${f.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {f.type === 'INCOME' ? '+' : '-'}{formatCurrency(f.amount)}
                              </p>
                          </div>
                      ))
                  )}
              </div>
          </div>
      );
  };

  const renderShop = () => {
      const shops = [
          { id: 'eclat', name: 'Éclat Royal', icon: 'diamond' },
          { id: 'elank', name: 'Elank Studio', icon: 'palette' }
      ];

      return (
          <div className="pb-32 animate-fade-in pt-4">
              {/* Header & Shop Selector */}
              <div className="flex items-center justify-between mb-6 px-1">
                  <h2 className="text-2xl font-bold text-slate-800">Cửa hàng</h2>
                  <div className="relative">
                      <select 
                          value={activeShop}
                          onChange={(e) => setActiveShop(e.target.value as 'eclat' | 'elank')}
                          className="appearance-none bg-white border border-slate-200 text-slate-700 py-2 pl-4 pr-10 rounded-xl font-bold text-sm outline-none shadow-sm focus:border-indigo-500 cursor-pointer"
                      >
                          {shops.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                      </select>
                      <span className="material-symbols-rounded absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">
                          expand_more
                      </span>
                  </div>
              </div>

              {/* Shop Dashboard */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                  <button 
                      onClick={() => setShopView('orders')} 
                      className={`bg-white p-5 rounded-[24px] shadow-sm border flex flex-col items-center justify-center gap-3 active:scale-95 transition-all ${
                          shopView === 'orders' ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-100'
                      }`}
                  >
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                          <span className="material-symbols-rounded">add_shopping_cart</span>
                      </div>
                      <span className="font-bold text-slate-700 text-sm">Tạo đơn hàng</span>
                  </button>
                  <button 
                      onClick={() => setShopView('inventory')} 
                      className={`bg-white p-5 rounded-[24px] shadow-sm border flex flex-col items-center justify-center gap-3 active:scale-95 transition-all ${
                          shopView === 'inventory' ? 'border-amber-500 ring-2 ring-amber-100' : 'border-slate-100'
                      }`}
                  >
                      <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center">
                          <span className="material-symbols-rounded">inventory_2</span>
                      </div>
                      <span className="font-bold text-slate-700 text-sm">Kho hàng</span>
                  </button>
                  <button 
                      onClick={() => setShopView('finance')} 
                      className={`bg-white p-5 rounded-[24px] shadow-sm border flex flex-col items-center justify-center gap-3 active:scale-95 transition-all col-span-2 ${
                          shopView === 'finance' ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-100'
                      }`}
                  >
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                          <span className="material-symbols-rounded">account_balance_wallet</span>
                      </div>
                      <span className="font-bold text-slate-700 text-sm">Tài chính & Báo cáo</span>
                  </button>
              </div>

              {/* Channels */}
              <div className="mb-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Kênh bán hàng</h3>
                  <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                      {['Shopee', 'Facebook', 'Instagram', 'Zalo'].map(channel => (
                          <div key={channel} className="bg-white px-4 py-2.5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-2 whitespace-nowrap">
                              <div className={`w-2 h-2 rounded-full ${
                                  channel === 'Shopee' ? 'bg-orange-500' :
                                  channel === 'Facebook' ? 'bg-blue-600' :
                                  channel === 'Instagram' ? 'bg-pink-500' : 'bg-blue-400'
                              }`}></div>
                              <span className="text-sm font-bold text-slate-700">{channel}</span>
                          </div>
                      ))}
                  </div>
              </div>

              {/* Placeholder for selected view */}
              {shopView === 'inventory' && renderShopInventory()}
              {shopView === 'orders' && renderShopOrders()}
              {shopView === 'finance' && renderShopFinance()}
              {shopView === 'overview' && (
                  <div className="bg-slate-50 rounded-[24px] p-8 border border-slate-100 text-center flex flex-col items-center justify-center">
                      <span className="material-symbols-rounded text-5xl text-slate-300 mb-4">
                          storefront
                      </span>
                      <h4 className="text-lg font-bold text-slate-800 mb-2">Tổng quan</h4>
                      <p className="text-slate-500 text-sm font-medium">
                          Chọn một chức năng bên trên để bắt đầu quản lý <br/>
                          <span className="font-bold text-indigo-600 mt-1 inline-block">
                              {shops.find(s => s.id === activeShop)?.name}
                          </span>
                      </p>
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 selection:bg-indigo-100">
      <main className="max-w-md mx-auto min-h-screen relative bg-[#F8FAFC] shadow-2xl overflow-hidden pb-safe">
        {isLoading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p className="text-sm font-bold text-indigo-600 animate-pulse">Đang đồng bộ...</p>
                </div>
            </div>
        )}
        
        {/* Error State Overlay */}
        {configError && !isLoading && (
             <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-50 flex items-center justify-center p-6 text-center">
                <div className="max-w-xs">
                    <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-rounded text-3xl">cloud_off</span>
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg mb-2">Chưa cấu hình Cloud</h3>
                    <p className="text-slate-500 text-sm mb-6">{configError}</p>
                    <div className="bg-slate-100 p-3 rounded-lg text-xs font-mono text-left mb-6 overflow-x-auto text-slate-600">
                        supabaseClient.ts
                    </div>
                    <p className="text-xs text-slate-400">Vui lòng cập nhật URL và Key trong code.</p>
                </div>
            </div>
        )}

        <div className="px-5 pt-safe relative">
          <AnimatePresence mode="wait">
              {activeTab === 'home' && (
                  <motion.div
                      key="home"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                  >
                      {renderHome()}
                  </motion.div>
              )}
              {activeTab === 'history' && (
                  <motion.div
                      key="history"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                  >
                      {renderHistory()}
                  </motion.div>
              )}
              {activeTab === 'shop' && (
                  <motion.div
                      key="shop"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                  >
                      {renderShop()}
                  </motion.div>
              )}
          </AnimatePresence>
        </div>

        {/* Docked Bottom Nav */}
        <div className="fixed bottom-0 left-0 right-0 z-40 pb-safe bg-white/90 backdrop-blur-xl border-t border-slate-200/60 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
            <div className="flex justify-around items-center px-6 py-2 max-w-md mx-auto">
                <button 
                    onClick={() => setActiveTab('home')}
                    className={`flex flex-col items-center gap-0.5 p-1.5 rounded-xl transition-all active:scale-95 ${activeTab === 'home' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-400'}`}
                >
                    <span className={`material-symbols-rounded text-[24px] ${activeTab === 'home' ? 'fill-1' : ''}`}>home</span>
                    <span className="text-[10px] font-bold">Trang chủ</span>
                </button>

                <button 
                    onClick={() => setActiveTab('history')}
                    className={`flex flex-col items-center gap-0.5 p-1.5 rounded-xl transition-all active:scale-95 ${activeTab === 'history' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-400'}`}
                >
                    <span className={`material-symbols-rounded text-[24px] ${activeTab === 'history' ? 'fill-1' : ''}`}>calendar_month</span>
                    <span className="text-[10px] font-bold">Lịch sử</span>
                </button>

                <button 
                    onClick={() => setActiveTab('shop')}
                    className={`flex flex-col items-center gap-0.5 p-1.5 rounded-xl transition-all active:scale-95 ${activeTab === 'shop' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-400'}`}
                >
                    <span className={`material-symbols-rounded text-[24px] ${activeTab === 'shop' ? 'fill-1' : ''}`}>storefront</span>
                    <span className="text-[10px] font-bold">Cửa hàng</span>
                </button>
            </div>
        </div>

        {/* Transfer Bottom Sheet */}
        {showTransfer && (
            <div className="fixed inset-0 z-50 flex items-end justify-center">
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setShowTransfer(false)}></div>
                <div className="bg-white w-full max-w-md rounded-t-[32px] p-6 shadow-2xl animate-slide-up relative z-10 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
                    <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8"></div>
                    
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800">
                        <span className="p-2 bg-indigo-50 text-indigo-600 rounded-full">
                           <span className="material-symbols-rounded block">swap_horiz</span>
                        </span>
                        Chuyển tiền nội bộ
                    </h3>
                    
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div className="flex-1">
                                <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Từ ví</label>
                                <select 
                                    value={transferFrom} 
                                    onChange={(e) => setTransferFrom(e.target.value as AccountType)}
                                    className="w-full bg-transparent font-bold text-slate-700 outline-none"
                                >
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                                    ))}
                                </select>
                            </div>
                            <span className="material-symbols-rounded text-slate-300">arrow_forward</span>
                            <div className="flex-1 text-right">
                                <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Đến ví</label>
                                <select 
                                    value={transferTo} 
                                    onChange={(e) => setTransferTo(e.target.value as AccountType)}
                                    className="w-full bg-transparent font-bold text-indigo-600 outline-none text-right"
                                >
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.id} disabled={acc.id === transferFrom}>{acc.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-slate-600 mb-2 block">Nhập số tiền</label>
                            <input 
                                type="text"
                                inputMode="numeric"
                                value={transferAmount}
                                onChange={(e) => setTransferAmount(formatNumberInput(e.target.value))}
                                placeholder="VD: 500"
                                className="w-full bg-slate-50 border-b-2 border-indigo-100 px-4 py-3 text-2xl font-bold text-slate-800 outline-none focus:border-indigo-500 transition-colors"
                            />
                            {transferAmount && (
                                <p className="text-xs text-indigo-500 mt-2 font-medium">
                                    Sẽ chuyển: {formatCurrency(parseSmartAmount(transferAmount))}
                                </p>
                            )}
                        </div>

                        <button 
                            onClick={handleTransfer}
                            disabled={!transferAmount || transferFrom === transferTo}
                            className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none active:scale-95 transition-all mt-4"
                        >
                            Xác nhận chuyển
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Bill Modal (Creation) */}
        {showBill && (
            <BillGenerator 
                transactions={transactions} 
                onClose={() => setShowBill(false)} 
                onSettle={handleSettleDebts}
            />
        )}

        {/* Bill Modal (Viewing History) */}
        {viewingBill && (
            <BillGenerator 
                transactions={viewingBill.transactions} 
                onClose={() => setViewingBill(null)} 
                onSettle={() => {}} // No-op for historical view
                isHistorical={true}
                historicalDate={viewingBill.date}
                historicalTotalPaid={viewingBill.totalPaid}
            />
        )}

        {/* Delete Confirmation Modal */}
        {deletingTx && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-safe pb-safe">
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setDeletingTx(null)}></div>
                <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative z-10 animate-scale-up">
                    <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8"></div>
                    <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center mb-4 mx-auto">
                        <span className="material-symbols-rounded text-2xl">delete</span>
                    </div>
                    <h3 className="text-xl font-bold text-center text-slate-800 mb-2">Xoá giao dịch?</h3>
                    <p className="text-center text-slate-500 mb-8 text-sm leading-relaxed">
                        Bạn có chắc muốn xoá <span className="font-bold text-slate-700">"{deletingTx.description}"</span>? 
                        <br/>Số dư tài khoản sẽ được hoàn lại.
                    </p>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setDeletingTx(null)}
                            className="flex-1 py-3.5 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 active:scale-95 transition-all"
                        >
                            Hủy
                        </button>
                        <button 
                            onClick={confirmDelete}
                            className="flex-1 py-3.5 bg-rose-500 text-white font-bold rounded-2xl shadow-lg shadow-rose-200 hover:bg-rose-600 active:scale-95 transition-all"
                        >
                            Xoá ngay
                        </button>
                    </div>
                </div>
            </div>
        )}
        {/* Edit Transaction Modal */}
        {editingTx && (
            <div className="fixed inset-0 z-50 flex items-end justify-center">
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setEditingTx(null)}></div>
                <div className="bg-white w-full max-w-md rounded-t-[32px] p-6 shadow-2xl animate-slide-up relative z-10 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
                    <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8"></div>
                    
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800">
                        <span className="p-2 bg-blue-50 text-blue-600 rounded-full">
                           <span className="material-symbols-rounded block">edit</span>
                        </span>
                        Sửa giao dịch
                    </h3>
                    
                    <div className="space-y-5">
                        <div>
                            <label className="text-sm font-medium text-slate-600 mb-2 block">Số tiền</label>
                            <input 
                                type="text"
                                inputMode="numeric"
                                value={editAmount}
                                onChange={(e) => setEditAmount(formatNumberInput(e.target.value))}
                                className="w-full bg-slate-50 border-b-2 border-slate-200 px-4 py-3 text-2xl font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-slate-600 mb-2 block">Ngày giao dịch</label>
                            <div className="w-full bg-slate-50 border-b-2 border-slate-200 px-4 py-3 text-lg font-bold text-slate-800 outline-none focus-within:border-blue-500 transition-colors flex items-center gap-2">
                                <span className="material-symbols-rounded text-slate-400">calendar_month</span>
                                <DatePicker 
                                    selected={editDate} 
                                    onChange={(date: Date | null) => date && setEditDate(date)} 
                                    dateFormat="dd/MM/yyyy"
                                    locale={vi}
                                    formatWeekDay={formatShortWeekday}
                                    className="w-full outline-none bg-transparent cursor-pointer"
                                    wrapperClassName="flex-1"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-slate-600 mb-2 block">Nội dung</label>
                            <input 
                                type="text"
                                value={editDesc}
                                onChange={(e) => setEditDesc(e.target.value)}
                                className="w-full bg-slate-50 border-b-2 border-slate-200 px-4 py-3 text-lg font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button 
                                onClick={() => setEditingTx(null)}
                                className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 active:scale-95 transition-all"
                            >
                                Hủy
                            </button>
                            <button 
                                onClick={confirmEdit}
                                disabled={!editAmount || !editDesc.trim()}
                                className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none active:scale-95 transition-all"
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
            animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes scale-up {
            from { transform: scale(0.9); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-up {
            animation: scale-up 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ease-spring {
            transition-timing-function: cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        
        /* React DatePicker Custom Styles */
        .react-datepicker-wrapper {
            width: 100%;
        }
        .react-datepicker {
            font-family: inherit;
            border-radius: 1rem;
            border: 1px solid #e2e8f0;
            box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
        }
        .react-datepicker__header {
            background-color: white;
            border-bottom: 1px solid #e2e8f0;
            border-top-left-radius: 1rem !important;
            border-top-right-radius: 1rem !important;
            padding-top: 1rem;
        }
        .react-datepicker__day-name, .react-datepicker__day, .react-datepicker__time-name {
            width: 2.2rem;
            line-height: 2.2rem;
            margin: 0.15rem;
            font-weight: 500;
        }
        .react-datepicker__day--selected {
            background-color: #4f46e5 !important;
            border-radius: 0.5rem;
            color: white !important;
        }
        .react-datepicker__day--keyboard-selected {
            background-color: #818cf8 !important;
            border-radius: 0.5rem;
            color: white !important;
        }
        .react-datepicker__current-month {
            font-weight: 700;
            font-size: 1.1rem;
            margin-bottom: 0.5rem;
        }
      `}</style>
    </div>
  );
}