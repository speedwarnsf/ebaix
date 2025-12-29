import React from "react";

const UPDATED_DATE = "October 28, 2025";
const SUPPORT_EMAIL = "support@nudio.ai";

export function ShopifyPrivacyPolicy() {
  return (
    <>
      <div>
        <h3 className="text-base font-semibold text-white">Privacy Policy</h3>
        <p className="text-xs text-white/50 mt-1">Last Updated: {UPDATED_DATE}</p>
      </div>

      <section>
        <h4 className="text-sm font-semibold text-white">1. Introduction</h4>
        <p className="mt-2">
          nudio.ai ("we," "us," "our," or "Company") is committed to protecting your privacy.
          This Privacy Policy explains how we collect, use, disclose, and safeguard your information
          when you use our services.
        </p>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-white">2. Information We Collect</h4>
        <h5 className="mt-3 font-semibold text-white/90">2.1 User-Provided Information</h5>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li><span className="font-medium">Account Data:</span> Name, email address, password</li>
          <li><span className="font-medium">Payment Information:</span> Billing address and payment method (processed securely through third-party processors)</li>
          <li><span className="font-medium">Product Photos:</span> Images you upload for processing</li>
        </ul>

        <h5 className="mt-4 font-semibold text-white/90">2.2 Automatically Collected Information</h5>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li><span className="font-medium">Device Information:</span> Device type, operating system, browser type</li>
          <li><span className="font-medium">Usage Data:</span> Features accessed, processing history, timestamps</li>
          <li><span className="font-medium">IP Address and Cookies:</span> Used for analytics, abuse detection, and service improvement</li>
        </ul>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-white">3. How We Use Your Information</h4>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>Processing and enhancing your product photos</li>
          <li>Providing, maintaining, and improving our services</li>
          <li>Sending service updates, billing notices, and customer support communications</li>
          <li>Processing payments and managing usage-based billing</li>
          <li>Complying with legal obligations and enforcing our Terms of Service</li>
          <li>Preventing fraud, abuse, and unauthorized access</li>
        </ul>
        <p className="mt-2">
          nudio.ai relies on emerging, rapidly evolving AI and imaging technology. Results may vary
          from run to run. By using the service you acknowledge these limitations and agree to review
          every asset before publishing or distributing it.
        </p>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-white">4. Third-Party Services</h4>
        <p className="mt-2">
          nudio.ai uses third-party services to provide functionality. These providers only receive the
          data necessary to perform their function and are contractually obligated to protect your information.
        </p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li><span className="font-medium">Google Gemini API:</span> AI-powered image processing</li>
          <li><span className="font-medium">Image Processing Infrastructure:</span> Background replacement and studio lighting effects</li>
          <li><span className="font-medium">Payment Processors:</span> Secure transaction handling</li>
          <li><span className="font-medium">Analytics Services:</span> Usage tracking and product improvement</li>
        </ul>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-white">5. Data Storage & Security</h4>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>Your uploaded photos are processed using encrypted infrastructure</li>
          <li>Original photos are retained for up to 30 days to enable re-processing and support requests</li>
          <li>Processed photos are generated on demand and should be downloaded promptly</li>
          <li>We use industry-standard encryption (SSL/TLS) to protect data in transit</li>
        </ul>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-white">6. Your Rights</h4>
        <p className="mt-2">You have the right to:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>Access the personal data we hold about you</li>
          <li>Request deletion of your data (subject to legal record-keeping requirements)</li>
          <li>Opt out of non-essential marketing or promotional communications</li>
          <li>Receive information about how we use and share your data</li>
        </ul>
        <p className="mt-2">
          To exercise these rights, contact us at{" "}
          <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-white">7. Data Retention</h4>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li><span className="font-medium">Account Data:</span> Retained while your account is active; deleted within 30 days after account closure</li>
          <li><span className="font-medium">Uploaded Photos:</span> Deleted automatically 30 days after upload unless you request earlier removal</li>
          <li><span className="font-medium">Processed Photos:</span> Retained only while you are actively using the app during a session</li>
          <li><span className="font-medium">Usage Logs:</span> Retained for up to 90 days for security and diagnostics</li>
        </ul>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-white">8. Children's Privacy</h4>
        <p className="mt-2">
          nudio.ai is not intended for users under 13 years old. We do not knowingly collect personal
          information from children under 13.
        </p>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-white">9. Changes to This Policy</h4>
        <p className="mt-2">
          We may update this Privacy Policy periodically. We will notify you of significant changes via
          email or by placing a prominent notice on our website.
        </p>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-white">10. Contact Us</h4>
        <p className="mt-2">
          For questions about this Privacy Policy or our privacy practices, contact{" "}
          <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </section>
    </>
  );
}
