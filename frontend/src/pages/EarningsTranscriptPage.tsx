import { useState, useMemo } from 'react';
import { FileText, Search, ThumbsUp, ThumbsDown, Minus, MessageSquare, Quote } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM'];

interface TranscriptSection {
  speaker: string;
  role: string;
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  isQA: boolean;
}

interface KeyTopic {
  topic: string;
  mentions: number;
  sentiment: number;
}

interface TranscriptData {
  ticker: string;
  quarter: string;
  date: string;
  duration: string;
  overallSentiment: number;
  positiveRatio: number;
  sections: TranscriptSection[];
  keyTopics: KeyTopic[];
  wordCount: number;
  qaCount: number;
}

const EXEC_NAMES: Record<string, { ceo: string; cfo: string }> = {
  AAPL: { ceo: 'Tim Cook', cfo: 'Luca Maestri' },
  MSFT: { ceo: 'Satya Nadella', cfo: 'Amy Hood' },
  GOOGL: { ceo: 'Sundar Pichai', cfo: 'Ruth Porat' },
  AMZN: { ceo: 'Andy Jassy', cfo: 'Brian Olsavsky' },
  NVDA: { ceo: 'Jensen Huang', cfo: 'Colette Kress' },
  META: { ceo: 'Mark Zuckerberg', cfo: 'Susan Li' },
  TSLA: { ceo: 'Elon Musk', cfo: 'Vaibhav Taneja' },
  JPM: { ceo: 'Jamie Dimon', cfo: 'Jeremy Barnum' },
};

const PREPARED_REMARKS = [
  'We delivered strong results this quarter driven by robust demand across our product portfolio.',
  'Revenue exceeded expectations primarily due to growth in our cloud and services segments.',
  'Our focus on operational efficiency drove margin expansion despite macroeconomic headwinds.',
  'We saw accelerating adoption of our AI capabilities, which contributed meaningfully to growth.',
  'Customer engagement metrics reached all-time highs across key product categories.',
  'We continued to invest in R&D to maintain our competitive position and drive long-term value.',
  'International markets showed particularly strong momentum, with double-digit growth in several regions.',
  'Our subscription revenue grew significantly, reflecting the ongoing shift in our business model.',
];

const QA_QUESTIONS = [
  'Can you provide more color on the margin trajectory going forward?',
  'How should we think about the competitive landscape and market share trends?',
  'What are you seeing in terms of enterprise demand for AI products?',
  'Can you elaborate on the capital allocation priorities for the next fiscal year?',
  'How is the macro environment impacting consumer spending patterns?',
  'What gives you confidence in the revenue guidance for next quarter?',
];

const QA_ANSWERS = [
  'We expect margins to continue improving as we scale our higher-margin product lines and realize operating leverage.',
  'We believe our differentiated approach and continued investment position us well to capture market share.',
  'Enterprise AI demand has been exceptionally strong, and our pipeline is the largest we have ever seen.',
  'We remain committed to returning capital to shareholders while investing for long-term growth.',
  'We are seeing resilient demand across most segments, though we remain cautious about the macro outlook.',
  'Our confidence is based on the strong backlog, healthy pipeline, and improving win rates we are seeing.',
];

const TOPICS = ['AI/ML', 'Cloud', 'Margins', 'Revenue Growth', 'Guidance', 'Competition', 'Macro', 'Capital Allocation', 'Product Innovation', 'International'];

