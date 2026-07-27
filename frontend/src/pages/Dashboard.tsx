import { useAuth } from "../lib/useAuth";

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {user.email}
        </h1>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Credit balance card */}
          <div className="bg-brand-50 rounded-lg border border-brand-200 p-6">
            <p className="text-sm font-medium text-brand-700">Credits</p>
            <p className="mt-2 text-3xl font-bold text-brand-900">
              {user.credits}
            </p>
            <p className="mt-1 text-sm text-brand-600">
              free credits remaining
            </p>
          </div>

          {/* Placeholder cards */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
            <p className="text-sm font-medium text-gray-600">Jobs</p>
            <p className="mt-2 text-3xl font-bold text-gray-400">—</p>
            <p className="mt-1 text-sm text-gray-500">
              No jobs yet
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
            <p className="text-sm font-medium text-gray-600">Images Processed</p>
            <p className="mt-2 text-3xl font-bold text-gray-400">—</p>
            <p className="mt-1 text-sm text-gray-500">
              Upload a CSV or crawl a site
            </p>
          </div>
        </div>

        <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200 text-center">
          <p className="text-gray-600">
            Alt-text generation will be available in the next update.
          </p>
        </div>
      </div>
    </div>
  );
}
