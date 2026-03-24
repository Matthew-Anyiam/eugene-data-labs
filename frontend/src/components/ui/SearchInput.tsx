import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

interface SearchInputProps {
  large?: boolean;
  className?: string;
}

export function SearchInput({ large, className = '' }: SearchInputProps) {
  const [value, setValue] = useState('');
  const navigate = useNavigate();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const ticker = value.trim().toUpperCase();
      if (ticker) {
        navigate(`/company/${ticker}`);
        setValue('');
      }
    },
    [value, navigate]
  );

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <Search className={`absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 ${large ? 'h-5 w-5' : 'h-4 w-4'}`} />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search by ticker (e.g. AAPL)"
        className={`w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 ${large ? 'py-4 text-lg' : 'py-2.5 text-sm'}`}
      />
    </form>
  );
}
