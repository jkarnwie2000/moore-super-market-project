import { afterEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ForgotPasswordPage, LoginPage, ResetPasswordPage } from '../pages/AuthPages';

const TOKEN = 'a'.repeat(64);

function mockFetch(handler) {
  global.fetch = vi.fn(async (url, opts = {}) => {
    const body = handler(String(url), opts.body ? JSON.parse(opts.body) : null);
    return { ok: body.status ? body.status < 400 : true, status: body.status || 200, json: async () => body.json || {} };
  });
}

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/admin" element={<h1>Admin dashboard</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );

afterEach(() => vi.restoreAllMocks());

describe('Forgot password', () => {
  test('the sign-in page links to it, carrying the typed email', async () => {
    mockFetch(() => ({ json: { user: null } }));
    renderAt('/login');
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'admin@mooresupermarket.com' } });
    const link = screen.getByRole('link', { name: 'Forgot password?' });
    expect(link.getAttribute('href')).toBe('/forgot-password?email=admin%40mooresupermarket.com');
  });

  test('requesting a link shows the confirmation', async () => {
    mockFetch((url) =>
      url.includes('forgot-password') ? { json: { message: "If there's an account for that email, we've sent a link.", emailEnabled: true } } : { json: { user: null } }
    );
    renderAt('/forgot-password?email=admin%40mooresupermarket.com');
    expect(screen.getByLabelText('Email address').value).toBe('admin@mooresupermarket.com');
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText('Check your inbox.')).toBeTruthy();
    expect(screen.queryByText(/isn't set up on this store/)).toBeNull();
  });

  test('warns when the store cannot send email yet', async () => {
    mockFetch((url) => (url.includes('forgot-password') ? { json: { message: 'Sent.', emailEnabled: false } } : { json: { user: null } }));
    renderAt('/forgot-password');
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'a@b.co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText(/isn't set up on this store yet/)).toBeTruthy();
  });
});

describe('Reset password page', () => {
  test('checks the passwords match, then saves and opens the dashboard for an admin', async () => {
    let sent = null;
    mockFetch((url, body) => {
      if (url.includes('reset-password')) {
        sent = body;
        return { json: { user: { id: '1', name: 'Moore Admin', email: 'admin@mooresupermarket.com', role: 'admin' } } };
      }
      return { json: { user: null } };
    });
    renderAt(`/reset-password?token=${TOKEN}`);
    fireEvent.change(screen.getByLabelText(/^New password/), { target: { value: 'NewPass123' } });
    fireEvent.change(screen.getByLabelText(/^Confirm new password/), { target: { value: 'Different1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(screen.getByText('Passwords do not match.')).toBeTruthy();
    expect(sent).toBeNull();

    fireEvent.change(screen.getByLabelText(/^Confirm new password/), { target: { value: 'NewPass123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Admin dashboard' })).toBeTruthy());
    expect(sent).toEqual({ token: TOKEN, password: 'NewPass123' });
  });

  test('a missing or malformed link offers to request a new one', () => {
    mockFetch(() => ({ json: { user: null } }));
    renderAt('/reset-password?token=nope');
    expect(screen.getByRole('heading', { name: 'Reset link not valid' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Request a new link' }).getAttribute('href')).toBe('/forgot-password');
  });
});
