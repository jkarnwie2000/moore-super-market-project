/**
 * Pure cart reducer. Quantities are always clamped to available stock so the
 * shopper can never add more than the store has.
 */
export const MAX_PER_LINE = 99;
export const lineKey = (productId, variantId) => `${productId}:${variantId}`;

const clamp = (qty, stock) => Math.max(0, Math.min(Number(qty) || 0, stock ?? MAX_PER_LINE, MAX_PER_LINE));

export function cartReducer(state, action) {
  switch (action.type) {
    case 'add': {
      const { product, variant, quantity = 1 } = action;
      const key = lineKey(product.id || product._id, variant._id);
      const existing = state.find((i) => i.key === key);
      const desired = (existing ? existing.quantity : 0) + quantity;
      const qty = clamp(desired, variant.stock);
      if (qty <= 0) return state;
      const line = {
        key,
        productId: product.id || product._id,
        variantId: variant._id,
        slug: product.slug,
        name: product.name,
        brand: product.brand,
        image: product.image,
        size: variant.label,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice || null,
        stock: variant.stock,
        quantity: qty,
      };
      return existing ? state.map((i) => (i.key === key ? line : i)) : [...state, line];
    }
    case 'setQuantity': {
      return state
        .map((i) => (i.key === action.key ? { ...i, quantity: clamp(action.quantity, i.stock) } : i))
        .filter((i) => i.quantity > 0);
    }
    case 'remove':
      return state.filter((i) => i.key !== action.key);
    case 'clear':
      return [];
    case 'sync': {
      // Apply fresh server data (price/stock/availability) to persisted lines.
      const fresh = new Map(action.lines.map((l) => [lineKey(l.productId, l.variantId), l]));
      return state
        .map((i) => {
          const f = fresh.get(i.key);
          if (!f || !f.available) return { ...i, stock: 0, quantity: 0 };
          return { ...i, name: f.name, image: f.image, size: f.size, price: f.price, compareAtPrice: f.compareAtPrice, stock: f.stock, slug: f.slug, quantity: clamp(i.quantity, f.stock) };
        })
        .filter((i) => i.quantity > 0);
    }
    case 'hydrate':
      return Array.isArray(action.items) ? action.items.filter((i) => i && i.key && i.quantity > 0) : [];
    default:
      return state;
  }
}

export const cartCount = (items) => items.reduce((n, i) => n + i.quantity, 0);
