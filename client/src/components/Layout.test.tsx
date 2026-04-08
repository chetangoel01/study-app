import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { Layout } from './Layout.js';

describe('Layout', () => {
  test('shows Mindful Engineer brand name', () => {
    render(
      <MemoryRouter>
        <Layout user={{ id: 1, email: 'test@example.com' }}>
          <div />
        </Layout>
      </MemoryRouter>
    );

    expect(screen.getByText('Mindful Engineer')).toBeInTheDocument();
  });

  test('renders all four nav links', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Layout user={{ id: 1, email: 'a@b.com' }}>
          <div />
        </Layout>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Curriculum' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Practice' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Community' })).toBeInTheDocument();
  });
});
