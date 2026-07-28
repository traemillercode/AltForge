import { useEffect, useRef } from "react";

interface AdUnitProps {
  /** Named slot identifier for this ad placement */
  slot: string;
  /** Optional CSS class for the container */
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

/**
 * Responsive Google AdSense ad unit.
 * Only renders when VITE_ADSENSE_PUBLISHER_ID is configured.
 */
export default function AdUnit({ slot, className = "" }: AdUnitProps) {
  const adRef = useRef<HTMLModElement>(null);
  const publisherId = import.meta.env.VITE_ADSENSE_PUBLISHER_ID as string | undefined;

  useEffect(() => {
    if (!publisherId || !adRef.current) return;

    try {
      // Push the ad unit to the adsbygoogle queue
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Silently ignore ad loading errors
    }
  }, [publisherId]);

  // Don't render anything if no publisher ID is configured
  if (!publisherId) return null;

  return (
    <div className={`w-full overflow-hidden ${className}`} aria-label="Advertisement">
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={`ca-${publisherId}`}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
