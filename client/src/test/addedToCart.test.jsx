import { beforeEach, describe, expect, test } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CartProvider, CART_STORAGE_KEY } from '../context/CartContext';
import { ToastProvider } from '../context/ToastContext';
import { StoreProvider } from '../context/StoreContext';
import ProductCard from '../components/ProductCard';
import AddedToCartDialog from '../components/AddedToCartDialog';
import { ackee } from './fixtures';

function renderShop() {
  return render(
    <MemoryRouter initialEntries={['/shop']}>
      <StoreProvider>
        <CartProvider>
          <ToastProvider>
            <Routes>
              <Route path="/shop" element={<ProductCard product={ackee} />} />
              <Route path="/checkout" element={<h1>Checkout page</h1>} />
            </Routes>
            <AddedToCartDialog />
          </ToastProvider>
        </CartProvider>
      </StoreProvider>
    </MemoryRouter>
  );
}

describe('Added to cart dialog', () => {
  beforeEach(() => window.localStorage.removeItem(CART_STORAGE_KEY));

  test('adding a product offers Continue shopping or Proceed to checkout', () => {
    renderShop();
    fireEvent.click(screen.getByRole('button', { name: `Add ${ackee.name} to cart` }));
    const dialog = screen.getByRole('dialog', { name: 'Added to your cart' });
    expect(dialog.textContent).toContain(ackee.name);
    expect(dialog.textContent).toContain('1 × added');
    expect(screen.getByRole('button', { name: 'Continue shopping' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Proceed to checkout/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /View or edit cart/ }).getAttribute('href')).toBe('/cart');
  });

  test('Continue shopping closes it and keeps the shopper on the page', () => {
    renderShop();
    fireEvent.click(screen.getByRole('button', { name: `Add ${ackee.name} to cart` }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue shopping' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: `Add ${ackee.name} to cart` })).toBeTruthy();
  });

  test('Proceed to checkout goes to the checkout page', () => {
    renderShop();
    fireEvent.click(screen.getByRole('button', { name: `Add ${ackee.name} to cart` }));
    fireEvent.click(screen.getByRole('button', { name: /Proceed to checkout/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Checkout page' })).toBeTruthy();
  });
});
