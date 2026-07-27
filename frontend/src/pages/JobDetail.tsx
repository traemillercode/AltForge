import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { api, type Job, type JobResult, ApiClientError } from "../lib/api";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    processing: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    failed: "bg-red-100 text-red-800 border-red-200",
    needs_review: "bg-yellow-100 text-yellow-800 border-yellow-200",
    compliant: "bg-green-100 text-green-800 border-green-200",
    decorative: "bg-gray-100 text-gray-600 border-gray-200",
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

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [results, setResults] = useState<JobResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadJob(id);
  }, [id]);

  async function loadJob(jobId: string) {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getJob(jobId);
      setJob(data.job);
      setResults(data.results);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 404) {
          setError("Job not found");
        } else {
          setError(err.message);
        }
      } else {
        setError("Failed to load job");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center min-h-[40vh]" role="status">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" aria-hidden="true" />
            <p className="text-gray-600 text-sm">Loading job…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => navigate("/upload")}
            className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-brand-700 bg-brand-50 rounded-md hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            ← Back to upload
          </button>
        </div>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Back link */}
      <button
        onClick={() => navigate("/upload")}
        className="mb-6 inline-flex items-center text-sm text-brand-600 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to upload
      </button>

      <h1 className="text-2xl font-bold text-gray-900">Job Details</h1>

      {/* Job info */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm font-medium text-gray-600">Status</p>
            <p className="mt-1"><StatusBadge status={job.status} /></p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Source</p>
            <p className="mt-1 text-sm text-gray-900 truncate" title={job.source_filename || job.source_url || ""}>
              {job.source_filename || job.source_url || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Total Images</p>
            <p className="mt-1 text-sm text-gray-900">{job.total_images}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Created</p>
            <p className="mt-1 text-sm text-gray-900">{formatDate(job.created_at)}</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-baseline">
          <h2 className="text-lg font-semibold text-gray-900">Progress</h2>
          <span className="text-sm text-gray-600">
            {job.processed_images} of {job.total_images} images
          </span>
        </div>
        <div className="mt-3 w-full bg-gray-200 rounded-full h-2.5" role="progressbar" aria-valuenow={job.processed_images} aria-valuemin={0} aria-valuemax={job.total_images} aria-label="Processing progress">
          <div
            className="bg-brand-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${job.total_images > 0 ? (job.processed_images / job.total_images) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Results table */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-900">
            Images ({results.length})
          </h2>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200" aria-label="Image results">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image URL</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {results.map((result, idx) => (
                <tr key={result.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">{idx + 1}</td>
                  <td className="px-6 py-3 text-sm text-gray-900 max-w-lg truncate" title={result.image_url}>
                    {result.image_url}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <StatusBadge status={result.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
