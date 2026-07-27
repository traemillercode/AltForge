import { Link } from "react-router-dom";

interface PricingTier {
  name: string;
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

export default function PricingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight">
              Simple, transparent{" "}
              <span className="text-brand-600">pricing</span>
            </h1>
            <p className="mt-4 text-lg text-gray-600 leading-relaxed">
              Every new account starts with 25 free credits. Purchase more
              when you need them — credits never expire on one-time packs.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section
        className="bg-gray-50 py-12 md:py-16"
        aria-labelledby="pricing-heading"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 id="pricing-heading" className="sr-only">
            Pricing plans
          </h2>
          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative bg-white rounded-2xl shadow-sm border-2 p-8 flex flex-col ${
                  tier.highlight
                    ? "border-brand-500 shadow-brand-100 shadow-lg"
                    : "border-gray-200"
                }`}
              >
                {tier.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center px-4 py-1 rounded-full text-xs font-semibold bg-brand-600 text-white shadow-sm">
                    Best Value
                  </span>
                )}

                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">
                    {tier.name}
                  </h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-gray-900">
                      {tier.price}
                    </span>
                    {tier.period && (
                      <span className="text-gray-500">{tier.period}</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium text-brand-600">
                    {tier.credits}
                  </p>
                  <p className="mt-3 text-sm text-gray-600">
                    {tier.description}
                  </p>

                  <ul className="mt-6 space-y-3" role="list">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <svg
                          className="w-5 h-5 flex-shrink-0 text-green-500 mt-0.5"
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
                        <span className="text-sm text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href="#"
                  title="Coming soon — Stripe integration pending"
                  className={`mt-8 inline-flex items-center justify-center w-full px-6 py-3 border rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 ${
                    tier.highlight
                      ? "border-transparent text-white bg-brand-600 hover:bg-brand-700"
                      : "border-brand-600 text-brand-600 bg-white hover:bg-brand-50"
                  }`}
                  aria-label={`Get started with ${tier.name} plan — coming soon`}
                  onClick={(e) => e.preventDefault()}
                >
                  Get started
                </a>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-gray-500">
            Stripe payment integration coming soon. All plans will be available
            for purchase directly from this page.
          </p>
        </div>
      </section>

      {/* FAQ / reassurance */}
      <section className="bg-white py-12 md:py-16" aria-labelledby="faq-heading">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2
            id="faq-heading"
            className="text-2xl font-bold text-center text-gray-900"
          >
            Frequently asked questions
          </h2>
          <dl className="mt-10 space-y-6">
            <div>
              <dt className="text-lg font-semibold text-gray-900">
                Do credits expire?
              </dt>
              <dd className="mt-2 text-gray-600">
                No — Starter and Growth credits never expire. Pro plan
                credits roll over for one billing cycle.
              </dd>
            </div>
            <div>
              <dt className="text-lg font-semibold text-gray-900">
                Can I change plans?
              </dt>
              <dd className="mt-2 text-gray-600">
                Absolutely. You can purchase any pack at any time. Unused
                credits stack across one-time packs.
              </dd>
            </div>
            <div>
              <dt className="text-lg font-semibold text-gray-900">
                How many credits per image?
              </dt>
              <dd className="mt-2 text-gray-600">
                Each image consumes 1 credit. If an image fails to process, the
                credit is not deducted.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-700 py-16" aria-labelledby="cta-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2
            id="cta-heading"
            className="text-2xl md:text-3xl font-bold text-white"
          >
            Start with 25 free credits
          </h2>
          <p className="mt-4 text-lg text-brand-100">
            No credit card required. Try AltForge risk-free.
          </p>
          <div className="mt-8">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center px-8 py-4 border-2 border-white text-lg font-semibold rounded-lg text-white hover:bg-white hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 transition-colors"
            >
              Get started free
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
