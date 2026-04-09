import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { AccountMenu } from './AccountMenu.js';

const user = { id: 1, email: 'alex@example.com' };

describe('AccountMenu', () => {
  test('shows avatar initial', () => {
    render(<MemoryRouter><AccountMenu user={user} /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  test('opens menu on click showing account options', () => {
    render(<MemoryRouter><AccountMenu user={user} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
  });

  test('links to the expected settings sections', () => {
    render(<MemoryRouter><AccountMenu user={user} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));

    expect(screen.getByRole('menuitem', { name: 'My Profile' })).toHaveAttribute('href', '/settings/profile');
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toHaveAttribute('href', '/settings/preferences');
    expect(screen.getByRole('menuitem', { name: 'Change Password' })).toHaveAttribute('href', '/settings/security');
  });

  test('closes menu when clicking outside', () => {
    render(<MemoryRouter><AccountMenu user={user} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.getByText('Settings')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });
});
