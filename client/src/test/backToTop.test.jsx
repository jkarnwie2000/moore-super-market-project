import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import BackToTop from '../components/BackToTop';

describe('BackToTop', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb();
      return 1;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    window.scrollY = 0;
  });

  const scrollTo = (y) =>
    act(() => {
      window.scrollY = y;
      window.dispatchEvent(new Event('scroll'));
    });

  test('is hidden near the top and appears after scrolling down', () => {
    const { container } = render(
      <main id="main">
        <BackToTop />
      </main>
    );
    // While hidden it is aria-hidden (not announced), so select it directly.
    const btn = container.querySelector('.back-to-top');
    expect(btn.getAttribute('aria-hidden')).toBe('true');
    expect(btn.className).not.toContain('is-visible');
    expect(btn.getAttribute('tabindex')).toBe('-1');
    scrollTo(1200);
    expect(btn.className).toContain('is-visible');
    expect(btn.getAttribute('tabindex')).toBe('0');
    scrollTo(100);
    expect(btn.className).not.toContain('is-visible');
  });

  test('clicking scrolls to the top and moves focus to the page', () => {
    render(
      <main id="main">
        <BackToTop />
      </main>
    );
    scrollTo(2000);
    fireEvent.click(screen.getByRole('button', { name: 'Back to top' }));
    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    expect(document.activeElement.id).toBe('main');
  });
});
