import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
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

  const currentMonthLabel = new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-black/[0.05] relative overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Phân tích tài chính</p>
          <h3 className="text-base font-semibold text-[#1d1d1f] capitalize">{currentMonthLabel}</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-[#86868b] bg-[#f5f5f7] px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3]"></span>
          <span>Chi tiêu theo ngày</span>
        </div>
      </div>

      {/* Apple Summary Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-[#f5f5f7] rounded-2xl p-3.5 border border-black/[0.03]">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34c759]"></span>
            <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Thu nhập</p>
          </div>
          <p className="text-base font-semibold text-[#1d1d1f] tracking-tight truncate">{formatCurrency(totalIncome)}</p>
        </div>
        
        <div className="bg-[#f5f5f7] rounded-2xl p-3.5 border border-black/[0.03]">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff3b30]"></span>
            <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Chi tiêu</p>
          </div>
          <p className="text-base font-semibold text-[#1d1d1f] tracking-tight truncate">{formatCurrency(totalExpense)}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-36 w-full -ml-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="appleIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34c759" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#34c759" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="appleExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1d1d1f" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#1d1d1f" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="day" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#86868b' }} 
              interval={4}
            />
            <YAxis hide domain={[0, 'auto']} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(29, 29, 31, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: '14px', 
                border: 'none', 
                color: '#fff',
                fontSize: '12px',
                padding: '8px 12px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)'
              }}
              itemStyle={{ color: '#fff', padding: '2px 0' }}
              formatter={(value: number) => [formatCurrency(value), '']}
              labelFormatter={(label) => `Ngày ${label}`}
            />
            <Area 
              type="monotone" 
              dataKey="income" 
              stroke="#34c759" 
              strokeWidth={1.5}
              fillOpacity={1} 
              fill="url(#appleIncomeGrad)" 
              name="Thu"
            />
            <Area 
              type="monotone" 
              dataKey="expense" 
              stroke="#1d1d1f" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#appleExpenseGrad)" 
              name="Chi"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
