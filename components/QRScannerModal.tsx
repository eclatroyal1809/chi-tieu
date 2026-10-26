import React, { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import { parseVietQR, VIETNAM_BANKS, getVietQRDeepLink, getDirectAppScheme, getDynamicVietQRImage, ParsedVietQR } from '../utils/vietqr';
import { AccountType, TransactionType, SplitType } from '../types';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogTransaction?: (data: {
    amount: number;
    description: string;
    account: AccountType;
  }) => void;
  getAmountSuggestions: (val: string) => number[];
  formatCurrency: (amount: number) => string;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
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
  const [parsedData, setParsedData] = useState<ParsedVietQR | null>(null);
  const [selectedBankCode, setSelectedBankCode] = useState<string>('tcb');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [beneficiaryName, setBeneficiaryName] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [note, setNote] = useState<string>('Chuyen tien');
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

      // Check flashlight support
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
        // Haptic feedback
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
    const parsed = parseVietQR(rawPayload);
    setParsedData(parsed);
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

    // Generate dynamic QR image for fallback
    const dynamicQr = getDynamicVietQRImage({
      bankCodeOrBin: selectedBankCode,
      accountNumber,
      amount: amountNum,
      note
    });
    setQrImageUrl(dynamicQr);

    // Official Web-to-App Deeplink URL
    const deeplink = getVietQRDeepLink({
      appCode: targetPayer,
      bankCodeOrBin: selectedBankCode,
      accountNumber,
      amount: amountNum,
      note
    });

    // Direct scheme as fallback / direct attempt
    const directScheme = getDirectAppScheme(targetPayer);

    // Attempt to open the app
    try {
      // First try standard deeplink
      window.location.href = deeplink;
      
      // Fallback timer to trigger direct scheme if needed
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

    // If auto log is checked, prepare and record transaction
    if (autoLogToLedger && onLogTransaction) {
      const accountType = targetPayer === 'tcb' ? AccountType.TCB : AccountType.MB;
      const bankInfo = VIETNAM_BANKS.find(b => b.code === selectedBankCode);
      const desc = `CK ${bankInfo?.shortName || selectedBankCode} - ${beneficiaryName || accountNumber}: ${note}`;
      onLogTransaction({
        amount: amountNum,
        description: desc,
        account: accountType
      });
    }

    setStep('success');
  };

  // Reset or initialize on open
  useEffect(() => {
    if (isOpen) {
      setStep('scan');
      setCameraError(null);
      setParsedData(null);
      setAccountNumber('');
      setBeneficiaryName('');
      setAmountInput('');
      setNote('Chuyen tien');
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
              {step === 'scan' ? 'Quét mã QR VietQR' : step === 'confirm' ? 'Chuyển tiền qua Ngân hàng' : 'Đang mở ứng dụng...'}
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
                      {/* Targeting Box */}
                      <div className="w-56 h-56 border-2 border-white/60 rounded-3xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                        {/* Animated Laser line */}
                        <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-[#0071e3] to-transparent animate-pulse top-1/2 -translate-y-1/2"></div>
                        
                        {/* Corner markers */}
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

          {/* STEP 2: FILL AMOUNT & SELECT TECHCOMBANK OR MB BANK */}
          {step === 'confirm' && (
            <div className="space-y-4">
              {/* Recipient Details Card */}
              <div className="bg-[#f5f5f7] p-4 rounded-2xl border border-black/[0.04] space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider">Tài khoản nhận</span>
                  <span className="text-[10px] font-semibold text-[#0071e3] bg-[#0071e3]/10 px-2 py-0.5 rounded-full">
                    VietQR 24/7
                  </span>
                </div>

                {/* Bank Selector */}
                <div>
                  <label className="text-[10px] text-[#86868b] font-medium block mb-1">Ngân hàng thụ hưởng</label>
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

                {/* Account Number */}
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-[#86868b] font-medium block mb-0.5">Số tài khoản</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\s+/g, ''))}
                      placeholder="Nhập số tài khoản thụ hưởng"
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
                      className="mt-4 px-3 py-2 bg-white border border-black/[0.06] rounded-xl text-xs font-medium text-[#1d1d1f] hover:bg-black/5 active:scale-95 transition-all flex items-center gap-1"
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
                  <div>
                    <label className="text-[10px] text-[#86868b] font-medium block mb-0.5">Người thụ hưởng</label>
                    <p className="text-xs font-semibold uppercase text-[#1d1d1f] bg-white px-3 py-2 rounded-xl border border-black/[0.06]">
                      {beneficiaryName}
                    </p>
                  </div>
                )}
              </div>

              {/* Amount Input with Smart Suggestions */}
              <div className="bg-white p-4 rounded-2xl border border-black/[0.06] shadow-sm">
                <label className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider block text-center mb-1">
                  Số tiền chuyển khoản
                </label>
                
                <div className="text-center mb-2">
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

              {/* Transfer Note / Message */}
              <div>
                <label className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider block mb-1 px-1">
                  Nội dung chuyển tiền
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Lời nhắn chuyển tiền"
                  className="w-full bg-[#f5f5f7] border border-black/[0.06] rounded-2xl px-4 py-3 text-xs font-medium text-[#1d1d1f] outline-none"
                />
              </div>

              {/* Auto Log Checkbox */}
              <label className="flex items-center gap-2.5 px-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoLogToLedger}
                  onChange={(e) => setAutoLogToLedger(e.target.checked)}
                  className="w-4 h-4 rounded text-[#0071e3] accent-[#1d1d1f] focus:ring-0 cursor-pointer"
                />
                <span className="text-xs text-[#1d1d1f] font-medium">
                  Tự động ghi nhận vào sổ chi tiêu của ví tương ứng
                </span>
              </label>

              {/* Primary Bank Buttons: Techcombank & MB Bank */}
              <div className="pt-2 space-y-2.5">
                <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider text-center">
                  Chọn ứng dụng ngân hàng để chuyển
                </p>

                {/* Techcombank Action Button */}
                <button
                  type="button"
                  onClick={() => handleExecuteTransfer('tcb')}
                  disabled={!accountNumber || parseSmartAmount(amountInput) <= 0}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-[#e3001b] to-[#b30015] hover:opacity-95 active:scale-[0.98] text-white rounded-2xl font-medium text-xs shadow-sm flex items-center justify-between transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#e3001b] font-black text-xs shadow-sm">
                      TCB
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-sm">Chuyển qua Techcombank</p>
                      <p className="text-[10px] text-white/80">Mở app Techcombank Mobile & tự động điền</p>
                    </div>
                  </div>
                  <span className="material-symbols-rounded text-lg">arrow_forward</span>
                </button>

                {/* MB Bank Action Button */}
                <button
                  type="button"
                  onClick={() => handleExecuteTransfer('mb')}
                  disabled={!accountNumber || parseSmartAmount(amountInput) <= 0}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-[#003399] to-[#002266] hover:opacity-95 active:scale-[0.98] text-white rounded-2xl font-medium text-xs shadow-sm flex items-center justify-between transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#003399] font-black text-xs shadow-sm">
                      MB
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-sm">Chuyển qua MB Bank</p>
                      <p className="text-[10px] text-white/80">Mở app MB Bank & tự động điền</p>
                    </div>
                  </div>
                  <span className="material-symbols-rounded text-lg">arrow_forward</span>
                </button>

                {/* Scan Again Link */}
                <div className="text-center pt-2">
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
                  Số tiền {formatCurrency(parseSmartAmount(amountInput))} đã được gửi kèm thông tin tài khoản đến ngân hàng.
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
                <div className="bg-[#34c759]/10 text-[#34c759] text-xs font-semibold py-2 px-3 rounded-xl inline-flex items-center gap-1.5">
                  <span className="material-symbols-rounded text-base">check_circle</span>
                  Đã ghi nhận giao dịch vào ví {selectedPayerBank === 'tcb' ? 'Techcombank' : 'MB Bank'}
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
