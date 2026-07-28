import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { api, type JobReportData, ApiClientError } from "../lib/api";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getComplianceStatus(altText: string): "decorative" | "compliant" | "compliant-long" | "needs_review" {
  if (altText === "") return "decorative";
  const chars = altText.length;
  if (chars > 250) return "needs_review";
  if (chars > 125) return "compliant-long";
  return "compliant";
}

function ComplianceBadge({ status }: { status: string }) {
  const badges: Record<string, { label: string; bg: string; text: string; border: string }> = {
    compliant: { label: "Compliant", bg: "bg-green-100", text: "text-green-800", border: "border-green-200" },
    "compliant-long": { label: "Compliant (long)", bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-200" },
    needs_review: { label: "Needs Review", bg: "bg-red-100", text: "text-red-800", border: "border-red-200" },
    decorative: { label: "Decorative", bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-200" },
  };
  const cfg = badges[status] ?? badges.needs_review;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg!.bg} ${cfg!.text} ${cfg!.border}`}>
      {cfg!.label}
    </span>
  );
}

export default function JobReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState<JobReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadReport(id);
  }, [id]);

  async function loadReport(jobId: string) {
    try {
      setLoading(true);
      setError(null);
      const report = await api.getJobReport(jobId);
      setData(report);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 404) setError("Job not found");
        else setError(err.message);
      } else {
        setError("Failed to load report data");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3" role="status">
          <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" aria-hidden="true" />
          <p className="text-gray-600 text-sm">Loading report…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "Report not available"}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-brand-700 bg-brand-50 rounded-md hover:bg-brand-100"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { job, totalImages, results, skipped, creditUsage, compliance } = data;
  const sourceLabel = job.source_filename || job.source_url || "Unknown source";
  const jobTypeLabel = job.type === "crawl" ? "Website Crawl" : job.type === "csv" ? "CSV Import" : "Direct Upload";
  const reportGeneratedAt = new Date().toISOString();

  // Bar chart data for compliance
  const barMax = Math.max(compliance.compliant, compliance.compliant_long, compliance.needs_review, compliance.decorative, 1);

  return (
    <div className="min-h-screen bg-white print:bg-white">
      {/* Print-only: hide buttons/links when printing */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page-break { page-break-before: always; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
      `}</style>

      {/* Top bar — hidden when printing */}
      <div className="no-print bg-gray-50 border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate(`/jobs/${id}`)}
          className="inline-flex items-center text-sm text-brand-600 hover:text-brand-800"
        >
          <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Job
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700"
        >
          <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print / Save PDF
        </button>
      </div>

      {/* Report content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 print:py-4 print:px-8">
        {/* ========== HEADER ========== */}
        <header className="border-b-2 border-brand-600 pb-6 mb-8">
          <div className="flex items-center gap-3 mb-3">
            <img src="/logo.png" alt="" className="h-10 w-10" aria-hidden="true" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Accessibility Report</h1>
              <p className="text-sm text-gray-500">AltForge — WCAG 2.1 Alt-Text Compliance</p>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            Generated on {formatDate(job.created_at)}
            {job.completed_at && <> · Completed {formatDate(job.completed_at)}</>}
          </p>
        </header>

        {/* ========== SOURCE INFO ========== */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Source Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Source</p>
              <p className="mt-1 text-sm font-medium text-gray-900 break-all" title={sourceLabel}>
                {sourceLabel.length > 60 ? sourceLabel.slice(0, 60) + "…" : sourceLabel}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Job Type</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{jobTypeLabel}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Images Found</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{totalImages}</p>
            </div>
          </div>
        </section>

        {/* ========== SUMMARY STATS CARDS ========== */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Summary</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-brand-50 rounded-lg p-4 border border-brand-100">
              <p className="text-xs font-medium text-brand-600 uppercase tracking-wider">Total Images</p>
              <p className="mt-1 text-2xl font-bold text-brand-700">{totalImages}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-100">
              <p className="text-xs font-medium text-green-600 uppercase tracking-wider">Alt Text Generated</p>
              <p className="mt-1 text-2xl font-bold text-green-700">{creditUsage}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">Skipped</p>
              <p className="mt-1 text-2xl font-bold text-blue-700">{skipped.length}</p>
              <p className="mt-0.5 text-xs text-blue-400">had existing alt text</p>
            </div>
            <div className={`rounded-lg p-4 border ${compliance.passRate >= 80 ? "bg-green-50 border-green-100" : compliance.passRate >= 50 ? "bg-amber-50 border-amber-100" : "bg-red-50 border-red-100"}`}>
              <p className={`text-xs font-medium uppercase tracking-wider ${compliance.passRate >= 80 ? "text-green-600" : compliance.passRate >= 50 ? "text-amber-600" : "text-red-600"}`}>
                Pass Rate
              </p>
              <p className={`mt-1 text-2xl font-bold ${compliance.passRate >= 80 ? "text-green-700" : compliance.passRate >= 50 ? "text-amber-700" : "text-red-700"}`}>
                {compliance.passRate}%
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Credits Used</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{creditUsage}</p>
            </div>
          </div>
        </section>

        {/* ========== COMPLIANCE BREAKDOWN ========== */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Compliance Breakdown</h2>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex flex-wrap items-end gap-6">
              {[
                { label: "Compliant", count: compliance.compliant, color: "bg-green-500" },
                { label: "Compliant (long)", count: compliance.compliant_long, color: "bg-amber-500" },
                { label: "Needs Review", count: compliance.needs_review, color: "bg-red-500" },
                { label: "Decorative", count: compliance.decorative, color: "bg-gray-400" },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-2 min-w-[80px]">
                  <span className="text-2xl font-bold text-gray-900">{item.count}</span>
                  <div
                    className={`${item.color} rounded-sm w-16`}
                    style={{ height: `${Math.max((item.count / barMax) * 100, 4)}px`, minHeight: "8px" }}
                    role="img"
                    aria-label={`${item.label}: ${item.count} images`}
                  />
                  <span className="text-xs text-gray-600 text-center">{item.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Overall pass rate:</span>
                <span className={`text-sm font-bold ${compliance.passRate >= 80 ? "text-green-600" : "text-amber-600"}`}>
                  {compliance.passRate}%
                </span>
                <span className="text-xs text-gray-400">
                  ({compliance.compliant + compliance.compliant_long + compliance.decorative} of {compliance.total} images pass)
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ========== IMAGE DETAIL TABLE ========== */}
        <section className="mb-8 page-break">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Image Details ({results.length})</h2>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200" aria-label="Image results with alt text">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-10">#</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">Thumb</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[120px]">Image URL</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[160px]">Alt Text</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-14">Chars</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-28">Status</th>
                  {job.type === "crawl" && (
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[120px]">Source Page</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {results.map((result, idx) => {
                  const altText = result.alt_text ?? "";
                  const displayStatus = result.status === "compliant"
                    ? getComplianceStatus(altText)
                    : result.status;
                  const charCount = altText.length || result.char_count;

                  return (
                    <tr key={result.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <ImageThumb url={result.image_url} alt={altText || `Image ${idx + 1}`} />
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 max-w-[200px]">
                        <a
                          href={result.image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-600 hover:text-brand-800 break-all text-xs"
                        >
                          {result.image_url.startsWith("data:") ? "[base64 image]" : truncateUrl(result.image_url)}
                        </a>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 max-w-[300px] break-words">
                        {altText || <span className="text-gray-400 italic">(empty)</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{charCount || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <ComplianceBadge status={displayStatus} />
                      </td>
                      {job.type === "crawl" && (
                        <td className="px-3 py-2 text-xs text-gray-500 max-w-[150px]">
                          {result.source_page_url ? (
                            <a href={result.source_page_url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:text-brand-800 break-all">
                              {truncateUrl(result.source_page_url)}
                            </a>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ========== SKIPPED IMAGES SECTION ========== */}
        {skipped.length > 0 && (
          <section className="mb-8 page-break">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Skipped Images ({skipped.length})</h2>
            <p className="text-sm text-gray-500 mb-3">
              These images already had alt text and were skipped during processing.
            </p>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200" aria-label="Skipped images with existing alt text">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-10">#</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[120px]">Image URL</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[160px]">Existing Alt Text</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[120px]">Source Page</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-28">Flagged for Review</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {skipped.map((s, idx) => {
                    const existingAlt = s.existing_alt_text ?? "";
                    const isGeneric = /^(image|photo|picture|graphic|logo|banner|icon|button|placeholder|spacer|img|\d+)$/i.test(existingAlt.trim());

                    return (
                      <tr key={s.id}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{idx + 1}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 max-w-[200px]">
                          <a href={s.image_url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:text-brand-800 break-all text-xs">
                            {truncateUrl(s.image_url)}
                          </a>
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900 max-w-[300px] break-words">
                          {existingAlt || <span className="text-gray-400 italic">(empty alt)</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500 max-w-[150px]">
                          {s.source_page_url ? (
                            <a href={s.source_page_url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:text-brand-800 break-all">
                              {truncateUrl(s.source_page_url)}
                            </a>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {isGeneric ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-red-100 text-red-800 border-red-200">
                              Needs Review
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-green-100 text-green-800 border-green-200">
                              OK
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ========== FOOTER ========== */}
        <footer className="border-t-2 border-gray-200 pt-6 mt-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img src="/logo.png" alt="" className="h-6 w-6" aria-hidden="true" />
            <span className="text-sm font-semibold text-brand-700">AltForge</span>
          </div>
          <p className="text-xs text-gray-500">
            Making the web accessible, one image at a time.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Report generated {formatDate(reportGeneratedAt)} · AltForge WCAG 2.1 Alt-Text Compliance Tool
          </p>
        </footer>
      </div>
    </div>
  );
}

/** Renders a small thumbnail image preview, with error fallback */
function ImageThumb({ url, alt }: { url: string; alt: string }) {
  const [error, setError] = useState(false);

  if (error || url.startsWith("data:")) {
    return (
      <div className="w-12 h-12 rounded border border-gray-200 bg-gray-100 flex items-center justify-center" title="Preview not available">
        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className="w-12 h-12 object-cover rounded border border-gray-200"
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}

/** Truncate a URL for display */
function truncateUrl(url: string): string {
  if (url.length <= 50) return url;
  try {
    const u = new URL(url);
    const path = u.pathname.length > 20 ? u.pathname.slice(0, 20) + "…" : u.pathname;
    return `${u.hostname}${path}`;
  } catch {
    return url.slice(0, 50) + "…";
  }
}
