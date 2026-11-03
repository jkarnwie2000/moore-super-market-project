import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import { api } from '../services/api';
import { cartCount, cartReducer } from '../utils/cartLogic';

const CartContext = createContext(null);
export const CART_STORAGE_KEY = 'moore_cart_v1';

function loadStoredCart() {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    return cartReducer([], { type: 'hydrate', items: raw ? JSON.parse(raw) : [] });
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, dispatch] = useReducer(cartReducer, undefined, loadStoredCart);
  const [syncNotice, setSyncNotice] = useState('');

  // Persist on every change so a refresh never loses the cart.
  useEffect(() => {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable (private mode) — cart still works for this session */
    }
  }, [items]);

  // Refresh persisted prices and stock from the server.
  const refresh = useCallback(async (current) => {
    if (!current.length) return;
    try {
      const { items: lines } = await api.post('/cart/validate', {
        items: current.map((i) => ({ productId: i.productId, variantId: i.variantId })),
      });
      const changed = lines.some((l) => {
        const i = current.find((c) => c.productId === l.productId && c.variantId === l.variantId);
        return !l.available || !i || l.price !== i.price || l.stock < i.quantity;
      });
      dispatch({ type: 'sync', lines });
      if (changed) setSyncNotice('Some items in your cart were updated to reflect current prices and stock.');
    } catch {
      /* offline — keep the stored cart */
    }
  }, []);

  useEffect(() => {
    refresh(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      items,
      count: cartCount(items),
      add: (product, variant, quantity = 1) => dispatch({ type: 'add', product, variant, quantity }),
      setQuantity: (key, quantity) => dispatch({ type: 'setQuantity', key, quantity }),
      remove: (key) => dispatch({ type: 'remove', key }),
      clear: () => dispatch({ type: 'clear' }),
      quantityOf: (productId, variantId) => items.find((i) => i.productId === productId && i.variantId === variantId)?.quantity || 0,
      refresh: () => refresh(items),
      syncNotice,
      dismissSyncNotice: () => setSyncNotice(''),
    }),
    [items, refresh, syncNotice]
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
