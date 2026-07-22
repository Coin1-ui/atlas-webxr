#!/usr/bin/env node
import { writeFileSync } from "node:fs";
const url = process.env.ATLAS_SITE || "https://main.d7vfdpujdozkj.amplifyapp.com/";
const html = await (await fetch(url)).text();
const m = html.match(/assets\/(main-[A-Za-z0-9_-]+\.js)/);
writeFileSync("tmp-amplify-check.txt", m ? m[1] : "no-bundle");
if (!m) process.exit(1);
const js = await (await fetch(new URL(`/assets/${m[1]}`, url))).text();
const lines = [
  `bundle=${m[1]}`,
  `clearSandboxData=${js.includes("Clear sandbox data")}`,
  `normalizeMonth=${js.includes("liveUsage") && js.includes("usage.month")}`,
  `overageHasPayment=${js.includes("overageHasPayment")}`,
  `sessionCapRaisedOptionalFor=${js.includes("Session cap raised") && js.includes("after overage payment")}`,
];
writeFileSync("tmp-amplify-check.txt", lines.join("\n"));
console.log(lines.join("\n"));
