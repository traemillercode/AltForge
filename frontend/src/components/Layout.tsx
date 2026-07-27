import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { api } from "../lib/api";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

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

            <nav aria-label="Main navigation">
              {user ? (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 hidden sm:inline">
                    {user.email}
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-brand-50 text-brand-700 rounded-full text-sm font-medium">
                    <span aria-hidden="true">🪙</span>
                    {user.credits} credits
                  </span>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-gray-600 hover:text-gray-900 underline focus-visible:outline-2 focus-visible:outline-brand-500"
                  >
                    Log out
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
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
                </div>
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
      <footer className="bg-white border-t border-gray-200 py-6" role="contentinfo">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
          <p>AltForge — Making the web accessible, one image at a time.</p>
        </div>
      </footer>
    </div>
  );
}
