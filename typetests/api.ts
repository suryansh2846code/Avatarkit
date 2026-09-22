/**
 * The declarations, exercised the way a consumer actually uses them.
 *
 * `tsc` is the assertion here, not `node --test`. It lives outside `test/`
 * because Node's runner claims that directory wholesale and executes TypeScript
 * on its own from 22 — a `.test-d.ts` suffix in there does not opt out, it just
 * fails the suite on 22 while passing on 18 and 20.
 *
 * It exists because `types/*.d.ts` are hand-written against plain JavaScript:
 * nothing but this file notices when a signature in `src/` moves and the
 * declaration does not.
 *
 * Imports are by package name, not by relative path, so the `exports` map and
 * the `types` conditions are checked too — those are what break for a consumer
 * while a direct import of the `.d.ts` keeps passing.
 */

import {
  createAvatar, renderToString, generateScene, randomScene, normalize, migrate,
  defaultScene, defaultPart, cloneScene, applyPreset, palette, contrast,
  buildRenderModel, toSVG, encode, decode, toURL, fromURL,
  downloadSVG, downloadPNG, toPNGBlob, FollowController,
  PALETTES, PRESETS, SHAPES, LIMITS, SCHEMA_ID, LEGACY_SCHEMA_ID,
  type AvatarDocument, type Pose, type Follow, type Part,
} from "avatarkit";
import { mountEditor, FACE_PRESETS, type EditorOptions } from "avatarkit/editor";

// ── documents ──────────────────────────────────────────────────────────────

const doc: AvatarDocument = generateScene("agent:inbox", { palette: "indigo", preset: "cat" });
const surprise: AvatarDocument = randomScene();

// normalize takes anything at all: a URL payload, a database row, null.
const fromNothing: AvatarDocument = normalize(null);
const fromPartial: AvatarDocument = normalize({ metadata: { name: "Partial" } });
const fromJunk: AvatarDocument = normalize({ scene: { view: { yaw: "0.4" as unknown as number } } });
const legacy: AvatarDocument = normalize(migrate({ schema: LEGACY_SCHEMA_ID, version: 1 }));

const part: Part = defaultPart({ shape: "capsule", faceHost: true });
const copy: AvatarDocument = cloneScene(defaultScene());
const swapped: AvatarDocument = applyPreset(doc, "rabbit");

// ── rendering ──────────────────────────────────────────────────────────────

const markup: string = renderToString(doc, { size: 64, idPrefix: "a", pose: { yaw: 0.2 } });
const viaModel: string = toSVG(buildRenderModel(doc, { pose: { pitch: -0.1 } }), { size: 128 });

const inst = createAvatar("#avatar", doc, {
  size: 96,
  responsive: false,
  title: "Inbox agent",
  follow: { yawRange: 30, scope: "window", respectReducedMotion: true },
  draggable: true,
  onChange: (next: AvatarDocument) => void next.scene.view.yaw,
});

const pose: Pose = { yaw: 0.2, pitch: -0.1, eyeX: 4, blink: 1 };
inst.setPose(pose);
inst.setFollow({ enabled: false });
inst.setSize(128);
inst.setDocument({ metadata: { name: "Renamed" } });
const live: AvatarDocument = inst.document;
const el: SVGSVGElement = inst.el;
const exported: string = inst.toSVGString(512);
inst.destroy();

// ── the follow loop, driven by hand ────────────────────────────────────────

const follow: Partial<Follow> = { stiffness: 9, damping: 0.85, blink: true };
const controller = new FollowController(el, follow, (p) => void p.yaw, 42);
controller.configure({ yawRange: 10 });
controller.step(1 / 60, 0);
controller.destroy();

// ── links and files ────────────────────────────────────────────────────────

const payload: string = encode(doc);
const decoded: AvatarDocument | null = decode(payload);
const link: string = toURL(doc, "https://example.com", "c");
const shared: AvatarDocument | null = fromURL(link, ["c", "d"]);

downloadSVG(doc, "avatar.svg");
void downloadPNG(doc, 512).then((b: Blob) => b.size);
void toPNGBlob(doc, 256).then((b: Blob) => b.type);

// ── the editor ─────────────────────────────────────────────────────────────

const options: EditorOptions = {
  document: doc,
  onChange: (next) => void next.metadata.name,
  onSave: (next) => void next.schema,
  actions: ["randomize", "reset", "export", "share"],
  storageKey: null,
  shareBase: "https://example.com/builder",
  showPreview: true,
};

const editor = mountEditor("#editor", options);
const unsubscribe: () => void = editor.on("change", (next) => void next.scene.face.eyeShape);
unsubscribe();
editor.setDocument(editor.getDocument());
editor.destroy();

// ── the tables the editor builds itself from ───────────────────────────────

void [
  SCHEMA_ID, PALETTES[0].body, PALETTES[0].outline, PRESETS[0].id, SHAPES[0],
  LIMITS.view.yaw.max, LIMITS.follow.stiffness.step, FACE_PRESETS[0].face.eyeShape,
  palette("indigo").background, contrast("#fff", "#000"),
  surprise, fromNothing, fromPartial, fromJunk, legacy, part, copy, swapped,
  markup, viaModel, live, exported, payload, decoded, shared, controller,
];
