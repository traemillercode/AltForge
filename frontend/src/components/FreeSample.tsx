import { useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";

interface SampleResult {
  filename: string;
  dataUri: string;
  altText: string;
  charCount: number;
  status: "compliant" | "decorative";
  error?: string;
}

type ProcessingState = "idle" | "uploading" | "processing" | "complete" | "error";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILES = 5;

export default function FreeSample() {
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [state, setState] = useState<ProcessingState>("idle");
  const [results, setResults] = useState<SampleResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndAddFiles = useCallback((incoming: File[]) => {
    setError(null);

    // Filter to allowed types
    const valid = incoming.filter((f) => ALLOWED_TYPES.includes(f.type));

    if (valid.length < incoming.length) {
      setError("Some files were skipped — only JPEG, PNG, WebP, and GIF are accepted.");
    }

    // Check size limits
    const oversized = valid.find((f) => f.size > 10 * 1024 * 1024);
    if (oversized) {
      setError(
        `"${oversized.name}" exceeds the 10MB file size limit.`
      );
      return;
    }

    // Enforce 5-image max
    const combined = [...files, ...valid].slice(0, MAX_FILES);
    setFiles(combined);
    setResults([]);
    setState("idle");
  }, [files]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = Array.from(e.dataTransfer.files);
      validateAndAddFiles(dropped);
    },
    [validateAndAddFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      validateAndAddFiles(Array.from(e.target.files));
    }
    // Reset input so re-selecting the same file works
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setResults([]);
    setState("idle");
    setError(null);
  };

  const handleGenerate = async () => {
    if (files.length === 0) return;

    setState("uploading");
    setError(null);
    setProgress({ current: 0, total: files.length });

    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append("images", file);
      }

      setState("processing");
      setProgress({ current: 0, total: files.length });

      const res = await fetch("/api/sample", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(body.error || `Server error (${res.status})`);
      }

      const data = await res.json();
      setResults(data.results || []);
      setState("complete");
      setProgress({ current: data.results?.length ?? 0, total: files.length });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setState("error");
    }
  };

  const handleReset = () => {
    setFiles([]);
    setResults([]);
    setState("idle");
    setError(null);
    setProgress({ current: 0, total: 0 });
  };

  const isProcessing = state === "uploading" || state === "processing";

  return (
    <section
      className="bg-white py-16 md:py-20"
      aria-labelledby="free-sample-heading"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2
            id="free-sample-heading"
            className="text-2xl md:text-3xl font-bold text-gray-900"
          >
            Try it free — no signup required
          </h2>
          <p className="mt-3 text-gray-600">
            Upload 1–5 images and see AI-generated alt text in seconds.
            Export and batch processing available after signup.
          </p>
        </div>

        {/* Drop zone / file selection */}
        {files.length === 0 && state === "idle" && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Upload images for free alt-text generation"
            className={`
              border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
              transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2
              ${dragOver
                ? "border-brand-500 bg-brand-50"
                : "border-gray-300 hover:border-brand-400 bg-gray-50"
              }
            `}
          >
            <div className="flex flex-col items-center gap-3">
              {/* Upload icon */}
              <svg
                aria-hidden="true"
                className="w-12 h-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-gray-700 font-medium">
                Drag &amp; drop up to 5 images here
              </p>
              <p className="text-sm text-gray-500">
                or click to browse — JPEG, PNG, WebP, GIF
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFilePicked}
              className="hidden"
              aria-hidden="true"
            />
          </div>
        )}

        {/* Selected files list */}
        {files.length > 0 && state !== "complete" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">
                {files.length} image{files.length !== 1 ? "s" : ""} selected
              </h3>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={files.length >= MAX_FILES || isProcessing}
                className="text-sm text-brand-600 hover:text-brand-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                + Add more
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFilePicked}
                className="hidden"
                aria-hidden="true"
              />
            </div>

            <ul className="space-y-2" aria-label="Selected images">
              {files.map((file, i) => (
                <li
                  key={`${file.name}-${i}`}
                  className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded bg-gray-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Preview of ${file.name}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(i)}
                    disabled={isProcessing}
                    className="ml-3 text-gray-400 hover:text-red-500 focus-visible:outline-2 focus-visible:outline-red-500 rounded p-1 disabled:opacity-50"
                    aria-label={`Remove ${file.name}`}
                  >
                    <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleGenerate}
                disabled={isProcessing}
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-semibold rounded-lg shadow-md text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 transition-colors"
              >
                {isProcessing ? (
                  <>
                    <svg
                      aria-hidden="true"
                      className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  "Generate alt text"
                )}
              </button>
              <button
                onClick={handleReset}
                disabled={isProcessing}
                className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 transition-colors"
              >
                Start over
              </button>
            </div>

            {/* Progress indicator */}
            {isProcessing && (
              <div className="mt-4" role="status" aria-live="polite">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Processing image {progress.current + 1} of {progress.total}...</span>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-brand-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progress.total > 0 ? ((progress.current) / progress.total) * 100 : 0}%` }}
                    role="progressbar"
                    aria-valuenow={progress.current}
                    aria-valuemin={0}
                    aria-valuemax={progress.total}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <svg aria-hidden="true" className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-medium text-red-800">{error}</p>
                {state === "error" && (
                  <button
                    onClick={handleReset}
                    className="mt-2 text-sm text-red-600 underline hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-500"
                  >
                    Try again
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {state === "complete" && results.length > 0 && (
          <div className="mt-6 space-y-6" aria-live="polite" aria-label="Generated alt text results">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Results ({results.length} image{results.length !== 1 ? "s" : ""})
              </h3>
              <button
                onClick={handleReset}
                className="text-sm text-brand-600 hover:text-brand-700 font-medium focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                Try another batch
              </button>
            </div>

            {results.map((result, i) => (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"
              >
                <div className="flex flex-col sm:flex-row">
                  {/* Thumbnail */}
                  <div className="sm:w-48 flex-shrink-0 bg-gray-100 flex items-center justify-center p-3">
                    {result.dataUri ? (
                      <img
                        src={result.dataUri}
                        alt={result.altText || "Uploaded image"}
                        className="max-h-36 w-auto object-contain rounded"
                      />
                    ) : (
                      <div className="w-full h-24 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-sm">
                        No preview
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 p-5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs text-gray-500 truncate max-w-full">
                        {result.filename}
                      </span>
                      {result.status === "compliant" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <svg aria-hidden="true" className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Compliant
                        </span>
                      )}
                      {result.status === "decorative" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Decorative
                        </span>
                      )}
                      {result.charCount > 0 && (
                        <span className="text-xs text-gray-400">
                          {result.charCount} chars
                        </span>
                      )}
                      {result.error && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Error
                        </span>
                      )}
                    </div>

                    {result.error ? (
                      <p className="text-sm text-red-600">{result.error}</p>
                    ) : result.status === "decorative" ? (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-sm text-blue-800">
                          This image appears to be purely decorative. No alt text needed — use an empty{" "}
                          <code className="bg-blue-100 px-1 rounded text-xs">alt=""</code> attribute.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">
                          Suggested alt text
                        </p>
                        <p className="text-sm text-gray-900 break-words">
                          {result.altText || "(empty)"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Signup CTA */}
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-6 text-center">
              <h3 className="text-lg font-semibold text-brand-900">
                Ready to process hundreds of images?
              </h3>
              <p className="mt-2 text-sm text-brand-700">
                Sign up to get 25 free credits, batch upload via CSV, crawl entire websites, and export results.
              </p>
              <Link
                to="/signup"
                className="mt-4 inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-semibold rounded-lg shadow-sm text-white bg-brand-600 hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 transition-colors"
              >
                Sign up free — 25 credits included
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
