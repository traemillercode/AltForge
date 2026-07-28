import { useEffect, useRef, useState } from "react";

export interface GenerationProgressState {
  /** Whether generation is currently active */
  isGenerating: boolean;
  /** 1-based count of completed images so far */
  current: number;
  /** Total images to generate */
  total: number;
  /** URL of the image currently being processed (for thumbnail) */
  currentImageUrl: string;
  /** Error messages accumulated during generation */
  errors: string[];
}

export interface GenerationProgressProps {
  /** The progress state */
  progress: GenerationProgressState;
  /** Current user credits, for the credits indicator */
  creditsRemaining: number;
  /** Called when the modal is dismissed after completion */
  onDismiss: () => void;
}

export default function GenerationProgress({
  progress,
  creditsRemaining,
  onDismiss,
}: GenerationProgressProps) {
  const [showComplete, setShowComplete] = useState(false);
  const [imgError, setImgError] = useState(false);
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { isGenerating, current, total, currentImageUrl, errors } = progress;
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  const isDone = current >= total && total > 0 && !isGenerating;
  const hasErrors = errors.length > 0;

  // Reset image error state when the URL changes
  useEffect(() => {
    setImgError(false);
  }, [currentImageUrl]);

  // Transition to "complete" view and auto-dismiss
  useEffect(() => {
    if (isDone) {
      // Brief delay before showing the complete state
      const t = setTimeout(() => {
        setShowComplete(true);
      }, 300);
      // Auto-dismiss after a few seconds
      autoCloseRef.current = setTimeout(() => {
        onDismiss();
      }, 3500);
      return () => {
        clearTimeout(t);
        if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
      };
    } else {
      setShowComplete(false);
    }
  }, [isDone, onDismiss]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    };
  }, []);

  if (!isGenerating && !showComplete) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={isDone ? "Generation complete" : "Generating alt text"}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-4 border-b ${isDone ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {isDone ? "Generation Complete" : "Generating Alt Text"}
            </h2>
            {isDone && (
              <button
                onClick={onDismiss}
                className="text-gray-400 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-brand-500 rounded p-1"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Thumbnail */}
          {currentImageUrl && (
            <div className="flex justify-center mb-4">
              <div className="w-32 h-32 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
                {imgError ? (
                  <div className="flex flex-col items-center gap-1" title="Image failed to load">
                    <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-gray-400">No preview</span>
                  </div>
                ) : (
                  <img
                    src={currentImageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                    aria-hidden="true"
                  />
                )}
              </div>
            </div>
          )}

          {/* Progress text */}
          <div className="text-center mb-3">
            <p className="text-sm font-medium text-gray-700">
              Processing{" "}
              <span className="text-brand-600 font-semibold">{Math.min(current + 1, total)}</span>{" "}
              of{" "}
              <span className="font-semibold">{total}</span>
            </p>
            {isDone && (
              <p className="text-sm text-green-600 mt-1">
                {total} image{total !== 1 ? "s" : ""} processed
                {hasErrors ? ` — ${errors.length} error${errors.length !== 1 ? "s" : ""}` : " successfully"}
              </p>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 mb-3" role="progressbar" aria-valuenow={current} aria-valuemin={0} aria-valuemax={total} aria-label={`${current} of ${total} images processed`}>
            <div
              className={`h-3 rounded-full transition-all duration-500 ease-out ${
                isDone
                  ? hasErrors
                    ? "bg-amber-500"
                    : "bg-green-500"
                  : "bg-brand-600"
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">{percentage}% complete</span>
            <span className="text-xs text-gray-500">
              {current} / {total}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-xs text-gray-600">
                1 credit per image
              </span>
            </div>
            <div className="text-xs text-gray-500">
              {creditsRemaining} credit{creditsRemaining !== 1 ? "s" : ""} remaining
            </div>
          </div>

          {/* Error summary */}
          {isDone && hasErrors && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs font-medium text-red-700 mb-1">
                {errors.length} image{errors.length !== 1 ? "s" : ""} failed:
              </p>
              <ul className="text-xs text-red-600 list-disc list-inside space-y-0.5">
                {errors.slice(0, 3).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {errors.length > 3 && (
                  <li>…and {errors.length - 3} more</li>
                )}
              </ul>
            </div>
          )}

          {/* Done button */}
          {isDone && (
            <button
              onClick={onDismiss}
              className="mt-3 w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 transition-colors"
            >
              {hasErrors ? "Dismiss" : "Great!"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
