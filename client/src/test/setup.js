import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Network calls are stubbed per test; default to an empty successful JSON response.
globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
window.scrollTo = () => {};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
});
