import React from "react";

const UPDATED_DATE = "October 28, 2025";
const SUPPORT_EMAIL = "support@nudio.ai";

export function ShopifyTermsOfService() {
  return (
    <>
      <div>
        <h3 className="text-base font-semibold text-white">Terms of Service</h3>
        <p className="text-xs text-white/50 mt-1">Last Updated: {UPDATED_DATE}</p>
      </div>

      <section>
        <h4 className="text-sm font-semibold text-white">1. Agreement to Terms</h4>
        <p className="mt-2">
          By accessing or using nudio.ai ("Service," "we," "us," or "our"), you agree to be bound by these
          Terms of Service and our Privacy Policy.
        </p>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-white">2. Eligibility & Accounts</h4>
        <p className="mt-2">
          You must be at least 13 years old to use the Service. You are responsible for safeguarding your
          login credentials and for any activity under your account.
        </p>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-white">3. Usage-Based Billing</h4>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>Each processed image is billed at the disclosed per-image rate.</li>
          <li>Charges only apply when processing completes successfully.</li>
          <li>All fees are non-refundable unless required by law.</li>
        </ul>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-white">4. User Content & Licenses</h4>
        <p className="mt-2">
          You retain ownership of product photos you submit. You grant nudio.ai a limited license to process
          and display the content solely to provide the Service.
        </p>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-white">5. Prohibited Conduct</h4>
        <p className="mt-2">
          You agree not to use the Service to create or distribute unlawful, infringing, defamatory,
          harassing, hateful, or sexually explicit material, or to attempt to bypass security controls.
        </p>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-white">6. AI Output & Disclaimers</h4>
        <p className="mt-2">
          Outputs may be unpredictable and require manual review. You must verify all content before
          publishing or distributing it. The Service is provided "as is" without warranties.
        </p>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-white">7. Limitation of Liability</h4>
        <p className="mt-2">
          To the fullest extent permitted by law, nudio.ai will not be liable for indirect or consequential
          damages. Our total liability will not exceed the fees you paid in the three months preceding the
          claim.
        </p>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-white">8. Contact</h4>
        <p className="mt-2">
          Questions about these Terms? Email{" "}
          <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </section>
    </>
  );
}
