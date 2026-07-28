import { Link } from "react-router-dom";
import { useAuth } from "../lib/useAuth";

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <h1 className="text-2xl font-bold text-gray-900">
        Dashboard
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Welcome back, {user.email}
      </p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Credit balance card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600">Credits</p>
          <p className="mt-2 text-3xl font-bold text-brand-700">
            {user.credits}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            credits remaining
          </p>
          <Link
            to="/pricing"
            className="mt-3 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 transition-colors"
          >
            Buy more credits
          </Link>
        </div>

        {/* Quick action card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600">Quick Action</p>
          <p className="mt-2 text-sm text-gray-700">
            Upload a CSV file to generate alt-text for your images.
          </p>
          <Link
            to="/upload"
            className="mt-3 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 transition-colors"
          >
            Upload CSV
          </Link>
        </div>

        {/* Pricing card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600">Need more credits?</p>
          <p className="mt-2 text-sm text-gray-700">
            Credits never expire. Purchase packs when you need them.
          </p>
          <Link
            to="/pricing"
            className="mt-3 inline-flex items-center px-4 py-2 text-sm font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded-lg hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-brand-500 transition-colors"
          >
            View pricing
          </Link>
        </div>
      </div>

      <div className="mt-8 p-6 bg-white rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Getting Started</h2>
        <ol className="mt-4 space-y-3 text-sm text-gray-700 list-decimal list-inside">
          <li>
            <Link to="/upload" className="text-brand-600 hover:text-brand-800 underline font-medium focus-visible:outline-2 focus-visible:outline-brand-500">
              Upload a CSV
            </Link>{" "}
            with your image URLs (or paste a website URL to crawl — coming soon).
          </li>
          <li>Review the extracted URLs, then click &ldquo;Start Processing&rdquo; to generate alt-text.</li>
          <li>Edit any alt-text inline, then export as CSV or ready-to-paste HTML.</li>
        </ol>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link
            to="/upload"
            className="inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-600 hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2"
          >
            Start your first job
          </Link>
        </div>
      </div>
    </div>
  );
}
