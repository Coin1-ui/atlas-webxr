export type LegalDocId = "terms" | "privacy" | "acceptable-use";

export type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalDocument = {
  id: LegalDocId;
  title: string;
  effectiveDate: string;
  intro: string;
  sections: LegalSection[];
  disclaimer: string;
};

const EFFECTIVE = "21 May 2026";
const CONTACT = "legal@atlas-ar.com";
const PRIVACY = "privacy@atlas-ar.com";
const GRIEVANCE = "grievance@atlas-ar.com";

export const LEGAL_DOCS: Record<LegalDocId, LegalDocument> = {
  terms: {
    id: "terms",
    title: "Terms of Service",
    effectiveDate: EFFECTIVE,
    intro:
      "These Terms of Service (“Terms”) govern access to and use of the Atlas AR platform, websites, and related services (collectively, the “Service”) operated by Atlas AR (“we”, “us”, “our”). By creating an account, starting a trial, or using the Service, you agree to these Terms. If you use the Service on behalf of an organization, you represent that you have authority to bind that organization.",
    disclaimer:
      "These Terms are provided for operational transparency. They are not legal advice. Organizations subject to sector-specific regulation should obtain independent counsel before relying on them.",
    sections: [
      {
        id: "eligibility",
        title: "1. Eligibility and accounts",
        paragraphs: [
          "You must be at least 18 years old (or the age of majority in your jurisdiction) to create an account. You are responsible for safeguarding credentials and for all activity under your account.",
          "Workspace owners may invite administrators. You must provide accurate registration information and keep it current.",
        ],
      },
      {
        id: "service",
        title: "2. The Service",
        paragraphs: [
          "Atlas AR provides a hosted platform to upload 3D product models, configure branded customer-facing workspaces, and enable browser-based augmented reality placement on supported mobile browsers. Features, limits, and availability may change as described in your plan or order form.",
          "The Service depends on third-party browsers, devices, cameras, and network connectivity. We do not guarantee AR availability on every device or in every environment.",
        ],
      },
      {
        id: "customer-content",
        title: "3. Your content and workspaces",
        paragraphs: [
          "You retain ownership of models, images, logos, and other materials you upload (“Customer Content”). You grant us a limited license to host, process, transform (including format conversion for mobile AR), transmit, and display Customer Content solely to provide and improve the Service.",
          "You represent that you have all rights necessary to upload Customer Content and to grant the above license, and that Customer Content does not infringe third-party rights or violate applicable law.",
        ],
      },
      {
        id: "fees",
        title: "4. Fees, trials, and taxes",
        paragraphs: [
          "Paid plans, trials, overage, and enterprise orders are described on our pricing page or in an order form. Unless stated otherwise, fees are billed in advance, non-refundable except where required by law, and exclusive of taxes, which you are responsible for where applicable.",
          "We may change list prices on notice. Continued use after a price change constitutes acceptance for renewal periods.",
        ],
      },
      {
        id: "restrictions",
        title: "5. Acceptable use",
        paragraphs: [
          "Use of the Service is also governed by our Acceptable Use Policy, incorporated by reference. We may suspend or terminate access for material violations.",
        ],
      },
      {
        id: "privacy",
        title: "6. Privacy",
        paragraphs: [
          "Our Privacy Policy describes how we process personal data. It is a separate document and forms part of your agreement with us.",
        ],
      },
      {
        id: "ip",
        title: "7. Intellectual property",
        paragraphs: [
          "We and our licensors own the Service, software, documentation, and branding, excluding Customer Content. No rights are granted except as expressly stated in these Terms.",
        ],
      },
      {
        id: "warranty",
        title: "8. Disclaimers",
        paragraphs: [
          "THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.",
        ],
      },
      {
        id: "liability",
        title: "9. Limitation of liability",
        paragraphs: [
          "TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER PARTY SHALL BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL. OUR AGGREGATE LIABILITY ARISING FROM THE SERVICE SHALL NOT EXCEED THE FEES PAID BY YOU FOR THE SERVICE IN THE TWELVE (12) MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM, OR ONE HUNDRED US DOLLARS (USD $100) IF YOU USE A FREE OR TRIAL TIER.",
          "Some jurisdictions do not allow certain limitations; in those cases, limits apply to the fullest extent permitted.",
        ],
      },
      {
        id: "indemnity",
        title: "10. Indemnification",
        paragraphs: [
          "You will defend and indemnify us against third-party claims arising from Customer Content, your use of the Service in violation of these Terms or law, or your products placed in AR experiences, except to the extent caused by our gross negligence or willful misconduct.",
        ],
      },
      {
        id: "termination",
        title: "11. Term and termination",
        paragraphs: [
          "Either party may terminate for convenience according to plan terms. We may suspend or terminate immediately for non-payment, security risk, or material breach. Upon termination, your right to access the Service ends; export obligations are described in the Privacy Policy and order form.",
        ],
      },
      {
        id: "law",
        title: "12. Governing law and disputes",
        paragraphs: [
          "Unless mandatory local law requires otherwise, these Terms are governed by the laws of the State of Delaware, USA, without regard to conflict-of-law rules. Courts in Delaware shall have exclusive jurisdiction, except that either party may seek injunctive relief in any competent court.",
          "If you are a consumer in the European Union, United Kingdom, Canada, India, or another jurisdiction with mandatory consumer protections, nothing in these Terms limits non-waivable rights under applicable law.",
        ],
      },
      {
        id: "changes",
        title: "13. Changes",
        paragraphs: [
          "We may update these Terms by posting a revised version with a new effective date. Material changes will be notified via the Service or email where appropriate. Continued use after the effective date constitutes acceptance.",
        ],
      },
      {
        id: "contact",
        title: "14. Contact",
        paragraphs: [`Questions about these Terms: ${CONTACT}. Atlas AR is a product of Omni Manual Private Limited.`],
      },
    ],
  },
  privacy: {
    id: "privacy",
    title: "Privacy Policy",
    effectiveDate: EFFECTIVE,
    intro:
      "This Privacy Policy explains how Atlas AR (“we”, “us”) processes personal data when you visit our websites, create an account, use browser-based AR features, or interact with a customer workspace powered by Atlas AR. This Policy is separate from our Terms of Service and is designed to meet transparency expectations under the EU/UK GDPR, California CPRA, Canada’s PIPEDA, India’s Digital Personal Data Protection Act, 2023 (DPDPA), and comparable laws in other regions where we offer the Service.",
    disclaimer:
      "This Policy describes our current practices. It is not legal advice. Consult qualified counsel for jurisdiction-specific compliance, especially if you are a Significant Data Fiduciary or process large volumes of sensitive data.",
    sections: [
      {
        id: "controller",
        title: "1. Who we are",
        paragraphs: [
          "Atlas AR is operated by Omni Manual Private Limited (\"Atlas AR\", \"we\", \"us\"). Atlas AR is the data controller for account, billing, and platform operations data. For end-customers who only open a tenant showroom link without an Atlas account, the workspace owner may act as an independent controller for their customer relationship; we process data as a processor according to their instructions and this Policy.",
          `Privacy inquiries: ${PRIVACY}. Grievance officer (India DPDPA): ${GRIEVANCE}.`,
        ],
      },
      {
        id: "data-collected",
        title: "2. Personal data we collect",
        paragraphs: ["We may collect the following categories:"],
        bullets: [
          "Account data: name, email, workspace name, authentication identifiers, role assignments.",
          "Billing data: plan, payment status, invoicing contacts (payment card data is handled by payment processors, not stored by us).",
          "Usage and analytics: AR session events, model views, placements, device/browser type, approximate region, timestamps, error logs.",
          "Camera and motion: when you start an in-browser AR session, the camera feed is processed locally on your device for placement; we do not record or store raw camera video on our servers unless a specific diagnostic feature is enabled with consent.",
          "Customer Content metadata: filenames, model dimensions, branding settings.",
          "Support communications: messages you send to us.",
          "Cookies and similar technologies: session, authentication, and preference cookies as described below.",
        ],
      },
      {
        id: "purposes",
        title: "3. Purposes and legal bases (GDPR/UK GDPR)",
        paragraphs: ["We process personal data to:"],
        bullets: [
          "Provide, secure, and improve the Service (contract; legitimate interests).",
          "Authenticate users and enforce Terms (contract; legitimate interests).",
          "Measure usage, billing, and plan limits (contract; legitimate interests).",
          "Send service and security notices (contract; legitimate interests; consent where required).",
          "Comply with law and respond to lawful requests (legal obligation).",
          "Marketing with consent where required (consent).",
        ],
      },
      {
        id: "rights",
        title: "4. Your rights",
        paragraphs: [
          "Depending on your location, you may have rights to access, correct, delete, restrict, object, port data, and withdraw consent. California residents may have rights to know, delete, correct, and opt out of certain sharing. Canadian residents may request access and correction under PIPEDA. Indian residents may exercise rights under the DPDPA, including grievance redressal.",
          `Submit requests to ${PRIVACY}. We respond within timelines required by applicable law (e.g., 30 days under GDPR where applicable). We may verify identity before fulfilling requests.`,
        ],
      },
      {
        id: "retention",
        title: "5. Retention",
        paragraphs: [
          "We retain personal data while your account is active and as needed for billing, security, and legal compliance. Session analytics may be aggregated or deleted according to plan settings. Backup retention may extend up to 90 days after deletion.",
        ],
      },
      {
        id: "sharing",
        title: "6. Processors and international transfers",
        paragraphs: [
          "We use infrastructure and subprocessors for hosting, authentication, email, analytics, and payment processing. A current subprocessor list is available on request. Data may be processed in the United States, European Union, India, and other regions where our providers operate.",
          "Where required, we rely on Standard Contractual Clauses, adequacy decisions, or comparable transfer mechanisms for cross-border transfers from the EEA, UK, or other restricted regions.",
        ],
      },
      {
        id: "security",
        title: "7. Security",
        paragraphs: [
          "We implement administrative, technical, and organizational measures including encryption in transit (HTTPS/TLS), access controls, tenant isolation for catalogs, and monitoring. No method of transmission or storage is completely secure.",
        ],
      },
      {
        id: "children",
        title: "8. Children",
        paragraphs: [
          "The Service is not directed to children under 16 (or under 18 in India for consent purposes). We do not knowingly collect children’s personal data without verifiable parental or guardian consent where required by the DPDPA or other law.",
        ],
      },
      {
        id: "breach",
        title: "9. Personal data breaches",
        paragraphs: [
          "We maintain procedures to assess and notify supervisory authorities and affected individuals of personal data breaches where required by GDPR, DPDPA, PIPEDA, or US state law.",
        ],
      },
      {
        id: "cookies",
        title: "10. Cookies",
        paragraphs: [
          "Strictly necessary cookies enable login and security. Analytics cookies, if used, will be disclosed in a cookie notice and enabled only with consent where required in the EU/UK/EEA.",
        ],
      },
      {
        id: "changes-privacy",
        title: "11. Changes",
        paragraphs: [
          "We will update this Policy with a new effective date when practices change materially. We will provide additional notice where required by law.",
        ],
      },
    ],
  },
  "acceptable-use": {
    id: "acceptable-use",
    title: "Acceptable Use Policy",
    effectiveDate: EFFECTIVE,
    intro:
      "This Acceptable Use Policy (“AUP”) governs use of Atlas AR services. It applies to account holders, administrators, and anyone accessing a workspace or AR experience. It supplements our Terms of Service.",
    disclaimer:
      "Violations may result in suspension or termination without refund where permitted by law and your order form.",
    sections: [
      {
        id: "permitted",
        title: "1. Permitted use",
        paragraphs: [
          "Use the Service to showcase products you are authorized to sell or demonstrate, train field teams, and operate branded showrooms for legitimate commercial purposes in compliance with law.",
        ],
      },
      {
        id: "prohibited",
        title: "2. Prohibited conduct",
        paragraphs: ["You must not:"],
        bullets: [
          "Upload malware, illegal content, or models you do not have rights to distribute.",
          "Use the Service to harass, deceive, or impersonate others.",
          "Attempt to bypass plan limits, tenant isolation, or security controls.",
          "Scrape, reverse engineer, or overload the Service except as permitted by law.",
          "Use camera or AR features in private spaces without consent of occupants where required by law.",
          "Process special-category personal data through the Service without a lawful basis and appropriate safeguards.",
          "Resell the Service without a written partner agreement.",
        ],
      },
      {
        id: "ar-safety",
        title: "3. AR and camera responsibilities",
        paragraphs: [
          "Browser-based AR requires camera access on the user’s device. You must provide clear notice to your customers and obtain permissions required in your jurisdiction before enabling AR. Users should remain aware of their physical surroundings while using AR.",
        ],
      },
      {
        id: "content-moderation",
        title: "4. Content standards",
        paragraphs: [
          "Customer Content must comply with applicable advertising, consumer protection, and sector rules (e.g., furniture safety representations, accurate dimensions). You are solely responsible for claims made through your AR experiences.",
        ],
      },
      {
        id: "enforcement",
        title: "5. Enforcement",
        paragraphs: [
          "We may investigate complaints, remove content, throttle usage, or suspend accounts to protect users and the platform. Report abuse to " + CONTACT + ".",
        ],
      },
    ],
  },
};

export function legalDocPath(id: LegalDocId): string {
  return `/legal/${id}`;
}
