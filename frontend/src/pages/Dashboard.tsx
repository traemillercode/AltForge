import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { api, type Job, ApiClientError } from "../lib/api";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    processing: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    failed: "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[status] || "bg-gray-100 text-gray-800 border-gray-200"}`}
      role="status"
    >
      {status.replace("_", " ")}
    </span>
  );
}

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
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    try {
      setJobsLoading(true);
      setJobsError(null);
      const data = await api.getJobs();
      setJobs(data.jobs);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setJobsError(err.message);
      } else {
        setJobsError("Failed to load jobs");
      }
    } finally {
      setJobsLoading(false);
    }
  }

  async function handleDeleteJob(jobId: string) {
    if (!window.confirm("Are you sure you want to delete this pending job? This cannot be undone.")) {
      return;
    }
    try {
      setDeletingId(jobId);
      await api.deleteJob(jobId);
      // Remove from local state
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (err) {
      if (err instanceof ApiClientError) {
        alert(err.message);
      } else {
        alert("Failed to delete job. Please try again.");
      }
    } finally {
      setDeletingId(null);
    }
  }

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

      {/* Jobs section */}
      <section className="mt-10" aria-labelledby="dashboard-jobs-heading">
        <div className="flex items-center justify-between">
          <h2 id="dashboard-jobs-heading" className="text-xl font-bold text-gray-900">Your Recent Jobs</h2>
          <Link
            to="/upload"
            className="text-sm font-medium text-brand-600 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            + New Job
          </Link>
        </div>

        {jobsLoading ? (
          <div className="mt-4 flex items-center gap-3 text-gray-600" role="status">
            <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" aria-hidden="true" />
            <span className="text-sm">Loading jobs…</span>
          </div>
        ) : jobsError ? (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md" role="alert">
            <p className="text-sm text-red-700">{jobsError}</p>
            <button onClick={loadJobs} className="mt-2 text-sm text-red-800 underline hover:no-underline focus-visible:outline-2 focus-visible:outline-brand-500">Try again</button>
          </div>
        ) : jobs.length === 0 ? (
          <div className="mt-4 p-8 bg-gray-50 rounded-lg border border-gray-200 text-center">
            <p className="text-gray-600">No jobs yet.</p>
            <Link to="/upload" className="mt-2 inline-block text-sm text-brand-600 hover:text-brand-800 underline focus-visible:outline-2 focus-visible:outline-brand-500">
              Create your first job
            </Link>
          </div>
        ) : (
          <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden table-responsive">
            <table className="min-w-full divide-y divide-gray-200" aria-label="Your jobs">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Images</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <Link to={`/jobs/${job.id}`} className="text-brand-600 hover:text-brand-800 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500">
                        {formatDate(job.created_at)}
                      </Link>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-900 max-w-[150px] sm:max-w-xs truncate">{job.source_filename || job.source_url || "—"}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600 uppercase">{job.type}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{job.total_images}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap"><StatusBadge status={job.status} /></td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      {job.status === "pending" ? (
                        <button
                          onClick={() => handleDeleteJob(job.id)}
                          disabled={deletingId === job.id}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-red-500 transition-colors"
                          aria-label={`Delete pending job from ${formatDate(job.created_at)}`}
                          aria-busy={deletingId === job.id}
                        >
                          {deletingId === job.id ? (
                            <>
                              <div className="w-3 h-3 border-2 border-red-200 border-t-red-600 rounded-full animate-spin mr-1" aria-hidden="true" />
                              Deleting…
                            </>
                          ) : (
                            "Delete"
                          )}
                        </button>
                      ) : (
                        <Link
                          to={`/jobs/${job.id}`}
                          className="text-xs text-brand-600 hover:text-brand-800 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
                        >
                          View
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
