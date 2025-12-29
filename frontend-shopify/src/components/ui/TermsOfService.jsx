import React from "react";

const UPDATED_DATE = "October 28, 2025";
const SUPPORT_EMAIL = "support@nudio.ai";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-semibold text-slate-900">Terms of Service</h1>
          <p className="text-sm text-slate-500 mt-1">Last Updated: {UPDATED_DATE}</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8 text-[13px] leading-6">
        <section>
          <h2 className="text-xl font-semibold text-slate-900">1. Agreement to Terms</h2>
          <p className="mt-3 text-slate-700">
            By accessing or using nudio.ai (&ldquo;Service,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
            &ldquo;our&rdquo;), you agree to be bound by these Terms of Service and our Privacy Policy.
            If you do not agree, do not use the Service. We may update these Terms from time to time; your
            continued use constitutes acceptance of any updates.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">2. Eligibility &amp; Accounts</h2>
          <p className="mt-3 text-slate-700">
            You must be at least 13 years old to use the Service. Creating an account requires accurate
            information, including a valid email address. You are responsible for safeguarding your login
            credentials and for any activity under your account. Notify us immediately if you suspect
            unauthorized use.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">3. Credits, Subscriptions &amp; Billing</h2>
          <ul className="mt-3 space-y-2 list-disc list-inside text-slate-700">
            <li>Credits and subscription allowances grant access to specific features and may expire as described at purchase.</li>
            <li>All fees are non-refundable unless required by law or expressly stated otherwise.</li>
            <li>We may adjust pricing with reasonable notice; continued use after the effective date constitutes acceptance.</li>
            <li>Chargebacks or payment disputes may result in suspension until the issue is resolved.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">4. User Content &amp; Licenses</h2>
          <p className="mt-3 text-slate-700">
            You retain ownership of product photos, descriptions, and other assets you submit. You grant
            nudio.ai a limited, non-exclusive license to process, store, and display the content solely to
            provide the Service. You are responsible for ensuring you have all necessary rights to the
            content you upload.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">5. Prohibited Conduct</h2>
          <p className="mt-3 text-slate-700">
            You agree not to use the Service to create or distribute unlawful, infringing, defamatory,
            harassing, hateful, or sexually explicit material; to violate the rights of others; to reverse
            engineer, scrape, or exploit the Service; or to attempt to circumvent credit limits, rate caps,
            or security controls. We may suspend or terminate access for violations.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">6. AI Output &amp; Disclaimers</h2>
          <p className="mt-3 text-slate-700">
            nudio.ai relies on third-party AI models and emerging imaging technology. Outputs may be
            unpredictable, contain artifacts, or require manual review. You must verify all content before
            publishing or distributing it. The Service is provided &ldquo;as is&rdquo; without warranties
            of merchantability, fitness for a particular purpose, or non-infringement.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">7. Third-Party Services</h2>
          <p className="mt-3 text-slate-700">
            We integrate with third-party vendors (e.g., payment processors, AI platforms). Their terms and
            policies govern your use of their services. We may modify or discontinue features if vendors
            change pricing or availability in ways that make continued operation commercially unreasonable.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">8. Intellectual Property</h2>
          <p className="mt-3 text-slate-700">
            nudio.ai and its logos, trademarks, and content are our proprietary property or licensed to us.
            Except for the limited license granted above, nothing in these Terms transfers ownership to
            you. You may not remove branding or reverse engineer the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">9. Limitation of Liability</h2>
          <p className="mt-3 text-slate-700">
            To the fullest extent permitted by law, nudio.ai will not be liable for indirect, incidental,
            special, consequential, or punitive damages, or for loss of profits, data, or goodwill arising
            from your use of the Service. Our total liability for any claim will not exceed the fees you
            paid in the three months preceding the event giving rise to the claim.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">10. Indemnification</h2>
          <p className="mt-3 text-slate-700">
            You agree to indemnify and hold harmless nudio.ai, its affiliates, and personnel from any
            claims, losses, liabilities, damages, or expenses (including reasonable attorneys’ fees)
            arising from your content, use of the Service, or violation of these Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">11. Termination</h2>
          <p className="mt-3 text-slate-700">
            We may suspend or terminate access if you breach these Terms, misuse credits, or engage in
            fraudulent or abusive behavior. You may cancel at any time by contacting support. Upon
            termination we may delete your content subject to our Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">12. Governing Law &amp; Dispute Resolution</h2>
          <p className="mt-3 text-slate-700">
            These Terms are governed by the laws of the State of California, without regard to conflicts of
            law principles. Any dispute will be resolved exclusively in the state or federal courts located
            in San Francisco County, California, unless otherwise required by applicable consumer
            protection laws.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">13. Contact</h2>
          <p className="mt-3 text-slate-700">
            Questions about these Terms? Email us at <a className="text-slate-900 underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </section>
      </main>
    </div>
  );
}
