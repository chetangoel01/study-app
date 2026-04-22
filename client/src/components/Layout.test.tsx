import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { Layout } from './Layout.js';

describe('Layout', () => {
  test('shows Mindful Engineer brand name', () => {
    render(
      <MemoryRouter>
        <Layout user={{ id: 1, email: 'test@example.com', timezone: 'UTC' }}>
          <div />
        </Layout>
      </MemoryRouter>
    );

    expect(screen.getByText('Mindful Engineer')).toBeInTheDocument();
  });

  test('renders all four nav links', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Layout user={{ id: 1, email: 'a@b.com', timezone: 'UTC' }}>
          <div />
        </Layout>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Curriculum' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Practice' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Community' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Help' })).not.toBeInTheDocument();
  });

  test('shows collapsed pomodoro left of search and account actions', () => {
    const { container } = render(
      <MemoryRouter>
        <Layout user={{ id: 1, email: 'focus@example.com', timezone: 'UTC' }}>
          <div />
        </Layout>
      </MemoryRouter>
    );

    const searchButton = screen.getByRole('button', { name: 'Search' });
    const collapsedPomodoro = screen.getByRole('button', { name: /open pomodoro timer/i });
    expect(searchButton).toBeInTheDocument();
    expect(collapsedPomodoro).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Pomodoro timer' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument();

    const topbarActions = container.querySelector('.topbar-actions');
    expect(topbarActions).not.toBeNull();
    expect(topbarActions?.firstElementChild).toHaveClass('pomodoro-slot');
    expect(topbarActions?.children[1]).toBe(searchButton);
  });
});
