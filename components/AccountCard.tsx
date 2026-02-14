import React, { useState } from 'react';
import { Account, AccountType } from '../types';

interface AccountCardProps {
  account: Account;
  onUpdateBalance: (id: string, newBalance: number) => void;
}

export const AccountCard: React.FC<AccountCardProps> = ({ account, onUpdateBalance }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempBalance, setTempBalance] = useState('');

  const formatNumberInput = (value: string) => {
    const raw = value.replace(/\D/g, '');
    if (!raw) return '';
    return new Intl.NumberFormat('vi-VN').format(parseInt(raw, 10));
  };

  const handleStartEdit = () => {
    setTempBalance(formatNumberInput(account.balance.toString()));
    setIsEditing(true);
  };

  const handleSave = () => {
    const raw = tempBalance.replace(/\./g, '');
    const val = parseFloat(raw);
    if (!isNaN(val)) {
      onUpdateBalance(account.id, val);
    }
    setIsEditing(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  // Modern gradients based on account type
  const getGradient = (type: AccountType) => {
    switch (type) {
      case AccountType.MB: return 'from-blue-600 to-blue-800';
      case AccountType.TCB: return 'from-red-500 to-red-700';
      case AccountType.SAVING: return 'from-purple-500 to-indigo-600';
      case AccountType.CASH: return 'from-emerald-500 to-emerald-700';
      default: return 'from-slate-500 to-slate-700';
    }
  };

  return (
    <div className={`rounded-2xl p-4 shadow-lg text-white flex flex-col justify-between h-32 relative overflow-hidden bg-gradient-to-br ${getGradient(account.id)} transition-transform active:scale-95`}>
      {/* Decorative Circles */}
      <div className="absolute top-[-20px] right-[-20px] w-24 h-24 rounded-full bg-white opacity-10 blur-xl"></div>
      <div className="absolute bottom-[-10px] left-[-10px] w-16 h-16 rounded-full bg-black opacity-10 blur-md"></div>
      
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg">
                <span className="material-symbols-rounded text-lg">{account.icon}</span>
            </div>
            <span className="font-medium text-sm text-white/90 truncate max-w-[80px]">{account.name}</span>
        </div>
        {/* Visa-like chip just for visuals */}
        <div className="w-8 h-5 rounded bg-yellow-200/80 overflow-hidden relative opacity-80">
            <div className="absolute top-1 left-0 right-0 h-[1px] bg-black/20"></div>
            <div className="absolute bottom-1 left-0 right-0 h-[1px] bg-black/20"></div>
        </div>
      </div>

      <div className="mt-auto z-10">
        {isEditing ? (
          <div className="flex items-center">
            <input
              type="text"
              inputMode="numeric"
              className="w-full text-xl font-bold border-b border-white/50 focus:border-white focus:outline-none bg-transparent placeholder-white/50"
              value={tempBalance}
              onChange={(e) => setTempBalance(formatNumberInput(e.target.value))}
              autoFocus
              onBlur={handleSave}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
        ) : (
          <div 
            onClick={handleStartEdit}
            className="text-xl font-bold tracking-tight cursor-pointer"
          >
            {formatCurrency(account.balance)}
          </div>
        )}
        <p className="text-[10px] text-white/60 mt-0.5 font-medium">Số dư khả dụng</p>
      </div>
    </div>
  );
};