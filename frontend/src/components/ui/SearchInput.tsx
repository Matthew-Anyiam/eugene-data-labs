import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';

// Common tickers for autocomplete (no API needed)
const POPULAR_TICKERS: { ticker: string; name: string }[] = [
  { ticker: 'AAPL', name: 'Apple Inc' },
  { ticker: 'MSFT', name: 'Microsoft Corp' },
  { ticker: 'GOOGL', name: 'Alphabet Inc' },
  { ticker: 'AMZN', name: 'Amazon.com Inc' },
  { ticker: 'NVDA', name: 'NVIDIA Corp' },
  { ticker: 'META', name: 'Meta Platforms Inc' },
  { ticker: 'TSLA', name: 'Tesla Inc' },
  { ticker: 'BRK.B', name: 'Berkshire Hathaway' },
  { ticker: 'JPM', name: 'JPMorgan Chase' },
  { ticker: 'V', name: 'Visa Inc' },
  { ticker: 'JNJ', name: 'Johnson & Johnson' },
  { ticker: 'WMT', name: 'Walmart Inc' },
  { ticker: 'UNH', name: 'UnitedHealth Group' },
  { ticker: 'MA', name: 'Mastercard Inc' },
  { ticker: 'PG', name: 'Procter & Gamble' },
  { ticker: 'HD', name: 'Home Depot Inc' },
  { ticker: 'XOM', name: 'Exxon Mobil Corp' },
  { ticker: 'BAC', name: 'Bank of America' },
  { ticker: 'KO', name: 'Coca-Cola Co' },
  { ticker: 'PFE', name: 'Pfizer Inc' },
  { ticker: 'ABBV', name: 'AbbVie Inc' },
  { ticker: 'AVGO', name: 'Broadcom Inc' },
  { ticker: 'COST', name: 'Costco Wholesale' },
  { ticker: 'MRK', name: 'Merck & Co' },
  { ticker: 'PEP', name: 'PepsiCo Inc' },
  { ticker: 'TMO', name: 'Thermo Fisher Scientific' },
  { ticker: 'LLY', name: 'Eli Lilly & Co' },
  { ticker: 'NFLX', name: 'Netflix Inc' },
  { ticker: 'AMD', name: 'Advanced Micro Devices' },
  { ticker: 'CRM', name: 'Salesforce Inc' },
  { ticker: 'DIS', name: 'Walt Disney Co' },
  { ticker: 'INTC', name: 'Intel Corp' },
  { ticker: 'CSCO', name: 'Cisco Systems' },
  { ticker: 'ADBE', name: 'Adobe Inc' },
  { ticker: 'NKE', name: 'Nike Inc' },
  { ticker: 'T', name: 'AT&T Inc' },
  { ticker: 'VZ', name: 'Verizon Communications' },
  { ticker: 'GS', name: 'Goldman Sachs' },
  { ticker: 'MS', name: 'Morgan Stanley' },
  { ticker: 'PYPL', name: 'PayPal Holdings' },
];

interface SearchInputProps {
  large?: boolean;
  className?: string;
}

export function SearchInput({ large, className = '' }: SearchInputProps) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const query = value.trim().toUpperCase();
  const suggestions = query.length > 0
    ? POPULAR_TICKERS.filter(
        (t) => t.ticker.startsWith(query) || t.name.toUpperCase().includes(query)
      ).slice(0, 6)
    : [];

  const showDropdown = open && suggestions.length > 0;

  const go = useCallback((ticker: string) => {
    navigate(`/company/${ticker}`);
    setValue('');
    setOpen(false);
    setHighlightIndex(-1);
    inputRef.current?.blur();
  }, [navigate]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (highlightIndex >= 0 && suggestions[highlightIndex]) {
        go(suggestions[highlightIndex].ticker);
      } else if (query) {
        go(query);
      }
    },
    [query, highlightIndex, suggestions, go]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, -1));
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    },
    [showDropdown, suggestions.length]
  );

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit}>
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 ${large ? 'h-5 w-5' : 'h-4 w-4'}`} />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value); setOpen(true); setHighlightIndex(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search by ticker (e.g. AAPL)"
          autoComplete="off"
          className={cn(
            'w-full border border-slate-200 bg-white pl-10 pr-4 text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-slate-500',
            large ? 'rounded-lg py-3.5 text-lg' : 'rounded-md py-2 text-sm',
            showDropdown ? 'rounded-b-none' : ''
          )}
        />
      </form>

      {showDropdown && (
        <div className="absolute left-0 right-0 z-50 overflow-hidden rounded-b-md border border-t-0 border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {suggestions.map((s, i) => (
            <button
              key={s.ticker}
              onClick={() => go(s.ticker)}
              onMouseEnter={() => setHighlightIndex(i)}
              className={cn(
                'flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm',
                i === highlightIndex
                  ? 'bg-slate-100 dark:bg-slate-700'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
              )}
            >
              <span className="w-14 shrink-0 font-medium tabular-nums">{s.ticker}</span>
              <span className="truncate text-slate-500 dark:text-slate-400">{s.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
