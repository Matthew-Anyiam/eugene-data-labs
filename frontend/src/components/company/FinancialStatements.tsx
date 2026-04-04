import { useState, useCallback } from 'react';
import { Download } from 'lucide-react';
import { Tabs } from '../ui/Tabs';
import { FinancialBarChart } from '../charts/FinancialBarChart';
import { DataTable } from '../ui/DataTable';
import type { FinancialPeriod, MetricValue } from '../../lib/types';
import { formatCurrency, metricLabel } from '../../lib/utils';
import { downloadCSV } from '../../lib/export';

interface FinancialStatementsProps {
  periods: FinancialPeriod[];
}

const TABS = ['Income Statement', 'Balance Sheet', 'Cash Flow'];
const TAB_KEY_MAP: Record<string, 'income_statement' | 'balance_sheet' | 'cash_flow_statement'> = {
  'Income Statement': 'income_statement',
  'Balance Sheet': 'balance_sheet',
  'Cash Flow': 'cash_flow_statement',
};

export function FinancialStatements({ periods }: FinancialStatementsProps) {
  const [tab, setTab] = useState(TABS[0]);
  const stmtKey = TAB_KEY_MAP[tab];

  const allKeys = new Set<string>();
  periods.forEach((p) => {
    const stmt = p[stmtKey] as Record<string, MetricValue> | undefined;
    if (stmt) Object.keys(stmt).forEach((k) => allKeys.add(k));
  });

  const tableData = Array.from(allKeys).map((key) => {
    const row: Record<string, unknown> = { metric: metricLabel(key) };
    periods.forEach((p, i) => {
      const stmt = p[stmtKey] as Record<string, MetricValue> | undefined;
      row[`p${i}`] = stmt?.[key]?.value ?? null;
    });
    return row;
  });

  const columns = [
    { key: 'metric', label: 'Metric', sortable: false },
    ...periods.map((p, i) => ({
      key: `p${i}`,
      label: p.fiscal_year ? `FY${p.fiscal_year}` : p.period_end.slice(0, 7),
      align: 'right' as const,
      render: (row: Record<string, unknown>) => {
        const v = row[`p${i}`] as number | null;
        return v !== null ? formatCurrency(v) : '—';
      },
    })),
  ];

  const exportCSV = useCallback(() => {
    const exportColumns = [
      { key: 'metric', label: 'Metric' },
      ...periods.map((p, i) => ({
        key: `p${i}`,
        label: p.fiscal_year ? `FY${p.fiscal_year}` : p.period_end.slice(0, 7),
      })),
    ];
    downloadCSV(
      tableData as Record<string, string | number | boolean | null | undefined>[],
      `eugene-${stmtKey.replace(/_/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`,
      exportColumns,
    );
  }, [tableData, periods, stmtKey]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
        <button
          onClick={exportCSV}
          className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          <Download className="h-3 w-3" />
          Export CSV
        </button>
      </div>
      <FinancialBarChart periods={periods} statement={stmtKey} />
      <DataTable columns={columns} data={tableData} />
    </div>
  );
}
