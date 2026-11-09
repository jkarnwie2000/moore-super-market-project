import { afterEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { RequireAdmin } from '../components/RouteGuards';

const CUSTOMER = { id: 'c1', name: 'Kofi', email: 'customer@example.com', role: 'customer' };
const ADMIN = { id: 'a1', name: 'Moore Admin', email: 'admin@mooresupermarket.com', role: 'admin' };

function mockApi(me, onAdminLogin) {
  global.fetch = vi.fn(async (url, opts = {}) => {
    const u = String(url);
    if (u.endsWith('/auth/me')) return { ok: true, status: 200, json: async () => ({ user: me }) };
    if (u.endsWith('/auth/admin-logout')) return { ok: true, status: 200, json: async () => ({ user: me }) };
    if (u.endsWith('/auth/admin-login')) {
      const r = onAdminLogin(JSON.parse(opts.body));
      return { ok: r.status < 400, status: r.status, json: async () => r.json };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

const renderAdmin = () =>
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <AuthProvider>
        <Routes>
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <h1>Dashboard</h1>
              </RequireAdmin>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );

afterEach(() => vi.restoreAllMocks());

describe('Admin Link while signed in as a customer', () => {
  test('shows the admin sign-in form (not "no access"), and admin details open the dashboard', async () => {
    mockApi(CUSTOMER, (body) => (body.email === ADMIN.email ? { status: 200, json: { admin: ADMIN } } : { status: 403, json: { message: 'nope' } }));
    renderAdmin();
    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeTruthy();
    expect(screen.queryByText(/doesn't have admin access/)).toBeNull();
    expect(screen.getByText(/signed in to the shop as/).textContent).toContain('customer@example.com');
    fireEvent.change(screen.getByLabelText('Admin email'), { target: { value: ADMIN.email } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'MooreAdmin123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to admin' }));
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeTruthy();
  });

  test('customer details show the server message and keep the form', async () => {
    mockApi(CUSTOMER, () => ({ status: 403, json: { message: "That account doesn't have admin access." } }));
    renderAdmin();
    await screen.findByRole('heading', { name: 'Admin sign in' });
    fireEvent.change(screen.getByLabelText('Admin email'), { target: { value: CUSTOMER.email } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Customer123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to admin' }));
    expect(await screen.findByText("That account doesn't have admin access.")).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).toBeNull();
  });

  test('signed out visitors get the same admin sign-in form, with Forgot password', async () => {
    mockApi(null, () => ({ status: 200, json: { admin: ADMIN } }));
    renderAdmin();
    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeTruthy();
    expect(screen.queryByText(/signed in to the shop as/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toBeTruthy();
  });
});

describe('Sign out of admin', () => {
  test('the admin bar opens the separate sign-out screen; signing out keeps the customer signed in', async () => {
    const { default: AdminLayout } = await import('../pages/admin/AdminLayout');
    const { default: AdminSignOut } = await import('../pages/admin/AdminSignOut');
    const { ToastProvider } = await import('../context/ToastContext');
    global.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.endsWith('/auth/me')) return { ok: true, status: 200, json: async () => ({ user: CUSTOMER, admin: ADMIN }) };
      if (u.endsWith('/auth/admin-logout')) return { ok: true, status: 200, json: async () => ({ user: CUSTOMER }) };
      return { ok: true, status: 200, json: async () => ({}) };
    });
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/admin/sign-out" element={<AdminSignOut />} />
              <Route path="/admin" element={<AdminLayout />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    );
    const bar = await screen.findByRole('region', { name: 'Admin session' });
    expect(bar.textContent).toContain('Signed in to the admin dashboard as Moore Admin');
    fireEvent.click(screen.getAllByRole('link', { name: /Sign out of admin/ })[0]);
    expect(await screen.findByRole('heading', { name: 'Admin sign out' })).toBeTruthy();
    expect(screen.getByText(/will stay signed in/).textContent).toContain('customer@example.com');
    fireEvent.click(screen.getByRole('button', { name: /Sign out of admin/ }));
    expect(await screen.findByRole('heading', { name: 'Signed out of admin' })).toBeTruthy();
    expect(screen.getByText(/still signed in to the shop as/).textContent).toContain('customer@example.com');
  });
});
