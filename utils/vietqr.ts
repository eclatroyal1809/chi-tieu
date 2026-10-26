export interface BankInfo {
  bin: string;
  code: string;
  shortName: string;
  name: string;
}

export const VIETNAM_BANKS: BankInfo[] = [
  { bin: '970407', code: 'tcb', shortName: 'Techcombank', name: 'Ngân hàng Kỹ thương Việt Nam' },
  { bin: '970422', code: 'mb', shortName: 'MB Bank', name: 'Ngân hàng Quân đội' },
  { bin: '970436', code: 'vcb', shortName: 'Vietcombank', name: 'Ngân hàng Ngoại thương Việt Nam' },
  { bin: '970415', code: 'ctg', shortName: 'VietinBank', name: 'Ngân hàng Công thương Việt Nam' },
  { bin: '970418', code: 'bidv', shortName: 'BIDV', name: 'Ngân hàng Đầu tư và Phát triển Việt Nam' },
  { bin: '970416', code: 'acb', shortName: 'ACB', name: 'Ngân hàng Á Châu' },
  { bin: '970432', code: 'vpb', shortName: 'VPBank', name: 'Ngân hàng Việt Nam Thịnh Vượng' },
  { bin: '970423', code: 'tpb', shortName: 'TPBank', name: 'Ngân hàng Tiên Phong' },
  { bin: '970403', code: 'stb', shortName: 'Sacombank', name: 'Ngân hàng Sài Gòn Thương Tín' },
  { bin: '970441', code: 'vib', shortName: 'VIB', name: 'Ngân hàng Quốc tế' },
  { bin: '970443', code: 'shb', shortName: 'SHB', name: 'Ngân hàng Sài Gòn - Hà Nội' },
  { bin: '970448', code: 'ocb', shortName: 'OCB', name: 'Ngân hàng Phương Đông' },
  { bin: '970426', code: 'msb', shortName: 'MSB', name: 'Ngân hàng Hàng Hải' },
  { bin: '970437', code: 'hdb', shortName: 'HDBank', name: 'Ngân hàng Phát triển TP.HCM' },
  { bin: '970405', code: 'vba', shortName: 'Agribank', name: 'Ngân hàng Nông nghiệp & PTNT' },
  { bin: '970428', code: 'nab', shortName: 'Nam A Bank', name: 'Ngân hàng Nam Á' },
  { bin: '970449', code: 'lpb', shortName: 'LPBank', name: 'Ngân hàng Lộc Phát' },
  { bin: '970454', code: 'vccb', shortName: 'BVBank', name: 'Ngân hàng Bản Việt' },
  { bin: '970431', code: 'eib', shortName: 'Eximbank', name: 'Ngân hàng Xuất Nhập khẩu' },
  { bin: '970452', code: 'klb', shortName: 'Kienlongbank', name: 'Ngân hàng Kiên Long' },
  { bin: '970433', code: 'vietb', shortName: 'VietBank', name: 'Ngân hàng Việt Nam Thương Tín' },
  { bin: '970425', code: 'abb', shortName: 'ABBANK', name: 'Ngân hàng An Bình' },
  { bin: '970427', code: 'vab', shortName: 'VietABank', name: 'Ngân hàng Việt Á' },
  { bin: '970440', code: 'seab', shortName: 'SeABank', name: 'Ngân hàng Đông Nam Á' },
  { bin: '970419', code: 'ncb', shortName: 'NCB', name: 'Ngân hàng Quốc Dân' },
  { bin: '970438', code: 'bvb', shortName: 'BaoViet Bank', name: 'Ngân hàng Bảo Việt' },
  { bin: '970400', code: 'sgb', shortName: 'Saigonbank', name: 'Ngân hàng Sài Gòn Công Thương' },
  { bin: '970458', code: 'shbv', shortName: 'Shinhan Bank', name: 'Ngân hàng Shinhan Việt Nam' },
  { bin: '970457', code: 'wrb', shortName: 'Woori Bank', name: 'Ngân hàng Woori' }
];

export interface ParsedVietQR {
  bankBin: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  amount?: number;
  purpose?: string;
  beneficiaryName?: string;
  isVietQR: boolean;
  raw: string;
}

// TLV Parser for EMVCo
function parseTLV(payload: string): { [tag: string]: string } {
  const result: { [tag: string]: string } = {};
  let i = 0;
  while (i < payload.length - 4) {
    const tag = payload.substring(i, i + 2);
    const len = parseInt(payload.substring(i + 2, i + 4), 10);
    if (isNaN(len)) break;
    const val = payload.substring(i + 4, i + 4 + len);
    result[tag] = val;
    i += 4 + len;
  }
  return result;
}

