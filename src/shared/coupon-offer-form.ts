/** Owner coupon form — offer-type field visibility + payload parsing. */

export type CouponOfferType = "fixed" | "percent";

export type CouponCreateInput = {
  offerType: CouponOfferType;
  code: string;
  label: string;
  discountPercent?: number;
  targetTier?: string;
  expiresAt?: string;
  showOnPricing?: boolean;
  bannerText?: string;
  maxUses?: number;
  promoPriceMonthly?: number;
  durationMonths?: number;
};

export function couponOfferMode(select: HTMLSelectElement | null): CouponOfferType {
  return select?.value === "percent" ? "percent" : "fixed";
}

/** Show only fields for the active offer type; disable hidden controls so validation + FormData stay clean. */
export function syncCouponOfferFields(form: HTMLFormElement, mode: CouponOfferType): void {
  form.querySelectorAll<HTMLElement>("[data-offer-group]").forEach((group) => {
    const show = group.getAttribute("data-offer-group") === mode;
    group.classList.toggle("hidden", !show);
    group.hidden = !show;
    group.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "input, select, textarea",
    ).forEach((control) => {
      control.disabled = !show;
    });
  });

  form.querySelectorAll<HTMLElement>("[data-offer-hint]").forEach((el) => {
    const show = el.getAttribute("data-offer-hint") === mode;
    el.classList.toggle("hidden", !show);
    el.hidden = !show;
  });
}

function optionalInt(raw: FormDataEntryValue | null): number | undefined {
  const s = String(raw ?? "").trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Parse create-coupon form — only includes fields valid for the selected offer type. */
export function parseCouponCreateForm(form: HTMLFormElement): CouponCreateInput {
  const fd = new FormData(form);
  const offerType = couponOfferMode(form.querySelector<HTMLSelectElement>("[data-offer-type]"));
  const code = String(fd.get("code") ?? "").trim().toUpperCase();
  const label = String(fd.get("label") ?? "").trim();
  const showOnPricing = fd.get("showOnPricing") === "on";
  const bannerText = String(fd.get("bannerText") ?? "").trim() || undefined;

  if (offerType === "fixed") {
    const promoPriceMonthly = optionalInt(fd.get("promoPriceMonthly"));
    const durationMonths = optionalInt(fd.get("durationMonths"));
    const maxUses = optionalInt(fd.get("maxUsesFixed"));
    const targetTier = String(fd.get("targetTierFixed") ?? "").trim() || undefined;
    return {
      offerType,
      code,
      label,
      promoPriceMonthly,
      durationMonths,
      targetTier,
      maxUses,
      showOnPricing,
      bannerText,
    };
  }

  const discountPercent = optionalInt(fd.get("discountPercent"));
  const targetTier = String(fd.get("targetTierPercent") ?? "").trim() || undefined;
  const expiresAt = String(fd.get("expiresAt") ?? "").trim() || undefined;
  const maxUses = optionalInt(fd.get("maxUses"));
  return {
    offerType,
    code,
    label,
    discountPercent,
    targetTier,
    expiresAt,
    maxUses,
    showOnPricing,
    bannerText,
  };
}

export function validateCouponCreateInput(input: CouponCreateInput): string | null {
  if (!input.code || !input.label) return "Coupon code and label are required.";
  if (input.offerType === "fixed") {
    if (input.promoPriceMonthly == null || input.promoPriceMonthly <= 0) {
      return "Promo price (USD/mo) is required for fixed promo offers.";
    }
    if (!input.targetTier) return "Plan tier is required for fixed promo offers.";
    if (input.durationMonths != null && (!Number.isInteger(input.durationMonths) || input.durationMonths < 1)) {
      return "Duration must be a positive whole number of months.";
    }
    if (input.maxUses != null && (!Number.isInteger(input.maxUses) || input.maxUses < 1)) {
      return "Max uses must be a positive whole number.";
    }
    return null;
  }
  const pct = input.discountPercent;
  if (pct == null || !Number.isInteger(pct) || pct < 1 || pct > 100) {
    return "Discount % (1–100) is required for percent-off offers.";
  }
  if (input.maxUses != null && (!Number.isInteger(input.maxUses) || input.maxUses < 1)) {
    return "Max uses must be a positive whole number.";
  }
  return null;
}
