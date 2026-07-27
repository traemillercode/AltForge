import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { api, type Job, type JobResult, type JobProgress, ApiClientError } from "../lib/api";

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
  const { user, refreshUser } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [results, setResults] = useState<JobResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!id) return;
    loadJob(id);
    return () => stopPolling();
  }, [id]);

  // Poll for progress while job is processing
  useEffect(() => {
    if (job?.status === "processing") {
      startPolling();
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [job?.status]);

  function startPolling() {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      if (!id) return;
      try {
        const progress: JobProgress = await api.getJobProgress(id);
        setJob((prev) =>
          prev
            ? {
                ...prev,
                status: progress.status as Job["status"],
                processed_images: progress.processed_images,
              }
            : prev
        );
        // If processing completed (or failed), do a full reload
        if (progress.status === "completed" || progress.status === "failed") {
          stopPolling();
          await refreshUser(); // refresh credits
          loadJob(id);
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 1500);
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

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

  async function handleStartProcessing() {
    if (!id || !job) return;
    setShowConfirm(false);
    setProcessing(true);
    setProcessError(null);
    try {
      const data = await api.processJob(id);
      setJob(data.job);
      setResults(data.results);
      // Polling will start via the useEffect when status changes to 'processing'
    } catch (err) {
      if (err instanceof ApiClientError) {
        setProcessError(err.message);
      } else {
        setProcessError("Failed to start processing");
      }
    } finally {
      setProcessing(false);
    }
  }

  const creditsNeeded = job ? job.total_images : 0;
  const hasEnoughCredits = user ? user.credits >= creditsNeeded : false;
  const creditsShortfall = hasEnoughCredits ? 0 : creditsNeeded - (user?.credits ?? 0);
  const isPending = job?.status === "pending";
  const isProcessing = job?.status === "processing";
  const isCompleted = job?.status === "completed";
  const isFailed = job?.status === "failed";

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

      {/* Action: Start Processing */}
      {isPending && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Ready to Process</h2>
              <p className="mt-1 text-sm text-gray-600">
                This job has <strong>{job.total_images}</strong> image{job.total_images !== 1 ? "s" : ""} waiting for alt text.
                {hasEnoughCredits
                  ? ` You have ${user.credits} credits — this will use ${creditsNeeded}.`
                  : ` You need ${creditsShortfall} more credit${creditsShortfall !== 1 ? "s" : ""}.`}
              </p>
            </div>
            <div className="flex-shrink-0">
              {hasEnoughCredits ? (
                <>
                  {processError && (
                    <p className="text-sm text-red-600 mb-2">{processError}</p>
                  )}
                  {!showConfirm ? (
                    <button
                      onClick={() => setShowConfirm(true)}
                      disabled={processing}
                      className="inline-flex items-center px-6 py-3 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      aria-label={`Start processing ${job.total_images} images`}
                    >
                      {processing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" aria-hidden="true" />
                          Starting…
                        </>
                      ) : (
                        "Start Processing"
                      )}
                    </button>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={handleStartProcessing}
                        disabled={processing}
                        className="inline-flex items-center px-6 py-3 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {processing ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" aria-hidden="true" />
                            Starting…
                          </>
                        ) : (
                          `Yes — use ${creditsNeeded} credit${creditsNeeded !== 1 ? "s" : ""}`
                        )}
                      </button>
                      <button
                        onClick={() => setShowConfirm(false)}
                        disabled={processing}
                        className="inline-flex items-center px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-gray-400 disabled:opacity-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {showConfirm && (
                    <p className="mt-2 text-xs text-gray-500">
                      This will use {creditsNeeded} of your {user.credits} credits. Continue?
                    </p>
                  )}
                </>
              ) : (
                <div className="text-right">
                  <p className="text-sm font-medium text-red-600">
                    Need {creditsShortfall} more credit{creditsShortfall !== 1 ? "s" : ""}
                  </p>
                  <button
                    disabled
                    className="mt-1 inline-flex items-center px-6 py-3 text-sm font-semibold text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed"
                    aria-disabled="true"
                  >
                    Start Processing
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Processing state banner */}
      {isProcessing && (
        <div className="mt-6 bg-blue-50 rounded-xl shadow-sm border border-blue-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin flex-shrink-0" aria-hidden="true" />
            <p className="text-sm text-blue-800">
              AI is generating alt text for your images. This page updates automatically — you can close it and come back.
            </p>
          </div>
        </div>
      )}

      {/* Completed banner */}
      {isCompleted && (
        <div className="mt-6 bg-green-50 rounded-xl shadow-sm border border-green-200 p-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-green-800">
              Processing complete! {job.processed_images} of {job.total_images} images processed.{" "}
              {job.completed_at && <>Finished {formatDate(job.completed_at)}.</>}
            </p>
          </div>
        </div>
      )}

      {/* Failed banner */}
      {isFailed && (
        <div className="mt-6 bg-red-50 rounded-xl shadow-sm border border-red-200 p-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-800">
              Processing failed. Please try processing again or contact support if the issue persists.
            </p>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {(isProcessing || isCompleted || isFailed) && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-baseline">
            <h2 className="text-lg font-semibold text-gray-900">Progress</h2>
            <span className="text-sm text-gray-600">
              {job.processed_images} of {job.total_images} images
            </span>
          </div>
          <div className="mt-3 w-full bg-gray-200 rounded-full h-2.5" role="progressbar" aria-valuenow={job.processed_images} aria-valuemin={0} aria-valuemax={job.total_images} aria-label={`${job.processed_images} of ${job.total_images} images processed`}>
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${isCompleted ? "bg-green-500" : "bg-brand-600"}`}
              style={{ width: `${job.total_images > 0 ? (job.processed_images / job.total_images) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Results table */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Images ({results.length})
          </h2>
          {(isCompleted || isProcessing) && (
            <span className="text-xs text-gray-500">
              {results.filter((r) => r.status === "compliant").length} compliant /{" "}
              {results.filter((r) => r.status === "decorative").length} decorative /{" "}
              {results.filter((r) => r.status === "needs_review").length} needs review
            </span>
          )}
        </div>
        <div className="max-h-[32rem] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200" aria-label="Image results with alt text">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">#</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image URL</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alt Text</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Chars</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {results.map((result, idx) => (
                <tr key={result.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{idx + 1}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title={result.image_url}>
                    <a
                      href={result.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:text-brand-800 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
                    >
                      {result.image_url}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-md">
                    {result.status === "needs_review" && !result.alt_text ? (
                      <span className="text-gray-400 italic">Waiting…</span>
                    ) : result.status === "decorative" ? (
                      <span className="text-gray-500 italic">(decorative — no alt text needed)</span>
                    ) : (
                      <span title={result.alt_text ?? ""}>
                        {result.alt_text}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {result.char_count > 0 ? result.char_count : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
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
