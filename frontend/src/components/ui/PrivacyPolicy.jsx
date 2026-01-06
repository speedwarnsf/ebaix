import React from "react";

const UPDATED_DATE = "October 28, 2025";
const SUPPORT_EMAIL = "support@nudio.ai";

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-semibold text-slate-900">Privacy Policy</h1>
          <p className="text-sm text-slate-500 mt-1">Last Updated: {UPDATED_DATE}</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8 text-[13px] leading-6">
        <section>
          <h2 className="text-xl font-semibold text-slate-900">1. Introduction</h2>
          <p className="mt-3 text-slate-700">
            nudio.ai (&ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;our,&rdquo; or &ldquo;Company&rdquo;) is committed to
            protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and
            safeguard your information when you use our website and services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">2. Information We Collect</h2>
          <h3 className="mt-4 font-semibold text-slate-900">2.1 User-Provided Information</h3>
          <ul className="mt-2 space-y-2 list-disc list-inside text-slate-700">
            <li><span className="font-medium">Account Data:</span> Name, email address, password</li>
            <li><span className="font-medium">Payment Information:</span> Billing address and payment method (processed securely through Stripe and other third-party payment processors)</li>
            <li><span className="font-medium">Product Photos:</span> Images you upload for processing</li>
          </ul>

          <h3 className="mt-4 font-semibold text-slate-900">2.2 Automatically Collected Information</h3>
          <ul className="mt-2 space-y-2 list-disc list-inside text-slate-700">
            <li><span className="font-medium">Device Information:</span> Device type, operating system, browser type</li>
            <li><span className="font-medium">Usage Data:</span> Features accessed, processing history, timestamps</li>
            <li><span className="font-medium">IP Address and Cookies:</span> Used for analytics, abuse detection, and service improvement</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">3. How We Use Your Information</h2>
          <ul className="mt-3 space-y-2 list-disc list-inside text-slate-700">
            <li>Processing and enhancing your product photos and descriptions</li>
            <li>Providing, maintaining, and improving our services</li>
            <li>Sending service updates, billing notices, and customer support communications</li>
            <li>Processing payments and managing subscriptions</li>
            <li>Complying with legal obligations and enforcing our Terms of Service</li>
            <li>Preventing fraud, abuse, and unauthorized access</li>
          </ul>
          <p className="mt-2 text-slate-700">
            nudio.ai relies on emerging, rapidly evolving AI and imaging technology. Results may vary
            from run to run, and some features may occasionally produce unexpected or less predictable
            output. By using the service you acknowledge these limitations and agree to review every
            asset before publishing or distributing it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">4. Third-Party Services</h2>
          <p className="mt-3 text-slate-700">
            nudio.ai uses the following third-party services to provide functionality. These providers
            only receive the data necessary to perform their function and are contractually obligated to
            protect your information:
          </p>
          <ul className="mt-2 space-y-2 list-disc list-inside text-slate-700">
            <li><span className="font-medium">Google Gemini API:</span> AI-powered description enhancement</li>
            <li><span className="font-medium">Image Processing Infrastructure:</span> Background removal and studio lighting effects</li>
            <li><span className="font-medium">Stripe and Other Payment Processors:</span> Secure transaction handling and subscription management</li>
            <li><span className="font-medium">Analytics Services:</span> Usage tracking and product improvement</li>
          </ul>
          <p className="mt-2 text-slate-700">
            Third-party marketplaces or platforms where you post processed listings may have their own
            cancellation or privacy policies. Those policies control your relationship with those
            providers.
          </p>
          <p className="mt-2 text-slate-700">
            We reserve the right to modify, suspend, or discontinue parts of the service if third-party
            vendors adjust their pricing, technical capabilities, or availability in ways that make
            continued operation commercially unreasonable. We will make commercially reasonable efforts
            to provide advance notice of material changes whenever feasible.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">5. Data Storage &amp; Security</h2>
          <ul className="mt-3 space-y-2 list-disc list-inside text-slate-700">
            <li>Your uploaded photos are processed using encrypted infrastructure</li>
            <li>Original photos are retained for up to 30 days to enable re-processing and support requests</li>
            <li>Processed photos are generated on demand. We do not promise long-term storage, so please download immediately after creation</li>
            <li>We use industry-standard encryption (SSL/TLS) to protect data in transit</li>
            <li>Access to user data is restricted to authorized personnel solely for support and compliance</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">6. Your Rights</h2>
          <p className="mt-3 text-slate-700">You have the right to:</p>
          <ul className="mt-2 space-y-2 list-disc list-inside text-slate-700">
            <li>Access the personal data we hold about you</li>
            <li>Request deletion of your data (subject to legal record-keeping requirements)</li>
            <li>Opt out of non-essential marketing or promotional communications</li>
            <li>Receive information about how we use and share your data</li>
          </ul>
          <p className="mt-2 text-slate-700">
            To exercise these rights, contact us at <a className="text-slate-900 underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">7. Data Retention</h2>
          <ul className="mt-3 space-y-2 list-disc list-inside text-slate-700">
            <li><span className="font-medium">Account Data:</span> Retained while your account is active; deleted within 30 days after account closure, except for legally required records</li>
            <li><span className="font-medium">Uploaded Photos:</span> Deleted automatically 30 days after upload unless you request earlier removal</li>
            <li><span className="font-medium">Processed Photos:</span> Retained only while you are actively using the site during a session. We may purge copies without notice, so please save your results as you go—we are not responsible for lost data</li>
            <li><span className="font-medium">Usage Logs:</span> Retained for up to 90 days for security, diagnostics, and analytics</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">8. Children's Privacy</h2>
          <p className="mt-3 text-slate-700">
            nudio.ai is not intended for users under 13 years old. We do not knowingly collect personal
            information from children under 13. If we become aware that we have collected such
            information, we will delete it promptly.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">11. Service Availability &amp; Vendor Changes</h2>
          <p className="mt-3 text-slate-700">
            We may update, suspend, or discontinue features if maintaining them is no longer feasible due
            to third-party vendor changes, increased costs, or evolving legal requirements. If a paid
            feature is materially affected, we will either provide comparable functionality or issue a
            prorated refund for unused credits. We do not guarantee uninterrupted service, but we strive to
            minimize downtime and communicate material changes in advance.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">12. Acceptable Use &amp; Abuse Prevention</h2>
          <p className="mt-3 text-slate-700">
            You agree not to use nudio.ai to create, upload, or distribute unlawful, abusive, or harmful
            content. This includes, but is not limited to, imagery or descriptions that infringe copyrights,
            promote violence, harassment, hate, or sexual exploitation. We reserve the right to investigate
            and suspend or terminate access for any account—or anonymous usage—that violates these
            expectations or attempts to circumvent rate limits, credits, or security controls. When legally
            required, we may preserve or disclose content to law enforcement or other competent
            authorities.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">9. Changes to This Policy</h2>
          <p className="mt-3 text-slate-700">
            We may update this Privacy Policy periodically. We will notify you of significant changes via
            email or by placing a prominent notice on our website. Your continued use of nudio.ai after
            changes take effect constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">10. Contact Us</h2>
          <p className="mt-3 text-slate-700">
            For questions about this Privacy Policy or our privacy practices, contact:
          </p>
          <ul className="mt-2 space-y-1 list-none text-slate-700">
            <li><span className="font-medium">Email:</span> <a className="text-slate-900 underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></li>
          </ul>
          <p className="mt-3 text-slate-700">
            EU/GDPR Users: If you reside in the European Union, you may have additional rights under
            applicable data protection laws. Contact us to request our GDPR Supplemental Notice.
          </p>
          <p className="text-slate-700">
            California Residents (CCPA): You may request our California Privacy Notice by emailing
            support. It describes how to exercise your access, deletion, and opt-out rights under the CCPA.
          </p>
        </section>
      </main>
    </div>
  );
}

export default PrivacyPolicy;
