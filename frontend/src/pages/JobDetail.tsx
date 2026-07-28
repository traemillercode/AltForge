import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { api, type Job, type JobResult, type JobProgress, type SkippedResult, ApiClientError } from "../lib/api";

function getComplianceStatus(altText: string): "decorative" | "compliant" | "compliant-long" | "needs_review" {
  if (altText === "") return "decorative";
  const chars = altText.length;
  if (chars > 250) return "needs_review";
  if (chars > 125) return "compliant-long";
  return "compliant";
}

function ComplianceBadge({ status }: { status: string }) {
  const badges = {
    compliant: {
      label: "Compliant",
      bg: "bg-green-100",
      text: "text-green-800",
      border: "border-green-200",
    },
    "compliant-long": {
      label: "Compliant (long)",
      bg: "bg-amber-100",
      text: "text-amber-800",
      border: "border-amber-200",
    },
    needs_review: {
      label: "Needs Review",
      bg: "bg-red-100",
      text: "text-red-800",
      border: "border-red-200",
    },
    decorative: {
      label: "Decorative",
      bg: "bg-gray-100",
      text: "text-gray-600",
      border: "border-gray-200",
    },
    processing: {
      label: "Processing",
      bg: "bg-blue-100",
      text: "text-blue-800",
      border: "border-blue-200",
    },
  } as const;

  const cfg = badges[status as keyof typeof badges] ?? badges.needs_review;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}
      role="status"
    >
      {cfg.label}
    </span>
  );
}

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

interface EditableAltCellProps {
  result: JobResult;
  jobId: string;
  onSaved: (updated: { id: string; alt_text: string; char_count: number; status: string }) => void;
}

