import { useState } from 'react';
import { FileText, Search, ThumbsUp, ThumbsDown, Minus, MessageSquare, Quote, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranscripts } from '../hooks/useTranscripts';

const TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM'];

export function EarningsTranscriptPage() {
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [tickerInput, setTickerInput] = useState('');
  const [filter, setFilter] = useState<'all' | 'prepared' | 'qa'>('all');
  const [selectedTranscriptIndex, setSelectedTranscriptIndex] = useState(0);

  const { data, isLoading, isError } = useTranscripts(selectedTicker, 5);

  const transcripts = data?.data?.transcripts ?? [];
  const transcript = transcripts[selectedTranscriptIndex] ?? null;

  const selectTicker = (t: string) => {
    setSelectedTicker(t.toUpperCase());
    setTickerInput('');
    setSelectedTranscriptIndex(0);
  };

  const sentimentScore = transcript?.tone_analysis?.sentiment_score ?? 0;
  const positiveWords = transcript?.tone_analysis?.positive_words ?? 0;
  const negativeWords = transcript?.tone_analysis?.negative_words ?? 0;
  const totalSentimentWords = positiveWords + negativeWords;
  const positiveRatio = totalSentimentWords > 0 ? Math.round((positiveWords / totalSentimentWords) * 100) : 0;

  const getSentimentLabel = (score: number) => {
    if (score > 0.3) return 'positive';
    if (score < -0.3) return 'negative';
    return 'neutral';
  };

  const overallSentiment = getSentimentLabel(sentimentScore);

  interface SectionBlock {
    type: 'prepared' | 'qa';
    text: string;
    index: number;
  }

  const preparedBlocks: SectionBlock[] = transcript
    ? (transcript.management_remarks || '')
        .split('\n\n')
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t, i) => ({ type: 'prepared' as const, text: t, index: i }))
    : [];

  const qaBlocks: SectionBlock[] = transcript
    ? (transcript.qa_section || '')
        .split('\n\n')
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t, i) => ({ type: 'qa' as const, text: t, index: i }))
    : [];

  const allBlocks: SectionBlock[] = [...preparedBlocks, ...qaBlocks];

  const visibleBlocks =
    filter === 'all' ? allBlocks : filter === 'prepared' ? preparedBlocks : qaBlocks;

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
          <input
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && tickerInput) selectTicker(tickerInput);
            }}
            placeholder="Ticker..."
            className="w-28 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        {TICKERS.map((t) => (
          <button
            key={t}
            onClick={() => selectTicker(t)}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-medium',
              selectedTicker === t
                ? 'bg-indigo-600 text-white'
                : 'border border-slate-700 text-slate-400 hover:text-white',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-800 p-12">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
          <span className="text-sm text-slate-400">Loading transcripts for {selectedTicker}…</span>
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <div className="rounded-xl border border-red-700/50 bg-red-900/20 p-6 text-center">
          <p className="text-sm font-medium text-red-400">Failed to load transcripts for {selectedTicker}.</p>
          <p className="mt-1 text-xs text-slate-500">Please try again or select a different ticker.</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && transcripts.length === 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-12 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-slate-600" />
          <p className="text-sm font-medium text-white">No transcripts available for {selectedTicker}</p>
          <p className="mt-1 text-xs text-slate-500">Try a different ticker or check back later.</p>
        </div>
      )}

      {/* Content */}
      {!isLoading && !isError && transcript && (
        <>
          {/* Quarter selector if multiple transcripts */}
          {transcripts.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {transcripts.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedTranscriptIndex(i)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium',
                    selectedTranscriptIndex === i
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-700 text-slate-400 hover:text-white',
                  )}
                >
                  {t.quarter} {t.year}
                </button>
              ))}
            </div>
          )}

          {/* Call info */}
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">Quarter</div>
              <div className="mt-1 text-lg font-bold text-white">
                {transcript.quarter} {transcript.year}
              </div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">Date</div>
              <div className="mt-1 text-lg font-bold text-white">{transcript.date}</div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">Sentiment Score</div>
              <div
                className={cn(
                  'mt-1 text-lg font-bold',
                  sentimentScore > 0.3
                    ? 'text-emerald-400'
                    : sentimentScore < -0.3
                      ? 'text-red-400'
                      : 'text-amber-400',
                )}
              >
                {sentimentScore > 0 ? '+' : ''}
                {sentimentScore.toFixed(2)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">Positive Tone</div>
              <div
                className={cn(
                  'mt-1 text-lg font-bold',
                  positiveRatio >= 60
                    ? 'text-emerald-400'
                    : positiveRatio < 40
                      ? 'text-red-400'
                      : 'text-amber-400',
                )}
              >
                {positiveRatio}%
              </div>
            </div>
          </div>

          {/* Guidance block if present */}
          {transcript.guidance && (
            <div className="rounded-xl border border-indigo-700/50 bg-indigo-900/20 p-4">
              <h3 className="mb-2 text-sm font-semibold text-indigo-300">Guidance</h3>
              <p className="text-sm leading-relaxed text-slate-300">{transcript.guidance}</p>
            </div>
          )}

          {/* Key metrics if present */}
          {transcript.key_metrics && Object.keys(transcript.key_metrics).length > 0 && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <h3 className="mb-3 text-sm font-semibold text-white">Key Metrics</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(transcript.key_metrics).map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5"
                  >
                    <span className="text-xs text-slate-500">{key}: </span>
                    <span className="text-xs font-medium text-white">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
              {(['all', 'prepared', 'qa'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium',
                    filter === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white',
                  )}
                >
                  {f === 'all' ? 'All' : f === 'prepared' ? 'Prepared Remarks' : 'Q&A'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{preparedBlocks.length} prepared</span>
              <span>·</span>
              <span>{qaBlocks.length} Q&amp;A blocks</span>
            </div>
          </div>

          {/* Section blocks */}
          <div className="space-y-3">
            {visibleBlocks.length === 0 && (
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 text-center">
                <p className="text-sm text-slate-500">No content available for this section.</p>
              </div>
            )}
            {visibleBlocks.map((block, i) => {
              const borderColor =
                overallSentiment === 'positive'
                  ? 'border-l-emerald-500'
                  : overallSentiment === 'negative'
                    ? 'border-l-red-500'
                    : 'border-l-slate-600';

              const labelColor =
                block.type === 'prepared' ? 'text-indigo-400' : 'text-amber-400';

              return (
                <div
                  key={`${block.type}-${block.index}-${i}`}
                  className={cn(
                    'rounded-xl border border-slate-700 bg-slate-800 p-4 border-l-4',
                    borderColor,
                  )}
                >
                  <div className="mb-2 flex items-center gap-2">
                    {block.type === 'qa' ? (
                      <MessageSquare className="h-3.5 w-3.5 text-slate-500" />
                    ) : (
                      <Quote className="h-3.5 w-3.5 text-slate-500" />
                    )}
                    <span className={cn('text-xs font-semibold', labelColor)}>
                      {block.type === 'prepared' ? 'Management' : 'Q&A'}
                    </span>
                    <span className="text-[10px] text-slate-600">
                      ({block.type === 'prepared' ? 'Prepared Remarks' : 'Q&A Section'})
                    </span>
                    {overallSentiment === 'positive' && (
                      <ThumbsUp className="ml-auto h-3 w-3 text-emerald-500" />
                    )}
                    {overallSentiment === 'negative' && (
                      <ThumbsDown className="ml-auto h-3 w-3 text-red-500" />
                    )}
                    {overallSentiment === 'neutral' && (
                      <Minus className="ml-auto h-3 w-3 text-slate-500" />
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-slate-300">{block.text}</p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
