import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import ProductImage from '../../components/ProductImage';
import { ErrorState, Field, PageLoader } from '../../components/ui';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';

const EMPTY = {
  name: '',
  brand: '',
  description: '',
  category: '',
  origin: '',
  image: '',
  rating: 0,
  numReviews: 0,
  featured: false,
  bestSeller: false,
  isActive: true,
  tags: '',
  variants: [{ label: '', price: '', compareAtPrice: '', stock: 0 }],
};

export default function AdminProductForm() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { categories, african, caribbean } = useStore();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isNew) return;
    api
      .get(`/admin/products/${id}`)
      .then(({ product }) =>
        setForm({
          ...product,
          category: product.category?._id || product.category,
          tags: (product.tags || []).join(', '),
          variants: product.variants.map((v) => ({ ...v, compareAtPrice: v.compareAtPrice ?? '' })),
        })
      )
      .catch(setLoadError)
      .finally(() => setLoading(false));
  }, [id, isNew]);

  if (loading) return <PageLoader />;
  if (loadError) return <ErrorState error={loadError} />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const setVariant = (i, k, v) => setForm({ ...form, variants: form.variants.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });

  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setErrors({ ...errors, image: 'Image must be 3 MB or smaller.' });
      return;
    }
    const fd = new FormData();
    fd.append('image', file);
    setUploading(true);
    try {
      const { url } = await api.upload('/admin/uploads', fd);
      setForm((f) => ({ ...f, image: url }));
      setErrors((x) => ({ ...x, image: undefined }));
    } catch (err) {
      setErrors((x) => ({ ...x, image: err.message }));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const payload = {
      ...form,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      variants: form.variants.map((v) => ({ ...v, price: Number(v.price), stock: Number(v.stock), compareAtPrice: v.compareAtPrice === '' ? null : Number(v.compareAtPrice) })),
    };
    try {
      if (isNew) await api.post('/admin/products', payload);
      else await api.put(`/admin/products/${id}`, payload);
      notify(isNew ? 'Product created' : 'Product saved');
      navigate('/admin/products');
    } catch (err) {
      setErrors(err.errors || { _: err.message });
      setSaving(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="admin__head">
        <h1>{isNew ? 'Add product' : 'Edit product'}</h1>
        <Link to="/admin/products" className="link-arrow">
          ← Back to products
        </Link>
      </div>
      {Object.keys(errors).length > 0 && (
        <div className="alert alert--error" role="alert">
          {errors._ || 'Please correct the highlighted fields.'}
        </div>
      )}

      <div className="admin-form">
        <section className="card stack">
          <h2>Details</h2>
          <Field label="Product name *" error={errors.name}>
            <input value={form.name} onChange={set('name')} />
          </Field>
          <div className="form-grid">
            <Field label="Brand *" error={errors.brand}>
              <input value={form.brand} onChange={set('brand')} />
            </Field>
            <Field label="Country of origin">
              <input value={form.origin} onChange={set('origin')} />
            </Field>
          </div>
          <Field label="Category *" error={errors.category}>
            <select value={form.category} onChange={set('category')}>
              <option value="">Choose a category…</option>
              <optgroup label="African groceries">
                {african.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Caribbean groceries">
                {caribbean.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </Field>
          {categories.length === 0 && <p className="muted small">Create a category first.</p>}
          <Field label="Description *" error={errors.description}>
            <textarea rows="5" value={form.description} onChange={set('description')} />
          </Field>
          <Field label="Search tags" hint="Comma separated, e.g. jollof, rice">
            <input value={form.tags} onChange={set('tags')} />
          </Field>
          <div className="form-grid">
            <Field label="Rating (0–5)" error={errors.rating}>
              <input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={set('rating')} />
            </Field>
            <Field label="Number of reviews" error={errors.numReviews}>
              <input type="number" min="0" step="1" value={form.numReviews} onChange={set('numReviews')} />
            </Field>
          </div>
        </section>

        <div className="stack">
          <section className="card stack">
            <h2>Image</h2>
            <div className="image-upload">
              <ProductImage src={form.image} alt="Product preview" />
              <label className="btn btn--outline btn--sm">
                <Icon name="upload" size={16} /> {uploading ? 'Uploading…' : 'Upload image'}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} hidden />
              </label>
              <p className="muted small">JPG, PNG or WEBP up to 3 MB. Square images look best.</p>
              {errors.image && <p className="field__error">{errors.image}</p>}
            </div>
          </section>
          <section className="card stack">
            <h2>Visibility</h2>
            <label className="checkbox">
              <input type="checkbox" checked={form.isActive} onChange={set('isActive')} /> Visible in store
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={form.featured} onChange={set('featured')} /> Featured on homepage
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={form.bestSeller} onChange={set('bestSeller')} /> Best seller badge
            </label>
          </section>
        </div>
      </div>

      <section className="card stack">
        <div className="admin__head">
          <h2>Sizes, pricing &amp; inventory</h2>
          <button type="button" className="btn btn--outline btn--sm" onClick={() => setForm({ ...form, variants: [...form.variants, { label: '', price: '', compareAtPrice: '', stock: 0 }] })}>
            + Add size
          </button>
        </div>
        {errors.variants && <p className="field__error">{errors.variants}</p>}
        <p className="muted small">Set an “original price” higher than the price to show the product as discounted in Weekly Deals.</p>
        {form.variants.map((v, i) => (
          <div key={v._id || i} className="variant-row">
            <Field label="Size / weight *" error={errors[`variants.${i}.label`]}>
              <input value={v.label} placeholder="e.g. 5 lb" onChange={(e) => setVariant(i, 'label', e.target.value)} />
            </Field>
            <Field label="Price ($) *" error={errors[`variants.${i}.price`]}>
              <input type="number" min="0.01" step="0.01" value={v.price} onChange={(e) => setVariant(i, 'price', e.target.value)} />
            </Field>
            <Field label="Original price ($)" error={errors[`variants.${i}.compareAtPrice`]}>
              <input type="number" min="0" step="0.01" value={v.compareAtPrice} onChange={(e) => setVariant(i, 'compareAtPrice', e.target.value)} />
            </Field>
            <Field label="Stock *" error={errors[`variants.${i}.stock`]}>
              <input type="number" min="0" step="1" value={v.stock} onChange={(e) => setVariant(i, 'stock', e.target.value)} />
            </Field>
            <button
              type="button"
              className="icon-btn icon-btn--danger"
              aria-label="Remove size"
              disabled={form.variants.length === 1}
              onClick={() => setForm({ ...form, variants: form.variants.filter((_, j) => j !== i) })}
            >
              <Icon name="trash" size={18} />
            </button>
          </div>
        ))}
      </section>

      <div className="row">
        <button type="submit" className="btn btn--primary btn--lg" disabled={saving || uploading}>
          {saving ? 'Saving…' : isNew ? 'Create product' : 'Save changes'}
        </button>
        <Link to="/admin/products" className="btn btn--outline btn--lg">
          Cancel
        </Link>
      </div>
    </form>
  );
}