function EditableAltCell({ result, jobId, onSaved }: EditableAltCellProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(result.alt_text ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const altText = result.alt_text ?? "";
  const isLong = altText.length > 100;
  const displayText = expanded || !isLong ? altText : altText.slice(0, 100) + "…";

  const currentStatus = editing
    ? getComplianceStatus(value)
    : getComplianceStatus(result.alt_text ?? "");

  // Show saved confirmation briefly then fade
  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [saved]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    // If unchanged, just cancel
    if (value === (result.alt_text ?? "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateResult(jobId, result.id, value);
      setEditing(false);
      setSaved(true);
      onSaved(updated);
    } catch {
      // Revert on error
      setValue(result.alt_text ?? "");
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [value, result, jobId, saving, onSaved]);

  const handleCancel = useCallback(() => {
    setValue(result.alt_text ?? "");
    setEditing(false);
  }, [result.alt_text]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        handleCancel();
      }
    },
    [handleSave, handleCancel]
  );

  if (editing) {
    return (
      <div className="flex flex-col gap-1">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          disabled={saving}
          rows={3}
          className="w-full min-w-[16rem] px-2 py-1 text-sm border border-brand-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-y"
          aria-label="Edit alt text"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-500">{value.length} chars</span>
          <div className="flex gap-1">
            <button
              onMouseDown={(e) => { e.preventDefault(); handleSave(); }}
              disabled={saving}
              className="px-2 py-0.5 text-xs font-medium text-white bg-brand-600 rounded hover:bg-brand-700 disabled:opacity-50"
              aria-label="Save alt text"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); handleCancel(); }}
              disabled={saving}
              className="px-2 py-0.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
              aria-label="Cancel editing"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Display mode
  if (result.status === "needs_review" && !result.alt_text && result.alt_text !== "") {
    return (
      <button
        onClick={() => { setValue(""); setEditing(true); }}
        className="text-left text-gray-400 italic hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-brand-500 cursor-text w-full"
        aria-label="Click to add alt text"
      >
        Waiting…
      </button>
    );
  }

  if (currentStatus === "decorative" || result.status === "decorative") {
    return (
      <button
        onClick={() => { setValue(result.alt_text ?? ""); setEditing(true); }}
        className="text-left text-gray-500 italic hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-brand-500 cursor-text w-full"
        aria-label="Click to edit alt text"
      >
        (decorative — no alt text needed)
      </button>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-start gap-1">
        <button
          onClick={() => { setValue(result.alt_text ?? ""); setEditing(true); }}
          className="text-left text-gray-900 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 cursor-text break-words flex-1"
          title="Click to edit"
          aria-label={`Click to edit alt text: ${result.alt_text}`}
        >
          {displayText}
        </button>
        {isLong && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="flex-shrink-0 text-xs text-brand-600 hover:text-brand-800 underline focus-visible:outline-2 focus-visible:outline-brand-500 mt-0.5"
            aria-label={expanded ? "Show less" : "Show more"}
            aria-expanded={expanded}
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
      {saved && (
        <span className="absolute -top-4 right-0 text-xs text-green-600 font-medium animate-pulse">
          ✓ Saved
        </span>
      )}
    </div>
  );
}

interface SkippedRowProps {
  skipped: SkippedResult;
  index: number;
  isGenerating: boolean;
  isCopied: boolean;
  anyGenerating: boolean;
  onCopy: (altText: string | null, skipId: number) => void;
  onGenerate: (skipId: number) => void;
}

function SkippedRow({ skipped, index, isGenerating, isCopied, anyGenerating, onCopy, onGenerate }: SkippedRowProps) {
  const [expandedAlt, setExpandedAlt] = useState(false);
  const altText = skipped.existing_alt_text ?? "";
  const isLong = altText.length > 100;
  const displayAlt = expandedAlt || !isLong ? altText : altText.slice(0, 100) + "…";

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
      <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
        {skipped.source_page_url ? (
          <a
            href={skipped.source_page_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-800 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 truncate block"
            title={skipped.source_page_url}
          >
            <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span className="truncate">{skipped.source_page_url}</span>
          </a>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
        <a
          href={skipped.image_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-600 hover:text-brand-800 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 truncate block"
        >
          {skipped.image_url}
        </a>
      </td>
      <td className="px-4 py-3 text-sm text-gray-900 max-w-md">
        {altText ? (
          <div className="flex items-start gap-1">
            <span className="break-words flex-1">{displayAlt}</span>
            {isLong && (
              <button
                onClick={() => setExpandedAlt(!expandedAlt)}
                className="flex-shrink-0 text-xs text-brand-600 hover:text-brand-800 underline focus-visible:outline-2 focus-visible:outline-brand-500 mt-0.5"
                aria-label={expandedAlt ? "Show less" : "Show more"}
                aria-expanded={expandedAlt}
              >
                {expandedAlt ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        ) : (
          <span className="text-gray-400 italic">(empty alt)</span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          {altText && (
            <button
              onClick={() => onCopy(altText, skipped.id)}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-brand-500 transition-colors"
              aria-label={`Copy alt text for image ${index + 1}`}
              title="Copy alt text to clipboard"
            >
              {isCopied ? (
                <>
                  <svg className="h-3 w-3 mr-0.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="h-3 w-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          )}
          {!isGenerating ? (
            <button
              onClick={() => onGenerate(skipped.id)}
              disabled={anyGenerating}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded hover:bg-brand-100 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-brand-500 transition-colors"
              title="Generate AI alt text (costs 1 credit)"
              aria-label={`Generate alt text for image ${index + 1}`}
            >
              <svg className="h-3 w-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate
            </button>
          ) : (
            <span className="inline-flex items-center text-xs text-gray-500" role="status">
              <div className="w-3 h-3 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin mr-1" aria-hidden="true" />
              Generating…
            </span>
          )}
        </div>
      </td>
    </tr>
  );
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
  const [showExportMenu, setShowExportMenu] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Skipped images state
  const [skipped, setSkipped] = useState<SkippedResult[]>([]);
  const [skippedLoading, setSkippedLoading] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const [generatingSkippedId, setGeneratingSkippedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

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

  // Close export menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    if (showExportMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showExportMenu]);

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
        if (progress.status === "completed" || progress.status === "failed") {
          stopPolling();
          await refreshUser();
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

      // Load skipped images for crawl jobs
      if (data.job.type === "crawl") {
        loadSkipped(jobId);
      }
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

  async function loadSkipped(jobId: string) {
    try {
      setSkippedLoading(true);
      const data = await api.getSkippedResults(jobId);
      setSkipped(data.skipped);
    } catch {
      // Silently fail — skipped images are non-critical
      setSkipped([]);
    } finally {
      setSkippedLoading(false);
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

  function handleResultSaved(updated: { id: string; alt_text: string; char_count: number; status: string }) {
    setResults((prev) =>
      prev.map((r) =>
        r.id === updated.id
          ? {
              ...r,
              alt_text: updated.alt_text,
              char_count: updated.char_count,
              status: updated.status as JobResult["status"],
            }
          : r
      )
    );
  }

  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  async function handleRegenerate(resultId: string) {
    if (!id || regeneratingId) return;
    setRegeneratingId(resultId);
    try {
      const updated = await api.regenerateResult(id, resultId);
      handleResultSaved(updated);
      await refreshUser();
    } catch (err) {
      if (err instanceof ApiClientError) {
        alert(err.message);
      } else {
        alert("Regeneration failed. Please try again.");
      }
    } finally {
      setRegeneratingId(null);
    }
  }

  async function handleCopySkipped(altText: string | null, skipId: number) {
    try {
      await navigator.clipboard.writeText(altText ?? "");
      setCopiedId(skipId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard API may not be available
      const textArea = document.createElement("textarea");
      textArea.value = altText ?? "";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedId(skipId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  async function handleGenerateSkipped(skipId: number) {
    if (!id || generatingSkippedId) return;
    setGeneratingSkippedId(skipId);
    try {
      const newResult = await api.generateSkipped(id, skipId);
      // Add the new result to the results list
      setResults((prev) => [
        ...prev,
        {
          id: newResult.id,
          job_id: newResult.job_id,
          image_url: newResult.image_url,
          alt_text: newResult.alt_text,
          char_count: newResult.char_count,
          status: newResult.status as JobResult["status"],
          context_text: null,
          source_page_url: newResult.source_page_url,
          created_at: new Date().toISOString(),
        },
      ]);
      // Remove from skipped list
      setSkipped((prev) => prev.filter((s) => s.id !== skipId));
      await refreshUser();
    } catch (err) {
      if (err instanceof ApiClientError) {
        alert(err.message);
      } else {
        alert("Generation failed. Please try again.");
      }
    } finally {
      setGeneratingSkippedId(null);
    }
  }

  function handleExportSkippedCsv() {
    if (skipped.length === 0) return;
    // Build CSV: image_url, source_page_url, existing_alt_text
    const header = "image_url,source_page_url,existing_alt_text";
    const rows = skipped.map((s) => {
      const escapeField = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
      return `${escapeField(s.image_url)},${escapeField(s.source_page_url)},${escapeField(s.existing_alt_text)}`;
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `altforge-skipped-${id ?? "export"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleExport(format: "csv" | "html") {
    if (!id) return;
    setShowExportMenu(false);
    // Trigger download by navigating to the export URL
    window.open(api.getExportUrl(id, format), "_blank");
  }

  const creditsNeeded = job ? job.total_images : 0;
  const hasEnoughCredits = user ? user.credits >= creditsNeeded : false;
  const creditsShortfall = hasEnoughCredits ? 0 : creditsNeeded - (user?.credits ?? 0);
  const isPending = job?.status === "pending";
  const isProcessing = job?.status === "processing";
  const isCompleted = job?.status === "completed";
  const isFailed = job?.status === "failed";

  // Compute compliance summary
  const compliantCount = results.filter((r) => r.status === "compliant").length;
  const decorativeCount = results.filter((r) => r.status === "decorative").length;
  const needsReviewCount = results.filter((r) => r.status === "needs_review").length;

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

  const canExport = isCompleted || (isProcessing && results.some((r) => r.status !== "needs_review"));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
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
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4">
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
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
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
                      className="inline-flex items-center justify-center w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                        className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                        className="inline-flex items-center justify-center px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-gray-400 disabled:opacity-50 transition-colors"
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
                <div className="text-center sm:text-right">
                  <p className="text-sm font-medium text-red-600">
                    Need {creditsShortfall} more credit{creditsShortfall !== 1 ? "s" : ""}
                  </p>
                  <button
                    disabled
                    className="mt-1 inline-flex items-center justify-center w-full sm:w-auto px-6 py-3 text-sm font-semibold text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed"
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
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
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
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">
            Images ({results.length})
          </h2>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Compliance summary */}
            {(isCompleted || isProcessing) && (
              <span className="text-xs text-gray-500">
                {compliantCount} compliant · {decorativeCount} decorative · {needsReviewCount} need review
              </span>
            )}
            {/* Export button */}
            {canExport && (
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded-md hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-brand-500 transition-colors"
                  aria-expanded={showExportMenu}
                  aria-haspopup="true"
                >
                  <svg className="mr-1 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export
                  <svg className="ml-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-1" role="menu">
                    <button
                      onClick={() => handleExport("csv")}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      role="menuitem"
                    >
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      CSV
                    </button>
                    <button
                      onClick={() => handleExport("html")}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      role="menuitem"
                    >
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                      HTML
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="max-h-[32rem] overflow-y-auto table-responsive">
          <table className="min-w-full divide-y divide-gray-200" aria-label="Image results with alt text">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">#</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Image URL</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[160px]">Alt Text</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Chars</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Status</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {results.map((result, idx) => {
                const displayStatus = result.status === "compliant"
                  ? getComplianceStatus(result.alt_text ?? "")
                  : result.status;
                const charCount = result.alt_text ? result.alt_text.length : result.char_count;
                const isRegenerating = regeneratingId === result.id;
                const isCrawlJob = job.type === "crawl";
                const sourcePageUrl = result.source_page_url;

                return (
                  <tr key={result.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                      <a
                        href={result.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:text-brand-800 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 truncate block"
                      >
                        {result.image_url.startsWith("data:") ? result.image_url.substring(0, 60) + "…" : result.image_url}
                      </a>
                      {isCrawlJob && sourcePageUrl && (
                        <a
                          href={sourcePageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-400 hover:text-gray-600 hover:underline block mt-0.5 truncate focus-visible:outline-2 focus-visible:outline-brand-500"
                          title={`Source page: ${sourcePageUrl}`}
                        >
                          ↳ {sourcePageUrl}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-md">
                      <EditableAltCell
                        result={result}
                        jobId={id!}
                        onSaved={handleResultSaved}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {charCount > 0 ? charCount : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {result.status === "needs_review" && !result.alt_text && result.alt_text !== "" ? (
                        <span className="text-gray-400 text-xs italic">Processing</span>
                      ) : (
                        <ComplianceBadge status={displayStatus} />
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {!isRegenerating ? (
                        <button
                          onClick={() => handleRegenerate(result.id)}
                          disabled={regeneratingId !== null}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded hover:bg-brand-100 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-brand-500 transition-colors"
                          title="Regenerate alt text (costs 1 credit)"
                          aria-label={`Regenerate alt text for image ${idx + 1}`}
                        >
                          <svg className="h-3 w-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Regen
                        </button>
                      ) : (
                        <span className="inline-flex items-center text-xs text-gray-500" role="status">
                          <div className="w-3 h-3 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin mr-1" aria-hidden="true" />
                          Regenerating…
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Skipped Images Section (crawl jobs only) */}
      {job.type === "crawl" && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <button
            onClick={() => setShowSkipped(!showSkipped)}
            className="w-full px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors focus-visible:outline-2 focus-visible:outline-brand-500"
            aria-expanded={showSkipped}
            aria-controls="skipped-images-panel"
          >
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">
                Skipped Images ({skipped.length})
              </h2>
              {skippedLoading && (
                <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" aria-hidden="true" />
              )}
            </div>
            <div className="flex items-center gap-2">
              {skipped.length > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleExportSkippedCsv(); }}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-brand-500 transition-colors"
                  title="Download skipped images as CSV"
                  aria-label="Export skipped images as CSV"
                >
                  <svg className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </button>
              )}
              <svg
                className={`h-4 w-4 text-gray-500 transition-transform ${showSkipped ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          {showSkipped && (
            <div id="skipped-images-panel" className="max-h-[24rem] overflow-y-auto table-responsive">
              {skipped.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">
                  {skippedLoading ? "Loading skipped images…" : "No skipped images. All images needed alt text."}
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200" aria-label="Skipped images — already have descriptive alt text">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">#</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">Source Page</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">Image URL</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[160px]">Existing Alt Text</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {skipped.map((s, idx) => (
                      <SkippedRow
                        key={s.id}
                        skipped={s}
                        index={idx}
                        isGenerating={generatingSkippedId === s.id}
                        isCopied={copiedId === s.id}
                        anyGenerating={generatingSkippedId !== null}
                        onCopy={handleCopySkipped}
                        onGenerate={handleGenerateSkipped}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
