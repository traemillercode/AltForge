import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import {
  api,
  type Job,
  type JobResult,
  type CsvUploadResponse,
  type ImageUploadResponse,
  ApiClientError,
} from "../lib/api";

const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif";
const MAX_FILES = 50;
const MAX_IMAGES = 500;

// ── Shared components ──────────────────────────────────────────────

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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type TabId = "csv" | "crawl" | "images";

interface TabDef {
  id: TabId;
  label: string;
  icon: JSX.Element;
  description: string;
}

const TABS: TabDef[] = [
  {
    id: "csv",
    label: "CSV Upload",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    description: "Upload a CSV file with image URLs.",
  },
  {
    id: "crawl",
    label: "Crawl Website",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    description: "Paste a website URL to find images needing alt text.",
  },
  {
    id: "images",
    label: "Upload Images",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    description: "Upload images or a zip file directly from your computer.",
  },
];

// ── Image preview helper ───────────────────────────────────────────

function ImageThumbnail({ file }: { file: File }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!src) {
    return <div className="w-16 h-16 bg-gray-100 rounded animate-pulse" />;
  }
  return (
    <img
      src={src}
      alt={file.name}
      className="w-16 h-16 object-cover rounded border border-gray-200"
      loading="lazy"
    />
  );
}

// ── Main page ──────────────────────────────────────────────────────

