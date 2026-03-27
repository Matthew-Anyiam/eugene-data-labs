import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-32">
      <h1 className="text-6xl font-bold tabular-nums text-slate-200 dark:text-slate-800">404</h1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">Page not found</p>
      <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
      >
        Back to home
      </Link>
    </div>
  );
}
