import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import Icon from '../components/Icon';
import { EmptyState, ErrorState, SkeletonGrid } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { useStore } from '../context/StoreContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const SORT_OPTIONS = [
  ['popular', 'Most popular'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['rating', 'Top rated'],
  ['newest', 'Newest'],
  ['name', 'Name A–Z'],
];

const PRICE_PRESETS = [
  ['', '5', 'Under $5'],
  ['5', '10', '$5 – $10'],
  ['10', '20', '$10 – $20'],
  ['20', '', '$20 & above'],
];

const FILTER_KEYS = ['q', 'category', 'region', 'minPrice', 'maxPrice', 'sort', 'deals', 'featured', 'bestSeller', 'inStock', 'page'];

export default function ShopPage() {
  const [params, setParams] = useSearchParams();
  const { categories, african, caribbean } = useStore();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query = useMemo(() => {
    const q = {};
    FILTER_KEYS.forEach((k) => {
      const v = params.get(k);
      if (v) q[k] = v;
    });
    return q;
  }, [params]);

  const [minDraft, setMinDraft] = useState(query.minPrice || '');
  const [maxDraft, setMaxDraft] = useState(query.maxPrice || '');
  useEffect(() => {
    setMinDraft(query.minPrice || '');
    setMaxDraft(query.maxPrice || '');
  }, [query.minPrice, query.maxPrice]);

  const { data, loading, error, reload } = useApi('/products', { ...query, limit: 24 });

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };

  const category = categories.find((c) => c.slug === query.category);
  let title = 'All products';
  if (query.q) title = `Results for “${query.q}”`;
  else if (category) title = category.name;
  else if (query.deals) title = 'Weekly deals';
  else if (query.bestSeller) title = 'Best sellers';
  else if (query.featured) title = 'Featured products';
  else if (query.region) title = query.region === 'african' ? 'African groceries' : 'Caribbean groceries';
  useDocumentTitle(title);

  const activeChips = [
    query.q && ['q', `“${query.q}”`],
    category && ['category', category.name],
    query.region && !category && ['region', query.region === 'african' ? 'African' : 'Caribbean'],
    (query.minPrice || query.maxPrice) && ['price', `$${query.minPrice || 0} – ${query.maxPrice ? `$${query.maxPrice}` : 'any'}`],
    query.deals && ['deals', 'On sale'],
    query.featured && ['featured', 'Featured'],
    query.bestSeller && ['bestSeller', 'Best sellers'],
    query.inStock && ['inStock', 'In stock'],
  ].filter(Boolean);

  const clearChip = (key) => (key === 'price' ? update({ minPrice: '', maxPrice: '' }) : update({ [key]: '' }));

  const filters = (
    <div className="filters">
      <div className="filters__group">
        <h3>Region</h3>
        {[
          ['', 'All regions'],
          ['african', 'African'],
          ['caribbean', 'Caribbean'],
        ].map(([v, label]) => (
          <label key={v || 'all'} className="radio">
            <input type="radio" name="region" checked={(query.region || '') === v && !query.category} onChange={() => update({ region: v, category: '' })} />
            {label}
          </label>
        ))}
      </div>
      <div className="filters__group">
        <h3>Category</h3>
        <select aria-label="Category" value={query.category || ''} onChange={(e) => update({ category: e.target.value, region: '' })}>
          <option value="">All categories</option>
          <optgroup label="African groceries">
            {african.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Caribbean groceries">
            {caribbean.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      <div className="filters__group">
        <h3>Price</h3>
        <div className="price-presets">
          {PRICE_PRESETS.map(([min, max, label]) => (
            <button
              key={label}
              type="button"
              className={`chip ${query.minPrice === (min || undefined) && query.maxPrice === (max || undefined) ? 'chip--active' : ''}`}
              onClick={() => update({ minPrice: min, maxPrice: max })}
            >
              {label}
            </button>
          ))}
        </div>
        <form
          className="price-range"
          onSubmit={(e) => {
            e.preventDefault();
            update({ minPrice: minDraft, maxPrice: maxDraft });
          }}
        >
          <input type="number" min="0" step="0.5" placeholder="Min $" aria-label="Minimum price" value={minDraft} onChange={(e) => setMinDraft(e.target.value)} />
          <span>–</span>
          <input type="number" min="0" step="0.5" placeholder="Max $" aria-label="Maximum price" value={maxDraft} onChange={(e) => setMaxDraft(e.target.value)} />
          <button type="submit" className="btn btn--outline btn--sm">
            Go
          </button>
        </form>
      </div>
      <div className="filters__group">
        <h3>Show</h3>
        {[
          ['deals', 'On sale / discounted'],
          ['featured', 'Featured products'],
          ['bestSeller', 'Best sellers'],
          ['inStock', 'In stock only'],
        ].map(([key, label]) => (
          <label key={key} className="checkbox">
            <input type="checkbox" checked={Boolean(query[key])} onChange={(e) => update({ [key]: e.target.checked ? '1' : '' })} />
            {label}
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="container shop">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link> <Icon name="chevronRight" size={14} /> <Link to="/shop">Shop</Link>
        {category && (
          <>
            <Icon name="chevronRight" size={14} /> <span>{category.name}</span>
          </>
        )}
      </nav>

      <div className="shop__head">
        <div>
          <h1>{title}</h1>
          {category?.description && <p className="muted">{category.description}</p>}
        </div>
        <div className="shop__tools">
          <button type="button" className="btn btn--outline btn--sm show-lg" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
            <Icon name="filter" size={16} /> Filters
          </button>
          <label className="sort">
            <span className="hide-sm">Sort by</span>
            <select aria-label="Sort products" value={query.sort || 'popular'} onChange={(e) => update({ sort: e.target.value })}>
              {SORT_OPTIONS.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="active-filters">
          {activeChips.map(([key, label]) => (
            <button key={key} type="button" className="chip chip--active" onClick={() => clearChip(key)} aria-label={`Remove filter ${label}`}>
              {label} <Icon name="close" size={14} />
            </button>
          ))}
          <button type="button" className="link-btn" onClick={() => setParams(new URLSearchParams())}>
            Clear all
          </button>
        </div>
      )}

      <div className="shop__layout">
        <aside className={`shop__sidebar ${filtersOpen ? 'is-open' : ''}`} aria-label="Filters">
          {filters}
        </aside>
        <section className="shop__results" aria-live="polite">
          {loading ? (
            <SkeletonGrid count={8} />
          ) : error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : data.products.length === 0 ? (
            <EmptyState
              icon="search"
              title="No products found"
              action={
                <Link to="/shop" className="btn btn--primary">
                  Browse all products
                </Link>
              }
            >
              Try a different search term or remove some filters.
            </EmptyState>
          ) : (
            <>
              <p className="muted results-count">
                Showing {data.products.length} of {data.total} product{data.total === 1 ? '' : 's'}
              </p>
              <div className="product-grid product-grid--shop">
                {data.products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              {data.pages > 1 && (
                <nav className="pagination" aria-label="Pagination">
                  {Array.from({ length: data.pages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`chip ${n === data.page ? 'chip--active' : ''}`}
                      aria-current={n === data.page ? 'page' : undefined}
                      onClick={() => {
                        update({ page: String(n) });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
