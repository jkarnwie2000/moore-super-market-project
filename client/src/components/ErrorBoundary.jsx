import { Component } from 'react';

/** Catches unexpected render errors so one broken widget never blanks the whole store. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="container">
        <div className="empty-state empty-state--error" role="alert">
          <h2>Something went wrong</h2>
          <p>Sorry — this page hit an unexpected error. Please reload to continue shopping.</p>
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
