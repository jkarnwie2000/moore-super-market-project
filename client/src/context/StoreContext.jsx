import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

const StoreContext = createContext(null);

const DEFAULT_CONFIG = { currency: 'usd', taxRate: 0.07, deliveryFee: 7.99, freeDeliveryThreshold: 75, stripeEnabled: false, stripeTestMode: true };

/** Public store configuration (tax, delivery fees) and the category list. */
export function StoreProvider({ children }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    const { categories: list } = await api.get('/categories');
    setCategories(list);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.allSettled([api.get('/config'), api.get('/categories')]).then(([cfg, cats]) => {
      if (!active) return;
      if (cfg.status === 'fulfilled') setConfig({ ...DEFAULT_CONFIG, ...cfg.value });
      if (cats.status === 'fulfilled') setCategories(cats.value.categories);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      config,
      categories,
      african: categories.filter((c) => c.region === 'african'),
      caribbean: categories.filter((c) => c.region === 'caribbean'),
      loading,
      reloadCategories: loadCategories,
    }),
    [config, categories, loading, loadCategories]
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const useStore = () => useContext(StoreContext);
