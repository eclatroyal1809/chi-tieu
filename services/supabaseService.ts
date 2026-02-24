
import { supabase } from '../supabaseClient';
import { Account, Transaction } from '../types';

// --- MAPPING HELPERS ---
// Chuyển đổi dữ liệu từ DB (snake_case) sang Frontend (camelCase)
const mapAccountFromDB = (data: any): Account => ({
    id: data.id,
    name: data.name,
    balance: Number(data.balance),
    color: data.color,
    icon: data.icon
});

const mapTransactionFromDB = (data: any): Transaction => ({
    id: data.id,
    date: data.date,
    description: data.description,
    amount: Number(data.amount),
    accountId: data.account_id,
    toAccountId: data.to_account_id,
    splitType: data.split_type,
    type: data.type,
    isSettled: data.is_settled,
    settlementId: data.settlement_id
});

// --- ACCOUNTS ---
export const getAccounts = async (): Promise<Account[]> => {
    const { data, error } = await supabase.from('accounts').select('*').order('id');
    if (error) throw error;
    return data.map(mapAccountFromDB);
};

export const upsertAccount = async (account: Account) => {
    const { error } = await supabase.from('accounts').upsert({
        id: account.id,
        name: account.name,
        balance: account.balance,
        color: account.color,
        icon: account.icon
    });
    if (error) throw error;
};

export const updateAccountBalance = async (accountId: string, newBalance: number) => {
    const { error } = await supabase.from('accounts')
        .update({ balance: newBalance })
        .eq('id', accountId);
    if (error) throw error;
};

// Hàm tiện ích để seed dữ liệu ban đầu nếu bảng rỗng
export const seedAccountsIfEmpty = async (initialAccounts: Account[]) => {
    const { count } = await supabase.from('accounts').select('*', { count: 'exact', head: true });
    if (count === 0) {
        const dbData = initialAccounts.map(acc => ({
            id: acc.id,
            name: acc.name,
            balance: acc.balance,
            color: acc.color,
            icon: acc.icon
        }));
        const { error } = await supabase.from('accounts').insert(dbData);
        if (error) console.error("Error seeding accounts:", error);
        return true; // Seeded
    }
    return false; // Already exists
};

export const ensureTetSavingExists = async (initialAccounts: Account[]) => {
    const { data } = await supabase.from('accounts').select('id').eq('id', 'TET_SAVING');
    if (!data || data.length === 0) {
        const tetSaving = initialAccounts.find(a => a.id === 'TET_SAVING');
        if (tetSaving) {
            // Initialize with 295,000 as requested by user
            const dbData = {
                id: tetSaving.id,
                name: tetSaving.name,
                balance: 295000,
                color: tetSaving.color,
                icon: tetSaving.icon
            };
            await supabase.from('accounts').insert([dbData]);
        }
    }
};

// --- TRANSACTIONS ---
export const getTransactions = async (): Promise<Transaction[]> => {
    const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false });
    if (error) throw error;
    return data.map(mapTransactionFromDB);
};

export const addTransaction = async (tx: Transaction) => {
    const { error } = await supabase.from('transactions').insert({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        account_id: tx.accountId,
        to_account_id: tx.toAccountId,
        split_type: tx.splitType,
        type: tx.type,
        is_settled: tx.isSettled,
        settlement_id: tx.settlementId
    });
    if (error) throw error;
};

export const deleteTransaction = async (id: string) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
};

// Hàm xử lý settlement (cập nhật nhiều giao dịch cùng lúc)
export const updateTransactionsAsSettled = async (txIds: string[], settlementId: string) => {
    const { error } = await supabase.from('transactions')
        .update({ is_settled: true, settlement_id: settlementId })
        .in('id', txIds);
    if (error) throw error;
};

// Hàm xử lý un-settle (khi xoá settlement)
export const updateTransactionsAsUnsettled = async (settlementId: string) => {
    const { error } = await supabase.from('transactions')
        .update({ is_settled: false, settlement_id: null })
        .eq('settlement_id', settlementId);
    if (error) throw error;
};
