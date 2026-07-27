export default function TermsPage() {
  return (
    <div className="bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: 2026</p>

        <div className="mt-10 prose prose-gray max-w-none space-y-8">
          <section aria-labelledby="sec1">
            <h2 id="sec1" className="text-lg font-bold text-gray-900">
              1. Acceptance of Terms
            </h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              By creating an account or using AltForge (&ldquo;the
              Service&rdquo;), you agree to these Terms of Service. If you do
              not agree, do not use the Service.
            </p>
          </section>

          <section aria-labelledby="sec2">
            <h2 id="sec2" className="text-lg font-bold text-gray-900">
              2. Description of Service
            </h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              AltForge is a software tool that helps generate and review image
              alt-text using automated and AI-assisted processes. AltForge
              assists with accessibility workflows. It does not certify,
              guarantee, or warrant legal compliance with the Web Content
              Accessibility Guidelines (WCAG), the Americans with Disabilities
              Act (ADA), Section 508, or any other accessibility law or
              standard, in whole or in part.
            </p>
          </section>

          <section aria-labelledby="sec3">
            <h2 id="sec3" className="text-lg font-bold text-gray-900">
              3. No Compliance Guarantee
            </h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              Accessibility conformance depends on many factors beyond image
              alt-text, including but not limited to color contrast, keyboard
              navigation, document structure, captions, and more, which this
              Service does not assess. Any score, tier, or &ldquo;readiness&rdquo;
              label shown in the Service reflects automated checks on image
              alt-text only and is not a legal determination of compliance. You
              are solely responsible for verifying compliance with applicable law
              and should consult a qualified accessibility professional or legal
              counsel for a full conformance review.
            </p>
          </section>

          <section aria-labelledby="sec4">
            <h2 id="sec4" className="text-lg font-bold text-gray-900">
              4. User Responsibilities
            </h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              You are responsible for reviewing and approving all AI-generated
              content before publishing it. You agree not to represent output
              from this Service as an official compliance certification to any
              third party, regulator, or court.
            </p>
          </section>

          <section aria-labelledby="sec5">
            <h2 id="sec5" className="text-lg font-bold text-gray-900">
              5. Account and Payment
            </h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              Account creation requires a valid email address. Credits and
              subscriptions are billed as described on the Pricing page. One-time
              credit packs are non-refundable after credits are consumed.
              Subscription plans may be cancelled at any time; cancellation takes
              effect at the end of the current billing period. Refunds are
              handled on a case-by-case basis — contact us at{" "}
              <a
                href="mailto:altforgeaccessibility@gmail.com"
                className="text-brand-600 hover:text-brand-800 underline focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                altforgeaccessibility@gmail.com
              </a>
              .
            </p>
          </section>

          <section aria-labelledby="sec6">
            <h2 id="sec6" className="text-lg font-bold text-gray-900">
              6. Intellectual Property
            </h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              You retain ownership of content you upload. You grant AltForge a
              limited license to process that content solely to provide the
              Service. AltForge retains ownership of the Service itself,
              including its software and design.
            </p>
          </section>

          <section aria-labelledby="sec7">
            <h2 id="sec7" className="text-lg font-bold text-gray-900">
              7. Limitation of Liability
            </h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              To the maximum extent permitted by law, AltForge and its operators
              are not liable for any indirect, incidental, or consequential
              damages arising from use of the Service, including but not limited
              to legal claims, penalties, or damages related to accessibility
              non-compliance. The Service is provided &ldquo;as is&rdquo; without
              warranties of any kind.
            </p>
          </section>

          <section aria-labelledby="sec8">
            <h2 id="sec8" className="text-lg font-bold text-gray-900">
              8. Termination
            </h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              Either party may terminate the relationship at any time. Upon
              termination, your right to access the Service will immediately
              cease. We may retain anonymized data for analytical purposes. You
              may request deletion of your account data by contacting us.
            </p>
          </section>

          <section aria-labelledby="sec9">
            <h2 id="sec9" className="text-lg font-bold text-gray-900">
              9. Changes to Terms
            </h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              We may update these terms from time to time. Continued use of the
              Service after changes constitutes acceptance. We will notify users
              of material changes via email or an in-app notice.
            </p>
          </section>

          <section aria-labelledby="sec10">
            <h2 id="sec10" className="text-lg font-bold text-gray-900">
              10. Contact
            </h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              Questions about these terms:{" "}
              <a
                href="mailto:altforgeaccessibility@gmail.com"
                className="text-brand-600 hover:text-brand-800 underline focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                altforgeaccessibility@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
