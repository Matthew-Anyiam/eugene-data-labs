import { useState, useEffect, useCallback } from 'react';
import { Zap, Search, BarChart3, Brain, Keyboard, FileText, Globe, Briefcase, ChevronRight, ChevronLeft, X } from 'lucide-react';

const STORAGE_KEY = 'eugene_onboarded';

interface OnboardingProps {
  onComplete: () => void;
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === current
              ? 'w-6 bg-indigo-500'
              : i < current
                ? 'w-1.5 bg-indigo-400/50'
                : 'w-1.5 bg-slate-600'
          }`}
        />
      ))}
    </div>
  );
}

function PillarCard({ icon: Icon, label, description }: { icon: typeof Zap; label: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/50 px-4 py-3 text-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/20">
        <Icon className="h-4.5 w-4.5 text-indigo-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-200">{label}</p>
        <p className="mt-0.5 text-xs text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, label }: { icon: typeof Zap; label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2.5">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500/20">
        <Icon className="h-3.5 w-3.5 text-indigo-400" />
      </div>
      <span className="text-sm text-slate-300">{label}</span>
    </div>
  );
}

const STEPS = [
  {
    key: 'welcome',
    title: 'Welcome to Eugene Intelligence',
    content: (
      <div className="flex flex-col items-center gap-6">
        <p className="max-w-sm text-center text-sm leading-relaxed text-slate-400">
          Your financial knowledge workspace — research, analyze, and build conviction.
        </p>
        <div className="grid w-full grid-cols-3 gap-3">
          <PillarCard icon={Brain} label="Intelligence" description="AI-powered research" />
          <PillarCard icon={BarChart3} label="Markets" description="Real-time data" />
          <PillarCard icon={Briefcase} label="Workspace" description="Your tools, unified" />
        </div>
      </div>
    ),
  },
  {
    key: 'quickstart',
    title: 'Start with a Ticker',
    content: (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/50 px-4 py-3">
          <Search className="h-4 w-4 text-indigo-400" />
          <div className="flex-1">
            <p className="text-sm text-slate-200">Command Palette</p>
            <p className="mt-0.5 text-xs text-slate-400">Press <kbd className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">&#8984;K</kbd> to search any ticker, page, or command</p>
          </div>
        </div>
        <div className="space-y-2.5 text-sm text-slate-400">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-medium text-indigo-400">1</span>
            <p>Search for any company — type a ticker or name</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-medium text-indigo-400">2</span>
            <p>Build your watchlist from the sidebar</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-medium text-indigo-400">3</span>
            <p>Explore Intelligence, Markets, and Tools sections in the sidebar</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    key: 'features',
    title: 'Key Features',
    content: (
      <div className="flex flex-col gap-4">
        <p className="text-center text-sm text-slate-400">
          Everything you need for financial research, in one place.
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <FeatureCard icon={FileText} label="78 intelligence pages" />
          <FeatureCard icon={Brain} label="AI research agents" />
          <FeatureCard icon={Globe} label="Real-time SEC EDGAR" />
          <FeatureCard icon={Keyboard} label="Keyboard shortcuts (?)" />
        </div>
      </div>
    ),
  },
  {
    key: 'ready',
    title: "You're All Set",
    content: (
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/20">
          <Zap className="h-7 w-7 text-indigo-400" />
        </div>
        <p className="max-w-xs text-center text-sm leading-relaxed text-slate-400">
          Start exploring — search for a ticker, browse the dashboard, or dive into any intelligence page.
        </p>
      </div>
    ),
  },
] as const;

function OnboardingModal({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [animating, setAnimating] = useState(false);

  const totalSteps = STEPS.length;
  const isLast = step === totalSteps - 1;

  const finish = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch { /* noop */ }
    onComplete();
  }, [onComplete]);

  const goNext = useCallback(() => {
    if (isLast) {
      finish();
      return;
    }
    setDirection('forward');
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => s + 1);
      setAnimating(false);
    }, 150);
  }, [isLast, finish]);

  const goBack = useCallback(() => {
    if (step === 0) return;
    setDirection('back');
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => s - 1);
      setAnimating(false);
    }, 150);
  }, [step]);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight' || e.key === 'Enter') goNext();
      if (e.key === 'ArrowLeft') goBack();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [finish, goNext, goBack]);

  const slideClass = animating
    ? direction === 'forward'
      ? 'opacity-0 translate-x-4'
      : 'opacity-0 -translate-x-4'
    : 'opacity-100 translate-x-0';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={finish} />

      {/* Modal */}
      <div className="relative z-10 mx-4 w-full max-w-md rounded-xl border border-slate-700/50 bg-slate-900 shadow-2xl">
        {/* Skip button */}
        <button
          onClick={finish}
          className="absolute right-3 top-3 rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
          title="Skip onboarding"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="px-6 pb-5 pt-8">
          <div className={`transition-all duration-150 ${slideClass}`}>
            <h2 className="mb-4 text-center text-lg font-semibold text-white">
              {STEPS[step].title}
            </h2>
            {STEPS[step].content}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4">
          <StepDots current={step} total={totalSteps} />

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={goBack}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
              >
                <ChevronLeft className="h-3 w-3" />
                Back
              </button>
            )}
            <button
              onClick={goNext}
              className="flex items-center gap-1 rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
            >
              {isLast ? 'Go to Dashboard' : 'Next'}
              {!isLast && <ChevronRight className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== 'true') {
        setShow(true);
      }
    } catch { /* noop */ }
  }, []);

  if (!show) return null;

  return (
    <OnboardingModal
      onComplete={() => {
        setShow(false);
        onComplete();
      }}
    />
  );
}