export default function UploadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>("csv");

  // ── CSV state ──
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const [csvDragOver, setCsvDragOver] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvResult, setCsvResult] = useState<CsvUploadResponse | null>(null);

  // ── Crawl state ──
  const [crawlUrl, setCrawlUrl] = useState("");
  const [crawling, setCrawling] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [crawlResult, setCrawlResult] = useState<ImageUploadResponse | CsvUploadResponse | null>(null);

  // ── Images state ──
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const zipFileInputRef = useRef<HTMLInputElement>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageZipFile, setImageZipFile] = useState<File | null>(null);
  const [imageDragOver, setImageDragOver] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageResult, setImageResult] = useState<ImageUploadResponse | null>(null);

  // ── Jobs list ──
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);

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

  // ── CSV handlers ─────────────────────────────────────────────────

  const handleCsvDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setCsvDragOver(true);
  }, []);
  const handleCsvDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setCsvDragOver(false);
  }, []);
  const handleCsvDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setCsvDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file && file.name.toLowerCase().endsWith(".csv")) {
        setCsvFile(file); setCsvError(null); setCsvResult(null);
      } else {
        setCsvError("Only .csv files are accepted");
      }
    }
  }, []);
  const handleCsvFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file) { setCsvFile(file); setCsvError(null); setCsvResult(null); }
    }
  }, []);

  const handleCsvUpload = async () => {
    if (!csvFile) return;
    try {
      setCsvUploading(true); setCsvError(null);
      const result = await api.uploadCsv(csvFile);
      setCsvResult(result);
      await loadJobs();
    } catch (err) {
      if (err instanceof ApiClientError) setCsvError(err.message);
      else setCsvError("Upload failed. Please try again.");
    } finally {
      setCsvUploading(false);
    }
  };

  const resetCsv = () => {
    setCsvFile(null); setCsvResult(null); setCsvError(null);
    if (csvFileInputRef.current) csvFileInputRef.current.value = "";
  };

  // ── Crawl handlers ───────────────────────────────────────────────

  const handleCrawl = async () => {
    let url = crawlUrl.trim();
    if (!url) return;
    // Auto-prepend https:// if no protocol specified
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    try {
      setCrawling(true); setCrawlError(null);
      const res = await fetch("/api/jobs/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Crawl failed" }));
        throw new ApiClientError(body.error || `Crawl failed (${res.status})`, res.status);
      }
      const data = await res.json();
      setCrawlResult(data);
      await loadJobs();
    } catch (err) {
      if (err instanceof ApiClientError) setCrawlError(err.message);
      else setCrawlError("Crawl failed. Please try again.");
    } finally {
      setCrawling(false);
    }
  };

  const resetCrawl = () => {
    setCrawlUrl(""); setCrawlResult(null); setCrawlError(null);
  };

  // ── Image upload handlers ────────────────────────────────────────

  const addImageFiles = useCallback((files: FileList | File[]) => {
    const newFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      const name = file.name.toLowerCase();
      const ext = name.substring(name.lastIndexOf("."));
      if (![".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) continue;
      if (file.size > 10 * 1024 * 1024) continue;
      newFiles.push(file);
    }
    setImageFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name.toLowerCase()));
      const added = newFiles.filter((f) => !existing.has(f.name.toLowerCase()));
      const combined = [...prev, ...added].slice(0, MAX_FILES);
      return combined;
    });
    setImageZipFile(null);
    setImageError(null);
    setImageResult(null);
  }, []);

  const handleImageDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setImageDragOver(true);
  }, []);
  const handleImageDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setImageDragOver(false);
  }, []);
  const handleImageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setImageDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    // If single zip file dropped, treat as zip
    if (files.length === 1 && files[0]!.name.toLowerCase().endsWith(".zip")) {
      setImageZipFile(files[0]!);
      setImageFiles([]);
      setImageError(null);
      setImageResult(null);
    } else {
      addImageFiles(files);
    }
  }, [addImageFiles]);

  const handleImageFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addImageFiles(e.target.files);
    }
    if (imageFileInputRef.current) imageFileInputRef.current.value = "";
  }, [addImageFiles]);

  const handleZipFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && files[0]) {
      setImageZipFile(files[0]);
      setImageFiles([]);
      setImageError(null);
      setImageResult(null);
    }
  }, []);

  const removeImageFile = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImageUpload = async () => {
    const filesToUpload = imageZipFile ? [imageZipFile] : imageFiles;
    if (filesToUpload.length === 0) return;
    try {
      setImageUploading(true); setImageError(null);
      const result = await api.uploadImages(filesToUpload);
      setImageResult(result);
      await loadJobs();
    } catch (err) {
      if (err instanceof ApiClientError) setImageError(err.message);
      else setImageError("Upload failed. Please try again.");
    } finally {
      setImageUploading(false);
    }
  };

  const resetImages = () => {
    setImageFiles([]);
    setImageZipFile(null);
    setImageResult(null);
    setImageError(null);
    if (imageFileInputRef.current) imageFileInputRef.current.value = "";
    if (zipFileInputRef.current) zipFileInputRef.current.value = "";
  };

  const totalImageSize = imageFiles.reduce((s, f) => s + f.size, 0) + (imageZipFile?.size ?? 0);

  if (!user) return null;

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <h1 className="text-2xl font-bold text-gray-900">New Job</h1>
      <p className="mt-1 text-sm text-gray-600">
        Choose how you want to provide images for alt-text generation.
      </p>

      {/* Tabs */}
      <nav className="mt-6 flex border-b border-gray-200" aria-label="Input method tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors
              focus-visible:outline-2 focus-visible:outline-brand-500
              ${activeTab === tab.id
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <section className="mt-6" aria-labelledby="upload-heading">
        <h2 id="upload-heading" className="sr-only">{TABS.find(t => t.id === activeTab)?.label} form</h2>

        {/* ── CSV Tab ──────────────────────────────────────────── */}
        {activeTab === "csv" && (
          <>
            {!csvResult ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
                <p className="text-sm text-gray-600 mb-4">{TABS.find(t => t.id === "csv")?.description}</p>
                <div
                  className={`
                    relative border-2 border-dashed rounded-lg p-8 md:p-12 text-center transition-colors
                    ${csvDragOver ? "border-brand-500 bg-brand-50" : "border-gray-300 hover:border-gray-400"}
                    ${csvFile ? "bg-green-50 border-green-400" : ""}
                  `}
                  onDragOver={handleCsvDragOver}
                  onDragLeave={handleCsvDragLeave}
                  onDrop={handleCsvDrop}
                  role="region"
                  aria-label="CSV file upload area"
                >
                  <input
                    ref={csvFileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleCsvFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    aria-label="Choose CSV file to upload"
                  />
                  {csvFile ? (
                    <div className="pointer-events-none">
                      <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="mt-2 text-sm font-medium text-green-700 break-all">{csvFile.name}</p>
                      <p className="mt-1 text-xs text-green-600">{formatSize(csvFile.size)}</p>
                    </div>
                  ) : (
                    <div className="pointer-events-none">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="mt-2 text-sm text-gray-600">
                        <span className="font-medium text-brand-600">Tap to browse</span> or drag and drop
                      </p>
                      <p className="mt-1 text-xs text-gray-500">CSV files only (max 10MB, up to 5,000 URLs)</p>
                    </div>
                  )}
                </div>

                {csvError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md" role="alert" aria-live="assertive">
                    <p className="text-sm text-red-700">{csvError}</p>
                  </div>
                )}

                <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                  {csvFile && (
                    <button type="button" onClick={resetCsv} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500">Clear</button>
                  )}
                  <button type="button" onClick={handleCsvUpload} disabled={!csvFile || csvUploading}
                    className="inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-600 hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-busy={csvUploading}>
                    {csvUploading ? (<><svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Uploading…</>) : "Upload & Preview"}
                  </button>
                </div>
              </div>
            ) : (
              <ResultPreview
                title="Image URLs"
                count={csvResult.results.length}
                source={csvResult.job.source_filename || undefined}
                stats={[
                  { label: "Valid URLs", value: csvResult.stats.validUrls, color: "text-green-700" },
                  { label: "Skipped / Invalid", value: csvResult.stats.invalidCount, color: "text-amber-700" },
                  { label: "Credit Cost", value: csvResult.stats.costEstimate, subtitle: "1 credit per image", color: "text-brand-700" },
                ]}
                results={csvResult.results}
                jobId={csvResult.job.id}
                jobStatus={csvResult.job.status}
                onReset={resetCsv}
                navigate={navigate}
              />
            )}
          </>
        )}

        {/* ── Crawl Tab ────────────────────────────────────────── */}
        {activeTab === "crawl" && (
          <>
            {!crawlResult ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
                <p className="text-sm text-gray-600 mb-4">{TABS.find(t => t.id === "crawl")?.description}</p>
                <div>
                  <label htmlFor="crawl-url-input" className="block text-sm font-medium text-gray-700">Website URL</label>
                  <div className="mt-1">
                    <input
                      id="crawl-url-input"
                      type="text"
                      value={crawlUrl}
                      onChange={(e) => setCrawlUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCrawl(); }}
                      placeholder="example.com"
                      className="block w-full px-3 py-2 rounded-md border border-gray-300 shadow-sm focus:ring-brand-500 focus:border-brand-500 text-sm"
                      aria-label="Website URL to crawl"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Enter a website URL (e.g. example.com)</p>
                </div>

                {crawlError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md" role="alert" aria-live="assertive">
                    <p className="text-sm text-red-700">{crawlError}</p>
                  </div>
                )}

                <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                  <button type="button" onClick={handleCrawl} disabled={!crawlUrl.trim() || crawling}
                    className="inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-600 hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-busy={crawling}>
                    {crawling ? (<><svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Crawling…</>) : "Crawl Website"}
                  </button>
                </div>
              </div>
            ) : (
              <ResultPreview
                title="Images Found"
                count={(crawlResult.results as JobResult[]).length}
                source={crawlResult.job.source_url || crawlResult.job.source_filename || undefined}
                stats={[
                  { label: "Images Found", value: (crawlResult as any).stats?.imagesAdded ?? (crawlResult as any).stats?.validUrls ?? crawlResult.job.total_images, color: "text-green-700" },
                  { label: "Skipped", value: (crawlResult as any).stats?.imagesSkipped ?? (crawlResult as any).stats?.invalidCount ?? 0, subtitle: "Already have descriptive alt text", color: "text-amber-700" },
                  { label: "Credit Cost", value: (crawlResult as any).stats?.costEstimate ?? crawlResult.job.total_images, subtitle: "1 credit per image", color: "text-brand-700" },
                ]}
                results={crawlResult.results as JobResult[]}
                jobId={crawlResult.job.id}
                jobStatus={crawlResult.job.status}
                onReset={resetCrawl}
                navigate={navigate}
              />
            )}
          </>
        )}

        {/* ── Images Tab ───────────────────────────────────────── */}
        {activeTab === "images" && (
          <>
            {!imageResult ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
                <p className="text-sm text-gray-600 mb-4">
                  Upload up to {MAX_FILES} image files (.jpg, .png, .webp, .gif) or a single .zip file containing up to {MAX_IMAGES} images (max 50MB total).
                </p>

                {/* Multi-file picker area */}
                <div
                  className={`
                    relative border-2 border-dashed rounded-lg p-6 md:p-10 text-center transition-colors cursor-pointer
                    ${imageDragOver ? "border-brand-500 bg-brand-50" : "border-gray-300 hover:border-gray-400"}
                    ${imageFiles.length > 0 ? "bg-green-50 border-green-400" : ""}
                  `}
                  onDragOver={handleImageDragOver}
                  onDragLeave={handleImageDragLeave}
                  onDrop={handleImageDrop}
                  role="region"
                  aria-label="Image file upload area"
                >
                  <input
                    ref={imageFileInputRef}
                    type="file"
                    accept={IMAGE_ACCEPT}
                    multiple
                    onChange={handleImageFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    aria-label="Choose image files to upload"
                  />

                  {imageFiles.length > 0 ? (
                    <div className="pointer-events-none">
                      <p className="text-sm font-medium text-green-700">
                        {imageFiles.length} image{imageFiles.length !== 1 ? "s" : ""} selected
                      </p>
                      <p className="mt-1 text-xs text-green-600">Total: {formatSize(totalImageSize)}</p>
                    </div>
                  ) : imageZipFile ? (
                    <div className="pointer-events-none">
                      <svg className="mx-auto h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                      <p className="mt-2 text-sm font-medium text-green-700 break-all">{imageZipFile.name}</p>
                      <p className="mt-1 text-xs text-green-600">{formatSize(imageZipFile.size)}</p>
                    </div>
                  ) : (
                    <div className="pointer-events-none">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="mt-2 text-sm text-gray-600">
                        <span className="font-medium text-brand-600">Click to select</span> or drag and drop images
                      </p>
                      <p className="mt-1 text-xs text-gray-500">.jpg, .jpeg, .png, .webp, .gif (max 10MB each)</p>
                    </div>
                  )}
                </div>

                {/* Zip upload button */}
                <div className="mt-4 flex items-center gap-4 flex-wrap">
                  <span className="text-sm text-gray-500">or</span>
                  <input
                    ref={zipFileInputRef}
                    type="file"
                    accept=".zip"
                    onChange={handleZipFileSelect}
                    className="hidden"
                    id="zip-file-input"
                    aria-label="Choose a zip file"
                  />
                  <label
                    htmlFor="zip-file-input"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus-within:outline-2 focus-within:outline-brand-500 cursor-pointer"
                  >
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    Upload .zip file
                  </label>
                </div>

                {/* Image thumbnails preview */}
                {imageFiles.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        {imageFiles.length} file{imageFiles.length !== 1 ? "s" : ""} ({formatSize(totalImageSize)})
                      </span>
                      <button type="button" onClick={resetImages} className="text-xs text-red-600 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-brand-500">Remove all</button>
                    </div>
                    <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3" aria-label="Selected images">
                      {imageFiles.slice(0, 10).map((file, idx) => (
                        <li key={`${file.name}-${idx}`} className="relative group">
                          <ImageThumbnail file={file} />
                          <p className="mt-1 text-xs text-gray-600 truncate" title={file.name}>{file.name}</p>
                          <button
                            type="button"
                            onClick={() => removeImageFile(idx)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-red-600 focus-visible:outline-2 focus-visible:outline-brand-500"
                            aria-label={`Remove ${file.name}`}
                          >
                            &times;
                          </button>
                        </li>
                      ))}
                    </ul>
                    {imageFiles.length > 10 && (
                      <p className="mt-2 text-xs text-gray-500">+{imageFiles.length - 10} more</p>
                    )}
                  </div>
                )}

                {/* Credit estimate */}
                {(imageFiles.length > 0 || imageZipFile) && (
                  <div className="mt-4 p-3 bg-brand-50 border border-brand-200 rounded-md">
                    <p className="text-sm text-brand-800">
                      <strong>Credit cost estimate:</strong> This job will use up to {imageZipFile ? "?" : imageFiles.length} credit{(!imageZipFile && imageFiles.length !== 1) ? "s" : ""} when processed (charged at processing time).
                    </p>
                  </div>
                )}

                {imageError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md" role="alert" aria-live="assertive">
                    <p className="text-sm text-red-700">{imageError}</p>
                  </div>
                )}

                <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                  {(imageFiles.length > 0 || imageZipFile) && (
                    <button type="button" onClick={resetImages} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500">Clear</button>
                  )}
                  <button type="button" onClick={handleImageUpload}
                    disabled={(imageFiles.length === 0 && !imageZipFile) || imageUploading}
                    className="inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-600 hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-busy={imageUploading}>
                    {imageUploading ? (<><svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Creating Job…</>) : "Create Job"}
                  </button>
                </div>
              </div>
            ) : (
              <ResultPreview
                title="Images"
                count={imageResult.results.length}
                source={imageResult.job.source_filename || undefined}
                stats={[
                  { label: "Images Found", value: imageResult.stats.imagesFound, color: "text-green-700" },
                  { label: "Skipped / Invalid", value: imageResult.stats.invalidCount, color: "text-amber-700" },
                  { label: "Credit Cost", value: imageResult.stats.costEstimate, subtitle: "1 credit per image", color: "text-brand-700" },
                ]}
                results={imageResult.results}
                jobId={imageResult.job.id}
                jobStatus={imageResult.job.status}
                onReset={resetImages}
                navigate={navigate}
              />
            )}
          </>
        )}
      </section>

      {/* Jobs list */}
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
            <button onClick={loadJobs} className="mt-2 text-sm text-red-800 underline hover:no-underline focus-visible:outline-2 focus-visible:outline-brand-500">Try again</button>
          </div>
        ) : jobs.length === 0 ? (
          <div className="mt-4 p-8 bg-gray-50 rounded-lg border border-gray-200 text-center">
            <p className="text-gray-600">No jobs yet. Upload a CSV, crawl a website, or upload images to get started.</p>
          </div>
        ) : (
          <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden table-responsive">
            <table className="min-w-full divide-y divide-gray-200" aria-label="Job history">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Images</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
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
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDate(job.created_at)}</td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-900 max-w-[150px] sm:max-w-xs truncate">{job.source_filename || job.source_url || "—"}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600 uppercase">{job.type}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{job.total_images}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap"><StatusBadge status={job.status} /></td>
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

