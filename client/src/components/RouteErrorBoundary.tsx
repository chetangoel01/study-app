import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';

export function RouteErrorBoundary() {
  const error = useRouteError();

  const message = isRouteErrorResponse(error)
    ? error.data?.error ?? error.statusText ?? 'This page did not load correctly.'
    : error instanceof Error
      ? error.message
      : 'Something went wrong while rendering this page.';

  return (
    <div className="route-error-page">
      <div className="route-error-card surface-card">
        <p className="panel-label">Unexpected Detour</p>
        <h1>That page fell over.</h1>
        <p className="page-muted">
          The app hit a rendering problem before it could finish loading.
          You can head back to the dashboard or try the previous page again.
        </p>
        <div className="route-error-message" role="alert">
          {message}
        </div>
        <div className="route-error-actions">
          <Link to="/" className="primary-action">Back to Dashboard</Link>
          <Link to="/settings/profile" className="secondary-link">Open Settings</Link>
        </div>
      </div>
    </div>
  );
}
