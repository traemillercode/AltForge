import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight">
              Bulk alt-text for{" "}
              <span className="text-brand-600">accessibility audits</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-gray-600 leading-relaxed">
              Hundreds of images, done in minutes, WCAG-compliant. Upload a CSV
              or paste a URL — AltForge generates proper alt text for every
              image using AI.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-semibold rounded-lg shadow-md text-white bg-brand-600 hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 transition-colors"
              >
                Start free — 25 credits, no card required
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center px-8 py-4 border border-gray-300 text-lg font-semibold rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 transition-colors"
              >
                Log in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-16 md:py-20" aria-labelledby="features-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 id="features-heading" className="text-2xl md:text-3xl font-bold text-center text-gray-900">
            Built for accessibility teams
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              {
                title: "CSV Upload",
                description:
                  "Drop a CSV of image URLs and get alt text for every one. Batch processing that scales.",
              },
              {
                title: "Website Crawl",
                description:
                  "Paste a URL and let AltForge find every image on the page — then generate alt text for all of them.",
              },
              {
                title: "WCAG Compliant",
                description:
                  "Every alt-text suggestion is checked against WCAG 2.1 guidelines. Review, edit, and export.",
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

      {/* Audience */}
      <section className="bg-white py-16 md:py-20" aria-labelledby="audience-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 id="audience-heading" className="text-2xl md:text-3xl font-bold text-center text-gray-900">
            Who uses AltForge?
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              {
                title: "Universities",
                description:
                  "Meet ADA compliance mandates across all your department websites and course materials.",
              },
              {
                title: "E-Commerce",
                description:
                  "Product images need alt text — generate thousands at once and stay compliant.",
              },
              {
                title: "Agencies",
                description:
                  "Deliver accessibility audits faster. AltForge cuts alt-text work from days to minutes.",
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

      {/* CTA */}
      <section className="bg-brand-700 py-16" aria-labelledby="cta-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 id="cta-heading" className="text-2xl md:text-3xl font-bold text-white">
            Ready to make your images accessible?
          </h2>
          <p className="mt-4 text-lg text-brand-100">
            Start with 25 free credits. No credit card required.
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
