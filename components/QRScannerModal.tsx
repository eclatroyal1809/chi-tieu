import React, { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import { parseVietQR, VIETNAM_BANKS, getVietQRDeepLink, getDirectAppScheme, getDynamicVietQRImage, ParsedVietQR } from '../utils/vietqr';
import { Account, AccountType, SplitType } from '../types';
import { SPLIT_OPTIONS } from '../constants';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  onLogTransaction?: (data: {
    amount: number;
    description: string;
    account: AccountType;
    splitType: SplitType;
    date: Date;
  }) => void;
  getAmountSuggestions: (val: string) => number[];
  formatCurrency: (amount: number) => string;
}

const COMMON_NOTES = [
  'Ăn uống', 'Đi chợ', 'Cà phê', 'Mua sắm', 'Tiền nhà', 'Chuyển tiền'
];

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onLogTransaction,
  getAmountSuggestions,
  formatCurrency
}) => {
  // Mode: 'scan' | 'confirm' | 'success'
  const [step, setStep] = useState<'scan' | 'confirm' | 'success'>('scan');

  // Scanner States
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  // Transfer Form States
  const [selectedBankCode, setSelectedBankCode] = useState<string>('tcb');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [beneficiaryName, setBeneficiaryName] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [note, setNote] = useState<string>('Chuyển tiền');
  const [splitType, setSplitType] = useState<SplitType>(SplitType.SHARED);
  const [selectedPayerBank, setSelectedPayerBank] = useState<'tcb' | 'mb'>('tcb');
  const [autoLogToLedger, setAutoLogToLedger] = useState<boolean>(true);
  const [qrImageUrl, setQrImageUrl] = useState<string>('');
  const [copiedAccount, setCopiedAccount] = useState<boolean>(false);

  // Video & Canvas Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Balances of Techcombank & MB
  const tcbAccount = accounts.find(a => a.id === AccountType.TCB);
  const mbAccount = accounts.find(a => a.id === AccountType.MB);

  // Stop camera stream cleanly
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
  }, []);

  // Format number input with thousands separators
  const formatNumberInput = (val: string) => {
    const raw = val.replace(/\D/g, '');
    if (!raw) return '';
    return new Intl.NumberFormat('vi-VN').format(parseInt(raw, 10));
  };

  const parseSmartAmount = (val: string): number => {
    const raw = val.replace(/\D/g, '');
    if (!raw) return 0;
    return parseInt(raw, 10);
  };

  // Start Camera
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Trình duyệt không hỗ trợ truy cập máy ảnh. Bạn có thể tải ảnh mã QR lên.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities?.() as { torch?: boolean }) || {};
        setHasTorch(!!capabilities.torch);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        scanFrameLoop();
      }
    } catch (err: unknown) {
      console.warn('Camera error:', err);
      setCameraError('Không thể mở camera. Vui lòng cấp quyền hoặc tải ảnh mã QR từ máy.');
    }
  }, [facingMode, stopCamera]);

  // Frame scanning loop using jsqr
  const scanFrameLoop = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code && code.data) {
        try {
          if (navigator.vibrate) navigator.vibrate(50);
        } catch {
          // ignore
        }
        handleScannedCode(code.data);
        return;
      }
    }

    animFrameRef.current = requestAnimationFrame(scanFrameLoop);
  };

  // Handle scanned QR payload
  const handleScannedCode = (rawPayload: string) => {
    stopCamera();
    const parsed: ParsedVietQR = parseVietQR(rawPayload);
    setSelectedBankCode(parsed.bankCode);
    setAccountNumber(parsed.accountNumber);
    setBeneficiaryName(parsed.beneficiaryName || '');
    if (parsed.amount && parsed.amount > 0) {
      setAmountInput(formatNumberInput(parsed.amount.toString()));
    }
    if (parsed.purpose) {
      setNote(parsed.purpose);
    }
    setStep('confirm');
  };

  // File Upload Decoder
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          handleScannedCode(code.data);
        } else {
          alert('Không tìm thấy mã QR hợp lệ trong ảnh đã chọn. Vui lòng thử lại với ảnh rõ hơn.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Toggle Torch
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !torchOn;
      await (track.applyConstraints as (c: unknown) => Promise<void>)({
        advanced: [{ torch: nextTorch }]
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch not supported', e);
    }
  };

  // Execute Transfer to Bank App
  const handleExecuteTransfer = (targetPayer: 'tcb' | 'mb') => {
    const amountNum = parseSmartAmount(amountInput);
    if (!accountNumber) {
      alert('Vui lòng nhập hoặc kiểm tra số tài khoản nhận tiền.');
      return;
    }
    if (amountNum <= 0) {
      alert('Vui lòng nhập số tiền cần chuyển.');
      return;
    }

    setSelectedPayerBank(targetPayer);

    const transferNote = note.trim() || 'Chuyen tien';

    // Generate dynamic QR image for fallback
    const dynamicQr = getDynamicVietQRImage({
      bankCodeOrBin: selectedBankCode,
      accountNumber,
      amount: amountNum,
      note: transferNote
    });
    setQrImageUrl(dynamicQr);

    // Official Web-to-App Deeplink URL
    const deeplink = getVietQRDeepLink({
      appCode: targetPayer,
      bankCodeOrBin: selectedBankCode,
      accountNumber,
      amount: amountNum,
      note: transferNote
    });

    // Direct scheme as fallback / direct attempt
    const directScheme = getDirectAppScheme(targetPayer);

    // Attempt to open the app
    try {
      window.location.href = deeplink;
      setTimeout(() => {
        try {
          window.location.href = directScheme;
        } catch {
          // ignore
        }
      }, 500);
    } catch {
      window.open(deeplink, '_blank');
    }

    // Auto log transaction to the matching bank wallet with selected splitType
    if (autoLogToLedger && onLogTransaction) {
      const accountType = targetPayer === 'tcb' ? AccountType.TCB : AccountType.MB;
      onLogTransaction({
        amount: amountNum,
        description: transferNote,
        account: accountType,
        splitType: splitType,
        date: new Date()
      });
    }

    setStep('success');
  };

  // Reset or initialize on open
  useEffect(() => {
    if (isOpen) {
      setStep('scan');
      setCameraError(null);
      setAccountNumber('');
      setBeneficiaryName('');
      setAmountInput('');
      setNote('Chuyển tiền');
      setSplitType(SplitType.SHARED);
      setSelectedPayerBank('tcb');
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      />

      {/* Main Apple Modal Sheet */}
      <div className="bg-white w-full max-w-md rounded-t-[36px] sm:rounded-[36px] overflow-hidden shadow-2xl relative z-10 max-h-[92vh] flex flex-col border border-black/[0.06] animate-slide-up">
        
        {/* Apple Sheet Pull Bar */}
        <div className="w-10 h-1.5 bg-black/15 rounded-full mx-auto my-3 shrink-0 sm:hidden"></div>

        {/* Modal Header */}
        <div className="px-6 py-3 flex items-center justify-between border-b border-black/[0.04] shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-xl text-[#0071e3]">qr_code_scanner</span>
            <h3 className="font-semibold text-base text-[#1d1d1f]">
              {step === 'scan' ? 'Quét mã QR VietQR' : step === 'confirm' ? 'Chuyển tiền & Ghi chép' : 'Đang chuyển qua Ngân hàng...'}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-black/5 flex items-center justify-center text-[#86868b] transition-colors"
          >
            <span className="material-symbols-rounded text-base">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          
          {/* STEP 1: SCAN QR CAMERA VIEW */}
          {step === 'scan' && (
            <div className="space-y-4">
              <p className="text-xs text-[#86868b] text-center">
                Hướng camera về phía mã QR hoặc tải ảnh mã QR từ thư viện ảnh
              </p>

              {/* Viewfinder Frame */}
              <div className="relative w-full aspect-square max-w-[320px] mx-auto rounded-3xl overflow-hidden bg-black flex items-center justify-center shadow-inner">
                {cameraError ? (
                  <div className="p-6 text-center text-white/70 space-y-3">
                    <span className="material-symbols-rounded text-4xl text-[#ff3b30]">no_photography</span>
                    <p className="text-xs leading-relaxed">{cameraError}</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-full transition-all"
                    >
                      Chọn ảnh mã QR
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Scanner Overlay UI */}
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                      <div className="w-56 h-56 border-2 border-white/60 rounded-3xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                        <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-[#0071e3] to-transparent animate-pulse top-1/2 -translate-y-1/2"></div>
                        <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-[#0071e3] rounded-tl-lg"></div>
                        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-[#0071e3] rounded-tr-lg"></div>
                        <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-[#0071e3] rounded-bl-lg"></div>
                        <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-[#0071e3] rounded-br-lg"></div>
                      </div>
                    </div>

                    {/* Camera Control Buttons */}
                    <div className="absolute bottom-3 inset-x-0 flex justify-center items-center gap-3 z-20">
                      {hasTorch && (
                        <button
                          onClick={toggleTorch}
                          className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${
                            torchOn ? 'bg-yellow-400 text-black' : 'bg-black/40 text-white hover:bg-black/60'
                          }`}
                          title="Bật/tắt đèn flash"
                        >
                          <span className="material-symbols-rounded text-lg">{torchOn ? 'flash_on' : 'flash_off'}</span>
                        </button>
                      )}
                      <button
                        onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
                        className="w-10 h-10 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md flex items-center justify-center transition-all"
                        title="Đổi camera trước/sau"
                      >
                        <span className="material-symbols-rounded text-lg">flip_camera_ios</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Action Buttons: Pick Image or Input Manually */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-3 px-4 bg-[#f5f5f7] hover:bg-[#e8e8ed] active:scale-[0.98] text-[#1d1d1f] font-medium rounded-2xl text-xs flex items-center justify-center gap-2 transition-all border border-black/[0.04]"
                >
                  <span className="material-symbols-rounded text-base">photo_library</span>
                  Chọn từ thư viện ảnh
                </button>

                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setStep('confirm');
                  }}
                  className="py-3 px-4 bg-[#f5f5f7] hover:bg-[#e8e8ed] active:scale-[0.98] text-[#1d1d1f] font-medium rounded-2xl text-xs flex items-center justify-center gap-2 transition-all border border-black/[0.04]"
                >
                  <span className="material-symbols-rounded text-base">keyboard</span>
                  Nhập thông tin tay
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: FILL DETAILS, ALLOCATION & BANK SELECTION */}
          {step === 'confirm' && (
            <div className="space-y-4">
              
              {/* Recipient Details Card */}
              <div className="bg-[#f5f5f7] p-3.5 rounded-2xl border border-black/[0.04] space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider">Người thụ hưởng</span>
                  <span className="text-[10px] font-semibold text-[#0071e3] bg-[#0071e3]/10 px-2 py-0.5 rounded-full">
                    VietQR 24/7
                  </span>
                </div>

                {/* Bank Selector */}
                <div>
                  <select
                    value={selectedBankCode}
                    onChange={(e) => setSelectedBankCode(e.target.value)}
                    className="w-full bg-white border border-black/[0.06] rounded-xl px-3 py-2 text-xs font-semibold text-[#1d1d1f] outline-none"
                  >
                    {VIETNAM_BANKS.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.shortName} - {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Account Number & Copy */}
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\s+/g, ''))}
                      placeholder="Số tài khoản thụ hưởng"
                      className="w-full bg-white border border-black/[0.06] rounded-xl px-3 py-2 text-xs font-semibold text-[#1d1d1f] outline-none font-mono tracking-wider"
                    />
                  </div>
                  {accountNumber && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(accountNumber);
                        setCopiedAccount(true);
                        setTimeout(() => setCopiedAccount(false), 2000);
                      }}
                      className="px-3 py-2 bg-white border border-black/[0.06] rounded-xl text-xs font-medium text-[#1d1d1f] hover:bg-black/5 active:scale-95 transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-rounded text-sm">
                        {copiedAccount ? 'check' : 'content_copy'}
                      </span>
                      <span>{copiedAccount ? 'Đã chép' : 'Chép'}</span>
                    </button>
                  )}
                </div>

                {/* Beneficiary Name if present */}
                {beneficiaryName && (
                  <p className="text-xs font-semibold uppercase text-[#1d1d1f] bg-white px-3 py-1.5 rounded-xl border border-black/[0.06]">
                    {beneficiaryName}
                  </p>
                )}
              </div>

              {/* Amount Input with Smart Suggestions */}
              <div className="bg-white p-4 rounded-2xl border border-black/[0.06] shadow-sm">
                <label className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider block text-center mb-1">
                  Số tiền chuyển khoản
                </label>
                
                <div className="text-center mb-1.5">
                  <div className="inline-flex items-baseline justify-center">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={amountInput}
                      onChange={(e) => setAmountInput(formatNumberInput(e.target.value))}
                      placeholder="0"
                      className="text-3xl sm:text-4xl font-semibold tracking-tight text-center outline-none bg-transparent placeholder-black/15 text-[#1d1d1f] max-w-[240px]"
                    />
                    <span className="text-sm font-semibold text-[#86868b] ml-1">₫</span>
                  </div>
                  {amountInput && (
                    <p className="text-xs font-medium text-[#86868b] mt-0.5">
                      {formatCurrency(parseSmartAmount(amountInput))}
                    </p>
                  )}
                </div>

                {/* Smart Amount Suggestions */}
                <div className="pt-1">
                  <p className="text-[10px] text-center font-semibold text-[#86868b] uppercase tracking-wider mb-1.5">
                    Gợi ý số tiền nhanh
                  </p>
                  <div className="flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-1 flex-wrap">
                    {getAmountSuggestions(amountInput).map((sugg) => (
                      <button
                        key={sugg}
                        type="button"
                        onClick={() => setAmountInput(formatNumberInput(sugg.toString()))}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all active:scale-95 border ${
                          parseSmartAmount(amountInput) === sugg
                            ? 'bg-[#1d1d1f] text-white border-[#1d1d1f] shadow-sm'
                            : 'bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border-black/[0.04]'
                        }`}
                      >
                        {formatCurrency(sugg)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Transfer Note & Description (Nội dung chuyển khoản) */}
              <div className="bg-white p-3.5 rounded-2xl border border-black/[0.06] shadow-sm space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider block">
                    Nội dung chuyển khoản & Ghi chép
                  </label>
                  <span className="text-[10px] text-[#86868b]">{note.length}/50</span>
                </div>
                
                <div className="bg-[#f5f5f7] rounded-xl px-3.5 py-2.5 flex items-center gap-2 border border-black/[0.03]">
                  <span className="material-symbols-rounded text-[#86868b] text-base">edit_note</span>
                  <input
                    type="text"
                    value={note}
                    maxLength={50}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Nhập nội dung chuyển tiền (ví dụ: Ăn trưa, Cà phê...)"
                    className="w-full text-xs font-semibold text-[#1d1d1f] placeholder-[#86868b]/60 outline-none bg-transparent"
                  />
                </div>

                {/* Common Note Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
                  {COMMON_NOTES.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNote(preset)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 ${
                        note === preset
                          ? 'bg-[#1d1d1f] text-white'
                          : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Expense Allocation (Phân bổ chi phí chuẩn luồng setup) */}
              <div className="bg-white p-3.5 rounded-2xl border border-black/[0.06] shadow-sm space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider block">
                    Phân bổ chi phí
                  </label>
                  <span className="text-[10px] font-medium text-[#0071e3]">
                    {SPLIT_OPTIONS.find(o => o.id === splitType)?.desc}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {SPLIT_OPTIONS.map((opt) => {
                    const isSelected = splitType === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSplitType(opt.id as SplitType)}
                        className={`p-2.5 rounded-xl text-left border flex items-center gap-2 transition-all active:scale-[0.98] ${
                          isSelected
                            ? 'bg-[#0071e3]/10 border-[#0071e3] text-[#0071e3] font-semibold'
                            : 'bg-[#f5f5f7] border-transparent text-[#1d1d1f] hover:border-black/10'
                        }`}
                      >
                        <span className="material-symbols-rounded text-sm shrink-0">{opt.icon}</span>
                        <div className="truncate">
                          <p className="text-xs truncate">{opt.label}</p>
                          <p className="text-[9px] text-[#86868b] truncate">{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Subtext explanation of debt impact */}
                <div className="bg-[#f5f5f7] px-3 py-2 rounded-xl text-[11px] text-[#86868b] flex items-center gap-1.5">
                  <span className="material-symbols-rounded text-sm text-[#0071e3]">info</span>
                  <span>
                    {splitType === SplitType.SHARED && 'Mèo sẽ chịu 50% số tiền này và tính vào công nợ chốt sổ.'}
                    {splitType === SplitType.ME_ONLY && 'Khoản chi của riêng bạn, không ảnh hưởng đến nợ của Mèo.'}
                    {splitType === SplitType.MEO_ONLY && 'Mèo sẽ nợ bạn 100% số tiền này khi chốt sổ.'}
                    {splitType === SplitType.MEO_PAID && 'Khoản Mèo thanh toán, sẽ được trừ vào số nợ của Mèo.'}
                  </span>
                </div>
              </div>

              {/* Source Wallet & Paying Bank Section (Ví thanh toán tương ứng) */}
              <div className="bg-white p-3.5 rounded-2xl border border-black/[0.06] shadow-sm space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider block">
                    Ví thanh toán & Ngân hàng chuyển
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoLogToLedger}
                      onChange={(e) => setAutoLogToLedger(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-[#0071e3] accent-[#1d1d1f] focus:ring-0 cursor-pointer"
                    />
                    <span className="text-[11px] text-[#86868b] font-medium">
                      Ghi sổ chi tiêu
                    </span>
                  </label>
                </div>

                {/* 2 Interactive Bank Wallet Cards */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Techcombank Option */}
                  <button
                    type="button"
                    onClick={() => setSelectedPayerBank('tcb')}
                    className={`p-3 rounded-2xl text-left border transition-all active:scale-[0.98] relative overflow-hidden ${
                      selectedPayerBank === 'tcb'
                        ? 'border-[#e3001b] bg-[#e3001b]/5 shadow-sm'
                        : 'border-black/[0.06] bg-[#f5f5f7] hover:border-black/15'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="w-6 h-6 rounded-full bg-[#e3001b] text-white flex items-center justify-center font-bold text-[9px]">
                        TCB
                      </div>
                      {selectedPayerBank === 'tcb' && (
                        <span className="material-symbols-rounded text-sm text-[#e3001b]">check_circle</span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-[#1d1d1f]">Techcombank</p>
                    <p className="text-[10px] text-[#86868b]">
                      Số dư: {formatCurrency(tcbAccount?.balance || 0)}
                    </p>
                  </button>

                  {/* MB Bank Option */}
                  <button
                    type="button"
                    onClick={() => setSelectedPayerBank('mb')}
                    className={`p-3 rounded-2xl text-left border transition-all active:scale-[0.98] relative overflow-hidden ${
                      selectedPayerBank === 'mb'
                        ? 'border-[#003399] bg-[#003399]/5 shadow-sm'
                        : 'border-black/[0.06] bg-[#f5f5f7] hover:border-black/15'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="w-6 h-6 rounded-full bg-[#003399] text-white flex items-center justify-center font-bold text-[9px]">
                        MB
                      </div>
                      {selectedPayerBank === 'mb' && (
                        <span className="material-symbols-rounded text-sm text-[#003399]">check_circle</span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-[#1d1d1f]">MB Bank</p>
                    <p className="text-[10px] text-[#86868b]">
                      Số dư: {formatCurrency(mbAccount?.balance || 0)}
                    </p>
                  </button>
                </div>
              </div>

              {/* Action Buttons to Launch Chosen Bank App */}
              <div className="pt-1 space-y-2.5">
                {/* Techcombank Action Button */}
                <button
                  type="button"
                  onClick={() => handleExecuteTransfer('tcb')}
                  disabled={!accountNumber || parseSmartAmount(amountInput) <= 0}
                  className={`w-full py-3.5 px-4 bg-gradient-to-r from-[#e3001b] to-[#b30015] hover:opacity-95 active:scale-[0.98] text-white rounded-2xl font-medium text-xs shadow-sm flex items-center justify-between transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    selectedPayerBank === 'tcb' ? 'ring-2 ring-[#e3001b]/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#e3001b] font-black text-xs shadow-sm">
                      TCB
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-sm">Chuyển qua Techcombank</p>
                      <p className="text-[10px] text-white/80">Trừ ví Techcombank ({formatCurrency(tcbAccount?.balance || 0)})</p>
                    </div>
                  </div>
                  <span className="material-symbols-rounded text-lg">arrow_forward</span>
                </button>

                {/* MB Bank Action Button */}
                <button
                  type="button"
                  onClick={() => handleExecuteTransfer('mb')}
                  disabled={!accountNumber || parseSmartAmount(amountInput) <= 0}
                  className={`w-full py-3.5 px-4 bg-gradient-to-r from-[#003399] to-[#002266] hover:opacity-95 active:scale-[0.98] text-white rounded-2xl font-medium text-xs shadow-sm flex items-center justify-between transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    selectedPayerBank === 'mb' ? 'ring-2 ring-[#003399]/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#003399] font-black text-xs shadow-sm">
                      MB
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-sm">Chuyển qua MB Bank</p>
                      <p className="text-[10px] text-white/80">Trừ ví MB Bank ({formatCurrency(mbAccount?.balance || 0)})</p>
                    </div>
                  </div>
                  <span className="material-symbols-rounded text-lg">arrow_forward</span>
                </button>

                {/* Rescan Button */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('scan');
                      startCamera();
                    }}
                    className="text-xs font-semibold text-[#0071e3] hover:underline"
                  >
                    ← Quét mã QR khác
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* STEP 3: SUCCESS / APP SWITCH HELPER */}
          {step === 'success' && (
            <div className="py-2 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-[#34c759]/10 text-[#34c759] flex items-center justify-center mx-auto">
                <span className="material-symbols-rounded text-3xl">open_in_new</span>
              </div>

              <div>
                <h4 className="text-base font-semibold text-[#1d1d1f]">
                  Đang mở app {selectedPayerBank === 'tcb' ? 'Techcombank' : 'MB Bank'}
                </h4>
                <p className="text-xs text-[#86868b] mt-1 max-w-xs mx-auto">
                  Số tiền {formatCurrency(parseSmartAmount(amountInput))} với nội dung "{note}" đã được gửi sang app ngân hàng.
                </p>
              </div>

              {/* Dynamic QR Fallback Card */}
              {qrImageUrl && (
                <div className="bg-[#f5f5f7] p-4 rounded-3xl border border-black/[0.05] inline-block max-w-[280px] mx-auto space-y-2">
                  <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider">
                    Mã VietQR động đã điền số tiền
                  </p>
                  <img
                    src={qrImageUrl}
                    alt="VietQR Dynamic"
                    className="w-56 h-56 mx-auto rounded-2xl bg-white p-2 shadow-sm border border-black/[0.06]"
                  />
                  <div className="pt-1 flex gap-2">
                    <a
                      href={qrImageUrl}
                      download={`VietQR_${accountNumber}_${parseSmartAmount(amountInput)}.png`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 bg-white text-[#1d1d1f] border border-black/[0.08] hover:bg-black/5 font-medium rounded-xl text-[11px] flex items-center justify-center gap-1 shadow-sm"
                    >
                      <span className="material-symbols-rounded text-sm">download</span>
                      Lưu ảnh QR
                    </a>
                    <button
                      type="button"
                      onClick={() => handleExecuteTransfer(selectedPayerBank)}
                      className="flex-1 py-2 bg-[#1d1d1f] text-white hover:bg-black font-medium rounded-xl text-[11px] flex items-center justify-center gap-1 shadow-sm"
                    >
                      <span className="material-symbols-rounded text-sm">replay</span>
                      Mở lại App
                    </button>
                  </div>
                </div>
              )}

              {autoLogToLedger && (
                <div className="bg-[#34c759]/10 text-[#34c759] text-xs font-semibold py-2.5 px-3.5 rounded-2xl inline-flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-rounded text-base">check_circle</span>
                    <span>Đã ghi nhận vào ví {selectedPayerBank === 'tcb' ? 'Techcombank' : 'MB Bank'}</span>
                  </div>
                  <span className="text-[11px] font-normal text-[#34c759]/90">
                    Phân bổ: {SPLIT_OPTIONS.find(o => o.id === splitType)?.label}
                  </span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] font-medium rounded-full text-xs transition-all"
                >
                  Hoàn tất & Quay lại
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
