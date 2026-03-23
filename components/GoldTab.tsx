import React, { useState, useEffect } from 'react';
import { Account, Transaction, AccountType, TransactionType, SplitType } from '../types';
import * as supabaseService from '../services/supabaseService';
import DatePicker from 'react-datepicker';
import { vi } from 'date-fns/locale';

export type GoldState = {
    id: string;
    totalPhan: number;
    purchases?: {
        id: string;
        date: string;
        amount: number;
        totalPhan: number;
        brand?: string;
        isHistorical?: boolean;
    }[];
    withdrawals?: {
        id: string;
        date: string;
        amount: number;
        totalPhan: number;
        brand?: string;
    }[];
    updatedAt?: string;
};

interface GoldTabProps {
    goldState: GoldState | null;
    setGoldState: React.Dispatch<React.SetStateAction<GoldState | null>>;
    accounts: Account[];
    setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
    transactions: Transaction[];
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    formatCurrency: (amount: number) => string;
    parseSmartAmount: (val: string) => number;
    formatNumberInput: (val: string) => string;
}

const parseNonNegativeInt = (raw: string) => {
    const cleaned = (raw || '').replace(/[^\d]/g, '');
    const v = parseInt(cleaned || '0', 10);
    return Number.isFinite(v) && v >= 0 ? v : 0;
};

const normalizeGoldUnits = (luong: number, chi: number, phan: number) => {
    let p = Math.max(0, phan);
    let c = Math.max(0, chi);
    let l = Math.max(0, luong);
    c += Math.floor(p / 10);
    p = p % 10;
    l += Math.floor(c / 10);
    c = c % 10;
    return { luong: l, chi: c, phan: p };
};

const toTotalPhan = (luong: number, chi: number, phan: number) => luong * 100 + chi * 10 + phan;

const fromTotalPhan = (totalPhan: number) => {
    const safe = Math.max(0, Math.floor(totalPhan || 0));
    const luong = Math.floor(safe / 100);
    const chi = Math.floor((safe % 100) / 10);
    const phan = safe % 10;
    return { luong, chi, phan };
};

