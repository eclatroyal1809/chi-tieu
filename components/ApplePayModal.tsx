import React, { useState } from 'react';

interface ApplePayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApplePayModal: React.FC<ApplePayModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const shortcutSampleUrl = `${currentOrigin}/?amount=ShortcutInput&desc=ShortcutInput&wallet=TCB`;

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(shortcutSampleUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="bg-white w-full max-w-md rounded-t-[36px] sm:rounded-[36px] overflow-hidden shadow-2xl relative z-10 max-h-[90vh] flex flex-col border border-black/[0.06] animate-slide-up">
        {/* Apple Sheet Pull Bar */}
        <div className="w-10 h-1.5 bg-black/15 rounded-full mx-auto my-3 shrink-0 sm:hidden"></div>

        {/* Header */}
        <div className="px-6 py-3 flex items-center justify-between border-b border-black/[0.04] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-[#1d1d1f]"> Pay</span>
            <h3 className="font-semibold text-base text-[#1d1d1f]">
              Tự động hóa Apple Pay
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-black/5 flex items-center justify-center text-[#86868b] transition-colors"
          >
            <span className="material-symbols-rounded text-base">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          
          {/* Explanation Banner */}
          <div className="bg-[#f5f5f7] p-4 rounded-2xl border border-black/[0.04] space-y-2">
            <div className="flex items-center gap-2 text-[#0071e3]">
              <span className="material-symbols-rounded text-xl">security</span>
              <p className="text-xs font-semibold">Chính sách bảo mật Apple</p>
            </div>
            <p className="text-xs text-[#86868b] leading-relaxed">
              Apple bảo vệ dữ liệu quẹt thẻ trong chip <strong className="text-[#1d1d1f]">Secure Element</strong> của iPhone nên bất kỳ trang web hay ứng dụng nào cũng <strong className="text-[#1d1d1f]">không thể tự ý đọc ngầm</strong> dữ liệu giao dịch khi bạn chạm iPhone ngoài đời.
            </p>
          </div>

          {/* Solution with Apple Shortcuts */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">
                ✓
              </span>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f]">
                Cách lấy số tiền tự động 100% qua Phím tắt iOS
              </h4>
            </div>
            <p className="text-xs text-[#86868b] leading-relaxed">
              Hệ điều hành iOS có tính năng <strong className="text-[#1d1d1f]">Tự động hóa (Automation)</strong> khi quẹt Apple Pay. Mỗi khi bạn chạm thẻ, iPhone sẽ tự động kích hoạt và điền thẳng số tiền vào ứng dụng:
            </p>

            {/* Steps */}
            <div className="space-y-2.5 pt-1">
              <div className="flex gap-3 bg-[#f5f5f7] p-3 rounded-xl border border-black/[0.03]">
                <span className="w-5 h-5 rounded-full bg-[#1d1d1f] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  1
                </span>
                <p className="text-xs text-[#1d1d1f]">
                  Mở app <strong>Phím tắt (Shortcuts)</strong> trên iPhone $\rightarrow$ Chọn tab <strong>Tự động hóa (Automation)</strong>.
                </p>
              </div>

              <div className="flex gap-3 bg-[#f5f5f7] p-3 rounded-xl border border-black/[0.03]">
                <span className="w-5 h-5 rounded-full bg-[#1d1d1f] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  2
                </span>
                <p className="text-xs text-[#1d1d1f]">
                  Bấm dấu <strong>+</strong> $\rightarrow$ Chọn <strong>Giao dịch (Transaction)</strong> $\rightarrow$ Chọn thẻ <strong>Techcombank</strong> hoặc <strong>MB Bank</strong>.
                </p>
              </div>

              <div className="flex gap-3 bg-[#f5f5f7] p-3 rounded-xl border border-black/[0.03]">
                <span className="w-5 h-5 rounded-full bg-[#1d1d1f] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  3
                </span>
                <p className="text-xs text-[#1d1d1f]">
                  Chọn <strong>Chạy ngay lập tức (Run Immediately)</strong> $\rightarrow$ Thêm tác vụ <strong>Mở URL (Open URLs)</strong>.
                </p>
              </div>

              <div className="flex gap-3 bg-[#f5f5f7] p-3 rounded-xl border border-black/[0.03]">
                <span className="w-5 h-5 rounded-full bg-[#1d1d1f] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  4
                </span>
                <p className="text-xs text-[#1d1d1f]">
                  Dán đường dẫn cấu hình bên dưới vào để app tự động nhận số tiền & tên cửa hàng!
                </p>
              </div>
            </div>

            {/* Copyable Link Box */}
            <div className="bg-black/[0.03] p-3.5 rounded-2xl border border-black/[0.06] space-y-2">
              <p className="text-[10px] font-semibold text-[#86868b] uppercase">Đường dẫn mẫu cho Phím tắt</p>
              <div className="bg-white p-2.5 rounded-xl border border-black/[0.06] font-mono text-[11px] text-[#1d1d1f] break-all select-all">
                {currentOrigin}/?amount=<strong>[Số_Tiền]</strong>&desc=<strong>[Tên_Cửa_Hàng]</strong>&wallet=TCB
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="w-full py-2.5 bg-[#1d1d1f] hover:bg-black active:scale-[0.98] text-white font-medium rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <span className="material-symbols-rounded text-sm">
                  {copied ? 'check' : 'content_copy'}
                </span>
                <span>{copied ? 'Đã sao chép đường dẫn!' : 'Sao chép đường dẫn mẫu'}</span>
              </button>
            </div>
          </div>

          {/* Quick Alternative: Paste SMS / Noti */}
          <div className="border-t border-black/[0.05] pt-3 text-xs text-[#86868b]">
            <p className="font-semibold text-[#1d1d1f] mb-1">💡 Mẹo thêm:</p>
            <p>
              Khi quẹt Apple Pay, thông báo trừ tiền của ngân hàng xuất hiện trên màn hình khóa. Bạn chỉ cần sao chép nội dung tin nhắn hoặc quét mã QR trên hoá đơn là app có thể tự nhận diện ngay lập tức.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-black/[0.04] bg-[#f5f5f7]/60">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-[#1d1d1f] text-white font-medium rounded-full text-xs shadow-sm active:scale-98 transition-all"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
};
