export default function PrivacyPage() {
  return (
    <div className="bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: July 28, 2026</p>

        <div className="mt-10 prose prose-gray max-w-none space-y-8">
          <section aria-labelledby="sec1">
            <h2 id="sec1" className="text-lg font-bold text-gray-900">
              1. Information We Collect
            </h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              When you use AltForge, we collect the following information:
            </p>
            <ul className="mt-2 list-disc list-inside text-gray-700 leading-relaxed space-y-1">
              <li><strong>Account information</strong> — your email address and a hashed password when you create an account.</li>
              <li><strong>Uploaded content</strong> — image URLs you submit (via CSV, website crawl, or direct upload) for alt-text generation. Images uploaded directly are temporarily processed in memory and are not stored on our servers. Image URLs from CSV and crawl jobs are stored alongside generated alt-text results.</li>
              <li><strong>Generated content</strong> — the AI-generated alt-text produced for each image you process.</li>
              <li><strong>Payment information</strong> — when you purchase credits, your payment is processed by Stripe. We do not store your full credit card details. We receive a customer reference and transaction confirmation from Stripe.</li>
              <li><strong>Usage data</strong> — job metadata (number of images processed, crawl URLs, timestamps) and credit consumption history.</li>
            </ul>
          </section>

          <section aria-labelledby="sec2">
            <h2 id="sec2" className="text-lg font-bold text-gray-900">
              2. How We Use Your Information
            </h2>
            <ul className="mt-2 list-disc list-inside text-gray-700 leading-relaxed space-y-1">
              <li>To provide the AltForge service: generating AI alt-text, displaying results, and managing your credits.</li>
              <li>To send transactional emails related to your account (welcome email, low-credit warnings, payment confirmations).</li>
              <li>To process payments and deliver purchased credits.</li>
              <li>To improve the service and diagnose technical issues.</li>
              <li>To comply with legal obligations.</li>
            </ul>
            <p className="mt-2 text-gray-700 leading-relaxed">
              We do not use your uploaded images or generated alt-text to train AI models. Your content is sent to our AI provider (Anthropic) solely for the purpose of generating alt-text for your account.
            </p>
          </section>

          <section aria-labelledby="sec3">
            <h2 id="sec3" className="text-lg font-bold text-gray-900">
              3. Third-Party Services
            </h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              We use the following third-party services to operate AltForge:
            </p>
            <ul className="mt-2 list-disc list-inside text-gray-700 leading-relaxed space-y-1">
              <li><strong>Anthropic (Claude API)</strong> — receives your image URLs to generate alt-text. See{" "}
                <a href="https://www.anthropic.com/legal/privacy" className="text-brand-600 hover:text-brand-800 underline" target="_blank" rel="noopener noreferrer">Anthropic's Privacy Policy</a>.
              </li>
              <li><strong>Stripe</strong> — processes payments and manages subscriptions. See{" "}
                <a href="https://stripe.com/privacy" className="text-brand-600 hover:text-brand-800 underline" target="_blank" rel="noopener noreferrer">Stripe's Privacy Policy</a>.
              </li>
              <li><strong>Resend</strong> — sends transactional emails on our behalf. See{" "}
                <a href="https://resend.com/legal/privacy-policy" className="text-brand-600 hover:text-brand-800 underline" target="_blank" rel="noopener noreferrer">Resend's Privacy Policy</a>.
              </li>
              <li><strong>Google AdSense</strong> — may serve advertisements on public-facing pages. See{" "}
                <a href="https://policies.google.com/privacy" className="text-brand-600 hover:text-brand-800 underline" target="_blank" rel="noopener noreferrer">Google's Privacy Policy</a>.
              </li>
              <li><strong>Cloudflare Turnstile</strong> — provides CAPTCHA verification on our free demo. See{" "}
                <a href="https://www.cloudflare.com/privacypolicy/" className="text-brand-600 hover:text-brand-800 underline" target="_blank" rel="noopener noreferrer">Cloudflare's Privacy Policy</a>.
              </li>
            </ul>
            <p className="mt-2 text-gray-700 leading-relaxed">
              We do not sell, rent, or share your personal information with third parties for their own marketing purposes.
            </p>
          </section>

          <section aria-labelledby="sec4">
            <h2 id="sec4" className="text-lg font-bold text-gray-900">
              4. Data Storage and Security
            </h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              All data is stored in the United States. We use industry-standard security practices including encrypted connections (HTTPS), password hashing (bcrypt), and database access controls. Payment information is handled exclusively by Stripe and is never stored on our servers.
            </p>
            <p className="mt-2 text-gray-700 leading-relaxed">
              While we take reasonable precautions, no method of electronic storage is 100% secure. We cannot guarantee absolute security of your data.
            </p>
          </section>

          <section aria-labelledby="sec5">
            <h2 id="sec5" className="text-lg font-bold text-gray-900">
              5. Data Retention
            </h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              We retain your account information, job history, and generated results for as long as your account is active. You may delete individual jobs from your dashboard at any time. If you wish to delete your entire account and all associated data, please contact us at the email address below.
            </p>
          </section>

          <section aria-labelledby="sec6">
            <h2 id="sec6" className="text-lg font-bold text-gray-900">
              6. Cookies and Tracking
            </h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              We use essential session cookies to keep you logged in. We do not use tracking cookies or analytics cookies. Google AdSense may set its own cookies on public-facing pages — you can manage these through Google's{" "}
              <a href="https://adssettings.google.com" className="text-brand-600 hover:text-brand-800 underline" target="_blank" rel="noopener noreferrer">Ad Settings</a>.
            </p>
          </section>

          <section aria-labelledby="sec7">
            <h2 id="sec7" className="text-lg font-bold text-gray-900">
              7. Your Rights
            </h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              You have the right to:
            </p>
            <ul className="mt-2 list-disc list-inside text-gray-700 leading-relaxed space-y-1">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your data (subject to any legal obligations we may have to retain it).</li>
              <li>Export your job results (available directly in the application via CSV/HTML export).</li>
            </ul>
            <p className="mt-2 text-gray-700 leading-relaxed">
              To exercise any of these rights, contact us at the email address below. We will respond within 30 days.
            </p>
          </section>

          <section aria-labelledby="sec8">
            <h2 id="sec8" className="text-lg font-bold text-gray-900">
              8. Children's Privacy
            </h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              AltForge is not intended for use by children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal data, please contact us and we will delete it.
            </p>
          </section>

          <section aria-labelledby="sec9">
            <h2 id="sec9" className="text-lg font-bold text-gray-900">
              9. Changes to This Policy
            </h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of material changes by email or through the Service. Continued use of AltForge after changes take effect constitutes acceptance of the updated policy.
            </p>
          </section>

          <section aria-labelledby="sec10">
            <h2 id="sec10" className="text-lg font-bold text-gray-900">
              10. Contact Us
            </h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              If you have questions about this Privacy Policy or wish to exercise your data rights, contact us at{" "}
              <a href="mailto:altforgeaccessibility@gmail.com" className="text-brand-600 hover:text-brand-800 underline">
                altforgeaccessibility@gmail.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
