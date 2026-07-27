import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { api, type Job } from "../lib/api";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentJobs();
  }, []);

  async function loadRecentJobs() {
    try {
      setLoading(true);
      const data = await api.getJobs();
      setRecentJobs(data.jobs.slice(0, 5));
    } catch (_err) {
      // Dashboard is non-critical — silently fail
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  const jobCount = recentJobs.length;
  const totalImages = recentJobs.reduce((sum, j) => sum + j.total_images, 0);

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

          {/* Jobs card */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
            <p className="text-sm font-medium text-gray-600">Jobs</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {loading ? "—" : jobCount}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {jobCount === 0 ? "No jobs yet" : `${totalImages} total images`}
            </p>
          </div>

          {/* Quick action card */}
          <Link
            to="/upload"
            className="bg-brand-50 rounded-lg border border-brand-200 p-6 hover:bg-brand-100 transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 block"
          >
            <p className="text-sm font-medium text-brand-700">New Job</p>
            <p className="mt-2 text-3xl font-bold text-brand-900">+</p>
            <p className="mt-1 text-sm text-brand-600">
              Upload a CSV
            </p>
          </Link>
        </div>

        {/* Recent jobs */}
        <div className="mt-8">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Recent Jobs</h2>
            {recentJobs.length > 0 && (
              <Link
                to="/upload"
                className="text-sm text-brand-600 hover:text-brand-800 font-medium"
              >
                View all jobs →
              </Link>
            )}
          </div>

          {loading ? (
            <div className="mt-4 flex items-center gap-3 text-gray-600" role="status">
              <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" aria-hidden="true" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : recentJobs.length === 0 ? (
            <div className="mt-4 p-8 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <p className="text-gray-600 mb-4">
                No jobs yet. Upload a CSV to start generating alt-text.
              </p>
              <Link
                to="/upload"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-600 hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2"
              >
                Upload CSV
              </Link>
            </div>
          ) : (
            <div className="mt-4 bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200" aria-label="Recent jobs">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Images</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(job.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                        {job.source_filename || job.source_url || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {job.total_images}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          job.status === "completed" ? "bg-green-100 text-green-800 border-green-200" :
                          job.status === "processing" ? "bg-blue-100 text-blue-800 border-blue-200" :
                          job.status === "failed" ? "bg-red-100 text-red-800 border-red-200" :
                          "bg-yellow-100 text-yellow-800 border-yellow-200"
                        }`} role="status">
                          {job.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
