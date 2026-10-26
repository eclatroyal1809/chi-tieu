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

  // Apple-inspired card finishes: minimalist titanium & matte finishes with subtle glowing accents
  const getCardTheme = (type: AccountType) => {
    switch (type) {
      case AccountType.MB:
        return {
          bg: 'bg-gradient-to-br from-[#1c1c1e] via-[#161618] to-[#0f172a]',
          border: 'border-blue-500/20',
          accent: 'text-blue-400',
          chip: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
          tag: 'MB Bank'
        };
      case AccountType.TCB:
        return {
          bg: 'bg-gradient-to-br from-[#1f1719] via-[#1c1618] to-[#121214]',
          border: 'border-rose-500/20',
          accent: 'text-rose-400',
          chip: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
          tag: 'Techcombank'
        };
      case AccountType.SAVING:
        return {
          bg: 'bg-gradient-to-br from-[#1e1c24] via-[#181620] to-[#111114]',
          border: 'border-purple-500/20',
          accent: 'text-purple-400',
          chip: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
          tag: 'Tiết kiệm'
        };
      case AccountType.TET_SAVING:
        return {
          bg: 'bg-gradient-to-br from-[#241a20] via-[#1d161a] to-[#121214]',
          border: 'border-pink-500/20',
          accent: 'text-pink-400',
          chip: 'bg-pink-500/10 border-pink-500/30 text-pink-300',
          tag: 'Ăn Tết'
        };
      case AccountType.CASH:
      default:
        return {
          bg: 'bg-gradient-to-br from-[#1c221e] via-[#171c19] to-[#121413]',
          border: 'border-emerald-500/20',
          accent: 'text-emerald-400',
          chip: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
          tag: 'Tiền mặt'
        };
    }
  };

  const theme = getCardTheme(account.id);

  return (
    <div 
      className={`rounded-2xl p-4 text-white flex flex-col justify-between h-36 relative overflow-hidden ${theme.bg} border ${theme.border} shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all duration-200 active:scale-[0.98] cursor-pointer group`}
    >
      {/* Subtle Apple Card metallic sheen */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-white/[0.08] to-transparent rounded-full -mr-12 -mt-12 pointer-events-none blur-xl"></div>
      
      {/* Card Header: Chip & Account Info */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${theme.chip} shrink-0`}>
            <span className="material-symbols-rounded text-sm">{account.icon || 'credit_card'}</span>
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-xs tracking-tight text-white/95 truncate">{account.name}</h4>
            <p className="text-[10px] text-white/40 tracking-wider uppercase font-medium">{theme.tag}</p>
          </div>
        </div>
        
        {/* Apple Pay style contactless icon */}
        <span className="material-symbols-rounded text-white/20 text-base group-hover:text-white/40 transition-colors">contactless</span>
      </div>

      {/* Card Footer: Balance & Edit */}
      <div className="mt-auto z-10 pt-2">
        <p className="text-[10px] text-white/50 tracking-wider uppercase font-semibold mb-0.5">Số dư</p>
        {isEditing ? (
          <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              inputMode="numeric"
              className="w-full text-lg font-semibold tracking-tight border-b border-white/60 focus:border-white focus:outline-none bg-transparent placeholder-white/40 text-white"
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
            className="text-lg font-semibold tracking-tight text-white/95 hover:text-white transition-colors flex items-baseline gap-1"
            title="Chạm để sửa số dư"
          >
            <span>{formatCurrency(account.balance)}</span>
          </div>
        )}
      </div>
    </div>
  );
};