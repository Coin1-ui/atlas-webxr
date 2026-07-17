/** Marketing landing static assets (served from /public/marketing). */
const base = import.meta.env.BASE_URL;

export const MKT_ASSETS = {
  heroPhone: `${base}marketing/hero-ar-phone.png`,
  heroPhoneWebp: `${base}marketing/hero-ar-phone.webp`,
  heroPhone2x: `${base}marketing/hero-ar-phone.png`,
  heroBg: `${base}marketing/hero-bg-mesh.png`,
  usecaseRetail: `${base}marketing/usecase-retail.png`,
  usecaseFieldSales: `${base}marketing/usecase-field-sales.png`,
  stepsWorkflow: `${base}marketing/steps-workflow.png`,
  authHero: `${base}marketing/auth-hero-ar.png`,
  authWorkspace: `${base}marketing/auth-workspace-hero.png`,
  omniManualLogo: `${base}marketing/omni-manual-logo.png`,
} as const;
