import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ModuleItemList } from './ModuleItemList.js';

describe('ModuleItemList', () => {
  it('gives url-backed checklist items an accessible checkbox name', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();

    render(
      <ModuleItemList
        items={[
          { id: 'read-docs', type: 'read', label: 'Read docs', url: 'https://example.com/docs' },
        ]}
        moduleId="graphs"
        isCompleted={() => false}
        onToggle={onToggle}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: 'Read docs' });
    expect(checkbox).toBeInTheDocument();

    await user.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith('graphs', 'read-docs', 'read', 'Read docs');
  });

  it('disables pending items and surfaces saving state', () => {
    render(
      <ModuleItemList
        items={[
          { id: 'mock-interview', type: 'check', label: 'Mock interview', url: null },
        ]}
        moduleId="behavioral"
        isCompleted={() => false}
        isPending={() => true}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByRole('checkbox', { name: 'Mock interview' })).toBeDisabled();
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });
});
