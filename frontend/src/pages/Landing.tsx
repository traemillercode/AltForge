import { Link } from "react-router-dom";
import FreeSample from "../components/FreeSample";
import AdUnit from "../components/AdUnit";

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight">
              Generate alt text for{" "}
              <span className="text-brand-600">hundreds of images</span>{" "}
              in minutes
            </h1>
            <p className="mt-6 text-lg md:text-xl text-gray-600 leading-relaxed">
              AltForge uses AI to produce WCAG 2.1 AA-compliant alt text at
              scale. Upload a CSV of image URLs or paste a website URL — review,
              edit, and export results in one workflow. Cut your accessibility
              audit time from days to minutes.
            </p>
            <p className="mt-4 text-sm text-gray-500">
              Trusted by accessibility teams processing thousands of images
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-semibold rounded-lg shadow-md text-white bg-brand-600 hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 transition-colors"
              >
                Start free — 25 credits, no card required
              </Link>
              <a
                href="#free-sample"
                className="inline-flex items-center justify-center px-8 py-4 border border-gray-300 text-lg font-semibold rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 transition-colors"
              >
                Try the demo
              </a>
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center px-8 py-4 border border-gray-300 text-lg font-semibold rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 transition-colors"
              >
                View pricing
              </Link>
            </div>
            <p className="mt-4 text-xs text-gray-400">
              1 credit = 1 alt-text generation. Every new account starts with 25 free.
            </p>
          </div>
        </div>
      </section>

      {/* Ad: Below hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <AdUnit slot="hero-bottom" className="min-h-[90px]" />
      </div>

      {/* Free Sample */}
      <div id="free-sample">
        <FreeSample />
      </div>

      {/* Features */}
      <section className="bg-gray-50 py-10 md:py-14" aria-labelledby="features-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 id="features-heading" className="text-2xl md:text-3xl font-bold text-center text-gray-900">
            One workflow, zero busywork
          </h2>
          <p className="mt-4 text-center text-gray-600 max-w-2xl mx-auto">
            Stop writing alt text by hand. AltForge does the heavy lifting so you can focus on review.
          </p>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              {
                title: "Bulk CSV Upload",
                description:
                  "Drop a CSV with hundreds of image URLs and AltForge generates alt text for every one. The whole batch processes in minutes, not days.",
              },
              {
                title: "Website Crawl",
                description:
                  "Paste any URL and AltForge finds every image on the page — including ones missing alt attributes — then generates replacement text for all of them.",
              },
              {
                title: "WCAG 2.1 AA Compliant",
                description:
                  "Every suggestion follows WCAG guidelines. Inline editing and one-click export to CSV or ready-to-paste HTML snippets make handoff seamless.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
                <p className="mt-2 text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ad: Mid-page */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <AdUnit slot="mid-page" className="min-h-[90px]" />
      </div>

      {/* Audience */}
      <section className="bg-white py-10 md:py-14" aria-labelledby="audience-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 id="audience-heading" className="text-2xl md:text-3xl font-bold text-center text-gray-900">
            Built for teams that ship accessible content
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              {
                title: "Universities",
                description:
                  "Facing ADA compliance deadlines across dozens of department sites? AltForge processes every image in bulk so your team can focus on the audit, not the typing.",
              },
              {
                title: "E-Commerce",
                description:
                  "Product catalogs need alt text on every image. Generate thousands at once, review inline, and export production-ready HTML — all without slowing your release cycle.",
              },
              {
                title: "Agencies",
                description:
                  "Deliver accessibility audits faster and more profitably. AltForge cuts alt-text work from days to minutes, letting you take on more clients without hiring.",
              },
            ].map((audience) => (
              <div
                key={audience.title}
                className="text-center p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900">{audience.title}</h3>
                <p className="mt-2 text-gray-600">{audience.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ad: Before CTA */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <AdUnit slot="before-cta" className="min-h-[90px]" />
      </div>

      {/* CTA */}
      <section className="bg-brand-700 py-10" aria-labelledby="cta-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 id="cta-heading" className="text-2xl md:text-3xl font-bold text-white">
            Ready to make your images accessible?
          </h2>
          <p className="mt-4 text-lg text-brand-100">
            Start with 25 free credits. No credit card required — no time limit.
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
