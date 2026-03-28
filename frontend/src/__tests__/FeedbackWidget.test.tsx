import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { FeedbackWidget } from '../components/ui/FeedbackWidget';

function renderWidget() {
  return render(
    <MemoryRouter>
      <FeedbackWidget />
    </MemoryRouter>
  );
}

describe('FeedbackWidget', () => {
  it('renders the floating button', () => {
    renderWidget();
    expect(screen.getByLabelText('Send feedback')).toBeInTheDocument();
  });

  it('opens modal on click', async () => {
    const user = userEvent.setup();
    renderWidget();

    await user.click(screen.getByLabelText('Send feedback'));
    expect(screen.getByText('Share your feedback')).toBeInTheDocument();
  });

  it('has three type selectors (Feedback, Feature Request, Bug Report)', async () => {
    const user = userEvent.setup();
    renderWidget();

    await user.click(screen.getByLabelText('Send feedback'));

    expect(screen.getByText('Feedback')).toBeInTheDocument();
    expect(screen.getByText('Feature Request')).toBeInTheDocument();
    expect(screen.getByText('Bug Report')).toBeInTheDocument();
  });

  it('disables send button when message is too short', async () => {
    const user = userEvent.setup();
    renderWidget();

    await user.click(screen.getByLabelText('Send feedback'));

    // Send button should be disabled when message is empty
    const sendButton = screen.getByRole('button', { name: /^send$/i });
    expect(sendButton).toBeDisabled();

    // Type a message shorter than 5 characters
    const textarea = screen.getByPlaceholderText(/what do you think/i);
    await user.type(textarea, 'Hi');
    expect(sendButton).toBeDisabled();

    // Type a message longer than 5 characters
    await user.clear(textarea);
    await user.type(textarea, 'This is great feedback');
    expect(sendButton).not.toBeDisabled();
  });

  it('switches feedback type when clicking type selectors', async () => {
    const user = userEvent.setup();
    renderWidget();

    await user.click(screen.getByLabelText('Send feedback'));

    // Click Bug Report — placeholder should change
    await user.click(screen.getByText('Bug Report'));
    expect(
      screen.getByPlaceholderText(/what went wrong/i)
    ).toBeInTheDocument();

    // Click Feature Request — placeholder should change
    await user.click(screen.getByText('Feature Request'));
    expect(
      screen.getByPlaceholderText(/describe the feature/i)
    ).toBeInTheDocument();
  });
});