function genTranscript(ticker: string): TranscriptData {
  const s = seed(ticker + '_transcript');
  const execs = EXEC_NAMES[ticker] || { ceo: 'CEO', cfo: 'CFO' };

  const sections: TranscriptSection[] = [];

  // Prepared remarks
  const numRemarks = 4 + Math.floor(pseudo(s, 0) * 4);
  for (let i = 0; i < numRemarks; i++) {
    const isCeo = pseudo(s, 10 + i) > 0.4;
    const remarkIdx = Math.floor(pseudo(s, 20 + i) * PREPARED_REMARKS.length);
    const sentVal = pseudo(s, 30 + i);
    sections.push({
      speaker: isCeo ? execs.ceo : execs.cfo,
      role: isCeo ? 'CEO' : 'CFO',
      text: PREPARED_REMARKS[remarkIdx],
      sentiment: sentVal > 0.6 ? 'positive' : sentVal < 0.25 ? 'negative' : 'neutral',
      isQA: false,
    });
  }

  // Q&A
  const numQA = 3 + Math.floor(pseudo(s, 5) * 4);
  const analysts = ['Morgan Stanley', 'Goldman Sachs', 'JP Morgan', 'Bank of America', 'Citi', 'Barclays', 'Deutsche Bank'];
  for (let i = 0; i < numQA; i++) {
    const qIdx = Math.floor(pseudo(s, 40 + i) * QA_QUESTIONS.length);
    const aIdx = Math.floor(pseudo(s, 50 + i) * QA_ANSWERS.length);
    const analystIdx = Math.floor(pseudo(s, 60 + i) * analysts.length);
    const sentVal = pseudo(s, 70 + i);

    sections.push({
      speaker: `Analyst (${analysts[analystIdx]})`,
      role: 'Analyst',
      text: QA_QUESTIONS[qIdx],
      sentiment: 'neutral',
      isQA: true,
    });
    sections.push({
      speaker: pseudo(s, 80 + i) > 0.5 ? execs.ceo : execs.cfo,
      role: pseudo(s, 80 + i) > 0.5 ? 'CEO' : 'CFO',
      text: QA_ANSWERS[aIdx],
      sentiment: sentVal > 0.5 ? 'positive' : sentVal < 0.2 ? 'negative' : 'neutral',
      isQA: true,
    });
  }

  const keyTopics: KeyTopic[] = TOPICS.slice(0, 6 + Math.floor(pseudo(s, 90) * 4)).map((topic, i) => ({
    topic,
    mentions: Math.floor(2 + pseudo(s, 100 + i) * 15),
    sentiment: +((pseudo(s, 110 + i) * 2 - 1)).toFixed(2),
  })).sort((a, b) => b.mentions - a.mentions);

  const overallSentiment = sections.filter(s => s.sentiment === 'positive').length / sections.length;

  return {
    ticker,
    quarter: 'Q4 2025',
    date: 'Jan 30, 2026',
    duration: `${55 + Math.floor(pseudo(s, 95) * 30)}min`,
    overallSentiment: +overallSentiment.toFixed(2),
    positiveRatio: +(sections.filter(s => s.sentiment === 'positive').length / sections.length * 100).toFixed(0),
    sections,
    keyTopics,
    wordCount: 4000 + Math.floor(pseudo(s, 96) * 8000),
    qaCount: numQA,
  };
}