export function parseVietQR(text: string): ParsedVietQR {
  const clean = text.trim();

  // 1. Check if EMVCo VietQR string (starts with 000201...)
  if (clean.startsWith('000201')) {
    try {
      const root = parseTLV(clean);
      let bankBin = '';
      let accountNumber = '';
      let beneficiaryName = root['59'] || '';
      let amount: number | undefined = root['54'] ? parseFloat(root['54']) : undefined;
      let purpose = '';

      // Tag 62: Additional data (Purpose of transaction is subtag 08)
      if (root['62']) {
        const tag62 = parseTLV(root['62']);
        purpose = tag62['08'] || tag62['01'] || '';
      }

      // Tag 38: Merchant Account Information
      if (root['38']) {
        const tag38 = parseTLV(root['38']);
        
        // Subtag 01 usually contains nested TLV or formatted acquirer & merchant
        if (tag38['01']) {
          const sub01 = parseTLV(tag38['01']);
          if (sub01['00']) bankBin = sub01['00'];
          if (sub01['01']) accountNumber = sub01['01'];
        }

        // Alternative tag 38 format where subtag 00 is GUID, 01 is BIN, 02 is Account
        if (!accountNumber && tag38['02']) {
          accountNumber = tag38['02'];
          if (tag38['01'] && tag38['01'].length === 6) {
            bankBin = tag38['01'];
          }
        }
      }

      const bank = VIETNAM_BANKS.find(b => b.bin === bankBin) || 
                   VIETNAM_BANKS.find(b => b.code.toLowerCase() === bankBin.toLowerCase()) || 
                   VIETNAM_BANKS[0]; // fallback

      return {
        bankBin: bank.bin,
        bankCode: bank.code,
        bankName: bank.shortName,
        accountNumber,
        amount,
        purpose,
        beneficiaryName,
        isVietQR: true,
        raw: clean
      };
    } catch (e) {
      console.warn('Error parsing EMVCo QR:', e);
    }
  }

  // 2. Check if URL VietQR (e.g. https://img.vietqr.io/image/tcb-1903...-compact2.png?amount=...)
  try {
    const url = new URL(clean);
    const searchParams = url.searchParams;
    const pathParts = url.pathname.split('/');
    const imagePart = pathParts.find(p => p.includes('-'));

    if (imagePart) {
      const [bankSlug, accSlug] = imagePart.replace(/\.png|\.jpg|\.svg/g, '').split('-');
      const bank = VIETNAM_BANKS.find(b => b.code.toLowerCase() === bankSlug.toLowerCase() || b.bin === bankSlug) || VIETNAM_BANKS[0];
      const parsedAmount = searchParams.get('amount') ? parseFloat(searchParams.get('amount')!) : undefined;
      const parsedPurpose = searchParams.get('addInfo') || '';

      return {
        bankBin: bank.bin,
        bankCode: bank.code,
        bankName: bank.shortName,
        accountNumber: accSlug || '',
        amount: isNaN(Number(parsedAmount)) ? undefined : parsedAmount,
        purpose: parsedPurpose,
        beneficiaryName: '',
        isVietQR: true,
        raw: clean
      };
    }
  } catch {
    // Not a URL
  }

  // 3. Fallback: Parse account number and guess or default
  const digits = clean.replace(/\D/g, '');
  return {
    bankBin: '970407',
    bankCode: 'tcb',
    bankName: 'Techcombank',
    accountNumber: digits.length >= 8 && digits.length <= 16 ? digits : '',
    amount: undefined,
    purpose: '',
    beneficiaryName: '',
    isVietQR: false,
    raw: clean
  };
}

/**
 * Generate official VietQR web-to-app deep link
 * Format: https://dl.vietqr.io/pay?app=<APP>&ba=<ACCOUNT>@<BANK>&am=<AMOUNT>&tn=<NOTE>&url=<CALLBACK>
 */
export function getVietQRDeepLink(params: {
  appCode: 'tcb' | 'mb';
  bankCodeOrBin: string;
  accountNumber: string;
  amount: number;
  note: string;
}): string {
  const { appCode, bankCodeOrBin, accountNumber, amount, note } = params;
  const callbackUrl = window.location.href;
  const bankParam = bankCodeOrBin.toLowerCase();
  const ba = `${accountNumber}@${bankParam}`;
  const encodedNote = encodeURIComponent(note || 'Chuyen tien');
  const encodedCallback = encodeURIComponent(callbackUrl);

  return `https://dl.vietqr.io/pay?app=${appCode}&ba=${ba}&am=${amount}&tn=${encodedNote}&url=${encodedCallback}`;
}

/**
 * Direct App Schemes
 */
export function getDirectAppScheme(appCode: 'tcb' | 'mb'): string {
  if (appCode === 'tcb') {
    return 'techcombank://';
  }
  return 'mbmobile://';
}

/**
 * Dynamic VietQR Image URL for fallback visual scanning / saving to photo library
 */
export function getDynamicVietQRImage(params: {
  bankCodeOrBin: string;
  accountNumber: string;
  amount: number;
  note: string;
}): string {
  const { bankCodeOrBin, accountNumber, amount, note } = params;
  const safeBank = bankCodeOrBin || 'TCB';
  const safeAmount = amount > 0 ? `?amount=${amount}` : '';
  const safeNote = note ? `${safeAmount ? '&' : '?'}addInfo=${encodeURIComponent(note)}` : '';
  return `https://img.vietqr.io/image/${safeBank}-${accountNumber}-compact2.png${safeAmount}${safeNote}`;
}
