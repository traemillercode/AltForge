import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { api, type Job, type JobResult, type CsvUploadResponse, ApiClientError } from "../lib/api";

// Status badge component
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
      {status}
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

export default function UploadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File upload state
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Upload result state
  const [uploadResult, setUploadResult] = useState<CsvUploadResponse | null>(null);

  // Jobs list state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);

  // Load existing jobs on mount
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

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file && file.name.toLowerCase().endsWith(".csv")) {
        setSelectedFile(file);
        setUploadError(null);
        setUploadResult(null);
      } else {
        setUploadError("Only .csv files are accepted");
      }
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file) {
        setSelectedFile(file);
        setUploadError(null);
        setUploadResult(null);
      }
    }
  }, []);

  // Upload the CSV
  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      setUploadError(null);
      const result = await api.uploadCsv(selectedFile);
      setUploadResult(result);
      // Refresh jobs list
      await loadJobs();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setUploadError(err.message);
      } else {
        setUploadError("Upload failed. Please try again.");
      }
    } finally {
      setUploading(false);
    }
  };

  // Reset the upload form
  const handleReset = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-2xl font-bold text-gray-900">Upload CSV</h1>
      <p className="mt-1 text-sm text-gray-600">
        Upload a CSV file with image URLs to generate alt-text.
      </p>

      {/* Upload area */}
      <section className="mt-8" aria-labelledby="upload-heading">
        <h2 id="upload-heading" className="sr-only">CSV File Upload</h2>

        {!uploadResult ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            {/* Drag-and-drop zone */}
            <div
              className={`
                relative border-2 border-dashed rounded-lg p-12 text-center
                transition-colors duration-200
                ${dragOver ? "border-brand-500 bg-brand-50" : "border-gray-300 hover:border-gray-400"}
                ${selectedFile ? "bg-green-50 border-green-400" : ""}
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              role="region"
              aria-label="File upload area"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Choose CSV file to upload"
                id="csv-file-input"
              />

              {selectedFile ? (
                <div className="pointer-events-none">
                  <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="mt-2 text-sm font-medium text-green-700">
                    {selectedFile.name}
                  </p>
                  <p className="mt-1 text-xs text-green-600">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="pointer-events-none">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">
                    <span className="font-medium text-brand-600">Click to upload</span> or drag and drop
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    CSV files only (max 10MB, up to 5,000 URLs)
                  </p>
                </div>
              )}
            </div>

            {/* Error message */}
            {uploadError && (
              <div
                className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md"
                role="alert"
                aria-live="assertive"
              >
                <p className="text-sm text-red-700">{uploadError}</p>
              </div>
            )}

            {/* Upload button */}
            <div className="mt-6 flex justify-end gap-3">
              {selectedFile && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="inline-flex items-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-600 hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-busy={uploading}
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Uploading…
                  </>
                ) : (
                  "Upload & Preview"
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Upload result preview */
          <div className="space-y-6">
            {/* Stats cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <p className="text-sm font-medium text-gray-600">Valid URLs</p>
                <p className="mt-1 text-2xl font-bold text-green-700">{uploadResult.stats.validUrls}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <p className="text-sm font-medium text-gray-600">Skipped / Invalid</p>
                <p className="mt-1 text-2xl font-bold text-amber-700">{uploadResult.stats.invalidCount}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <p className="text-sm font-medium text-gray-600">Credit Cost</p>
                <p className="mt-1 text-2xl font-bold text-brand-700">{uploadResult.stats.costEstimate}</p>
                <p className="text-xs text-gray-500">1 credit per image</p>
              </div>
            </div>

            {/* URL list preview */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-900">
                  Image URLs ({uploadResult.results.length})
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Source: {uploadResult.job.source_filename}
                </p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image URL</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {uploadResult.results.map((result: JobResult, idx: number) => (
                      <tr key={result.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">{idx + 1}</td>
                        <td className="px-6 py-3 text-sm text-gray-900 max-w-md truncate" title={result.image_url}>
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

            {/* Action buttons */}
            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                Upload a different file
              </button>
              <button
                type="button"
                className="inline-flex items-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-600 hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2"
                onClick={() => navigate(`/jobs/${uploadResult.job.id}`)}
              >
                View Job Details
              </button>
            </div>

            <p className="text-sm text-gray-500 text-center">
              Processing will be available in the next update. Your URLs are queued and ready.
            </p>
          </div>
        )}
      </section>

      {/* Existing jobs list */}
      <section className="mt-12" aria-labelledby="jobs-heading">
        <h2 id="jobs-heading" className="text-xl font-bold text-gray-900">Your Jobs</h2>

        {jobsLoading ? (
          <div className="mt-4 flex items-center gap-3 text-gray-600" role="status">
            <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" aria-hidden="true" />
            <span className="text-sm">Loading jobs…</span>
          </div>
        ) : jobsError ? (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md" role="alert">
            <p className="text-sm text-red-700">{jobsError}</p>
            <button
              onClick={loadJobs}
              className="mt-2 text-sm text-red-800 underline hover:no-underline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              Try again
            </button>
          </div>
        ) : jobs.length === 0 ? (
          <div className="mt-4 p-8 bg-gray-50 rounded-lg border border-gray-200 text-center">
            <p className="text-gray-600">No jobs yet. Upload a CSV to get started.</p>
          </div>
        ) : (
          <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200" aria-label="Job history">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File / URL</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Images</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    tabIndex={0}
                    role="link"
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/jobs/${job.id}`); } }}
                    aria-label={`Job from ${formatDate(job.created_at)}, ${job.total_images} images, status ${job.status}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(job.created_at)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {job.source_filename || job.source_url || "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 uppercase">
                      {job.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {job.total_images}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={job.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
