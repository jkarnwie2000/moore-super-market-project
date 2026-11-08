import { useEffect, useState } from 'react';
import Icon from './Icon';

const SHOW_AFTER = 400; // px scrolled before the button appears

/**
 * Floating "back to top" button, shown on every page once you've scrolled down.
 * Scrolls smoothly (instantly for people who prefer reduced motion) and moves keyboard
 * focus to the top of the page so it isn't lost when the button hides.
 */
export default function BackToTop() {
  const [visible, setVisible] = useState(false);
  const [lift, setLift] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      setVisible(window.scrollY > SHOW_AFTER);
      // When the footer's bottom line (copyright / "Prices and availability subject to change.")
      // scrolls into view, rise above it so the button never covers that text.
      const bar = document.querySelector('.site-footer__bottom');
      const showing = bar ? window.innerHeight - bar.getBoundingClientRect().top : 0;
      setLift(Math.max(0, Math.round(showing)));
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  function goUp() {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, left: 0, behavior: reduce ? 'instant' : 'smooth' });
    const main = document.getElementById('main');
    if (main) {
      if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
    }
  }

  return (
    <button
      type="button"
      className={`back-to-top ${visible ? 'is-visible' : ''}`}
      style={{ '--btt-lift': `${lift}px` }}
      onClick={goUp}
      aria-label="Back to top"
      title="Back to top"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
    >
      <Icon name="arrowUp" size={22} strokeWidth={2.4} />
    </button>
  );
}
