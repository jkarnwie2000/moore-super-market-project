import { useState } from 'react';

export default function ProductImage({ src, alt, className = '', eager = false }) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      className={className}
      src={!src || failed ? '/images/placeholder.svg' : src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      width="400"
      height="400"
      onError={() => setFailed(true)}
    />
  );
}
