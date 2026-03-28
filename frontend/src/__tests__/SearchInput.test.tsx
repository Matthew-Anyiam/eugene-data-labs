import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SearchInput } from '../components/ui/SearchInput';

function renderSearchInput(props = {}) {
  return render(
    <MemoryRouter>
      <SearchInput {...props} />
    </MemoryRouter>
  );
}

describe('SearchInput', () => {
  it('renders with placeholder text', () => {
    renderSearchInput();
    expect(
      screen.getByPlaceholderText('Search by ticker (e.g. AAPL)')
    ).toBeInTheDocument();
  });

  it('accepts user input', async () => {
    const user = userEvent.setup();
    renderSearchInput();
    const input = screen.getByPlaceholderText('Search by ticker (e.g. AAPL)');

    await user.type(input, 'MSFT');
    expect(input).toHaveValue('MSFT');
  });

  it('validates ticker format — uppercase letters, 1-5 chars', async () => {
    const user = userEvent.setup();
    renderSearchInput();
    const input = screen.getByPlaceholderText('Search by ticker (e.g. AAPL)');

    // Type a valid ticker
    await user.type(input, 'AAPL');
    expect(input).toHaveValue('AAPL');

    // The component converts input to uppercase for matching
    // and filters suggestions based on uppercase query
    await user.clear(input);
    await user.type(input, 'goog');
    expect(input).toHaveValue('goog');

    // Verify suggestions appear for valid ticker patterns
    // GOOGL should show up as a suggestion since 'GOOG' matches the start
    expect(screen.getByText('GOOGL')).toBeInTheDocument();
  });

  it('shows autocomplete suggestions for matching tickers', async () => {
    const user = userEvent.setup();
    renderSearchInput();
    const input = screen.getByPlaceholderText('Search by ticker (e.g. AAPL)');

    await user.type(input, 'AA');
    // AAPL should appear as a suggestion
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('Apple Inc')).toBeInTheDocument();
  });

  it('does not show suggestions when input is empty', () => {
    renderSearchInput();
    // No suggestion buttons should be present
    expect(screen.queryByText('Apple Inc')).not.toBeInTheDocument();
    expect(screen.queryByText('Microsoft Corp')).not.toBeInTheDocument();
  });
});