export function EarningsTranscriptPage() {
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [tickerInput, setTickerInput] = useState('');
  const [filter, setFilter] = useState<'all' | 'prepared' | 'qa'>('all');
  const [sentimentFilter, setSentimentFilter] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all');

  const data = useMemo(() => genTranscript(selectedTicker), [selectedTicker]);
  const selectTicker = (t: string) => { setSelectedTicker(t.toUpperCase()); setTickerInput(''); };

  const filteredSections = data.sections
    .filter(s => filter === 'all' || (filter === 'prepared' && !s.isQA) || (filter === 'qa' && s.isQA))
    .filter(s => sentimentFilter === 'all' || s.sentiment === sentimentFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Earnings Transcripts</h1>
          <p className="text-sm text-slate-400">Earnings call analysis with sentiment and key topics</p>
        </div>
      </div>

      {/* Ticker selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input value={tickerInput} onChange={e => setTickerInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter' && tickerInput) selectTicker(tickerInput); }}
            placeholder="Ticker..." className="w-28 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none" />
        </div>
        {TICKERS.map(t => (
          <button key={t} onClick={() => selectTicker(t)}
            className={cn('rounded-lg px-2.5 py-1 text-xs font-medium', selectedTicker === t ? 'bg-indigo-600 text-white' : 'border border-slate-700 text-slate-400 hover:text-white')}>
            {t}
          </button>
        ))}
      </div>

      {/* Call info */}
      <div className="grid gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Quarter</div>
          <div className="mt-1 text-lg font-bold text-white">{data.quarter}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Date</div>
          <div className="mt-1 text-lg font-bold text-white">{data.date}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Duration</div>
          <div className="mt-1 text-lg font-bold text-white">{data.duration}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Sentiment</div>
          <div className={cn('mt-1 text-lg font-bold', data.overallSentiment > 0.5 ? 'text-emerald-400' : data.overallSentiment < 0.3 ? 'text-red-400' : 'text-amber-400')}>
            {data.positiveRatio}% Positive
          </div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Q&A Sessions</div>
          <div className="mt-1 text-lg font-bold text-white">{data.qaCount}</div>
        </div>
      </div>

      {/* Key Topics */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Key Topics Mentioned</h3>
        <div className="flex flex-wrap gap-2">
          {data.keyTopics.map(t => (
            <div key={t.topic} className={cn(
              'rounded-lg border px-3 py-1.5',
              t.sentiment > 0.2 ? 'border-emerald-700/50 bg-emerald-900/20' : t.sentiment < -0.2 ? 'border-red-700/50 bg-red-900/20' : 'border-slate-700 bg-slate-800'
            )}>
              <span className="text-xs font-medium text-white">{t.topic}</span>
              <span className="ml-2 text-[10px] text-slate-400">{t.mentions}x</span>
              <span className={cn('ml-1 text-[10px] font-medium', t.sentiment > 0.2 ? 'text-emerald-400' : t.sentiment < -0.2 ? 'text-red-400' : 'text-slate-400')}>
                {t.sentiment > 0 ? '+' : ''}{t.sentiment}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
          {(['all', 'prepared', 'qa'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('rounded-md px-3 py-1 text-xs font-medium', filter === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}>
              {f === 'all' ? 'All' : f === 'prepared' ? 'Prepared Remarks' : 'Q&A'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
          {(['all', 'positive', 'neutral', 'negative'] as const).map(f => (
            <button key={f} onClick={() => setSentimentFilter(f)}
              className={cn('rounded-md px-3 py-1 text-xs font-medium capitalize', sentimentFilter === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Transcript sections */}
      <div className="space-y-3">
        {filteredSections.map((section, i) => {
          const sentColor = section.sentiment === 'positive' ? 'border-l-emerald-500' : section.sentiment === 'negative' ? 'border-l-red-500' : 'border-l-slate-600';
          const roleColor = section.role === 'CEO' ? 'text-indigo-400' : section.role === 'CFO' ? 'text-purple-400' : 'text-amber-400';
          return (
            <div key={i} className={cn('rounded-xl border border-slate-700 bg-slate-800 p-4 border-l-4', sentColor)}>
              <div className="flex items-center gap-2 mb-2">
                {section.isQA ? <MessageSquare className="h-3.5 w-3.5 text-slate-500" /> : <Quote className="h-3.5 w-3.5 text-slate-500" />}
                <span className={cn('text-xs font-semibold', roleColor)}>{section.speaker}</span>
                <span className="text-[10px] text-slate-600">({section.role})</span>
                {section.sentiment === 'positive' && <ThumbsUp className="ml-auto h-3 w-3 text-emerald-500" />}
                {section.sentiment === 'negative' && <ThumbsDown className="ml-auto h-3 w-3 text-red-500" />}
                {section.sentiment === 'neutral' && <Minus className="ml-auto h-3 w-3 text-slate-500" />}
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{section.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
