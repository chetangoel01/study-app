import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LoginPage } from './LoginPage.js';

describe('LoginPage', () => {
  it('renders the login shell and oauth entry points', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Study Guide' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue with Google' }))
      .toHaveAttribute('href', '/api/auth/oauth/google');
    expect(screen.getByRole('link', { name: 'Continue with GitHub' }))
      .toHaveAttribute('href', '/api/auth/oauth/github');
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });
});
