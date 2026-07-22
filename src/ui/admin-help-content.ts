/** In-app admin help — SUP-1 + SUP-2 troubleshooting */

import { AR_TROUBLESHOOTING_SECTIONS } from "./ar-troubleshooting-content";

export type AdminHelpSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  tip?: string;
};

export const ADMIN_HELP_SECTIONS: AdminHelpSection[] = [  {
    id: "upload",
    title: "Upload your first 3D model",
    paragraphs: [
      "Use Manage 3D models on desktop admin only. Each product needs a display name, a square icon image (PNG, JPEG, or WebP), and a GLB file.",
      "When upload succeeds, Atlas AR stores the model in your workspace prefix and generates USDZ for Safari AR automatically.",
      "Max 50 MB per GLB or USDZ file on every plan. Each model uses about 2.5× the GLB size in workspace storage (GLB + iOS USDZ).",
    ],
    bullets: [
      "GLB must be valid glTF 2.0 binary — export from Blender, Sketchfab, or your PIM as .glb",
      "Keep each GLB under 50 MB. Prefer GLBs under ~33 MB if you rely on auto-USDZ so conversion stays under the cap.",
      "Workspace storage is derived from your plan model slots × 50 MB × 2.5 — compress textures if uploads are slow",
      "Name appears in the showroom catalog; use the same name shoppers recognize",
    ],
    tip: "Target: first model live in under 10 minutes from signup.",
  },
  {
    id: "share",
    title: "Share your showroom link",
    paragraphs: [
      "Your branded showroom lives at /w/your-slug — shoppers and field reps open it on a phone browser. No account or app install required.",
      "Each uploaded model also gets a direct AR link you can paste into email, SMS, or QR codes for a single SKU.",
    ],
    bullets: [
      "Showroom link — full catalog with View in AR on every product",
      "Direct AR link — skips catalog, opens Start AR for one model",
      "Copy link from admin dashboard, get-started wizard, or the model card toolbar",
    ],
  },
  {
    id: "devices",
    title: "iPhone vs Android",
    paragraphs: [
      "Shoppers use browser-based AR only — you never publish to the App Store or Play Store.",
    ],
    bullets: [
      "Android (Chrome): Start AR → scan floor → place at true scale → AR/3D toggle to inspect",
      "iPhone (Safari): View in AR opens Safari AR with USDZ generated at upload",
      "iPhone model picker: model tiles are icon + label buttons — VoiceOver reads the model name; ensure each icon has alt text or is decorative",
      "3D mode — rotate and zoom the placed catalog model without leaving the session (Android)",
      "Desktop admin is for uploads and branding; AR preview always happens on a phone",
    ],
    tip: "Train store staff: on iPhone say View in AR, not Start AR.",
  },
  ...AR_TROUBLESHOOTING_SECTIONS,
];
