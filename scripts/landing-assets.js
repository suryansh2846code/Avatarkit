#!/usr/bin/env node
/**
 * The landing page's two static assets, drawn by the library they advertise.
 *
 * `docs/favicon.svg` and the markup for `docs/og.png` both come out of
 * `renderToString`, so the tab icon and the link preview can never drift from
 * what the package actually draws. Rasterising the card needs a browser, which
 * is not a dependency this package is willing to take — so this writes
 * `og.html` and leaves the screenshot to whoever has Chrome:
 *
 *   node scripts/landing-assets.js
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *     --headless --window-size=1200,630 --screenshot=docs/og.png docs/og.html
 *
 * The same goes for the README's images: this writes the cards, a browser
 * turns them into PNGs. They are shot at a device scale factor of 2 and shown
 * at half width, because a screenshot of vector art that renders soft is a
 * strange advertisement for a renderer.
 *
 * Regenerate after a palette, preset or brand change. Nothing else reads these.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateScene, renderToString, normalize, defaultPart } from "../src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docs = join(root, "docs");
mkdirSync(docs, { recursive: true });

/**
 * The mark: a cube, face-on.
 *
 * Composed rather than seeded, because a favicon has one job at 16 pixels and
 * a seed cannot be asked to respect it. The shape is the package's own default
 * primitive — a rounded box — turned almost straight at the camera, which is
 * the only angle where it stays a square instead of collapsing into the
 * hexagon a box's silhouette becomes under rotation. Lighting does the rest of
 * the work of reading as a solid; a stacked "three faces of a cube" version
 * was tried and is unreadable below about 48px.
 *
 * The page loads this same file for its nav mark, so the tab and the header
 * cannot drift apart.
 */
const MARK = normalize({
  metadata: { name: "Avatarkit" },
  scene: {
    appearance: { paletteId: "coral", backgroundStyle: "solid" },
    camera: { size: 256, frame: "rounded", fit: "contain", padding: 12 },
    entity: { preset: "custom", parts: [defaultPart({
      id: "body", shape: "rounded-box", round: 18,
      width: 100, height: 100, depth: 100, faceHost: true,
    })] },
    face: { enabled: true, eyeShape: "rounded", eyeRoundness: 100, width: 20, height: 44, gap: 40 },
    effects: { showOutline: true, outline: { width: 5, opacity: 85 }, seams: true },
    lighting: { enabled: true, azimuth: -40, elevation: 45, strength: 70 },
    view: { yaw: 0.1, pitch: 0.12, roll: 0, scale: 1 },
    follow: { enabled: false },
  },
});
writeFileSync(join(docs, "favicon.svg"), renderToString(MARK, { size: 64, idPrefix: "fav" }));

const CAST = [MARK, "ada@example.com", "agent:inbox", "cat", "ship it"];
const cast = CAST.map((seed, i) => {
  const doc = typeof seed === "string" ? generateScene(seed) : seed;
  return `<div class="a">${renderToString(doc, { size: 132, idPrefix: `og${i}` })}</div>`;
}).join("");

writeFileSync(join(docs, "og.html"), `<!doctype html>
<meta charset="utf-8">
<title>Avatarkit</title>
<style>
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
  body {
    background: #0b0b0d; color: #ecedf0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 44px;
    font: 400 16px/1.5 ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .cast { display: flex; gap: 22px; align-items: flex-end; }
  .a { width: 132px; height: 132px; }
  .a:nth-child(even) { margin-bottom: 26px; }
  h1 { margin: 0; font-size: 68px; line-height: 1.05; letter-spacing: -0.035em; font-weight: 680; text-align: center; }
  h1 em { font-style: normal; color: #e2542a; }
  .facts { display: flex; gap: 30px; color: #8d8f97; font-size: 22px; align-items: center; }
  .facts b { color: #ecedf0; font-weight: 620; }
  code {
    font: 500 22px ui-monospace, SFMono-Regular, Menlo, monospace;
    background: #17171a; border: 1px solid #2a2a30; border-radius: 10px; padding: 9px 18px;
  }
</style>
<div class="cast">${cast}</div>
<h1>Avatars that <em>watch your cursor</em></h1>
<div class="facts">
  <code>npm i avatarkit</code>
  <span><b>0</b> deps</span>
  <span><b>58 kB</b></span>
  <span><b>MIT</b></span>
</div>
`);

process.stdout.write("docs/favicon.svg\ndocs/og.html  (screenshot it at 1200x630 -> docs/og.png)\n");

// ── the README's images ────────────────────────────────────────────────────

const media = join(docs, "media");
mkdirSync(media, { recursive: true });

const SHELL = (w, body, extra) => `<!doctype html>
<meta charset="utf-8">
<style>
  html, body { margin: 0; width: ${w}px; background: #0b0b0d; }
  body {
    color: #ecedf0; -webkit-font-smoothing: antialiased;
    font: 400 15px/1.5 ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif;
  }
  ${extra || ""}
</style>
${body}`;

// A banner, not a logo: the point of the package is the row of faces, so the
// row is most of the image and the words are the caption.
writeFileSync(join(media, "banner.html"), SHELL(1280, `
<div class="b">
  <div class="cast">${["avatarkit", "ada@example.com", "agent:inbox", "cat", "u_8812", "ship it", "panda"]
    .map((s, i) => `<div class="a">${renderToString(typeof s === "string" && i === 0 ? MARK : generateScene(s), { size: 112, idPrefix: "bn" + i })}</div>`)
    .join("")}</div>
  <h1>Avatars that <em>watch your cursor</em></h1>
  <p>Geometric 3D characters in plain SVG · zero dependencies · 58&nbsp;kB · MIT</p>
</div>`, `
  .b { padding: 52px 0 46px; text-align: center; }
  .cast { display: flex; gap: 20px; justify-content: center; align-items: flex-end; margin-bottom: 38px; }
  .a { width: 112px; height: 112px; }
  .a:nth-child(even) { margin-bottom: 22px; }
  h1 { margin: 0 0 14px; font-size: 54px; letter-spacing: -0.035em; font-weight: 680; }
  h1 em { font-style: normal; color: #e2542a; }
  p { margin: 0; color: #8d8f97; font-size: 19px; }
`));

// The claim this image has to carry is that one string is enough. So each cell
// is captioned with the string that produced it, not with a pretty name.
const SEEDS = [
  "ada@example.com", "u_8812", "agent:inbox", "@suryansh", "order-4471", "billing-bot",
  "nina.patel", "team/design", "sess_91af", "guest", "kai@studio.dev", "reviewer-3",
];
writeFileSync(join(media, "gallery.html"), SHELL(1280, `
<div class="g">${SEEDS.map((s, i) =>
  `<figure><div class="a">${renderToString(generateScene(s), { size: 128, idPrefix: "g" + i })}</div>
   <figcaption>${s}</figcaption></figure>`).join("")}</div>`, `
  .g { display: grid; grid-template-columns: repeat(6, 1fr); gap: 26px 20px; padding: 40px 36px; }
  figure { margin: 0; text-align: center; }
  .a { width: 128px; height: 128px; margin: 0 auto 10px; }
  figcaption { color: #8d8f97; font: 12px ui-monospace, SFMono-Regular, Menlo, monospace;
               overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`));

process.stdout.write("docs/media/banner.html\ndocs/media/gallery.html\n");
