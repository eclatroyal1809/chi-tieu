import React, { useState, useEffect } from 'react';
import { AccountType, Account, Transaction, SplitType, TransactionType } from './types';
import { INITIAL_ACCOUNTS, SPLIT_OPTIONS } from './constants';
import { AccountCard } from './components/AccountCard';
import { BillGenerator } from './components/BillGenerator';
import * as supabaseService from './services/supabaseService';
import { supabase } from './supabaseClient'; // Import to check config

export default function App() {
  // State
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'home' | 'history'>('home');
  const [historyFilter, setHistoryFilter] = useState<'MEO' | 'ME' | 'BILL'>('MEO');
  
  const [showBill, setShowBill] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  
  // Delete Confirmation State
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);

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

  // Transfer State
  const [transferAmount, setTransferAmount] = useState('');
  const [transferFrom, setTransferFrom] = useState<AccountType>(AccountType.MB);
  const [transferTo, setTransferTo] = useState<AccountType>(AccountType.CASH);
  
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
            
            // Fetch data concurrently
            const [fetchedAccounts, fetchedTransactions] = await Promise.all([
                supabaseService.getAccounts(),
                supabaseService.getTransactions()
            ]);

            setAccounts(fetchedAccounts);
            setTransactions(fetchedTransactions);
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
                 // Lúc tạo là Mèo trả cho mình (Cộng tiền) -> Xoá là trừ tiền
                 newBalance -= amount;
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
        date: new Date().toISOString(),
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
        const isMeoPayingMe = qaSplit === SplitType.MEO_PAID;
        newBalance = isMeoPayingMe ? newBalance + amountVal : newBalance - amountVal;
    }

    try {
        await Promise.all([
            supabaseService.addTransaction(newTx),
            supabaseService.updateAccountBalance(qaAccount, newBalance)
        ]);

        // Optimistic UI Update
        setTransactions(prev => [newTx, ...prev]);
        setAccounts(prev => prev.map(acc => 
            acc.id === qaAccount ? { ...acc, balance: newBalance } : acc
        ));

        setQaDesc('');
        setQaAmount('');
        setQaSplit(SplitType.SHARED);
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
    <div className="space-y-6 pb-32 animate-fade-in pt-4">
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

                 <input 
                     type="text" 
                     value={qaDesc}
                     onChange={(e) => setQaDesc(e.target.value)}
                     placeholder={qaType === TransactionType.INCOME ? "Nguồn thu nhập..." : "Nội dung chi tiêu..."}
                     className="w-full text-lg font-medium text-slate-700 placeholder-slate-300 outline-none bg-transparent"
                 />
             </div>

             <div className="mb-5">
                 <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                     {[AccountType.MB, AccountType.TCB, AccountType.CASH].map(type => {
                         const acc = accounts.find(a => a.id === type);
                         if(!acc) return null;
                         const isSelected = qaAccount === acc.id;
                         return (
                            <button
                                key={acc.id}
                                onClick={() => setQaAccount(acc.id as AccountType)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold border transition-all whitespace-nowrap active:scale-95 ${
                                    isSelected 
                                    ? `bg-slate-800 text-white border-slate-800 shadow-lg shadow-slate-200` 
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
                                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm' 
                                            : 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm')
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
                    qaType === TransactionType.INCOME ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200' :
                    qaSplit === SplitType.MEO_PAID ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
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
                className="text-xs font-bold text-indigo-600 bg-indigo-50 active:bg-indigo-100 px-4 py-2 rounded-full flex items-center gap-1 transition-all active:scale-95"
            >
                <span className="material-symbols-rounded text-lg">swap_horiz</span>
                Chuyển tiền
            </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
            {accounts.map(acc => (
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
        <div className="pb-32 animate-fade-in pt-4">
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
                                                
                                                {/* Delete Button */}
                                                {!t.isSettled || t.type === TransactionType.SETTLEMENT || (t.type === TransactionType.INCOME && t.splitType === SplitType.MEO_PAID) ? (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteTransaction(t.id);
                                                        }}
                                                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all active:scale-90"
                                                    >
                                                        <span className="material-symbols-rounded text-lg">delete</span>
                                                    </button>
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

        <div className="px-5">
          {activeTab === 'home' && renderHome()}
          {activeTab === 'history' && renderHistory()}
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
            </div>
        </div>

        {/* Transfer Bottom Sheet */}
        {showTransfer && (
            <div className="fixed inset-0 z-50 flex items-end justify-center">
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setShowTransfer(false)}></div>
                <div className="bg-white w-full max-w-md rounded-t-[32px] p-6 shadow-2xl animate-slide-up relative z-10 pb-10">
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
      `}</style>
    </div>
  );
}