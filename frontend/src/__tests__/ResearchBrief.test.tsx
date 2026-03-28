import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ResearchBrief } from '../components/company/ResearchBrief';
import type { ResearchResponse } from '../hooks/useResearch';

const defaultProps = {
  data: undefined as ResearchResponse | undefined,
  isLoading: false,
  error: null as unknown,
  onGenerate: vi.fn(),
  hasRequested: false,
};

function renderBrief(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  return render(
    <MemoryRouter>
      <ResearchBrief {...props} />
    </MemoryRouter>
  );
}

describe('ResearchBrief', () => {
  it('shows CTA when hasRequested is false', () => {
    renderBrief({ hasRequested: false });
    expect(screen.getByText('AI Deep Research')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /generate deep research brief/i })
    ).toBeInTheDocument();
  });

  it('shows loading spinner when isLoading is true', () => {
    renderBrief({ hasRequested: true, isLoading: true });
    expect(
      screen.getByText(/running deep research analysis/i)
    ).toBeInTheDocument();
  });

  it('shows error message when error exists', () => {
    renderBrief({
      hasRequested: true,
      error: new Error('Something went wrong'),
    });
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('shows error message from data.error', () => {
    renderBrief({
      hasRequested: true,
      data: {
        ticker: 'AAPL',
        source: 'test',
        research: null,
        error: 'API limit exceeded',
      },
    });
    expect(screen.getByText('API limit exceeded')).toBeInTheDocument();
  });

  it('renders research sections when data is provided', () => {
    renderBrief({
      hasRequested: true,
      data: {
        ticker: 'AAPL',
        source: 'test',
        research: {
          company_overview: 'Apple is a technology company.',
          financial_health: 'Strong balance sheet with low debt.',
          key_metrics: 'P/E of 28, revenue growth 8%.',
          recent_developments: 'New product launches in Q4.',
          risk_factors: 'Supply chain concentration risk.',
          competitive_position: 'Market leader in premium devices.',
          outlook_summary: 'Positive outlook driven by services.',
        },
        disclaimer: 'Not investment advice.',
      },
    });

    expect(screen.getByText('Company Overview')).toBeInTheDocument();
    expect(screen.getByText('Financial Health')).toBeInTheDocument();
    expect(screen.getByText('Key Metrics')).toBeInTheDocument();
    expect(screen.getByText('Risk Factors')).toBeInTheDocument();
    expect(screen.getByText('Competitive Position')).toBeInTheDocument();
    expect(screen.getByText('Outlook')).toBeInTheDocument();
    expect(screen.getByText('Not investment advice.')).toBeInTheDocument();
  });

  it('shows rate limit message when rate_limited is true', () => {
    renderBrief({
      hasRequested: true,
      data: {
        ticker: 'AAPL',
        source: 'test',
        research: null,
        rate_limited: true,
      },
    });
    expect(screen.getByText('Daily Limit Reached')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /upgrade to pro/i })
    ).toBeInTheDocument();
  });
});
