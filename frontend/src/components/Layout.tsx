import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { api } from "../lib/api";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  // Load Google AdSense script (only when publisher ID is configured)
  useEffect(() => {
    const publisherId = import.meta.env.VITE_ADSENSE_PUBLISHER_ID as string | undefined;
    if (!publisherId) return;

    const scriptId = "google-adsense-script";
    if (document.getElementById(scriptId)) return;

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-${publisherId}`;
    script.async = true;
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
  }, []);

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Skip navigation link */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm" role="banner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link
              to={user ? "/dashboard" : "/"}
              className="text-xl font-bold text-brand-700 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:rounded"
              aria-label="AltForge home"
            >
              AltForge
            </Link>

            <nav aria-label="Main navigation" className="flex items-center gap-4">
              {user ? (
                <>
                  <Link
                    to="/upload"
                    className="text-sm text-gray-600 hover:text-gray-900 font-medium focus-visible:outline-2 focus-visible:outline-brand-500 hidden sm:inline"
                  >
                    Upload
                  </Link>
                  <Link
                    to="/dashboard"
                    className="text-sm text-gray-600 hover:text-gray-900 font-medium focus-visible:outline-2 focus-visible:outline-brand-500 hidden sm:inline"
                  >
                    Dashboard
                  </Link>
                  <span className="text-sm text-gray-600 hidden sm:inline">
                    {user.email}
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-brand-50 text-brand-700 rounded-full text-sm font-medium">
                    <span aria-hidden="true">🪙</span>
                    {user.credits} credits
                  </span>
                  <Link
                    to="/pricing"
                    className="text-sm text-brand-600 hover:text-brand-800 font-medium focus-visible:outline-2 focus-visible:outline-brand-500 hidden sm:inline"
                    aria-label="Buy more credits"
                  >
                    Buy credits
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-gray-600 hover:text-gray-900 underline focus-visible:outline-2 focus-visible:outline-brand-500"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/pricing"
                    className="text-sm text-gray-600 hover:text-gray-900 font-medium focus-visible:outline-2 focus-visible:outline-brand-500"
                  >
                    Pricing
                  </Link>
                  <Link
                    to="/login"
                    className="text-sm text-gray-600 hover:text-gray-900 font-medium focus-visible:outline-2 focus-visible:outline-brand-500"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/signup"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-600 hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main id="main-content" className="flex-1" role="main">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8" role="contentinfo">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              AltForge — Making the web accessible, one image at a time.
            </p>
            <nav aria-label="Footer navigation" className="flex items-center gap-6">
              <Link
                to="/pricing"
                className="text-sm text-gray-500 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                Pricing
              </Link>
              <Link
                to="/terms"
                className="text-sm text-gray-500 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                Terms of Service
              </Link>
              <Link
                to="/privacy"
                className="text-sm text-gray-500 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                Privacy Policy
              </Link>
              <a
                href="mailto:altforgeaccessibility@gmail.com"
                className="text-sm text-gray-500 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                Contact
              </a>
            </nav>
          </div>
          <p className="mt-4 text-center text-xs text-gray-400">
            &copy; {new Date().getFullYear()} AltForge. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
