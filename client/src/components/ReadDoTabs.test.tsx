import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ReadDoTabs } from './ReadDoTabs.js';

describe('ReadDoTabs', () => {
  it('renders semantic tabs and supports keyboard navigation', async () => {
    const user = userEvent.setup();

    render(
      <ReadDoTabs
        readContent={<div>Read panel content</div>}
        doContent={<div>Do panel content</div>}
      />
    );

    const readTab = screen.getByRole('tab', { name: 'Read' });
    const doTab = screen.getByRole('tab', { name: 'Do' });

    expect(screen.getByRole('tablist', { name: 'Module sections' })).toBeInTheDocument();
    expect(readTab).toHaveAttribute('aria-selected', 'true');
    expect(doTab).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Read panel content');

    readTab.focus();
    await user.keyboard('{ArrowRight}');

    expect(doTab).toHaveAttribute('aria-selected', 'true');
    expect(doTab).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Do panel content');
  });
});
