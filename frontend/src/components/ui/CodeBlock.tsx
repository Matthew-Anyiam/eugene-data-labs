import { useState, useCallback } from 'react';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  children: string;
  language?: string;
}

export function CodeBlock({ children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-4 pr-12 text-[13px] leading-relaxed dark:border-slate-800 dark:bg-slate-900">
        <code>{children}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute right-2 top-2 rounded-md border border-slate-200 bg-white p-1.5 text-slate-400 opacity-0 transition-opacity hover:text-slate-600 group-hover:opacity-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:text-slate-300"
        title="Copy"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export function InlineCode({ children }: { children: string }) {
  return (
    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px] dark:bg-slate-800">
      {children}
    </code>
  );
}
