import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { api, type JobReportData, type WcagCriteriaBreakdown, ApiClientError } from "../lib/api";

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
    ok: { label: "OK", bg: "bg-green-100", text: "text-green-800", border: "border-green-200" },
  };
  const cfg = badges[status] ?? badges.needs_review;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg!.bg} ${cfg!.text} ${cfg!.border}`}>
      {cfg!.label}
    </span>
  );
}

/** WcagCriterionBadge shows "1.1.1 ✓" or "1.1.1 ⚠" with tooltip */
function WcagCriterionBadge({ criteria }: { criteria: string[] }) {
  if (!criteria || criteria.length === 0) {
    return <span className="text-gray-400 text-xs">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {criteria.map((c, i) => {
        const isPass = c.includes("✓") || c.includes("(Decorative)");
        const isWarn = c.includes("⚠");
        return (
          <span
            key={i}
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono whitespace-nowrap ${
              isPass ? "bg-green-50 text-green-700 border border-green-200" :
              isWarn ? "bg-amber-50 text-amber-700 border border-amber-200" :
              "bg-gray-50 text-gray-600 border border-gray-200"
            }`}
            title={c}
          >
            {c}
          </span>
        );
      })}
    </div>
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
          <p className="text-gray-600 text-sm">Loading compliance report…</p>
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

  const { job, totalImages, results, skipped, creditUsage, compliance, overallGrade, wcagLevel, complianceRate, wcag_breakdown } = data;
  const sourceLabel = job.source_filename || job.source_url || "Unknown source";
  const jobTypeLabel = job.type === "crawl" ? "Website Crawl" : job.type === "csv" ? "CSV Import" : "Direct Upload";
  const reportGeneratedAt = new Date().toISOString();
  const hasResults = results.length > 0;
  const hasSkipped = skipped.length > 0;
  const generatedCount = results.length;
  const skippedCount = skipped.length;

  // Grade styling
  function getGradeStyle(grade: "Pass" | "Needs Improvement" | "Fails") {
    switch (grade) {
      case "Pass": return { bg: "bg-green-50", text: "text-green-700", border: "border-green-300", icon: "✓" };
      case "Needs Improvement": return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300", icon: "!" };
      case "Fails": return { bg: "bg-red-50", text: "text-red-700", border: "border-red-300", icon: "✗" };
    }
  }
  const gradeStyle = getGradeStyle(overallGrade);

  // Bar chart data
  const barMax = Math.max(compliance.compliant, compliance.compliant_long, compliance.needs_review, compliance.decorative, 1);

  return (
    <div className="min-h-screen bg-white print:bg-white">
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page-break { page-break-before: always; }
          .avoid-break { page-break-inside: avoid; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
          @page { margin: 1.5cm; }
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
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 print:py-4 print:px-4">
        {/* ========== HEADER ========== */}
        <header className="border-b-2 border-brand-600 pb-6 mb-8 avoid-break">
          <div className="flex items-center gap-3 mb-3">
            <img src="/logo.png" alt="" className="h-10 w-10" aria-hidden="true" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">WCAG Accessibility Compliance Report</h1>
              <p className="text-sm text-gray-500">AltForge — WCAG 2.1 Alt-Text Compliance Tool</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
            <span>Job Date: {formatDate(job.created_at)}</span>
            {job.completed_at && <span>Completed: {formatDate(job.completed_at)}</span>}
            <span>Source: <span className="font-medium text-gray-900 break-all">{sourceLabel.length > 80 ? sourceLabel.slice(0, 80) + "…" : sourceLabel}</span></span>
            <span>Type: <span className="font-medium text-gray-900">{jobTypeLabel}</span></span>
          </div>
        </header>

        {/* ========== EXECUTIVE SUMMARY ========== */}
        <section className="mb-8 avoid-break">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Executive Summary</h2>

          {/* Overall Grade banner */}
          <div className={`${gradeStyle.bg} ${gradeStyle.border} border-2 rounded-xl p-6 mb-6 flex items-center gap-4`}>
            <div className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold ${gradeStyle.text} bg-white/80 border-2 ${gradeStyle.border}`}>
              {gradeStyle.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${gradeStyle.text}`}>{overallGrade}</span>
                <span className="text-sm text-gray-500">
                  ({wcagLevel} level)
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-0.5">
                {overallGrade === "Pass" && `This page meets WCAG 2.1 ${wcagLevel} requirements for alt-text compliance.`}
                {overallGrade === "Needs Improvement" && `Partial compliance — ${compliance.needs_review} image(s) require review to meet WCAG 2.1 ${wcagLevel}.`}
                {overallGrade === "Fails" && (totalImages === 0
                  ? `No images have been processed yet. Start processing to generate a compliance report.`
                  : `This page does not meet WCAG 2.1 alt-text requirements. ${compliance.needs_review} image(s) need attention.`)}
              </p>
            </div>
          </div>

          {/* Summary cards grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <SummaryCard
              label="Total Images Analyzed"
              value={totalImages}
              sub={totalImages === 0 ? "No images processed yet" : undefined}
              color="brand"
            />
            <SummaryCard
              label="Images With Alt Text"
              value={generatedCount}
              color="green"
            />
            <SummaryCard
              label="Skipped / Already Compliant"
              value={skippedCount}
              sub={hasSkipped ? "existing alt text" : undefined}
              color="blue"
            />
            <SummaryCard
              label="Compliance Rate"
              value={`${complianceRate}%`}
              color={complianceRate >= 80 ? "green" : complianceRate >= 50 ? "amber" : "red"}
            />
            <SummaryCard
              label="Credits Used"
              value={creditUsage}
              color="gray"
            />
            <SummaryCard
              label="WCAG Level"
              value={wcagLevel}
              sub="approximate"
              color="purple"
            />
          </div>

          {/* Source info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
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
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status</p>
              <p className="mt-1 text-sm font-medium text-gray-900 capitalize">{job.status}</p>
            </div>
          </div>
        </section>

        {/* ========== WCAG STANDARDS SECTION ========== */}
        <section className="mb-8 page-break avoid-break">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">WCAG 2.1 Standards</h2>
          <div className="overflow-hidden border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200" aria-label="WCAG criteria compliance">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Criterion</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {wcag_breakdown && Object.entries(wcag_breakdown).map(([key, criterion]) => (
                  <WcagCriterionRow key={key} criterion={criterion} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ========== COMPLIANCE BREAKDOWN CHART ========== */}
        <section className="mb-8 page-break avoid-break">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Compliance Breakdown</h2>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex flex-wrap items-end gap-6 mb-6">
              {[
                { label: "Compliant", count: compliance.compliant, pct: compliance.total > 0 ? Math.round((compliance.compliant / compliance.total) * 100) : 0, color: "bg-green-500" },
                { label: "Compliant (long)", count: compliance.compliant_long, pct: compliance.total > 0 ? Math.round((compliance.compliant_long / compliance.total) * 100) : 0, color: "bg-amber-500" },
                { label: "Needs Review", count: compliance.needs_review, pct: compliance.total > 0 ? Math.round((compliance.needs_review / compliance.total) * 100) : 0, color: "bg-red-500" },
                { label: "Decorative", count: compliance.decorative, pct: compliance.total > 0 ? Math.round((compliance.decorative / compliance.total) * 100) : 0, color: "bg-gray-400" },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-2 min-w-[80px]">
                  <span className="text-2xl font-bold text-gray-900">{item.count}</span>
                  <span className="text-xs text-gray-500">{item.pct}%</span>
                  <div
                    className={`${item.color} rounded-sm w-20`}
                    style={{ height: `${Math.max((item.count / barMax) * 120, 8)}px`, minHeight: "8px" }}
                    role="img"
                    aria-label={`${item.label}: ${item.count} images (${item.pct}%)`}
                  />
                  <span className="text-xs text-gray-600 text-center">{item.label}</span>
                </div>
              ))}
            </div>
            {/* Horizontal stacked bar chart */}
            <div className="w-full bg-gray-100 rounded-full h-6 overflow-hidden">
              {compliance.total > 0 ? (
                <>
                  {compliance.compliant > 0 && (
                    <span
                      className="inline-block h-full bg-green-500"
                      style={{ width: `${(compliance.compliant / compliance.total) * 100}%` }}
                      title={`Compliant: ${compliance.compliant}`}
                    />
                  )}
                  {compliance.compliant_long > 0 && (
                    <span
                      className="inline-block h-full bg-amber-500"
                      style={{ width: `${(compliance.compliant_long / compliance.total) * 100}%` }}
                      title={`Compliant (long): ${compliance.compliant_long}`}
                    />
                  )}
                  {compliance.needs_review > 0 && (
                    <span
                      className="inline-block h-full bg-red-500"
                      style={{ width: `${(compliance.needs_review / compliance.total) * 100}%` }}
                      title={`Needs Review: ${compliance.needs_review}`}
                    />
                  )}
                  {compliance.decorative > 0 && (
                    <span
                      className="inline-block h-full bg-gray-400"
                      style={{ width: `${(compliance.decorative / compliance.total) * 100}%` }}
                      title={`Decorative: ${compliance.decorative}`}
                    />
                  )}
                </>
              ) : (
                <span className="inline-block h-full bg-gray-200 w-full" title="No results yet" />
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Pass rate:</span>
                <span className={`text-sm font-bold ${compliance.passRate >= 80 ? "text-green-600" : compliance.passRate >= 50 ? "text-amber-600" : "text-red-600"}`}>
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
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Image Details ({results.length})
            {!hasResults && <span className="text-sm font-normal text-gray-400 ml-2">— no images processed yet</span>}
          </h2>
          {hasResults ? (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200" aria-label="Image results with alt text and WCAG criteria">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-10">#</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">Thumb</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[120px]">Image URL</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[160px]">Alt Text</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-14">Chars</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-28">Status</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-40">WCAG Criteria</th>
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
                        <td className="px-3 py-2">
                          <WcagCriterionBadge criteria={result.wcag_criteria ?? []} />
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
          ) : (
            <div className="border border-gray-200 rounded-lg bg-gray-50 p-8 text-center">
              <p className="text-gray-500 text-sm">No images have been processed for this job yet.</p>
              <p className="text-gray-400 text-xs mt-1">Start the job processing to generate alt-text and see results here.</p>
            </div>
          )}
        </section>

        {/* ========== SKIPPED IMAGES SECTION ========== */}
        <section className="mb-8 page-break">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Skipped Images ({skippedCount})
          </h2>
          {hasSkipped ? (
            <>
              <p className="text-sm text-gray-500 mb-3">
                These images already had alt text and were skipped during processing. Review them for WCAG compliance.
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
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-40">WCAG Criteria</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {skipped.map((s, idx) => {
                      const existingAlt = s.existing_alt_text ?? "";
                      const needsReview = s.needs_review ?? false;

                      return (
                        <tr key={s.id}>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{idx + 1}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 max-w-[200px]">
                            <ImageThumb url={s.image_url} alt={`Skipped image ${idx + 1}`} />
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
                            {needsReview ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-red-100 text-red-800 border-red-200">
                                Needs Review
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-green-100 text-green-800 border-green-200">
                                OK
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <WcagCriterionBadge criteria={s.wcag_criteria ?? []} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="border border-gray-200 rounded-lg bg-gray-50 p-8 text-center">
              <p className="text-gray-500 text-sm">No images were skipped.</p>
              <p className="text-gray-400 text-xs mt-1">All images in this job were processed.</p>
            </div>
          )}
        </section>

        {/* ========== FOOTER ========== */}
        <footer className="border-t-2 border-gray-200 pt-6 mt-8 text-center avoid-break">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img src="/logo.png" alt="" className="h-6 w-6" aria-hidden="true" />
            <span className="text-sm font-semibold text-brand-700">AltForge</span>
          </div>
          <p className="text-xs text-gray-500">
            Generated by AltForge — WCAG 2.1 AA Compliance Tool
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Report generated {formatDate(reportGeneratedAt)} · Making the web accessible, one image at a time.
          </p>
        </footer>
      </div>
    </div>
  );
}

/** Summary card for the executive summary grid */
function SummaryCard({ label, value, sub, color }: {
  label: string;
  value: string | number;
  sub?: string;
  color: "brand" | "green" | "blue" | "amber" | "red" | "gray" | "purple";
}) {
  function getStyle(c: typeof color) {
    switch (c) {
      case "brand": return { bg: "bg-brand-50", border: "border-brand-100", labelCls: "text-brand-600", valCls: "text-brand-700" };
      case "green": return { bg: "bg-green-50", border: "border-green-100", labelCls: "text-green-600", valCls: "text-green-700" };
      case "blue": return { bg: "bg-blue-50", border: "border-blue-100", labelCls: "text-blue-600", valCls: "text-blue-700" };
      case "amber": return { bg: "bg-amber-50", border: "border-amber-100", labelCls: "text-amber-600", valCls: "text-amber-700" };
      case "red": return { bg: "bg-red-50", border: "border-red-100", labelCls: "text-red-600", valCls: "text-red-700" };
      case "gray": return { bg: "bg-gray-50", border: "border-gray-200", labelCls: "text-gray-500", valCls: "text-gray-900" };
      case "purple": return { bg: "bg-purple-50", border: "border-purple-100", labelCls: "text-purple-600", valCls: "text-purple-700" };
    }
  }
  const s = getStyle(color);
  return (
    <div className={`${s.bg} rounded-lg p-4 border ${s.border}`}>
      <p className={`text-xs font-medium uppercase tracking-wider ${s.labelCls}`}>{label}</p>
      <p className={`mt-1 text-2xl font-bold ${s.valCls}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

/** WCAG criterion row for the standards table */
function WcagCriterionRow({ criterion }: { criterion: WcagCriteriaBreakdown }) {
  const levelColors: Record<string, string> = {
    A: "bg-blue-100 text-blue-700 border-blue-200",
    AA: "bg-purple-100 text-purple-700 border-purple-200",
    AAA: "bg-green-100 text-green-700 border-green-200",
  };
  const levelStyle = levelColors[criterion.level] ?? levelColors.A;

  const pass = criterion.pass ?? 0;
  const fail = criterion.fail ?? 0;
  const flagged = criterion.flagged ?? 0;
  const total = pass + fail;
  const passPct = total > 0 ? Math.round((pass / total) * 100) : 0;

  // Determine status
  let statusLabel: string;
  let statusBg: string;
  if (flagged !== undefined) {
    // This is 1.4.5 — flag-based
    if (flagged === 0) {
      statusLabel = "No flags";
      statusBg = "bg-green-100 text-green-700 border-green-200";
    } else {
      statusLabel = `${flagged} flagged`;
      statusBg = "bg-amber-100 text-amber-700 border-amber-200";
    }
  } else if (total === 0) {
    statusLabel = "N/A";
    statusBg = "bg-gray-100 text-gray-500 border-gray-200";
  } else if (passPct >= 85) {
    statusLabel = `${passPct}% pass`;
    statusBg = "bg-green-100 text-green-700 border-green-200";
  } else if (passPct >= 50) {
    statusLabel = `${passPct}% pass`;
    statusBg = "bg-amber-100 text-amber-700 border-amber-200";
  } else {
    statusLabel = `${passPct}% pass`;
    statusBg = "bg-red-100 text-red-700 border-red-200";
  }

  // Details string
  let details: string;
  if (flagged !== undefined) {
    details = `${flagged} image(s) flagged as potentially containing text`;
  } else if (total === 0) {
    details = "No images to evaluate";
  } else {
    details = `${pass} pass, ${fail} need review`;
  }

  return (
    <tr>
      <td className="px-4 py-3">
        <span className="text-sm font-medium text-gray-900">{criterion.name}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${levelStyle}`}>
          Level {criterion.level}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusBg}`}>
          {statusLabel}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {details}
        <p className="text-xs text-gray-400 mt-0.5">{criterion.description}</p>
      </td>
    </tr>
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
