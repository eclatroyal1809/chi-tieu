
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

export const updateTransaction = async (tx: Transaction) => {
    const { error } = await supabase.from('transactions')
        .update({
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            account_id: tx.accountId,
            to_account_id: tx.toAccountId,
            split_type: tx.splitType,
            type: tx.type,
            is_settled: tx.isSettled,
            settlement_id: tx.settlementId
        })
        .eq('id', tx.id);
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

// --- SHOP PRODUCTS ---
export const getShopProducts = async (): Promise<any[]> => {
    const { data, error } = await supabase.from('shop_products').select('*').order('import_date', { ascending: false });
    if (error) throw error;
    return data.map(p => ({
        id: p.id,
        shopId: p.shop_id,
        name: p.name,
        originalPrice: Number(p.original_price),
        sellingPrice: Number(p.selling_price),
        stock: Number(p.stock),
        importDate: p.import_date
    }));
};

export const addShopProduct = async (product: any) => {
    const { error } = await supabase.from('shop_products').insert({
        id: product.id,
        shop_id: product.shopId,
        name: product.name,
        original_price: product.originalPrice,
        selling_price: product.sellingPrice,
        stock: product.stock,
        import_date: product.importDate
    });
    if (error) throw error;
};

export const updateShopProductStock = async (productId: string, newStock: number) => {
    const { error } = await supabase.from('shop_products')
        .update({ stock: newStock })
        .eq('id', productId);
    if (error) throw error;
};

export const deleteShopProduct = async (productId: string) => {
    const { error } = await supabase.from('shop_products')
        .delete()
        .eq('id', productId);
    if (error) throw error;
};

// --- SHOP ORDERS ---
export const getShopOrders = async (): Promise<any[]> => {
    const { data, error } = await supabase.from('shop_orders').select('*').order('date', { ascending: false });
    if (error) throw error;
    return data.map(o => ({
        id: o.id,
        shopId: o.shop_id,
        channel: o.channel,
        name: o.name,
        phone: o.phone,
        address: o.address,
        productId: o.product_id,
        qty: Number(o.qty),
        deposit: Number(o.deposit),
        shipping: Number(o.shipping),
        voucher: Number(o.voucher),
        paymentFee: Number(o.payment_fee),
        status: o.status,
        paymentMethod: o.payment_method,
        totalAmount: Number(o.total_amount),
        netRevenue: Number(o.net_revenue),
        date: o.date
    }));
};

export const addShopOrder = async (order: any) => {
    const { error } = await supabase.from('shop_orders').insert({
        id: order.id,
        shop_id: order.shopId,
        channel: order.channel,
        name: order.name,
        phone: order.phone,
        address: order.address,
        product_id: order.productId,
        qty: Number(order.qty) || 0,
        deposit: Number(order.deposit) || 0,
        shipping: Number(order.shipping) || 0,
        voucher: Number(order.voucher) || 0,
        payment_fee: Number(order.paymentFee) || 0,
        status: order.status,
        payment_method: order.paymentMethod,
        total_amount: order.totalAmount,
        net_revenue: order.netRevenue,
        date: order.date
    });
    if (error) throw error;
};

export const updateShopOrder = async (orderId: string, updates: any) => {
    const dbUpdates: any = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.paymentMethod !== undefined) dbUpdates.payment_method = updates.paymentMethod;
    
    const { error } = await supabase.from('shop_orders')
        .update(dbUpdates)
        .eq('id', orderId);
    if (error) throw error;
};

export const deleteShopOrder = async (orderId: string) => {
    const { error } = await supabase.from('shop_orders').delete().eq('id', orderId);
    if (error) throw error;
};

// --- SHOP FINANCES ---
export const getShopFinances = async (): Promise<any[]> => {
    const { data, error } = await supabase.from('shop_finances').select('*').order('date', { ascending: false });
    if (error) throw error;
    return data.map(f => ({
        id: f.id,
        shopId: f.shop_id,
        type: f.type,
        amount: Number(f.amount),
        description: f.description,
        category: f.category,
        date: f.date
    }));
};

export const addShopFinance = async (finance: any) => {
    const { error } = await supabase.from('shop_finances').insert({
        id: finance.id,
        shop_id: finance.shopId,
        type: finance.type,
        amount: finance.amount,
        description: finance.description,
        category: finance.category,
        date: finance.date
    });
    if (error) throw error;
};

export const deleteShopFinance = async (id: string) => {
    const { error } = await supabase.from('shop_finances').delete().eq('id', id);
    if (error) throw error;
};
