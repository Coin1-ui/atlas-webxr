#!/usr/bin/env node
const base = process.env.ATLAS_SITE || "https://main.d7vfdpujdozkj.amplifyapp.com";
const html = await (await fetch(`${base}/`)).text();
const m = html.match(/assets\/(main-[A-Za-z0-9_-]+\.js)/);
if (!m) {
  console.log("no main bundle");
  process.exit(1);
}
const js = await (await fetch(`${base}/assets/${m[1]}`)).text();
const needles = [
  "clearTestOverage",
  "Clear test overage",
  "Clear sandbox data",
  "accept must be true",
  "sandboxSeedEnabled",
  "Seed overage",
  "Only leftover test",
  "Only sandbox test",
];
console.log("bundle=", m[1], "bytes=", js.length);
for (const n of needles) console.log(`${n}=${js.includes(n)}`);
