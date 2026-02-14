import React, { useState } from 'react';
import { Transaction, SplitType, TransactionType } from '../types';
import { MEO_NAME } from '../constants';
// @ts-ignore
import html2canvas from 'html2canvas';

interface BillGeneratorProps {
  transactions: Transaction[];
  onClose: () => void;
  onSettle: (txIds: string[], finalPayment: number, surplus: number) => void;
  isHistorical?: boolean; // Chế độ xem lại lịch sử
  historicalDate?: string; // Ngày của bill cũ
  historicalTotalPaid?: number; // Số tiền đã trả trong bill cũ
}

export const BillGenerator: React.FC<BillGeneratorProps> = ({ 
    transactions, 
    onClose, 
    onSettle, 
    isHistorical = false,
    historicalDate,
    historicalTotalPaid = 0
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [step, setStep] = useState<'preview' | 'confirm'>('preview');
  const [payAmount, setPayAmount] = useState('');

  const BASE_FEE = 0; // Updated to 0 as requested

  // Filter transactions
  // Nếu là lịch sử: Hiển thị tất cả transactions được truyền vào (đã filter ở App)
  // Nếu là tạo mới: Chỉ hiển thị những cái chưa settle
  const activeTransactions = isHistorical 
    ? transactions 
    : transactions.filter(t => 
        !t.isSettled && 
        t.type !== TransactionType.TRANSFER &&
        (t.splitType === SplitType.MEO_ONLY || 
         t.splitType === SplitType.SHARED || 
         t.splitType === SplitType.MEO_PAID)
      );

  // Calculate transactional debt
  const transactionDebt = activeTransactions.reduce((sum, t) => {
    if (t.splitType === SplitType.MEO_ONLY) return sum + t.amount;
    if (t.splitType === SplitType.SHARED) return sum + (t.amount / 2);
    if (t.splitType === SplitType.MEO_PAID) return sum - t.amount;
    return sum;
  }, 0);

  // LOGIC CHANGE: Total Debt = Expenses - Initial Deposit
  const totalDebt = transactionDebt - BASE_FEE;
  const isCredit = totalDebt < 0; // Surplus/Credit scenario

  // Check if we should show the base fee row
  const showBaseFee = BASE_FEE > 0;

  // Formatting helpers
  const formatNumberInput = (value: string) => {
    const raw = value.replace(/\D/g, '');
    if (!raw) return '';
    return new Intl.NumberFormat('vi-VN').format(parseInt(raw, 10));
  };

  const parseNumber = (val: string) => {
      return parseInt(val.replace(/\./g, ''), 10) || 0;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  const handleDownloadImage = async () => {
    setIsCapturing(true);
    const element = document.getElementById('bill-receipt-node');
    if (!element) return;

    try {
        const canvas = await html2canvas(element, {
            scale: 2, // Higher resolution
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false,
        });
        
        const link = document.createElement('a');
        const dateStr = historicalDate || new Date().toISOString();
        link.download = `Hoa-don-${MEO_NAME}-${new Date(dateStr).toLocaleDateString('vi-VN').replace(/\//g, '-')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        console.error("Export failed", err);
        alert("Không thể xuất ảnh. Vui lòng thử lại.");
    } finally {
        setIsCapturing(false);
    }
  };

  const handleInitSettle = () => {
      // If in credit, default payment is 0
      setPayAmount(isCredit ? '0' : formatNumberInput(totalDebt.toString()));
      setStep('confirm');
  };

  const handleConfirmSettle = () => {
      const finalPayment = parseNumber(payAmount);
      const surplus = finalPayment - totalDebt;
      onSettle(activeTransactions.map(d => d.id), finalPayment, surplus);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-100 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header Actions */}
        <div className="bg-slate-800 p-4 text-white flex justify-between items-center shrink-0">
          <h2 className="font-bold text-lg">
            {isHistorical ? 'Chi tiết hoá đơn cũ' : (step === 'preview' ? 'Chi tiết nợ' : 'Xác nhận thanh toán')}
          </h2>
          <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition">
            <span className="material-symbols-rounded block text-sm">close</span>
          </button>
        </div>

        {step === 'preview' ? (
            <>
                {/* Receipt Content - This part gets captured */}
                <div className="flex-1 overflow-y-auto bg-slate-200 p-4 flex justify-center">
                    <div 
                        id="bill-receipt-node" 
                        className="bg-white w-full max-w-sm shadow-sm relative text-slate-800 p-6 font-mono text-sm leading-relaxed"
                        style={{ fontFamily: "'Space Mono', monospace" }}
                    >
                        {/* Receipt Header */}
                        <div className="text-center border-b-2 border-dashed border-slate-300 pb-4 mb-4">
                            <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-widest">HOÁ ĐƠN</h1>
                            <p className="text-xs text-slate-500 mt-1">
                                Ngày: {new Date(historicalDate || new Date().toISOString()).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-xs text-slate-500">Khách hàng: {MEO_NAME}</p>
                            {isHistorical && (
                                <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-[10px] font-bold text-slate-500 border border-slate-300 rounded">LỊCH SỬ</span>
                            )}
                        </div>

                        {/* Fixed Base Fee Item - DISPLAY AS CREDIT (Only if > 0) */}
                        {showBaseFee && (
                            <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-100">
                                <div>
                                    <p className="font-bold text-emerald-600">1. Quỹ đầu kỳ (Đã đóng)</p>
                                    <p className="text-xs text-slate-500 italic">Trừ vào tổng chi</p>
                                </div>
                                <span className="font-bold text-emerald-600">-{formatCurrency(BASE_FEE)}</span>
                            </div>
                        )}

                        {/* Dynamic Items */}
                        <div className="space-y-3 pb-4 border-b-2 border-dashed border-slate-300">
                            {activeTransactions.length === 0 ? (
                                <p className="text-center text-slate-400 italic py-2">Không có giao dịch phát sinh</p>
                            ) : (
                                activeTransactions.map((t, idx) => {
                                    const isPayment = t.splitType === SplitType.MEO_PAID;
                                    const orderNum = idx + (showBaseFee ? 2 : 1);
                                    return (
                                        <div key={t.id} className="flex justify-between items-start">
                                            <div className="pr-2 max-w-[70%]">
                                                <p className={`font-bold ${isPayment ? 'text-emerald-600' : 'text-slate-800'}`}>
                                                    {orderNum}. {t.description}
                                                </p>
                                                <p className="text-[10px] text-slate-400">
                                                    {formatDate(t.date)} - {
                                                        isPayment ? 'Đã trả' :
                                                        t.splitType === SplitType.SHARED ? '50%' : '100%'
                                                    }
                                                </p>
                                            </div>
                                            <div className="text-right whitespace-nowrap">
                                                <span className={`font-bold ${isPayment ? 'text-emerald-600' : 'text-slate-800'}`}>
                                                    {isPayment ? '-' : ''}{formatCurrency(
                                                        t.splitType === SplitType.SHARED ? t.amount / 2 : t.amount
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Total */}
                        <div className="pt-4">
                            <div className="flex justify-between items-center mb-1 text-slate-500 text-xs">
                                <span>Số lượng khoản mục:</span>
                                <span>{activeTransactions.length + (showBaseFee ? 1 : 0)}</span>
                            </div>
                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-900">
                                <span className="text-lg font-bold uppercase">
                                    {isCredit ? 'DƯ (MÈO CÓ)' : 'TỔNG CỘNG'}
                                </span>
                                <span className={`text-2xl font-bold tracking-tight ${isCredit ? 'text-emerald-600' : 'text-slate-900'}`}>
                                    {formatCurrency(Math.abs(totalDebt))}
                                </span>
                            </div>
                            
                            {/* In historical mode, show what was actually paid */}
                            {isHistorical && historicalTotalPaid > 0 && (
                                <div className="flex justify-between items-center mt-2 text-emerald-600">
                                    <span className="text-sm font-bold uppercase">Đã thanh toán</span>
                                    <span className="text-lg font-bold">{formatCurrency(historicalTotalPaid)}</span>
                                </div>
                            )}

                            {isCredit && (
                                <p className="text-center text-[10px] text-emerald-600 mt-2 font-bold uppercase">
                                    (Số tiền này sẽ được trừ vào kỳ sau)
                                </p>
                            )}
                            <div className="text-center mt-6 text-[10px] text-slate-400 uppercase tracking-widest">
                                *** Cảm ơn quý khách ***
                            </div>
                        </div>

                        {/* Jagged Bottom Edge */}
                        <div 
                            className="absolute -bottom-3 left-0 right-0 h-3 bg-slate-200"
                            style={{
                                maskImage: 'linear-gradient(45deg, transparent 75%, black 75%), linear-gradient(-45deg, transparent 75%, black 75%)',
                                maskSize: '10px 10px',
                                maskPosition: '0 0, 5px 0',
                                maskRepeat: 'repeat-x',
                                WebkitMaskImage: 'linear-gradient(45deg, transparent 75%, black 75%), linear-gradient(-45deg, transparent 75%, black 75%)',
                                WebkitMaskSize: '10px 10px',
                                WebkitMaskPosition: '0 0, 5px 0',
                                WebkitMaskRepeat: 'repeat-x',
                                backgroundColor: '#F1F5F9'
                            }}
                        ></div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-white border-t border-slate-200 flex flex-col gap-3 shrink-0">
                    <button 
                        onClick={handleDownloadImage}
                        disabled={isCapturing}
                        className="w-full py-3 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-bold rounded-xl shadow-lg transition-all flex justify-center items-center gap-2"
                    >
                        {isCapturing ? (
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : (
                            <>
                                <span className="material-symbols-rounded">download</span>
                                Tải ảnh hóa đơn (PNG)
                            </>
                        )}
                    </button>
                    
                    {!isHistorical && (
                        <button 
                            onClick={handleInitSettle}
                            className={`w-full py-3 font-bold rounded-xl border active:scale-95 transition-all flex justify-center items-center gap-2 ${
                                isCredit 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                            }`}
                        >
                            <span className="material-symbols-rounded">check_circle</span>
                            {isCredit ? 'Xác nhận kết chuyển số dư' : 'Xác nhận thanh toán nợ'}
                        </button>
                    )}
                </div>
            </>
        ) : (
            <div className="p-6 bg-white flex-1 flex flex-col">
                <div className="flex-1 space-y-6">
                    <div className={`p-4 rounded-2xl border text-center ${
                        isCredit ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'
                    }`}>
                        <p className={`text-sm mb-1 ${isCredit ? 'text-emerald-600' : 'text-slate-500'}`}>
                            {isCredit ? 'Tổng tiền dư (Mèo đang có)' : 'Tổng nợ cần thanh toán'}
                        </p>
                        <p className={`text-3xl font-bold ${isCredit ? 'text-emerald-700' : 'text-slate-800'}`}>
                            {formatCurrency(Math.abs(totalDebt))}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Số tiền Mèo chuyển khoản (MB)
                        </label>
                        <input 
                            type="text"
                            inputMode="numeric"
                            value={payAmount}
                            onChange={(e) => setPayAmount(formatNumberInput(e.target.value))}
                            className="w-full bg-slate-50 border-b-2 border-indigo-500 px-4 py-3 text-2xl font-bold text-slate-800 outline-none"
                            placeholder="0"
                            autoFocus
                        />
                    </div>

                    <div className="flex justify-between items-center py-4 border-t border-slate-100">
                        <span className="text-slate-500 font-medium">Số dư (để lại kỳ sau):</span>
                        <span className={`text-xl font-bold ${
                            (parseNumber(payAmount) - totalDebt) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                            {formatCurrency(parseNumber(payAmount) - totalDebt)}
                        </span>
                    </div>
                </div>

                <div className="mt-auto flex gap-3">
                     <button 
                        onClick={() => setStep('preview')}
                        className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
                    >
                        Quay lại
                    </button>
                    <button 
                        onClick={handleConfirmSettle}
                        className="flex-[2] py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 active:scale-95 transition-all"
                    >
                        Hoàn tất chốt sổ
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};