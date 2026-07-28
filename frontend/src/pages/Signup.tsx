import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiClientError } from "../lib/api";
import { useAuth } from "../lib/useAuth";

interface PricingTier {
  name: string;
  planKey: string;
  price: string;
  period: string;
  credits: string;
  description: string;
  highlight?: boolean;
  features: string[];
}

const tiers: PricingTier[] = [
  {
    name: "Starter",
    planKey: "starter",
    price: "$19",
    period: "one-time",
    credits: "250 credits",
    description:
      "Perfect for small sites or one-off accessibility audits.",
    features: [
      "250 alt-text generations",
      "Credits never expire",
      "CSV upload support",
      "URL crawl support",
      "Inline editing & export",
    ],
  },
  {
    name: "Growth",
    planKey: "growth",
    price: "$49",
    period: "one-time",
    credits: "1,000 credits",
    description:
      "Best for teams with multiple sites or regular audit work.",
    highlight: true,
    features: [
      "1,000 alt-text generations",
      "Credits never expire",
      "CSV upload support",
      "URL crawl support",
      "Inline editing & export",
      "Priority support",
    ],
  },
  {
    name: "Pro",
    planKey: "pro",
    price: "$39",
    period: "/month",
    credits: "1,500 credits/month",
    description:
      "For agencies and institutions with ongoing accessibility needs.",
    features: [
      "1,500 alt-text generations per month",
      "Unused credits roll over 1 month",
      "CSV upload support",
      "URL crawl support",
      "Inline editing & export",
      "Priority support",
    ],
  },
];

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
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
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const { user, checkoutUrl } = await api.signup(
        email.trim(),
        password,
        selectedPlan ?? undefined
      );
      setUser(user);

      if (checkoutUrl) {
        // Redirect to Stripe Checkout
        window.location.href = checkoutUrl;
      } else {
        navigate("/dashboard");
      }
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
    <div className="flex items-center justify-center min-h-[70vh] px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 text-center">
            Create your account
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Get 25 free credits to start. Choose a plan below or skip for now.
          </p>

          {error && (
            <div
              id="signup-form-error"
              className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm"
              role="alert"
            >
              {error}
            </div>
          )}

          <form id="signup-form" onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="signup-email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Email address
                </label>
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  required
                  aria-required="true"
                  aria-describedby={error ? "signup-form-error" : undefined}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label
                  htmlFor="signup-password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Password
                </label>
                <input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  aria-required="true"
                  aria-describedby={error ? `signup-form-error password-hint` : "password-hint"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
                  placeholder="At least 8 characters"
                />
                <p className="mt-1 text-xs text-gray-500" id="password-hint">
                  Must be at least 8 characters long.
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="signup-confirm-password"
                className="block text-sm font-medium text-gray-700"
              >
                Confirm password
              </label>
              <input
                id="signup-confirm-password"
                type="password"
                autoComplete="new-password"
                required
                aria-required="true"
                aria-describedby={error ? "signup-form-error" : undefined}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
                placeholder="Re-enter your password"
              />
            </div>

            {/* Pricing tier selection */}
            <fieldset className="mt-6">
              <legend className="text-base font-semibold text-gray-900">
                Choose a plan{" "}
                <span className="text-sm font-normal text-gray-500">
                  (optional)
                </span>
              </legend>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                {tiers.map((tier) => {
                  const isSelected = selectedPlan === tier.planKey;
                  return (
                    <button
                      key={tier.planKey}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() =>
                        setSelectedPlan(
                          isSelected ? null : tier.planKey
                        )
                      }
                      className={`relative flex flex-col rounded-xl border-2 p-4 text-left transition-all focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 ${
                        isSelected
                          ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600"
                          : tier.highlight
                            ? "border-brand-300 bg-white hover:border-brand-400"
                            : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      {tier.highlight && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold bg-brand-600 text-white shadow-sm">
                          Best Value
                        </span>
                      )}

                      <h3 className="text-sm font-bold text-gray-900">
                        {tier.name}
                      </h3>
                      <div className="mt-1 flex items-baseline gap-0.5">
                        <span className="text-xl font-extrabold text-gray-900">
                          {tier.price}
                        </span>
                        <span className="text-xs text-gray-500">
                          {tier.period}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-brand-600">
                        {tier.credits}
                      </p>
                      <p className="mt-1 text-xs text-gray-600 leading-tight">
                        {tier.description}
                      </p>

                      <ul className="mt-3 space-y-1 flex-1" role="list">
                        {tier.features.slice(0, 3).map((feature) => (
                          <li key={feature} className="flex items-start gap-1.5">
                            <svg
                              className="w-4 h-4 flex-shrink-0 text-green-500 mt-px"
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
                            <span className="text-xs text-gray-600">
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {isSelected && (
                        <div className="mt-3 flex items-center gap-1 text-brand-600 text-xs font-semibold">
                          <svg
                            className="w-4 h-4"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Selected
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex justify-center px-4 py-3 border border-transparent text-sm font-semibold rounded-md shadow-sm text-white bg-brand-600 hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting
                ? "Creating account…"
                : selectedPlan
                  ? "Create Account & Pay"
                  : "Create Account"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setSelectedPlan(null);
                const form = document.getElementById("signup-form") as HTMLFormElement | null;
                if (form) form.requestSubmit();
              }}
              className="text-sm text-gray-500 hover:text-gray-700 underline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              Skip for now
            </button>
          </div>

          <p className="mt-4 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-brand-600 hover:text-brand-500 underline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