// ── Result preview (shared across all tabs) ────────────────────────

interface StatDef {
  label: string;
  value: number;
  subtitle?: string;
  color: string;
}

function ResultPreview({
  title,
  count,
  source,
  stats,
  results,
  jobId,
  jobStatus,
  onReset,
  navigate,
}: {
  title: string;
  count: number;
  source?: string;
  stats: StatDef[];
  results: JobResult[];
  jobId: string;
  jobStatus?: string;
  onReset: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel this job? This will delete all results and cannot be undone.")) {
      return;
    }
    try {
      setCancelling(true);
      await api.deleteJob(jobId);
      onReset();
    } catch (err) {
      if (err instanceof ApiClientError) {
        alert(err.message);
      } else {
        alert("Failed to cancel job. Please try again.");
      }
    } finally {
      setCancelling(false);
    }
  };
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-5">
            <p className="text-sm font-medium text-gray-600">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
            {s.subtitle && <p className="text-xs text-gray-500">{s.subtitle}</p>}
          </div>
        ))}
      </div>

      {/* Results table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-900">{title} ({count})</h3>
          {source && <p className="text-xs text-gray-600 mt-0.5 break-all">Source: {source}</p>}
        </div>
        <div className="max-h-80 overflow-y-auto table-responsive">
          <table className="min-w-full divide-y divide-gray-200" aria-label="Preview of images">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {results.slice(0, 100).map((result, idx) => (
                <tr key={result.id} className="hover:bg-gray-50">
                  <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-sm text-gray-500">{idx + 1}</td>
                  <td className="px-4 sm:px-6 py-3 text-sm text-gray-900 max-w-[300px] md:max-w-md truncate" title={result.image_url}>
                    {result.image_url.startsWith("data:") ? result.image_url.substring(0, 80) + "…" : result.image_url}
                  </td>
                  <td className="px-4 sm:px-6 py-3 whitespace-nowrap"><StatusBadge status={result.status} /></td>
                </tr>
              ))}
              {results.length > 100 && (
                <tr><td colSpan={3} className="px-4 py-2 text-xs text-gray-500 text-center">+{results.length - 100} more</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row sm:justify-between items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onReset} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500">
            Start a new job
          </button>
          {jobStatus === "pending" && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-busy={cancelling}
            >
              {cancelling ? "Cancelling…" : "Cancel Job"}
            </button>
          )}
        </div>
        <button type="button"
          className="inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-600 hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2"
          onClick={() => navigate(`/jobs/${jobId}`)}>
          View Job Details
        </button>
      </div>

      <p className="text-sm text-gray-500 text-center">Click &ldquo;View Job Details&rdquo; to start processing with AI.</p>
    </div>
  );
}
