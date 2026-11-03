import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="container">
      <EmptyState
        icon="search"
        title="We couldn’t find that page"
        action={
          <Link to="/" className="btn btn--primary">
            Back to the store
          </Link>
        }
      >
        The page you’re looking for may have moved. Try searching for a product instead.
      </EmptyState>
    </div>
  );
}
