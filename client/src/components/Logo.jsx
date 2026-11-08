import { Link } from 'react-router-dom';
import { scrollToTop } from '../utils/scroll';

/** Moore Supermarket brand mark: a sun-and-market "M" seal with a wordmark. */
export default function Logo({ inverted = false }) {
  return (
    <Link
      to="/"
      className={`logo ${inverted ? 'logo--inverted' : ''}`}
      aria-label="Moore Supermarket home"
      // Already on the home page (e.g. clicking the footer logo)? Still go back to the top.
      onClick={(e) => {
        if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) scrollToTop();
      }}
    >
      <svg className="logo__mark" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="30" fill="#1F5135" />
        <circle cx="32" cy="32" r="25" fill="none" stroke="#E2A92B" strokeWidth="1.5" strokeDasharray="2 3" />
        <path d="M15 43V23l8.5 12L32 23l8.5 12L49 23v20" stroke="#E2A92B" strokeWidth="4.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M17 49h30" stroke="#D9692B" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
      <span className="logo__text">
        <span className="logo__name">Moore</span>
        <span className="logo__tag">Supermarket</span>
      </span>
    </Link>
  );
}
