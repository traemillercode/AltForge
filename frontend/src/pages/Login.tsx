import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiClientError } from "../lib/api";
import { useAuth } from "../lib/useAuth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    setSubmitting(true);
    try {
      const { user } = await api.login(email.trim(), password);
      setUser(user);
      navigate("/dashboard");
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 text-center">
            Log in to AltForge
          </h1>

          {error && (
            <div
              id="login-form-error"
              className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm"
              role="alert"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-medium text-gray-700"
              >
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                aria-required="true"
                aria-describedby={error ? "login-form-error" : undefined}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                aria-required="true"
                aria-describedby={error ? "login-form-error" : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex justify-center px-4 py-3 border border-transparent text-sm font-semibold rounded-md shadow-sm text-white bg-brand-600 hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Logging in…" : "Log in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Don&apos;t have an account?{" "}
            <Link
              to="/signup"
              className="font-medium text-brand-600 hover:text-brand-500 underline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
