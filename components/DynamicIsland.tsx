import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Account, Transaction, AccountType } from '../types';

interface DynamicIslandProps {
  totalBalance: number;
  meoDebt: number;
  isCredit: boolean;
  onOpenBill: () => void;
  onQuickAddDeposit: () => void;
  onOpenTransfer: () => void;
  transactions: Transaction[];
  accounts: Account[];
}

export const DynamicIsland: React.FC<DynamicIslandProps> = ({
  totalBalance,
  meoDebt,
  isCredit,
  onOpenBill,
  onQuickAddDeposit,
  onOpenTransfer,
  transactions,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeMode, setActiveMode] = useState<'debt' | 'soundwave' | 'battery'>('debt');

  // Calculate 7 days spending for equalizer
  const today = new Date();
  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const dailySpendings = [0, 0, 0, 0, 0, 0, 0];

  transactions.forEach((tx) => {
    const d = new Date(tx.date);
    const diffDays = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays < 7 && tx.type === 'EXPENSE') {
      const dayIdx = d.getDay();
      dailySpendings[dayIdx] += tx.amount;
    }
  });

  const maxDaily = Math.max(...dailySpendings, 100000);

  const formatShortVND = (amount: number) => {
    if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'tr';
    if (amount >= 1000) return (amount / 1000).toFixed(0) + 'k';
    return amount.toString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div className="fixed top-2 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <AnimatePresence initial={false} mode="wait">
        {!isExpanded ? (
          /* COLLAPSED DYNAMIC ISLAND (Inspired by PickMe, OLA & Spotify waveform in image) */
          <motion.div
            key="collapsed"
            layoutId="dynamic-island"
            onClick={() => setIsExpanded(true)}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="pointer-events-auto bg-black text-white h-10 px-4 rounded-full shadow-[0_10px_35px_rgba(0,0,0,0.35)] border border-white/15 flex items-center gap-3 cursor-pointer select-none hover:border-white/30 transition-colors"
          >
            {/* Animated Soundwave / Live indicator */}
            <div className="flex items-center gap-0.5 h-3.5">
              <span className="w-1 bg-[#30d158] rounded-full animate-[pulse_1s_ease-in-out_infinite] h-2"></span>
              <span className="w-1 bg-[#30d158] rounded-full animate-[pulse_1.2s_ease-in-out_infinite_200ms] h-3.5"></span>
              <span className="w-1 bg-[#30d158] rounded-full animate-[pulse_0.8s_ease-in-out_infinite_400ms] h-2.5"></span>
              <span className="w-1 bg-[#30d158] rounded-full animate-[pulse_1.4s_ease-in-out_infinite_100ms] h-3"></span>
            </div>

            {/* Live Status Pill Text */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-white/70 tracking-tight">M&M Live</span>
              <span className="text-white/30">|</span>
              <span className={`text-xs font-bold tracking-tight ${isCredit ? 'text-[#30d158]' : 'text-[#ffd60a]'}`}>
                {isCredit ? 'Mèo dư ' : 'Mèo nợ '}
                {formatShortVND(Math.abs(meoDebt))}
              </span>
            </div>

            {/* Expand Indicator */}
            <span className="material-symbols-rounded text-white/50 text-sm">unfold_more</span>
          </motion.div>
        ) : (
          /* EXPANDED DYNAMIC ISLAND (Inspired by Scooter battery, Yellow Frequency & Music widgets in image) */
          <motion.div
            key="expanded"
            layoutId="dynamic-island"
            initial={{ scale: 0.92, opacity: 0, y: -8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="pointer-events-auto w-full max-w-sm bg-[#000000] text-white rounded-[32px] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/20 select-none overflow-hidden relative"
          >
            {/* Ambient backlight glow */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-[#ffd60a]/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-36 h-36 bg-[#30d158]/10 rounded-full blur-3xl pointer-events-none"></div>

            {/* Header: Mode Selector + Close button */}
            <div className="flex justify-between items-center mb-3 relative z-10">
              <div className="flex items-center gap-1 bg-white/10 p-1 rounded-full border border-white/5">
                <button
                  onClick={() => setActiveMode('debt')}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${
                    activeMode === 'debt' ? 'bg-white text-black shadow-sm' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Đối soát nợ
                </button>
                <button
                  onClick={() => setActiveMode('soundwave')}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${
                    activeMode === 'soundwave' ? 'bg-[#ffd60a] text-black shadow-sm' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Tần số chi tiêu
                </button>
                <button
                  onClick={() => setActiveMode('battery')}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${
                    activeMode === 'battery' ? 'bg-[#30d158] text-black shadow-sm' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Năng lượng ví
                </button>
              </div>

              {/* Close Button (like [x] pill in image) */}
              <button
                onClick={() => setIsExpanded(false)}
                className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 active:scale-90 flex items-center justify-center text-white/80 transition-all"
              >
                <span className="material-symbols-rounded text-sm">close</span>
              </button>
            </div>

            {/* TAB 1: LIVE DEBT & TRIP TRACKER (Inspired by 'Drop in 10 min' & 'Order arriving' in image) */}
            {activeMode === 'debt' && (
              <div className="space-y-3 relative z-10 animate-fade-in">
                <div className="flex justify-between items-center bg-white/[0.06] p-3 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#ffd60a]/20 text-[#ffd60a] flex items-center justify-center font-bold text-sm border border-[#ffd60a]/30">
                      🐱
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-white/50 tracking-wider">
                        {isCredit ? 'Mèo có số dư' : 'Mèo đang nợ Me'}
                      </p>
                      <p className={`text-xl font-extrabold tracking-tight ${isCredit ? 'text-[#30d158]' : 'text-[#ffd60a]'}`}>
                        {formatCurrency(Math.abs(meoDebt))}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white/80">
                      {isCredit ? 'Đã dư tiền' : 'Cần đối soát'}
                    </span>
                  </div>
                </div>

                {/* Live Activity Step Slider (like burger delivery track in image) */}
                <div className="bg-white/[0.04] p-3 rounded-2xl border border-white/5">
                  <div className="flex justify-between text-[10px] font-medium text-white/60 mb-2">
                    <span>Ghi chép</span>
                    <span>Đối soát</span>
                    <span>Chuyển khoản</span>
                    <span>Hoàn tất</span>
                  </div>
                  <div className="relative flex items-center">
                    <div className="h-1 bg-white/15 w-full rounded-full"></div>
                    <div
                      className="absolute h-1 bg-gradient-to-r from-[#ffd60a] to-[#30d158] rounded-full transition-all duration-500"
                      style={{ width: isCredit ? '100%' : Math.abs(meoDebt) > 0 ? '60%' : '20%' }}
                    ></div>
                    {/* Sliding marker car/avatar */}
                    <div
                      className="absolute w-5 h-5 rounded-full bg-[#ffd60a] text-black flex items-center justify-center shadow-lg -ml-2.5 transition-all duration-500"
                      style={{ left: isCredit ? '100%' : Math.abs(meoDebt) > 0 ? '60%' : '20%' }}
                    >
                      <span className="material-symbols-rounded text-xs">local_shipping</span>
                    </div>
                  </div>
                </div>

                {/* Tactile Control Buttons (Inspired by image scooter widgets) */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={() => {
                      onQuickAddDeposit();
                      setIsExpanded(false);
                    }}
                    className="py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white flex flex-col items-center justify-center gap-0.5 border border-white/10 transition-all"
                  >
                    <span className="material-symbols-rounded text-base text-[#30d158]">add_circle</span>
                    <span className="text-[10px] font-semibold">+300k Mèo</span>
                  </button>

                  <button
                    onClick={() => {
                      onOpenBill();
                      setIsExpanded(false);
                    }}
                    className="py-2.5 rounded-2xl bg-[#ffd60a] hover:bg-[#ffe033] active:scale-95 text-black flex flex-col items-center justify-center gap-0.5 shadow-md transition-all"
                  >
                    <span className="material-symbols-rounded text-base font-bold">receipt_long</span>
                    <span className="text-[10px] font-bold">Chốt hoá đơn</span>
                  </button>

                  <button
                    onClick={() => {
                      onOpenTransfer();
                      setIsExpanded(false);
                    }}
                    className="py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white flex flex-col items-center justify-center gap-0.5 border border-white/10 transition-all"
                  >
                    <span className="material-symbols-rounded text-base text-[#0a84ff]">sync_alt</span>
                    <span className="text-[10px] font-semibold">Chuyển ví</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: SPENDING FREQUENCY EQUALIZER (Inspired by yellow 15:36 1.9MI waveform widget & Espress in image) */}
            {activeMode === 'soundwave' && (
              <div className="space-y-3 relative z-10 animate-fade-in">
                <div className="flex justify-between items-baseline px-1">
                  <span className="text-xs font-semibold text-[#ffd60a] flex items-center gap-1">
                    <span className="material-symbols-rounded text-sm">graphic_eq</span>
                    Nhịp điệu chi tiêu 7 ngày
                  </span>
                  <span className="text-[10px] text-white/50">Tuần hiện tại</span>
                </div>

                {/* Glowing Yellow Frequency Bars (exactly like the yellow soundwave in the user image) */}
                <div className="bg-black/60 p-3.5 rounded-2xl border border-[#ffd60a]/20 flex items-end justify-between gap-1.5 h-24">
                  {dailySpendings.map((amount, idx) => {
                    const heightPercent = Math.max(15, Math.min(100, (amount / maxDaily) * 100));
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                        <div
                          className="w-full rounded-full transition-all duration-500 relative group cursor-pointer"
                          style={{
                            height: `${heightPercent}%`,
                            background:
                              amount > 0
                                ? 'linear-gradient(to top, #ffd60a, #fff5a6)'
                                : 'rgba(255, 214, 10, 0.15)',
                            boxShadow: amount > 0 ? '0 0 10px rgba(255, 214, 10, 0.4)' : 'none',
                          }}
                        >
                          {/* Tooltip on hover */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 left-1/2 -translate-x-1/2 bg-black text-[#ffd60a] border border-[#ffd60a]/40 text-[9px] px-1.5 py-0.5 rounded font-mono pointer-events-none whitespace-nowrap z-20">
                            {formatShortVND(amount)}
                          </div>
                        </div>
                        <span className="text-[9px] font-bold text-white/60">{dayNames[idx]}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Equalizer Controls (Like [x] [||] [target] in yellow widget) */}
                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#30d158] animate-ping"></div>
                    <span className="text-[10px] font-semibold text-white/70">Tần số: Ổn định</span>
                  </div>
                  <span className="text-xs font-bold text-[#ffd60a]">
                    TB: {formatShortVND(dailySpendings.reduce((s, a) => s + a, 0) / 7)} / ngày
                  </span>
                </div>
              </div>
            )}

            {/* TAB 3: BATTERY & SCOOTER ENERGY (Inspired by Scooter widget: 136mi, 35m left, and 4 quick toggles in image) */}
            {activeMode === 'battery' && (
              <div className="space-y-3 relative z-10 animate-fade-in">
                {/* Battery Status Pill */}
                <div className="flex justify-between items-center">
                  <div className="inline-flex items-center gap-1.5 bg-[#30d158]/20 border border-[#30d158]/30 px-3 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-[#30d158] animate-pulse"></span>
                    <span className="text-[11px] font-bold text-[#30d158]">Tài chính An toàn</span>
                  </div>
                  <span className="text-[11px] font-semibold text-white/60">
                    Số dư: {formatShortVND(totalBalance)}
                  </span>
                </div>

                {/* Energy progress bar (like the green scooter battery in image) */}
                <div className="bg-white/10 p-3.5 rounded-2xl border border-white/10 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Mức khả dụng</span>
                    <span className="font-bold text-[#30d158]">88%</span>
                  </div>
                  <div className="h-3 bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-[#30d158] via-[#a3e635] to-[#ffd60a] rounded-full shadow-[0_0_12px_rgba(48,209,88,0.6)]"
                      style={{ width: '88%' }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[10px] text-white/40">
                    <span>Mức chi tiêu tối ưu</span>
                    <span>An toàn 30 ngày</span>
                  </div>
                </div>

                {/* 4 Tactile Circle / Squircle Action Buttons (identical layout to green scooter widget in image: [x], [((4))], [yellow lock], [fan]) */}
                <div className="flex justify-between items-center px-2 pt-1">
                  <button
                    onClick={() => {
                      onQuickAddDeposit();
                      setIsExpanded(false);
                    }}
                    title="Nạp nhanh"
                    className="w-11 h-11 rounded-2xl bg-[#30d158] text-black font-bold flex items-center justify-center active:scale-95 transition-all shadow-md"
                  >
                    <span className="material-symbols-rounded text-xl">bolt</span>
                  </button>

                  <button
                    onClick={() => {
                      onOpenTransfer();
                      setIsExpanded(false);
                    }}
                    title="Điều chuyển"
                    className="w-11 h-11 rounded-2xl bg-white/10 text-white flex items-center justify-center active:scale-95 border border-white/10 hover:bg-white/20 transition-all"
                  >
                    <span className="material-symbols-rounded text-xl">swap_horiz</span>
                  </button>

                  <button
                    onClick={() => {
                      onOpenBill();
                      setIsExpanded(false);
                    }}
                    title="Khóa chốt sổ"
                    className="w-11 h-11 rounded-2xl bg-[#ffd60a] text-black font-bold flex items-center justify-center active:scale-95 transition-all shadow-md"
                  >
                    <span className="material-symbols-rounded text-xl">lock</span>
                  </button>

                  <button
                    onClick={() => setIsExpanded(false)}
                    title="Thu nhỏ đảo"
                    className="w-11 h-11 rounded-2xl bg-white/10 text-white flex items-center justify-center active:scale-95 border border-white/10 hover:bg-white/20 transition-all"
                  >
                    <span className="material-symbols-rounded text-xl">keyboard_arrow_up</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
