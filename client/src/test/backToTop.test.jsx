import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StoreProvider } from '../context/StoreContext';
import Footer from '../components/Footer';

describe('Back-to-top arrow in the footer', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());

  const renderFooter = () =>
    render(
      <MemoryRouter>
        <StoreProvider>
          <main id="main" />
          <Footer />
        </StoreProvider>
      </MemoryRouter>
    );

  test('sits between the copyright and the prices note in the footer bottom line', () => {
    const { container } = renderFooter();
    const bar = container.querySelector('.site-footer__bottom .container');
    const parts = [...bar.children].map((el) => el.className || el.tagName);
    expect(parts).toEqual(['site-footer__copy', 'back-to-top', 'site-footer__note']);
  });

  test('clicking it scrolls to the top and moves focus to the page', () => {
    renderFooter();
    fireEvent.click(screen.getByRole('button', { name: 'Back to top' }));
    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    expect(document.activeElement.id).toBe('main');
  });
});
