import React, { useState } from 'react';
import { Transaction } from '../types';

interface LiveActivityCardProps {
  meoDebt: number;
  isCredit: boolean;
  transactions: Transaction[];
  onOpenBill: () => void;
  onQuickDeposit: () => void;
  onOpenTransfer: () => void;
}

export const LiveActivityCard: React.FC<LiveActivityCardProps> = ({
  meoDebt,
  isCredit,
  transactions,
  onOpenBill,
  onQuickDeposit,
  onOpenTransfer,
}) => {
  const [activeTab, setActiveTab] = useState<'settlement' | 'waveform'>('settlement');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Group spending for the last 7 days (or 16 tick bars like 16s Espress & yellow soundwave)
  const today = new Date();
  const ticks = Array.from({ length: 18 }, (_, i) => {
    // Generate tick height based on transactions or time
    const dayOffset = Math.floor(i / 2.5);
    const targetDate = new Date();
    targetDate.setDate(today.getDate() - dayOffset);
    const targetDateStr = targetDate.toDateString();

    const daySpending = transactions
      .filter((t) => t.type === 'EXPENSE' && new Date(t.date).toDateString() === targetDateStr)
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      index: i,
      dayOffset,
      label: dayOffset === 0 ? 'Hôm nay' : `${dayOffset} ngày trước`,
      amount: daySpending,
      heightRatio: Math.min(100, Math.max(18, (daySpending / 500000) * 85 + (i % 3) * 10)),
    };
  });

  const formatShortCurrency = (amount: number) => {
    if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'tr';
    if (amount >= 1000) return (amount / 1000).toFixed(0) + 'k';
    return amount.toString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const unsettledTxCount = transactions.filter(
    (t) => !t.isSettled && t.type !== 'TRANSFER' && t.type !== 'SETTLEMENT'
  ).length;

  return (
    <div className="space-y-3">
      {/* SECTION TITLE & SWITCHER (Live Activities iOS Style) */}
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#30d158] animate-ping"></span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">
            Apple Live Activity
          </span>
        </div>
        <div className="flex bg-black/[0.05] p-0.5 rounded-full border border-black/[0.04]">
          <button
            onClick={() => setActiveTab('settlement')}
            className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-all ${
              activeTab === 'settlement'
                ? 'bg-black text-white shadow-sm'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            Đối soát Mèo
          </button>
          <button
            onClick={() => setActiveTab('waveform')}
            className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-all ${
              activeTab === 'waveform'
                ? 'bg-[#ffd60a] text-black shadow-sm font-bold'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            Tần số 7 ngày
          </button>
        </div>
      </div>

      {activeTab === 'settlement' ? (
        /* WIDGET 1: LIVE SETTLEMENT TRACKER (Exact aesthetic of 'Drop in 10 min' & 'Order arriving in 8 min') */
        <div className="bg-[#000000] text-white rounded-[28px] p-5 shadow-[0_12px_32px_rgba(0,0,0,0.2)] border border-white/10 relative overflow-hidden">
          {/* Subtle amber gradient glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#ffd60a]/10 rounded-full blur-2xl pointer-events-none"></div>

          {/* Top Row: Drop Status & Vehicle/Icon (similar to Toyota Corolla White in image) */}
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#ffd60a] text-black flex items-center justify-center font-bold text-lg shadow-sm">
                🐱
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-base tracking-tight text-white">
                    {isCredit ? 'Mèo có số dư' : 'Mèo đang nợ Me'}
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 text-white/80 font-medium">
                    {unsettledTxCount} mục mới
                  </span>
                </div>
                <p className="text-[11px] text-white/50 tracking-tight">
                  Chu kỳ hiện tại · {unsettledTxCount > 0 ? 'Đang chờ đối soát' : 'Đã cân bằng'}
                </p>
              </div>
            </div>

            {/* High-impact score display (like 92/1 and 8 min in image) */}
            <div className="text-right">
              <p
                className={`text-xl sm:text-2xl font-extrabold tracking-tight ${
                  isCredit ? 'text-[#30d158]' : 'text-[#ffd60a]'
                }`}
              >
                {formatCurrency(Math.abs(meoDebt))}
              </p>
              <p className="text-[10px] text-white/40">
                {isCredit ? 'Dư để trừ dần' : 'Cần thu về'}
              </p>
            </div>
          </div>

          {/* Milestone Progress Bar (Inspired directly by 'Order arriving in 8 min' with 4 milestones) */}
          <div className="bg-white/[0.06] rounded-2xl p-3.5 mb-4 border border-white/5 relative z-10">
            <div className="flex justify-between items-center text-[10px] text-white/70 font-semibold mb-2.5">
              <span>Ghi chép</span>
              <span>Tổng hợp</span>
              <span>Chuyển khoản</span>
              <span>Đã khớp</span>
            </div>

            <div className="relative flex items-center px-1">
              {/* Connecting line */}
              <div className="h-1 bg-white/15 w-full rounded-full"></div>
              <div
                className="absolute h-1 bg-gradient-to-r from-[#ffd60a] via-[#ff9f0a] to-[#30d158] rounded-full transition-all duration-500"
                style={{
                  width: isCredit ? '100%' : Math.abs(meoDebt) > 0 ? '66%' : '25%',
                }}
              ></div>

              {/* 4 Interactive milestone dots */}
              <div className="absolute left-0 w-3.5 h-3.5 rounded-full bg-[#ffd60a] border-2 border-black flex items-center justify-center"></div>
              <div
                className={`absolute left-[33%] w-3.5 h-3.5 rounded-full border-2 border-black flex items-center justify-center ${
                  unsettledTxCount > 0 ? 'bg-[#ffd60a]' : 'bg-white/30'
                }`}
              ></div>
              <div
                className={`absolute left-[66%] w-3.5 h-3.5 rounded-full border-2 border-black flex items-center justify-center ${
                  Math.abs(meoDebt) > 0 ? 'bg-[#ffd60a]' : 'bg-white/30'
                }`}
              ></div>
              <div
                className={`absolute right-0 w-3.5 h-3.5 rounded-full border-2 border-black flex items-center justify-center ${
                  isCredit || Math.abs(meoDebt) === 0 ? 'bg-[#30d158]' : 'bg-white/30'
                }`}
              ></div>
            </div>

            <div className="flex justify-between items-center mt-3 text-[11px] text-white/80">
              <span className="flex items-center gap-1">
                <span className="material-symbols-rounded text-sm text-[#ffd60a]">receipt_long</span>
                Hóa đơn đối soát tháng
              </span>
              <span className="text-[10px] text-white/50">
                {Math.abs(meoDebt) > 0 ? 'Đang tích luỹ khoản chi' : 'Sẵn sàng'}
              </span>
            </div>
          </div>

          {/* Bottom Action Pill Buttons (like OLA, PickMe & Scooter buttons in image) */}
          <div className="grid grid-cols-2 gap-2 relative z-10">
            <button
              onClick={onQuickDeposit}
              className="py-2.5 px-3 rounded-2xl bg-white/10 hover:bg-white/15 active:scale-95 text-white font-medium text-xs flex items-center justify-center gap-2 border border-white/10 transition-all"
            >
              <span className="material-symbols-rounded text-sm text-[#30d158]">add_circle</span>
              <span>+300k Mèo nạp</span>
            </button>

            <button
              onClick={onOpenBill}
              className="py-2.5 px-3 rounded-2xl bg-[#ffd60a] hover:bg-[#ffe033] active:scale-95 text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
            >
              <span className="material-symbols-rounded text-sm font-bold">receipt</span>
              <span>Xem & Chốt sổ</span>
            </button>
          </div>
        </div>
      ) : (
        /* WIDGET 2: SPENDING FREQUENCY EQUALIZER (Exact aesthetic of yellow 15:36 1.9MI & 16s Espress tick marks) */
        <div className="bg-[#000000] text-white rounded-[28px] p-5 shadow-[0_12px_32px_rgba(0,0,0,0.2)] border border-white/10 relative overflow-hidden">
          {/* Subtle glow */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-[#ffd60a]/15 rounded-full blur-2xl pointer-events-none"></div>

          {/* Header Row: 15:36 & Frequency metrics */}
          <div className="flex justify-between items-center mb-4 relative z-10">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black text-[#ffd60a] tracking-tight">
                  {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ffd60a]/20 text-[#ffd60a]">
                  RHYTHM
                </span>
              </div>
              <p className="text-[11px] text-white/50">Tần suất chi tiêu theo thời gian</p>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-white tracking-tight flex items-center justify-end gap-1">
                <span className="material-symbols-rounded text-sm text-[#ffd60a]">speed</span>
                {ticks.reduce((s, t) => s + (t.amount > 0 ? 1 : 0), 0)} chu kỳ
              </span>
              <p className="text-[10px] text-white/40">Giao dịch gần đây</p>
            </div>
          </div>

          {/* Equalizer Frequency Spectrum Bars (Visual counterpart to yellow soundwave in user image) */}
          <div className="bg-[#0c0c0e] p-4 rounded-2xl border border-white/5 mb-4 relative z-10">
            <div className="flex items-end justify-between gap-1 h-20">
              {ticks.map((tick) => (
                <div
                  key={tick.index}
                  onClick={() => setSelectedDay(tick.index)}
                  className="flex-1 h-full flex flex-col items-center justify-end group cursor-pointer"
                >
                  <div
                    className={`w-full rounded-full transition-all duration-300 ${
                      selectedDay === tick.index
                        ? 'bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)] scale-110'
                        : tick.amount > 0
                        ? 'bg-gradient-to-t from-[#ffd60a] to-[#fffae0] shadow-[0_0_8px_rgba(255,214,10,0.5)]'
                        : 'bg-[#ffd60a]/20 hover:bg-[#ffd60a]/40'
                    }`}
                    style={{ height: `${tick.heightRatio}%` }}
                  ></div>
                </div>
              ))}
            </div>

            {/* Ruler / Tick Numbers (like 10, 20 markers in 16s Espress image) */}
            <div className="flex justify-between text-[9px] font-mono text-white/40 mt-2 px-1">
              <span>01</span>
              <span>05</span>
              <span>10</span>
              <span>15</span>
              <span>18</span>
            </div>
          </div>

          {/* Bottom Controls Row (like [x] [||] [target] in yellow waveform widget) */}
          <div className="flex justify-between items-center relative z-10">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedDay(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-white/70"
                title="Làm mới"
              >
                <span className="material-symbols-rounded text-sm">restart_alt</span>
              </button>
              <button
                onClick={onOpenTransfer}
                className="w-8 h-8 rounded-full bg-[#ffd60a] text-black font-bold active:scale-90 flex items-center justify-center shadow-sm"
                title="Điều chuyển ví"
              >
                <span className="material-symbols-rounded text-sm font-bold">swap_horiz</span>
              </button>
            </div>

            <div className="text-right">
              <span className="text-xs font-semibold text-white/80">
                {selectedDay !== null
                  ? `${ticks[selectedDay].label}: ${formatCurrency(ticks[selectedDay].amount)}`
                  : 'Chạm thanh sóng để kiểm tra'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
