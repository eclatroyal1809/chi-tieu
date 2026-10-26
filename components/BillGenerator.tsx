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
  const activeTransactions = isHistorical 
    ? transactions.filter(t => 
        t.splitType === SplitType.MEO_ONLY || 
        t.splitType === SplitType.SHARED || 
        t.splitType === SplitType.MEO_PAID
      )
    : transactions.filter(t => 
        !t.isSettled && 
        t.type !== TransactionType.TRANSFER &&
        t.type !== TransactionType.SETTLEMENT &&
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

  const totalDebt = transactionDebt - BASE_FEE;
  const isCredit = totalDebt < 0; // Surplus/Credit scenario
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
    const scrollContainer = element?.parentElement;
    
    if (!element || !scrollContainer) {
        setIsCapturing(false);
        return;
    }

    const originalOverflow = scrollContainer.style.overflow;
    const originalHeight = scrollContainer.style.height;
    const originalMaxHeight = scrollContainer.style.maxHeight;
    const parentFlex = scrollContainer.style.flex;
    
    scrollContainer.style.overflow = 'visible';
    scrollContainer.style.height = 'auto';
    scrollContainer.style.maxHeight = 'none';
    scrollContainer.style.flex = 'none';

    const modalContainer = scrollContainer.parentElement;
    let originalModalMaxHeight = '';
    if (modalContainer) {
        originalModalMaxHeight = modalContainer.style.maxHeight;
        modalContainer.style.maxHeight = 'none';
    }

    try {
        await new Promise(resolve => setTimeout(resolve, 100));

        const canvas = await html2canvas(element, {
            scale: 3,
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
        scrollContainer.style.overflow = originalOverflow;
        scrollContainer.style.height = originalHeight;
        scrollContainer.style.maxHeight = originalMaxHeight;
        scrollContainer.style.flex = parentFlex;
        
        if (modalContainer) {
            modalContainer.style.maxHeight = originalModalMaxHeight;
        }
        
        setIsCapturing(false);
    }
  };

  const handleInitSettle = () => {
      setPayAmount(isCredit ? '0' : formatNumberInput(totalDebt.toString()));
      setStep('confirm');
  };

  const handleConfirmSettle = () => {
      const finalPayment = parseNumber(payAmount);
      const surplus = finalPayment - totalDebt;
      onSettle(activeTransactions.map(d => d.id), finalPayment, surplus);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 pt-safe pb-safe backdrop-blur-md">
      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-black/[0.08]">
        {/* Apple Style Header */}
        <div className="bg-[#1d1d1f] px-6 py-4 text-white flex justify-between items-center shrink-0">
          <div>
            <p className="text-[10px] text-[#86868b] uppercase tracking-wider font-semibold">Quyết toán chi phí</p>
            <h2 className="font-semibold text-base text-white">
              {isHistorical ? 'Hoá đơn thanh toán' : (step === 'preview' ? 'Đối soát cùng Mèo' : 'Xác nhận chuyển tiền')}
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 rounded-full transition-colors text-white"
          >
            <span className="material-symbols-rounded text-sm">close</span>
          </button>
        </div>

        {step === 'preview' ? (
            <>
                {/* Receipt Content */}
                <div className="flex-1 overflow-y-auto bg-[#f5f5f7] p-4 flex justify-center items-start">
                    <div 
                        id="bill-receipt-node" 
                        className="bg-white w-full max-w-sm rounded-2xl shadow-sm border border-black/[0.04] relative text-[#1d1d1f] p-6 font-sans text-sm leading-relaxed h-fit"
                    >
                        {/* Receipt Header */}
                        <div className="text-center pb-5 mb-5 relative border-b border-black/[0.06]">
                            <div className="w-10 h-10 rounded-full bg-[#f5f5f7] mx-auto flex items-center justify-center mb-3">
                                <span className="material-symbols-rounded text-xl text-[#1d1d1f]">receipt_long</span>
                            </div>
                            <h1 className="text-xl font-bold text-[#1d1d1f] tracking-tight mb-1">HOÁ ĐƠN ĐỐI SOÁT</h1>
                            <p className="text-xs text-[#86868b] font-medium">
                                Ngày {new Date(historicalDate || new Date().toISOString()).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </p>
                            <p className="text-xs text-[#86868b] font-medium mt-0.5">Khách hàng: <span className="text-[#1d1d1f] font-semibold">{MEO_NAME}</span></p>
                            {isHistorical && (
                                <span className="inline-block mt-2 px-2.5 py-0.5 bg-[#f5f5f7] text-[10px] font-semibold text-[#86868b] rounded-full uppercase tracking-wider">Đã lưu lịch sử</span>
                            )}
                        </div>

                        {/* Fixed Base Fee Item */}
                        {showBaseFee && (
                            <div className="flex justify-between items-start mb-3 pb-3 border-b border-black/[0.04]">
                                <div>
                                    <p className="font-semibold text-[#34c759] text-sm">1. Quỹ đầu kỳ</p>
                                </div>
                                <span className="font-semibold text-[#34c759] text-sm">-{formatCurrency(BASE_FEE)}</span>
                            </div>
                        )}

                        {/* Dynamic Items */}
                        <div className="space-y-3.5 pb-5 relative border-b border-black/[0.06]">
                            {activeTransactions.length === 0 ? (
                                <p className="text-center text-[#86868b] italic py-3 text-xs">Không có giao dịch phát sinh</p>
                            ) : (
                                activeTransactions.map((t, idx) => {
                                    const isPayment = t.splitType === SplitType.MEO_PAID;
                                    const orderNum = idx + (showBaseFee ? 2 : 1);
                                    return (
                                        <div key={t.id} className="flex justify-between items-start">
                                            <div className="pr-3 flex-1">
                                                <p className={`font-medium text-xs mb-0.5 leading-snug ${isPayment ? 'text-[#34c759]' : 'text-[#1d1d1f]'}`}>
                                                    {orderNum}. {t.description}
                                                </p>
                                                <p className="text-[11px] text-[#86868b]">
                                                    {formatDate(t.date)} {t.splitType === SplitType.SHARED && '· Chia đôi 50%'}
                                                </p>
                                            </div>
                                            <div className="text-right whitespace-nowrap pt-0.5">
                                                <span className={`font-semibold text-xs tabular-nums ${isPayment ? 'text-[#34c759]' : 'text-[#1d1d1f]'}`}>
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

                        {/* Total Summary */}
                        <div className="pt-4 space-y-2">
                            <div className="flex justify-between items-center text-xs text-[#86868b]">
                                <span>Số khoản mục</span>
                                <span className="font-medium text-[#1d1d1f] tabular-nums">{activeTransactions.length + (showBaseFee ? 1 : 0)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-[#86868b]">
                                <span>Tổng chi tiêu phát sinh</span>
                                <span className="font-medium text-[#1d1d1f] tabular-nums">{formatCurrency(activeTransactions.reduce((sum, t) => t.type === TransactionType.EXPENSE ? sum + t.amount : sum, 0))}</span>
                            </div>
                            
                            <div className="flex justify-between items-baseline pt-4 mt-2 border-t border-black/[0.08]">
                                <span className="text-sm font-semibold uppercase tracking-tight text-[#1d1d1f]">
                                    {isCredit ? 'MÈO DƯ CÓ' : 'MÈO CẦN TRẢ'}
                                </span>
                                <span className={`text-xl font-bold tracking-tight tabular-nums ${isCredit ? 'text-[#34c759]' : 'text-[#1d1d1f]'}`}>
                                    {formatCurrency(Math.abs(totalDebt))}
                                </span>
                            </div>
                            
                            {isHistorical && historicalTotalPaid > 0 && (
                                <div className="flex justify-between items-center pt-2 text-[#34c759] text-xs">
                                    <span className="font-medium">Đã thanh toán thực tế</span>
                                    <span className="font-semibold text-sm tabular-nums">{formatCurrency(historicalTotalPaid)}</span>
                                </div>
                            )}

                            {isCredit && (
                                <p className="text-center text-[11px] text-[#34c759] mt-2 font-medium">
                                    (Số tiền dư này sẽ tự động giảm trừ vào bill tiếp theo)
                                </p>
                            )}
                            
                            <div className="text-center pt-6 text-[10px] text-[#86868b] tracking-wider uppercase font-medium">
                                Mèo Finance • Minimalist Living
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-white border-t border-black/[0.06] flex flex-col gap-2.5 shrink-0">
                    <button 
                        onClick={handleDownloadImage}
                        disabled={isCapturing}
                        className="w-full py-3 bg-[#f5f5f7] hover:bg-[#e8e8ed] active:scale-[0.98] text-[#1d1d1f] font-medium rounded-full text-sm transition-all flex justify-center items-center gap-2 border border-black/[0.06]"
                    >
                        {isCapturing ? (
                            <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                        ) : (
                            <>
                                <span className="material-symbols-rounded text-base">download</span>
                                Tải ảnh hoá đơn (PNG)
                            </>
                        )}
                    </button>
                    
                    {!isHistorical && (
                        <button 
                            onClick={handleInitSettle}
                            className="w-full py-3.5 font-medium rounded-full text-sm active:scale-[0.98] transition-all flex justify-center items-center gap-2 bg-[#1d1d1f] hover:bg-black text-white shadow-sm"
                        >
                            <span className="material-symbols-rounded text-base">check_circle</span>
                            {isCredit ? 'Xác nhận kết chuyển số dư' : 'Xác nhận thanh toán nợ'}
                        </button>
                    )}
                </div>
            </>
        ) : (
            <div className="p-6 bg-white flex-1 flex flex-col justify-between">
                <div className="space-y-6">
                    <div className="p-5 rounded-2xl bg-[#f5f5f7] border border-black/[0.04] text-center">
                        <p className="text-xs text-[#86868b] font-medium mb-1">
                            {isCredit ? 'Số tiền dư hiện có của Mèo' : 'Số tiền Mèo cần thanh toán'}
                        </p>
                        <p className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">
                            {formatCurrency(Math.abs(totalDebt))}
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-2">
                            Số tiền Mèo chuyển khoản (MB)
                        </label>
                        <div className="relative">
                            <input 
                                type="text"
                                inputMode="numeric"
                                value={payAmount}
                                onChange={(e) => setPayAmount(formatNumberInput(e.target.value))}
                                className="w-full bg-[#f5f5f7] border border-black/[0.06] rounded-2xl px-4 py-3.5 text-2xl font-semibold text-[#1d1d1f] outline-none focus:border-[#1d1d1f] transition-colors"
                                placeholder="0"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center py-3 border-t border-black/[0.06]">
                        <span className="text-xs text-[#86868b] font-medium">Số dư còn lại (kỳ sau):</span>
                        <span className={`text-base font-semibold ${
                            (parseNumber(payAmount) - totalDebt) >= 0 ? 'text-[#34c759]' : 'text-[#ff3b30]'
                        }`}>
                            {formatCurrency(parseNumber(payAmount) - totalDebt)}
                        </span>
                    </div>
                </div>

                <div className="pt-6 flex gap-3">
                     <button 
                        onClick={() => setStep('preview')}
                        className="flex-1 py-3 bg-[#f5f5f7] text-[#1d1d1f] font-medium rounded-full text-sm hover:bg-[#e8e8ed] active:scale-[0.98] transition-all"
                    >
                        Quay lại
                    </button>
                    <button 
                        onClick={handleConfirmSettle}
                        className="flex-[2] py-3 bg-[#1d1d1f] hover:bg-black text-white font-medium rounded-full text-sm active:scale-[0.98] transition-all shadow-sm"
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