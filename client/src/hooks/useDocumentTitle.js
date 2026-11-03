import { useEffect } from 'react';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | Moore Supermarket` : 'Moore Supermarket — African & Caribbean Groceries';
  }, [title]);
}
