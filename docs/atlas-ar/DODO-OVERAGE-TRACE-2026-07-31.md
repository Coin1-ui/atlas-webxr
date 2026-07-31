# Dodo overage trace — 2026-07-31 (IST)

**Scope:** Read-only identify which Atlas / Dodo account was charged **meter overage** today (test mode).  
**Host:** `https://test.dodopayments.com`  
**Script:** [`scripts/investigate-dodo-overage-today.mjs`](../../scripts/investigate-dodo-overage-today.mjs)  
**No API keys or JWTs stored here.**

---

## Verdict

| Result | Detail |
|--------|--------|
| **Overage charged** | **Yes — one payment** |
| **Account** | **`aryan.barua007@gmail.com`** (Dodo customer `cus_0Nje8lgcLcodCc5wzGwWu`) |
| **Payment** | `pay_0NkNxZTsxympGoNbZJoIo` · **USD $59.14** (5914¢) vs Launch fixed **$59.00** (5900¢) |
| **Surplus** | **+$0.14** meter overage |
| **Subscription** | `sub_0NkJM4YIKzoUK0ksXz3iR` · product Launch `pdt_0Njk5QMJ8uCwSvseuHeo0` |
| **Likely cause** | Subscription storage meter has **`free_threshold: -362807296`** (negative). All storage usage is treated as billable overage (BILL-METER-SYNC / int32 free-threshold class of bug). Not proven to be Account “Seed overage” sandbox events, but sandbox ingest was **true earlier today** before OPS-INGEST PASS. |

**Atlas workspace:** Dynamo map not run (no AWS CLI in agent env). Match in Owner → Customers by `billingCustomerId` / `billingSubscriptionId` above, or known Launch test account for `aryan.barua007` (memory: CT202 Sofa / Launch probes).

---

## All succeeded payments (IST 2026-07-31)

| Payment | Email | Amount | Product (from sub) | Overage? |
|---------|-------|--------|--------------------|----------|
| `pay_0NkO0JPqsh6uskwPbAMup` | aryan.barua57@gmail.com | USD **$59.00** | Growth product id but recurring fixed **5900** (remount metadata) | No — equals fixed |
| `pay_0NkNyPUo9b9EJZX6gfLby` | contact@omnimanual.com | EUR **€51.47** (tax 858¢) | Launch | No — under/near EUR fixed 5190¢ with tax |
| **`pay_0NkNxZTsxympGoNbZJoIo`** | **aryan.barua007@gmail.com** | USD **$59.14** | **Launch** | **Yes +$0.14** |
| `pay_0NkMlDMo9HtUIjDC8i3zG` | contact@omnimanual.com | USD **$5.00** | Starter | No — equals fixed |

---

## Founder next steps

1. Owner `/owner` → find workspace for `aryan.barua007@gmail.com` / sub `sub_0NkJM4YIKzoUK0ksXz3iR`.
2. Remount Launch checkout (BILL-METER-SYNC) so storage `free_threshold` is positive and matches plan — **do not** leave negative threshold.
3. Optional refund of **$0.14** via Owner Issue refund with `pay_0NkNxZTsxympGoNbZJoIo` or Dodo Console.
4. Keep `ATLAS_SANDBOX_DODO_INGEST=false` ([OPS-SANDBOX-INGEST-OFF.md](./OPS-SANDBOX-INGEST-OFF.md)).

---

## Related

- [DODO-OVERAGE-METERS.md](./DODO-OVERAGE-METERS.md)  
- [LAMBDA-METER-BANNER-CHECK.md](./LAMBDA-METER-BANNER-CHECK.md) (Growth `aryan.barua57` separate from this Launch overage)
