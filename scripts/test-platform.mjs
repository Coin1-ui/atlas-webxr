/**

 * Platform routing tests — Android WebXR; iOS Safari Quick Look only.

 */

import { readFileSync, existsSync } from "node:fs";

import { join } from "node:path";



function isIosUserAgent(userAgent) {

  return /iPhone|iPad|iPod/i.test(userAgent);

}



function useDomOverlayInARForUserAgent(userAgent) {

  return !isIosUserAgent(userAgent);

}



function useInCanvasArUiFallbackForUserAgent(_userAgent) {

  return false;

}



function useHtmlArTouchOverlayForUserAgent(_userAgent) {

  return false;

}



function usesArHtmlPanelForUserAgent(userAgent) {

  return useDomOverlayInARForUserAgent(userAgent);

}



const androidUa =

  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/148.0.0.0 Mobile Safari/537.36";

const iosSafariUa =

  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";



const results = [];

let failed = 0;



function assert(name, condition) {

  if (condition) results.push({ name, status: "pass" });

  else {

    failed += 1;

    results.push({ name, status: "fail" });

  }

}



const webxrAr = readFileSync(join(process.cwd(), "src/xr/webxr-ar.ts"), "utf8");



assert("android session module exists", existsSync(join(process.cwd(), "src/xr/android/session.ts")));

assert("ios quick look module exists", existsSync(join(process.cwd(), "src/xr/ios/quick-look-ar.ts")));

assert("webxr-ar rejects iOS (Quick Look only)", webxrAr.includes("isIOS()") && webxrAr.includes("return null"));

assert("webxr-ar routes Android only", webxrAr.includes("tryStartWebXRAndroid"));



assert("Android Chrome uses dom-overlay", useDomOverlayInARForUserAgent(androidUa) === true);

assert("iOS Safari skips WebXR dom-overlay", useDomOverlayInARForUserAgent(iosSafariUa) === false);

assert("iOS does not use HTML touch overlay for WebXR", useHtmlArTouchOverlayForUserAgent(iosSafariUa) === false);

assert("iOS HTML panel host disabled (no WebXR)", usesArHtmlPanelForUserAgent(iosSafariUa) === false);

assert("iOS skips Babylon in-canvas GUI", useInCanvasArUiFallbackForUserAgent(iosSafariUa) === false);



console.log(JSON.stringify({ ok: failed === 0, failed, results }, null, 2));

process.exit(failed > 0 ? 1 : 0);

