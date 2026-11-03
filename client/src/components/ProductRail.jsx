import ProductCard from './ProductCard';
import { ErrorState, SectionHeader, SkeletonGrid } from './ui';
import { useApi } from '../hooks/useApi';

/** A titled row of products loaded from the catalogue API with the given filters. */
export default function ProductRail({ eyebrow, title, params, to, limit = 4 }) {
  const { data, loading, error, reload } = useApi('/products', { ...params, limit });
  return (
    <section className="section">
      <div className="container">
        <SectionHeader eyebrow={eyebrow} title={title} to={to} />
        {loading ? (
          <SkeletonGrid count={limit} />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="product-grid">
            {data.products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
