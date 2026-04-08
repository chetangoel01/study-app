import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { ExternalLinkModal } from './ExternalLinkModal.js';

const url = 'https://developer.mozilla.org/en-US/docs/Web/API/Event';

describe('ExternalLinkModal', () => {
  test('renders domain name in modal body', () => {
    render(<ExternalLinkModal url={url} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('developer.mozilla.org', { selector: 'strong' })).toBeInTheDocument();
  });

  test('calls onCancel when Stay Here is clicked', () => {
    const onCancel = vi.fn();
    render(<ExternalLinkModal url={url} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /Stay Here/ }));
    expect(onCancel).toHaveBeenCalled();
  });

  test('calls onCancel on Escape key', () => {
    const onCancel = vi.fn();
    render(<ExternalLinkModal url={url} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });
});
