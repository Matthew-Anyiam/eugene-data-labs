import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; label: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['g', 'd'], label: 'Go to Dashboard' },
      { keys: ['g', 's'], label: 'Go to Screener' },
      { keys: ['g', 'w'], label: 'Go to World' },
      { keys: ['g', 'e'], label: 'Go to Economics' },
      { keys: ['g', 'n'], label: 'Go to News' },
      { keys: ['g', 'o'], label: 'Go to Ontology' },
      { keys: ['g', 'p'], label: 'Go to Predictions' },
      { keys: ['g', 'c'], label: 'Go to Crypto' },
      { keys: ['g', 'a'], label: 'Go to AI Agents' },
      { keys: ['g', '.'], label: 'Go to Settings' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['\u2318', 'K'], label: 'Open command palette' },
      { keys: ['/'], label: 'Focus search' },
      { keys: ['?'], label: 'Show this help' },
      { keys: ['\u2318', '.'], label: 'Toggle activity panel' },
    ],
  },
  {
    title: 'More Navigation',
    shortcuts: [
      { keys: ['g', 'f'], label: 'Go to Portfolio' },
      { keys: ['g', 'h'], label: 'Go to Heatmap' },
      { keys: ['g', 't'], label: 'Go to Technical' },
      { keys: ['g', 'b'], label: 'Go to Backtest' },
      { keys: ['g', 'm'], label: 'Go to Movers' },
      { keys: ['g', 'r'], label: 'Go to Reports' },
      { keys: ['g', 'i'], label: 'Go to Insiders' },
      { keys: ['g', 'y'], label: 'Go to Options' },
      { keys: ['g', 'z'], label: 'Go to Risk' },
    ],
  },
];

export function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-[15%] z-50 w-full max-w-2xl -translate-x-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.label}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {shortcut.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={i}>
                          <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-slate-200 bg-slate-50 px-1.5 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                            {key}
                          </kbd>
                          {i < shortcut.keys.length - 1 && (
                            <span className="mx-0.5 text-[10px] text-slate-300 dark:text-slate-600">
                              +
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 px-5 py-2.5 dark:border-slate-700">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Press <kbd className="rounded border border-slate-200 bg-slate-50 px-1 text-[10px] dark:border-slate-700 dark:bg-slate-800">Esc</kbd> to close.
            Two-key shortcuts: press the first key, then the second within 1 second.
          </p>
        </div>
      </div>
    </>
  );
}
