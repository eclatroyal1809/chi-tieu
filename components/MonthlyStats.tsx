import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Transaction, TransactionType } from '../types';

interface MonthlyStatsProps {
  transactions: Transaction[];
}

export const MonthlyStats: React.FC<MonthlyStatsProps> = ({ transactions }) => {
  const { totalIncome, totalExpense, chartData } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const dataMap = new Map<number, { day: number; income: number; expense: number }>();

    // Initialize all days with 0
    for (let i = 1; i <= daysInMonth; i++) {
      dataMap.set(i, { day: i, income: 0, expense: 0 });
    }

    let income = 0;
    let expense = 0;

    transactions.forEach(t => {
      const date = new Date(t.date);
      if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
        // Exclude internal movements (Transfer, Settlement)
        if (t.type === TransactionType.TRANSFER || t.type === TransactionType.SETTLEMENT) return;

        const day = date.getDate();
        const entry = dataMap.get(day);

        if (entry) {
          if (t.type === TransactionType.INCOME) {
            entry.income += t.amount;
            income += t.amount;
          } else if (t.type === TransactionType.EXPENSE) {
            entry.expense += t.amount;
            expense += t.amount;
          }
        }
      }
    });

    const chartData = Array.from(dataMap.values()).sort((a, b) => a.day - b.day);

    return { totalIncome: income, totalExpense: expense, chartData };
  }, [transactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const formatShortCurrency = (amount: number) => {
    if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'tr';
    if (amount >= 1000) return (amount / 1000).toFixed(0) + 'k';
    return amount.toString();
  };

  return (
    <div className="bg-white rounded-[32px] p-6 shadow-lg shadow-slate-200/50 border border-slate-100 mb-6 relative overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-slate-800 text-lg">Tháng này</h3>
        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
          {new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 relative overflow-hidden">
          <div className="absolute -right-2 -top-2 w-16 h-16 bg-emerald-100 rounded-full opacity-50 blur-xl"></div>
          <p className="text-xs font-bold text-emerald-600 mb-1 uppercase tracking-wider">Thu nhập</p>
          <p className="text-xl font-bold text-emerald-700">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100 relative overflow-hidden">
          <div className="absolute -right-2 -top-2 w-16 h-16 bg-rose-100 rounded-full opacity-50 blur-xl"></div>
          <p className="text-xs font-bold text-rose-600 mb-1 uppercase tracking-wider">Chi tiêu</p>
          <p className="text-xl font-bold text-rose-700">{formatCurrency(totalExpense)}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-48 w-full -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis 
              dataKey="day" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#94A3B8' }} 
              interval={4}
            />
            <YAxis 
              hide 
              domain={[0, 'auto']}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              formatter={(value: number) => [formatCurrency(value), '']}
              labelFormatter={(label) => `Ngày ${label}`}
            />
            <Area 
              type="monotone" 
              dataKey="income" 
              stroke="#10B981" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorIncome)" 
              name="Thu"
            />
            <Area 
              type="monotone" 
              dataKey="expense" 
              stroke="#F43F5E" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorExpense)" 
              name="Chi"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
