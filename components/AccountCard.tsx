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

  // Pure White Apple Card aesthetic with delicate brand accents
  const getCardTheme = (type: AccountType) => {
    switch (type) {
      case AccountType.MB:
        return {
          chip: 'bg-[#003399]/10 border-[#003399]/20 text-[#003399]',
          badge: 'bg-[#003399] text-white',
          tag: 'MB Bank',
          dot: 'bg-[#003399]'
        };
      case AccountType.TCB:
        return {
          chip: 'bg-[#e3001b]/10 border-[#e3001b]/20 text-[#e3001b]',
          badge: 'bg-[#e3001b] text-white',
          tag: 'Techcombank',
          dot: 'bg-[#e3001b]'
        };
      case AccountType.SAVING:
        return {
          chip: 'bg-[#5856d6]/10 border-[#5856d6]/20 text-[#5856d6]',
          badge: 'bg-[#5856d6] text-white',
          tag: 'Tiết kiệm',
          dot: 'bg-[#5856d6]'
        };
      case AccountType.TET_SAVING:
        return {
          chip: 'bg-[#ff2d55]/10 border-[#ff2d55]/20 text-[#ff2d55]',
          badge: 'bg-[#ff2d55] text-white',
          tag: 'Ăn Tết',
          dot: 'bg-[#ff2d55]'
        };
      case AccountType.CASH:
      default:
        return {
          chip: 'bg-[#34c759]/10 border-[#34c759]/20 text-[#34c759]',
          badge: 'bg-[#34c759] text-white',
          tag: 'Tiền mặt',
          dot: 'bg-[#34c759]'
        };
    }
  };

  const theme = getCardTheme(account.id);

  return (
    <div 
      className="bg-white rounded-[24px] p-4 text-[#1d1d1f] flex flex-col justify-between h-36 relative overflow-hidden border border-black/[0.06] shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.05)] transition-all duration-200 active:scale-[0.98] cursor-pointer group"
    >
      {/* Subtle Apple Card pearl titanium sheen */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-black/[0.02] to-transparent rounded-full -mr-10 -mt-10 pointer-events-none"></div>
      
      {/* Card Header: Chip & Account Info */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${theme.chip} shrink-0`}>
            <span className="material-symbols-rounded text-base">{account.icon || 'credit_card'}</span>
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-xs tracking-tight text-[#1d1d1f] truncate">{account.name}</h4>
            <p className="text-[10px] text-[#86868b] tracking-wider uppercase font-medium">{theme.tag}</p>
          </div>
        </div>
        
        {/* Apple Pay contactless waves icon */}
        <span className="material-symbols-rounded text-black/20 text-base group-hover:text-black/40 transition-colors">
          contactless
        </span>
      </div>

      {/* Card Footer: Balance & Edit */}
      <div className="mt-auto z-10 pt-2">
        <p className="text-[10px] text-[#86868b] tracking-wider uppercase font-semibold mb-0.5">Số dư khả dụng</p>
        {isEditing ? (
          <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              inputMode="numeric"
              className="w-full text-base font-semibold tracking-tight border-b-2 border-[#0071e3] focus:outline-none bg-transparent placeholder-black/30 text-[#1d1d1f]"
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
            className="text-base font-semibold tracking-tight text-[#1d1d1f] hover:text-[#0071e3] transition-colors flex items-baseline gap-1"
            title="Chạm để sửa số dư"
          >
            <span>{formatCurrency(account.balance)}</span>
          </div>
        )}
      </div>
    </div>
  );
};