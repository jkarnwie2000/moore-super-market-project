import Icon from './Icon';

/**
 * Up-arrow button in the middle of the footer's bottom line (between the copyright and
 * "Prices and availability…"). Scrolls smoothly to the top — instantly for people who
 * prefer reduced motion — and moves keyboard focus to the top of the page.
 */
export default function BackToTop() {
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
    <button type="button" className="back-to-top" onClick={goUp} aria-label="Back to top" title="Back to top">
      <Icon name="arrowUp" size={20} strokeWidth={2.4} />
    </button>
  );
}