export const GoldTab: React.FC<GoldTabProps> = ({
    goldState, setGoldState,
    accounts, setAccounts,
    transactions, setTransactions,
    formatCurrency, parseSmartAmount, formatNumberInput
}) => {
    const [goldBuyBrand, setGoldBuyBrand] = useState('');
    const [goldBuyAmount, setGoldBuyAmount] = useState('');
    const [goldBuyLuong, setGoldBuyLuong] = useState('');
    const [goldBuyChi, setGoldBuyChi] = useState('');
    const [goldBuyPhan, setGoldBuyPhan] = useState('');
    const [goldBuyDate, setGoldBuyDate] = useState<Date>(new Date());

    const [goldWithdrawAmount, setGoldWithdrawAmount] = useState('');
    const [goldWithdrawLuong, setGoldWithdrawLuong] = useState('');
    const [goldWithdrawChi, setGoldWithdrawChi] = useState('');
    const [goldWithdrawPhan, setGoldWithdrawPhan] = useState('');
    const [goldWithdrawDate, setGoldWithdrawDate] = useState<Date>(new Date());
    const [goldWithdrawBrand, setGoldWithdrawBrand] = useState('');

    const resetGoldPurchases = async (opts?: { askConfirm?: boolean }) => {
        const askConfirm = opts?.askConfirm !== false;
        const purchases = goldState?.purchases || [];
        if (purchases.length === 0) return;
        const refundablePurchases = purchases.filter(p => !p.isHistorical);
        if (askConfirm && !window.confirm(refundablePurchases.length > 0 ? 'Xoá toàn bộ lịch sử mua vàng và hoàn tiền về Tiết kiệm ăn Tết?' : 'Xoá toàn bộ lịch sử mua vàng?')) return;

        const refund = refundablePurchases.reduce((s, p) => s + (p.amount || 0), 0);
        const removedTotalPhan = purchases.reduce((s, p) => s + (p.totalPhan || 0), 0);

        const mbAcc = accounts.find(a => a.id === AccountType.MB);
        const tetAcc = accounts.find(a => a.id === AccountType.TET_SAVING);
        if (refund > 0 && (!mbAcc || !tetAcc)) {
            alert('Không tìm thấy ví MB Bank hoặc Tiết kiệm ăn Tết');
            return;
        }

        const newTet = tetAcc ? tetAcc.balance + refund : 0;
        const newMb = mbAcc ? mbAcc.balance + refund : 0;

        try {
            const tasks: Promise<any>[] = [];
            if (refund > 0) {
                tasks.push(supabaseService.updateAccountBalance(AccountType.TET_SAVING, newTet));
                tasks.push(supabaseService.updateAccountBalance(AccountType.MB, newMb));
            }
            tasks.push(...refundablePurchases.map(p => supabaseService.deleteTransaction(p.id).catch(() => {})));
            await Promise.all(tasks);

            if (refund > 0) {
                setAccounts(prev => prev.map(acc => {
                    if (acc.id === AccountType.TET_SAVING) return { ...acc, balance: newTet };
                    if (acc.id === AccountType.MB) return { ...acc, balance: newMb };
                    return acc;
                }));
            }

            const ids = new Set(refundablePurchases.map(p => p.id));
            if (ids.size > 0) {
                setTransactions(prev => prev.filter(t => !ids.has(t.id)));
            }

            setGoldState(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    totalPhan: Math.max(0, (prev.totalPhan || 0) - removedTotalPhan),
                    purchases: [],
                    updatedAt: new Date().toISOString()
                };
            });
        } catch (e) {
            console.error('Reset gold purchases error', e);
            alert('Lỗi khi xoá lịch sử mua vàng');
        }
    };

    const resetGoldAll = async (opts?: { askConfirm?: boolean }) => {
        const askConfirm = opts?.askConfirm !== false;
        const purchases = goldState?.purchases || [];
        const withdrawals = goldState?.withdrawals || [];
        if (purchases.length === 0 && withdrawals.length === 0) return;
        if (askConfirm && !window.confirm('Xoá toàn bộ lịch sử vàng (mua + rút) và hoàn tiền về Tiết kiệm ăn Tết?')) return;

        const mbAcc = accounts.find(a => a.id === AccountType.MB);
        const tetAcc = accounts.find(a => a.id === AccountType.TET_SAVING);
        if (!mbAcc || !tetAcc) {
            alert('Không tìm thấy ví MB Bank hoặc Tiết kiệm ăn Tết');
            return;
        }

        const refundablePurchases = purchases.filter(p => !p.isHistorical);
        const refundBuy = refundablePurchases.reduce((s, p) => s + (p.amount || 0), 0);
        const revertWithdraw = withdrawals.reduce((s, w) => s + (w.amount || 0), 0);
        const delta = refundBuy - revertWithdraw;

        const newTet = tetAcc.balance + delta;
        const newMb = mbAcc.balance + delta;

        try {
            await Promise.all([
                supabaseService.updateAccountBalance(AccountType.TET_SAVING, newTet),
                supabaseService.updateAccountBalance(AccountType.MB, newMb),
                ...refundablePurchases.map(p => supabaseService.deleteTransaction(p.id).catch(() => {})),
                ...withdrawals.map(w => supabaseService.deleteTransaction(w.id).catch(() => {}))
            ]);

            setAccounts(prev => prev.map(acc => {
                if (acc.id === AccountType.TET_SAVING) return { ...acc, balance: newTet };
                if (acc.id === AccountType.MB) return { ...acc, balance: newMb };
                return acc;
            }));

            const ids = new Set([...refundablePurchases.map(p => p.id), ...withdrawals.map(w => w.id)]);
            setTransactions(prev => prev.filter(t => !ids.has(t.id)));

            setGoldState(prev => {
                if (!prev) return prev;
                return { ...prev, totalPhan: 0, purchases: [], withdrawals: [], updatedAt: new Date().toISOString() };
            });
        } catch (e) {
            console.error('Reset gold all error', e);
            alert('Lỗi khi xoá lịch sử vàng');
        }
    };

    useEffect(() => {
        if (!goldState) return;
        const purchases = goldState.purchases || [];
        const withdrawals = goldState.withdrawals || [];
        if (withdrawals.length > 0) return;
        if (purchases.length !== 1) return;
        if ((purchases[0].totalPhan || 0) !== 1) return;
        if (localStorage.getItem('goldAutoReset_v1') === '1') return;
        localStorage.setItem('goldAutoReset_v1', '1');
        resetGoldAll({ askConfirm: false }).catch(() => {});
    }, [goldState]);

    useEffect(() => {
        if (!goldState) return;
        if (!accounts || accounts.length === 0) return;
        if (!transactions || transactions.length === 0) return;
        if (localStorage.getItem('goldFix_20260323_v1') === '1') return;

        const cutoff = new Date(2026, 2, 23);
        const target = transactions.find(t => {
            if ((t.amount || 0) !== 1650000) return false;
            if (t.type !== TransactionType.EXPENSE) return false;
            const desc = (t.description || '').toLowerCase();
            if (!desc.includes('mua vàng')) return false;
            const d = new Date(t.date);
            return Number.isFinite(d.getTime()) && d < cutoff;
        });
        if (!target) return;

        const mbAcc = accounts.find(a => a.id === AccountType.MB);
        const tetAcc = accounts.find(a => a.id === AccountType.TET_SAVING);
        if (!mbAcc || !tetAcc) return;

        const amountVal = 1650000;
        const newTet = tetAcc.balance + amountVal;
        const newMb = mbAcc.balance + amountVal;

        Promise.all([
            supabaseService.updateAccountBalance(AccountType.TET_SAVING, newTet),
            supabaseService.updateAccountBalance(AccountType.MB, newMb),
            supabaseService.deleteTransaction(target.id).catch(() => {})
        ])
            .then(() => {
                setAccounts(prev => prev.map(acc => {
                    if (acc.id === AccountType.TET_SAVING) return { ...acc, balance: newTet };
                    if (acc.id === AccountType.MB) return { ...acc, balance: newMb };
                    return acc;
                }));
                setTransactions(prev => prev.filter(t => t.id !== target.id));
                setGoldState(prev => {
                    if (!prev) return prev;
                    return { ...prev, totalPhan: 0, purchases: [], withdrawals: [], updatedAt: new Date().toISOString() };
                });
                localStorage.setItem('goldFix_20260323_v1', '1');
            })
            .catch((e) => {
                console.error('Gold fix 20260323 error', e);
            });
    }, [goldState, accounts, transactions]);

    const handleBuyGold = async () => {
        const amountVal = parseSmartAmount(goldBuyAmount);
        const luongRaw = parseNonNegativeInt(goldBuyLuong);
        const chiRaw = parseNonNegativeInt(goldBuyChi);
        const phanRaw = parseNonNegativeInt(goldBuyPhan);
        const normalized = normalizeGoldUnits(luongRaw, chiRaw, phanRaw);
        const totalPhan = toTotalPhan(normalized.luong, normalized.chi, normalized.phan);
        const buyDate = new Date(goldBuyDate.getFullYear(), goldBuyDate.getMonth(), goldBuyDate.getDate());
        const brand = (goldBuyBrand || '').trim();
        const cutoff = new Date(2026, 2, 23);
        const isHistorical = Number.isFinite(buyDate.getTime()) && buyDate < cutoff;

        if (amountVal <= 0) {
            alert('Vui lòng nhập số tiền mua vàng');
            return;
        }
        if (totalPhan <= 0) {
            alert('Vui lòng nhập số lượng vàng (phân/chỉ/lượng)');
            return;
        }
        if (!brand) {
            alert('Vui lòng nhập thương hiệu vàng');
            return;
        }

        const mbAcc = accounts.find(a => a.id === AccountType.MB);
        const tetAcc = accounts.find(a => a.id === AccountType.TET_SAVING);
        if (!mbAcc || !tetAcc) {
            alert('Không tìm thấy ví MB Bank hoặc Tiết kiệm ăn Tết');
            return;
        }
        if (!isHistorical) {
            if (tetAcc.balance < amountVal) {
                alert('Tiết kiệm ăn Tết không đủ để mua vàng');
                return;
            }
            if (mbAcc.balance < amountVal) {
                alert('Số dư MB Bank không đủ để mua vàng');
                return;
            }
        }

        const qtyText = `${normalized.luong} lượng ${normalized.chi} chỉ ${normalized.phan} phân`;
        const nowId = Date.now().toString();
        const purchaseId = (isHistorical ? 'gold-buy-hist-' : 'gold-buy-') + nowId;
        const newTx: Transaction = {
            id: purchaseId,
            date: buyDate.toISOString(),
            description: `Mua vàng đầu tư - ${brand} (${qtyText})`,
            amount: amountVal,
            accountId: AccountType.TET_SAVING,
            splitType: SplitType.ME_ONLY,
            type: TransactionType.EXPENSE,
            isSettled: true
        };

        const newTet = tetAcc.balance - amountVal;
        const newMb = mbAcc.balance - amountVal;

        try {
            const baseGold: GoldState = goldState && typeof goldState.totalPhan === 'number'
                ? {
                    id: goldState.id || 'gold-default',
                    totalPhan: goldState.totalPhan || 0,
                    purchases: Array.isArray(goldState.purchases) ? goldState.purchases : [],
                    withdrawals: Array.isArray(goldState.withdrawals) ? goldState.withdrawals : [],
                    updatedAt: goldState.updatedAt
                }
                : { id: 'gold-default', totalPhan: 0, purchases: [], withdrawals: [] };

            const nextPurchase = {
                id: purchaseId,
                date: buyDate.toISOString(),
                amount: amountVal,
                totalPhan,
                brand,
                isHistorical
            };

            const nextGoldState: GoldState = {
                ...baseGold,
                id: baseGold.id || 'gold-default',
                totalPhan: Math.max(0, (baseGold.totalPhan || 0) + totalPhan),
                purchases: [nextPurchase, ...(baseGold.purchases || [])],
                withdrawals: baseGold.withdrawals || [],
                updatedAt: new Date().toISOString()
            };

            const tasks: Promise<any>[] = [supabaseService.upsertGoldState(nextGoldState)];
            if (!isHistorical) {
                tasks.push(supabaseService.addTransaction(newTx));
                tasks.push(supabaseService.updateAccountBalance(AccountType.TET_SAVING, newTet));
                tasks.push(supabaseService.updateAccountBalance(AccountType.MB, newMb));
            }

            await Promise.all(tasks);

            if (!isHistorical) {
                setTransactions(prev => [newTx, ...prev]);
                setAccounts(prev => prev.map(acc => {
                    if (acc.id === AccountType.TET_SAVING) return { ...acc, balance: newTet };
                    if (acc.id === AccountType.MB) return { ...acc, balance: newMb };
                    return acc;
                }));
            }

            setGoldState(nextGoldState);

            setGoldBuyBrand('');
            setGoldBuyAmount('');
            setGoldBuyLuong('');
            setGoldBuyChi('');
            setGoldBuyPhan('');
            setGoldBuyDate(new Date());
        } catch (e) {
            console.error('Buy gold error', e);
            alert('Lỗi khi mua vàng');
        }
    };

    const handleDeleteGoldPurchase = async (purchaseId: string) => {
        if (!goldState || !(goldState.purchases || []).length) return;
        const purchase = (goldState.purchases || []).find(p => p.id === purchaseId);
        if (!purchase) return;

        if (purchase.isHistorical) {
            if (!window.confirm('Xoá lần mua vàng này?')) return;
            setGoldState(prev => {
                if (!prev) return prev;
                const nextPurchases = (prev.purchases || []).filter(p => p.id !== purchaseId);
                return {
                    ...prev,
                    totalPhan: Math.max(0, (prev.totalPhan || 0) - (purchase.totalPhan || 0)),
                    purchases: nextPurchases,
                    updatedAt: new Date().toISOString()
                };
            });
            return;
        }

        if (!window.confirm('Xoá lần mua vàng này và hoàn tiền về Tiết kiệm ăn Tết?')) return;

        const mbAcc = accounts.find(a => a.id === AccountType.MB);
        const tetAcc = accounts.find(a => a.id === AccountType.TET_SAVING);
        if (!mbAcc || !tetAcc) {
            alert('Không tìm thấy ví MB Bank hoặc Tiết kiệm ăn Tết');
            return;
        }

        const refund = purchase.amount || 0;
        const newTet = tetAcc.balance + refund;
        const newMb = mbAcc.balance + refund;

        try {
            await Promise.all([
                supabaseService.updateAccountBalance(AccountType.TET_SAVING, newTet),
                supabaseService.updateAccountBalance(AccountType.MB, newMb),
                supabaseService.deleteTransaction(purchaseId).catch(() => {})
            ]);

            setAccounts(prev => prev.map(acc => {
                if (acc.id === AccountType.TET_SAVING) return { ...acc, balance: newTet };
                if (acc.id === AccountType.MB) return { ...acc, balance: newMb };
                return acc;
            }));
            setTransactions(prev => prev.filter(t => t.id !== purchaseId));
            setGoldState(prev => {
                if (!prev) return prev;
                const nextPurchases = (prev.purchases || []).filter(p => p.id !== purchaseId);
                return {
                    ...prev,
                    totalPhan: Math.max(0, (prev.totalPhan || 0) - (purchase.totalPhan || 0)),
                    purchases: nextPurchases,
                    updatedAt: new Date().toISOString()
                };
            });
        } catch (e) {
            console.error('Delete gold purchase error', e);
            alert('Lỗi khi xoá lịch sử mua vàng');
        }
    };

    const handleWithdrawGold = async () => {
        const amountVal = parseSmartAmount(goldWithdrawAmount);
        const luongRaw = parseNonNegativeInt(goldWithdrawLuong);
        const chiRaw = parseNonNegativeInt(goldWithdrawChi);
        const phanRaw = parseNonNegativeInt(goldWithdrawPhan);
        const normalized = normalizeGoldUnits(luongRaw, chiRaw, phanRaw);
        const totalPhan = toTotalPhan(normalized.luong, normalized.chi, normalized.phan);
        const withdrawDate = new Date(goldWithdrawDate.getFullYear(), goldWithdrawDate.getMonth(), goldWithdrawDate.getDate());

        if (totalPhan <= 0) {
            alert('Vui lòng nhập số lượng vàng muốn rút');
            return;
        }
        if (amountVal <= 0) {
            alert('Vui lòng nhập số tiền thu về khi rút vàng');
            return;
        }
        if (!goldWithdrawBrand) {
            alert('Vui lòng chọn thương hiệu vàng muốn rút');
            return;
        }

        const brandHolding = brandTotals.find(bt => bt.brand === goldWithdrawBrand)?.totalPhan || 0;
        if (brandHolding < totalPhan) {
            alert(`Số lượng vàng của thương hiệu ${goldWithdrawBrand} không đủ (còn ${fromTotalPhan(brandHolding).luong}L ${fromTotalPhan(brandHolding).chi}C ${fromTotalPhan(brandHolding).phan}P)`);
            return;
        }

        const currentHolding = goldState?.totalPhan || 0;
        if (currentHolding < totalPhan) {
            alert('Số lượng vàng đang giữ không đủ');
            return;
        }

        const mbAcc = accounts.find(a => a.id === AccountType.MB);
        const tetAcc = accounts.find(a => a.id === AccountType.TET_SAVING);
        if (!mbAcc || !tetAcc) {
            alert('Không tìm thấy ví MB Bank hoặc Tiết kiệm ăn Tết');
            return;
        }

        const qtyText = `${normalized.luong} lượng ${normalized.chi} chỉ ${normalized.phan} phân`;
        const newTx: Transaction = {
            id: 'gold-withdraw-' + Date.now().toString(),
            date: withdrawDate.toISOString(),
            description: `Rút vàng (chốt lãi) (${qtyText})`,
            amount: amountVal,
            accountId: AccountType.MB,
            splitType: SplitType.ME_ONLY,
            type: TransactionType.INCOME,
            isSettled: true
        };

        const newMb = mbAcc.balance + amountVal;
        const newTet = tetAcc.balance + amountVal;

        try {
            await Promise.all([
                supabaseService.addTransaction(newTx),
                supabaseService.updateAccountBalance(AccountType.MB, newMb),
                supabaseService.updateAccountBalance(AccountType.TET_SAVING, newTet)
            ]);

            setTransactions(prev => [newTx, ...prev]);
            setAccounts(prev => prev.map(acc => {
                if (acc.id === AccountType.MB) return { ...acc, balance: newMb };
                if (acc.id === AccountType.TET_SAVING) return { ...acc, balance: newTet };
                return acc;
            }));

            setGoldState(prev => {
                const base: GoldState = prev && typeof prev.totalPhan === 'number'
                    ? prev
                    : { id: 'gold-default', totalPhan: 0, purchases: [], withdrawals: [] };
                const nextWithdrawal = {
                    id: newTx.id,
                    date: withdrawDate.toISOString(),
                    amount: amountVal,
                    totalPhan,
                    brand: goldWithdrawBrand
                };
                return {
                    ...base,
                    id: base.id || 'gold-default',
                    totalPhan: Math.max(0, (base.totalPhan || 0) - totalPhan),
                    purchases: base.purchases || [],
                    withdrawals: [nextWithdrawal, ...(base.withdrawals || [])],
                    updatedAt: new Date().toISOString()
                };
            });

            setGoldWithdrawAmount('');
            setGoldWithdrawLuong('');
            setGoldWithdrawChi('');
            setGoldWithdrawPhan('');
            setGoldWithdrawDate(new Date());
            setGoldWithdrawBrand('');
        } catch (e) {
            console.error('Withdraw gold error', e);
            alert('Lỗi khi rút vàng');
        }
    };

    const handleDeleteGoldWithdrawal = async (withdrawId: string) => {
        if (!goldState || !(goldState.withdrawals || []).length) return;
        const withdrawal = (goldState.withdrawals || []).find(w => w.id === withdrawId);
        if (!withdrawal) return;

        if (!window.confirm('Xoá lần rút vàng này và hoàn tác số tiền/số lượng?')) return;

        const mbAcc = accounts.find(a => a.id === AccountType.MB);
        const tetAcc = accounts.find(a => a.id === AccountType.TET_SAVING);
        if (!mbAcc || !tetAcc) {
            alert('Không tìm thấy ví MB Bank hoặc Tiết kiệm ăn Tết');
            return;
        }

        const amountVal = withdrawal.amount || 0;
        const newMb = mbAcc.balance - amountVal;
        const newTet = tetAcc.balance - amountVal;

        try {
            await Promise.all([
                supabaseService.updateAccountBalance(AccountType.MB, newMb),
                supabaseService.updateAccountBalance(AccountType.TET_SAVING, newTet),
                supabaseService.deleteTransaction(withdrawId).catch(() => {})
            ]);

            setAccounts(prev => prev.map(acc => {
                if (acc.id === AccountType.MB) return { ...acc, balance: newMb };
                if (acc.id === AccountType.TET_SAVING) return { ...acc, balance: newTet };
                return acc;
            }));
            setTransactions(prev => prev.filter(t => t.id !== withdrawId));
            setGoldState(prev => {
                if (!prev) return prev;
                const nextWithdrawals = (prev.withdrawals || []).filter(w => w.id !== withdrawId);
                return {
                    ...prev,
                    totalPhan: Math.max(0, (prev.totalPhan || 0) + (withdrawal.totalPhan || 0)),
                    withdrawals: nextWithdrawals,
                    updatedAt: new Date().toISOString()
                };
            });
        } catch (e) {
            console.error('Delete gold withdrawal error', e);
            alert('Lỗi khi xoá lịch sử rút vàng');
        }
    };

    const resetGoldWithdrawals = async () => {
        const withdrawals = goldState?.withdrawals || [];
        if (withdrawals.length === 0) return;
        if (!window.confirm('Xoá toàn bộ lịch sử rút vàng và hoàn tác số tiền/số lượng?')) return;

        const mbAcc = accounts.find(a => a.id === AccountType.MB);
        const tetAcc = accounts.find(a => a.id === AccountType.TET_SAVING);
        if (!mbAcc || !tetAcc) {
            alert('Không tìm thấy ví MB Bank hoặc Tiết kiệm ăn Tết');
            return;
        }

        const totalAmount = withdrawals.reduce((s, w) => s + (w.amount || 0), 0);
        const totalPhan = withdrawals.reduce((s, w) => s + (w.totalPhan || 0), 0);
        const newMb = mbAcc.balance - totalAmount;
        const newTet = tetAcc.balance - totalAmount;

        try {
            await Promise.all([
                supabaseService.updateAccountBalance(AccountType.MB, newMb),
                supabaseService.updateAccountBalance(AccountType.TET_SAVING, newTet),
                ...withdrawals.map(w => supabaseService.deleteTransaction(w.id).catch(() => {}))
            ]);

            setAccounts(prev => prev.map(acc => {
                if (acc.id === AccountType.MB) return { ...acc, balance: newMb };
                if (acc.id === AccountType.TET_SAVING) return { ...acc, balance: newTet };
                return acc;
            }));

            const ids = new Set(withdrawals.map(w => w.id));
            setTransactions(prev => prev.filter(t => !ids.has(t.id)));

            setGoldState(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    totalPhan: Math.max(0, (prev.totalPhan || 0) + totalPhan),
                    withdrawals: [],
                    updatedAt: new Date().toISOString()
                };
            });
        } catch (e) {
            console.error('Reset gold withdrawals error', e);
            alert('Lỗi khi xoá lịch sử rút vàng');
        }
    };

    const goldTotalPhan = goldState?.totalPhan || 0;
    const goldUnits = fromTotalPhan(goldTotalPhan);
    const brandTotalsMap = (goldState?.purchases || []).reduce<Record<string, { amount: number, totalPhan: number }>>((acc, p) => {
        const key = ((p.brand || '').trim() || 'Không rõ');
        if (!acc[key]) acc[key] = { amount: 0, totalPhan: 0 };
        acc[key].amount += (p.amount ?? 0);
        acc[key].totalPhan += (p.totalPhan ?? 0);
        return acc;
    }, {});

    (goldState?.withdrawals || []).forEach(w => {
        const key = ((w.brand || '').trim() || 'Không rõ');
        if (brandTotalsMap[key]) {
            brandTotalsMap[key].totalPhan -= (w.totalPhan ?? 0);
        }
    });

    const brandTotals = Object.keys(brandTotalsMap)
        .map(brand => ({ brand, total: brandTotalsMap[brand].amount, totalPhan: brandTotalsMap[brand].totalPhan }))
        .filter(bt => bt.totalPhan > 0)
        .sort((a, b) => b.total - a.total);

    const uniqueBrands = Array.from(new Set((goldState?.purchases || []).map(p => (p.brand || '').trim()).filter(Boolean)));

    return (
        <div className="pb-32 animate-fade-in pt-4 space-y-6">
            <div className="flex items-center justify-between mb-1 px-1">
                <h2 className="text-2xl font-bold text-slate-800">Vàng đầu tư</h2>
            </div>

            <div className="space-y-4">
                <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h3 className="font-bold text-slate-800">Tổng quan</h3>
                            <p className="text-xs text-slate-500 mt-1">Theo dõi mua/rút riêng biệt</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Đang giữ</p>
                            <p className="text-sm font-bold text-slate-800">{goldUnits.luong} lượng {goldUnits.chi} chỉ {goldUnits.phan} phân</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="bg-amber-50 p-4 rounded-[20px] border border-amber-100">
                            <p className="text-xs font-bold text-amber-700 uppercase mb-1">Tổng đã bỏ ra</p>
                            <p className="text-lg font-bold text-amber-800">
                                {formatCurrency((goldState?.purchases || []).reduce((s, p) => s + (p.amount || 0), 0))}
                            </p>
                        </div>
                        <div className="bg-emerald-50 p-4 rounded-[20px] border border-emerald-100">
                            <p className="text-xs font-bold text-emerald-700 uppercase mb-1">Tổng đã thu về</p>
                            <p className="text-lg font-bold text-emerald-800">
                                {formatCurrency((goldState?.withdrawals || []).reduce((s, w) => s + (w.amount || 0), 0))}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                        <button
                            onClick={() => resetGoldAll()}
                            className="text-xs font-bold px-3 py-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 active:scale-95"
                        >
                            Xoá toàn bộ lịch sử vàng
                        </button>
                    </div>
                </div>

                {brandTotals.length > 0 && (
                    <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-slate-800">Theo thương hiệu</h3>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">
                                Tổng tiền mua
                            </span>
                        </div>
                        <div className="space-y-2">
                            {brandTotals.map(bt => {
                                const units = fromTotalPhan(bt.totalPhan);
                                return (
                                    <div key={bt.brand} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{bt.brand}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">{units.luong} lượng {units.chi} chỉ {units.phan} phân</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-amber-700 whitespace-nowrap">{formatCurrency(bt.total)}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-800 mb-4">Mua vàng</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Thương hiệu</label>
                            <input
                                type="text"
                                list="gold-brands"
                                value={goldBuyBrand}
                                onChange={e => setGoldBuyBrand(e.target.value)}
                                placeholder="VD: SJC, PNJ, DOJI..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                            />
                            <datalist id="gold-brands">
                                {uniqueBrands.map(brand => (
                                    <option key={brand} value={brand} />
                                ))}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Số tiền mua</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={goldBuyAmount}
                                onChange={e => setGoldBuyAmount(formatNumberInput(e.target.value))}
                                placeholder="0"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Lượng</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={goldBuyLuong}
                                    onChange={e => setGoldBuyLuong(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-center"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Chỉ</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={goldBuyChi}
                                    onChange={e => setGoldBuyChi(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-center"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phân</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={goldBuyPhan}
                                    onChange={e => setGoldBuyPhan(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-center"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ngày mua</label>
                            <DatePicker
                                selected={goldBuyDate}
                                onChange={(date: Date | null) => date && setGoldBuyDate(date)}
                                dateFormat="dd/MM/yyyy"
                                locale={vi}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                            />
                        </div>
                        <button
                            onClick={handleBuyGold}
                            className="w-full bg-amber-500 text-white font-bold py-3 rounded-xl active:scale-[0.98] transition-all shadow-sm shadow-amber-500/20 mt-2"
                        >
                            Ghi nhận mua vàng
                        </button>
                    </div>

                    {((goldState?.purchases || []).length > 0) && (
                        <div className="mt-6 border-t border-slate-100 pt-4">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-bold text-slate-800 text-sm">Lịch sử mua</h4>
                                <button
                                    onClick={() => resetGoldPurchases()}
                                    className="text-[10px] font-bold text-rose-500 uppercase"
                                >
                                    Xoá lịch sử mua
                                </button>
                            </div>
                            <div className="space-y-2">
                                {(goldState?.purchases || []).slice(0, 30).map(p => {
                                    const units = fromTotalPhan(p.totalPhan);
                                    return (
                                        <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm">
                                                    {p.brand || 'Không rõ'} <span className="text-slate-400 font-normal text-xs ml-1">({new Date(p.date).toLocaleDateString('vi-VN')})</span>
                                                </p>
                                                <p className="text-xs text-slate-500 mt-0.5">{units.luong} lượng {units.chi} chỉ {units.phan} phân</p>
                                            </div>
                                            <div className="text-right flex items-center gap-3">
                                                <p className="text-sm font-bold text-amber-700">
                                                    -{formatCurrency(p.amount)}
                                                </p>
                                                <button
                                                    onClick={() => handleDeleteGoldPurchase(p.id)}
                                                    className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center hover:bg-rose-100 hover:text-rose-500 transition-colors"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-800 mb-4">Rút vàng (Bán)</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Thương hiệu</label>
                            <select
                                value={goldWithdrawBrand}
                                onChange={e => setGoldWithdrawBrand(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none"
                            >
                                <option value="">Chọn thương hiệu...</option>
                                {brandTotals.map(bt => (
                                    <option key={bt.brand} value={bt.brand}>{bt.brand} (Còn {fromTotalPhan(bt.totalPhan).luong}L {fromTotalPhan(bt.totalPhan).chi}C {fromTotalPhan(bt.totalPhan).phan}P)</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Số tiền thu về</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={goldWithdrawAmount}
                                onChange={e => setGoldWithdrawAmount(formatNumberInput(e.target.value))}
                                placeholder="0"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Lượng</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={goldWithdrawLuong}
                                    onChange={e => setGoldWithdrawLuong(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-center"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Chỉ</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={goldWithdrawChi}
                                    onChange={e => setGoldWithdrawChi(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-center"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phân</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={goldWithdrawPhan}
                                    onChange={e => setGoldWithdrawPhan(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-center"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ngày rút</label>
                            <DatePicker
                                selected={goldWithdrawDate}
                                onChange={(date: Date | null) => date && setGoldWithdrawDate(date)}
                                dateFormat="dd/MM/yyyy"
                                locale={vi}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            />
                        </div>
                        <button
                            onClick={handleWithdrawGold}
                            className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl active:scale-[0.98] transition-all shadow-sm shadow-emerald-500/20 mt-2"
                        >
                            Ghi nhận rút vàng
                        </button>
                    </div>

                    {((goldState?.withdrawals || []).length > 0) && (
                        <div className="mt-6 border-t border-slate-100 pt-4">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-bold text-slate-800 text-sm">Lịch sử rút</h4>
                                <button
                                    onClick={() => resetGoldWithdrawals()}
                                    className="text-[10px] font-bold text-rose-500 uppercase"
                                >
                                    Xoá lịch sử rút
                                </button>
                            </div>
                            <div className="space-y-2">
                                {(goldState?.withdrawals || []).slice(0, 30).map(w => {
                                    const units = fromTotalPhan(w.totalPhan);
                                    return (
                                        <div key={w.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm">
                                                    {w.brand || 'Rút vàng'} <span className="text-slate-400 font-normal text-xs ml-1">({new Date(w.date).toLocaleDateString('vi-VN')})</span>
                                                </p>
                                                <p className="text-xs text-slate-500 mt-0.5">{units.luong} lượng {units.chi} chỉ {units.phan} phân</p>
                                            </div>
                                            <div className="text-right flex items-center gap-3">
                                                <p className="text-sm font-bold text-emerald-600">
                                                    +{formatCurrency(w.amount)}
                                                </p>
                                                <button
                                                    onClick={() => handleDeleteGoldWithdrawal(w.id)}
                                                    className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center hover:bg-rose-100 hover:text-rose-500 transition-colors"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
