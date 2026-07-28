import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/useAuth";

export default function PaymentSuccessPage() {
  const { user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [refreshed, setRefreshed] = useState(false);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    // Refresh user data to get updated credit balance
    if (!refreshed) {
      refreshUser();
      setRefreshed(true);
    }
  }, [refreshUser, refreshed]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      <div className="text-center">
        {/* Success icon */}
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="mt-6 text-3xl font-extrabold text-gray-900">
          Payment successful!
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Thank you for your purchase. Your credits have been added to your
          account.
        </p>

        {user && (
          <div className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-brand-50 rounded-xl">
            <span aria-hidden="true" className="text-xl">🪙</span>
            <span className="text-lg font-semibold text-brand-700">
              {user.credits} credits available
            </span>
          </div>
        )}

        {sessionId && (
          <p className="mt-4 text-sm text-gray-400">
            Reference: {sessionId.slice(0, 12)}…
          </p>
        )}

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/upload"
            className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-brand-600 hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 transition-colors"
          >
            Start generating alt-text
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center px-8 py-3 border border-brand-200 text-base font-medium rounded-lg text-brand-700 bg-white hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 transition-colors"
          >
            Go to dashboard
          </Link>
        </div>

        <p className="mt-8 text-sm text-gray-500">
          Credits are typically available immediately. If you don't see your
          updated balance, it may take a moment — try refreshing the page.
        </p>
      </div>
    </div>
  );
}
