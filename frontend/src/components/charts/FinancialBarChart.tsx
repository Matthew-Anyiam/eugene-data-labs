import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import type { FinancialPeriod } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';

interface FinancialBarChartProps {
  periods: FinancialPeriod[];
  statement: 'income_statement' | 'balance_sheet' | 'cash_flow_statement';
}

const STATEMENT_KEYS: Record<string, { keys: string[]; colors: string[] }> = {
  income_statement: {
    keys: ['revenue', 'net_income', 'operating_income'],
    colors: ['#3b82f6', '#10b981', '#f59e0b'],
  },
  balance_sheet: {
    keys: ['total_assets', 'total_liabilities', 'stockholders_equity'],
    colors: ['#3b82f6', '#ef4444', '#10b981'],
  },
  cash_flow_statement: {
    keys: ['operating_cash_flow', 'capital_expenditure', 'free_cash_flow'],
    colors: ['#3b82f6', '#ef4444', '#10b981'],
  },
};

function label(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

export function FinancialBarChart({ periods, statement }: FinancialBarChartProps) {
  const config = STATEMENT_KEYS[statement] || STATEMENT_KEYS.income_statement;

  const data = [...periods].reverse().map((p) => {
    const row: Record<string, string | number> = {
      year: p.fiscal_year ? `FY${p.fiscal_year}` : p.period_end.slice(0, 4),
    };
    const stmt = p[statement] as Record<string, { value: number }> | undefined;
    if (stmt) {
      config.keys.forEach((key) => {
        row[key] = stmt[key]?.value ?? 0;
      });
    }
    return row;
  });

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
          <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(v)} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              border: 'none',
              borderRadius: '8px',
              color: '#f1f5f9',
              fontSize: '13px',
            }}
            formatter={(value, name) => [formatCurrency(Number(value)), label(String(name))]}
          />
          <Legend formatter={(value) => label(value)} />
          {config.keys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={config.colors[i]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
