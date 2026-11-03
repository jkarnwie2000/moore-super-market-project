import { describe, expect, test } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CartProvider, CART_STORAGE_KEY, useCart } from '../context/CartContext';
import { ToastProvider } from '../context/ToastContext';
import { StoreProvider } from '../context/StoreContext';
import ProductCard from '../components/ProductCard';
import CartPage from '../pages/CartPage';
import { rice, ackee } from './fixtures';

function Count() {
  const { count } = useCart();
  return <span data-testid="count">{count}</span>;
}

function renderWith(ui) {
  return render(
    <MemoryRouter>
      <StoreProvider>
        <CartProvider>
          <ToastProvider>
            {ui}
            <Count />
          </ToastProvider>
        </CartProvider>
      </StoreProvider>
    </MemoryRouter>
  );
}

describe('Add to cart', () => {
  test('clicking Add updates the cart count and persists to localStorage', () => {
    renderWith(<ProductCard product={rice} />);
    expect(screen.getByTestId('count').textContent).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: /add royal stallion rice to cart/i }));
    expect(screen.getByTestId('count').textContent).toBe('1');
    const stored = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY));
    expect(stored[0]).toMatchObject({ productId: 'p1', variantId: 'v1', quantity: 1, price: 14.99 });
  });

  test('disables Add once all stock is in the cart', () => {
    renderWith(<ProductCard product={ackee} />);
    const btn = screen.getByRole('button', { name: /add grace ackee to cart/i });
    fireEvent.click(btn);
    expect(btn).toHaveProperty('disabled', true);
    expect(btn.textContent).toMatch(/max in cart/i);
  });

  test('restores the cart from localStorage after a refresh', () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify([{ key: 'p1:v2', productId: 'p1', variantId: 'v2', name: 'Rice', price: 32.99, stock: 10, quantity: 4 }])
    );
    renderWith(null);
    expect(screen.getByTestId('count').textContent).toBe('4');
  });
});

describe('Cart page', () => {
  test('quantity buttons update line totals and the order total', () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify([{ key: 'p1:v2', productId: 'p1', variantId: 'v2', slug: 'rice', name: 'Royal Stallion Rice', brand: 'RS', size: '25 lb', price: 32.99, stock: 3, quantity: 1 }])
    );
    renderWith(<CartPage />);
    expect(screen.getByTestId('line-total').textContent).toBe('$32.99');

    const inc = screen.getByRole('button', { name: /increase quantity/i });
    fireEvent.click(inc);
    expect(screen.getByTestId('line-total').textContent).toBe('$65.98');
    fireEvent.click(inc);
    expect(screen.getByTestId('line-total').textContent).toBe('$98.97');
    // Stock is 3 — the increase button is now disabled.
    expect(inc).toHaveProperty('disabled', true);
    // 98.97 qualifies for free delivery; tax 6.93 → total 105.90
    expect(screen.getByText('$105.90')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /decrease quantity/i }));
    expect(screen.getByTestId('line-total').textContent).toBe('$65.98');
    expect(screen.getByTestId('count').textContent).toBe('2');

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(screen.getByText(/your cart is empty/i)).toBeTruthy();
  });
});
