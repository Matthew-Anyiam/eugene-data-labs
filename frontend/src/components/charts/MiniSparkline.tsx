import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface MiniSparklineProps {
  data: { value: number }[];
  color?: string;
  height?: number;
}

export function MiniSparkline({ data, color = '#3b82f6', height = 32 }: MiniSparklineProps) {
  if (data.length < 2) return null;

  return (
    <div style={{ width: 80, height }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
