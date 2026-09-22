/**
 * avatarkit — geometric 3D avatars in SVG.
 *
 * Hand-written to match `src/`, because the source is plain JavaScript with no
 * compile step and generating these from JSDoc would put a toolchain in front
 * of a package whose selling point is that it has none.
 *
 * The document types below are deliberately *complete* rather than partial:
 * `normalize()` is the only door into the renderer and it fills every field, so
 * anything that has been through it really does have all of these. Inputs are
 * typed as `AvatarInput` — a deep partial — because that is what a URL payload,
 * a database row and a hand-written literal actually look like.
 */

// ── documents ──────────────────────────────────────────────────────────────

export type EyeShape = "rounded" | "ellipse" | "leaf" | "line";
export type MouthShape = "curve" | "line" | "oval" | "cat" | "none";
export type NoseShape = "inverted-triangle" | "oval" | "line" | "heart";
export type Frame = "rounded" | "squircle" | "circle" | "square" | "none";
export type Fit = "contain" | "none";
export type BackgroundStyle = "solid" | "gradient" | "ring" | "none";
export type PartRole = "body" | "ear" | "snout" | "limb" | "accessory";
export type Shape = "sphere" | "capsule" | "rounded-box" | "cone" | "wedge" | (string & {});
export type PaletteId =
  | "coral" | "cloud" | "bone" | "clay" | "honey" | "moss" | "indigo" | "plum"
  | "slate" | "ember" | "mint" | "sand" | "ink" | "blossom" | "sky" | "gold"
  | (string & {});
export type PresetId = "custom" | (string & {});

/** One convex solid. Sizes and positions are in hundredths of `UNIT`. */
export interface Part {
  id: string;
  role: PartRole;
  shape: Shape;
  /** `null` means "take the palette's body colour". */
  color: string | null;
  shade: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  width: number;
  height: number;
  depth: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  round: number;
  taper: number;
  /** The part the face is drawn on. Exactly one part is the host. */
  faceHost: boolean;
  outline: boolean;
}

export interface Shadow {
  color: string;
  direction: number;
  distance: number;
  opacity: number;
  softness: number;
}

export interface Appearance {
  paletteId: PaletteId;
  backgroundStyle: BackgroundStyle;
  /** `null` means "take the palette's background". */
  background: string | null;
}

export interface Camera {
  size: number;
  frame: Frame;
  /** `"contain"` makes `view.scale` a zoom relative to a fitted avatar. */
  fit: Fit;
  padding: number;
  showFrameShadow: boolean;
  frameShadow: Shadow;
}

export interface Entity {
  preset: PresetId;
  parts: Part[];
}

export interface EyeHighlight {
  enabled: boolean;
  color: string;
  offsetX: number;
  offsetY: number;
  opacity: number;
  size: number;
}

export interface Face {
  enabled: boolean;
  color: string | null;
  offsetX: number;
  offsetY: number;
  rotation: number;
  width: number;
  height: number;
  gap: number;
  eyeShape: EyeShape;
  eyeRoundness: number;
  leftEyeRotation: number;
  rightEyeRotation: number;
  eyeHighlight: EyeHighlight;
  mouthEnabled: boolean;
  mouthShape: MouthShape;
  mouthWidth: number;
  mouthHeight: number;
  mouthY: number;
  mouthCurve: number;
  mouthRotation: number;
  noseEnabled: boolean;
  noseShape: NoseShape;
  noseWidth: number;
  noseHeight: number;
  noseY: number;
  noseRotation: number;
}

export interface ColorGrade {
  brightness: number;
  saturation: number;
  tintAmount: number;
  tintR: number;
  tintG: number;
  tintB: number;
}

export interface Effects {
  showOutline: boolean;
  outline: { color: string | null; opacity: number; width: number };
  showAvatarShadow: boolean;
  avatarShadow: Shadow;
  showFaceShadow: boolean;
  faceShadow: Shadow;
  seams: boolean;
  colorGrade: ColorGrade;
}

export interface Lighting {
  enabled: boolean;
  azimuth: number;
  elevation: number;
  strength: number;
}

/** How an avatar watches the pointer. Also accepted by `setFollow()`. */
export interface Follow {
  enabled: boolean;
  /** `"element"` measures from the avatar's own box; `"window"` from the page. */
  scope: "element" | "window";
  yawRange: number;
  pitchRange: number;
  eyeShift: number;
  stiffness: number;
  damping: number;
  blink: boolean;
  /** Honours `prefers-reduced-motion` by parking the loop. Default `true`. */
  respectReducedMotion: boolean;
}

export interface View {
  yaw: number;
  pitch: number;
  roll: number;
  /** A zoom relative to the auto-fit, so `1` means "as large as fits". */
  scale: number;
  positionX: number;
  positionY: number;
}

export interface Scene {
  appearance: Appearance;
  camera: Camera;
  entity: Entity;
  face: Face;
  effects: Effects;
  lighting: Lighting;
  follow: Follow;
  view: View;
  decals: unknown[];
  /** Unknown keys survive the round trip, so an old tab cannot delete new work. */
  [key: string]: unknown;
}

/** A normalised document: every field present and in range. */
export interface AvatarDocument {
  schema: string;
  version: number;
  metadata: { name: string; [key: string]: unknown };
  scene: Scene;
  [key: string]: unknown;
}

type DeepPartial<T> = T extends (infer U)[] ? DeepPartial<U>[]
  : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

/**
 * What every entry point accepts: a partial, a stale, or a hand-edited
 * document. `normalize()` never throws and never returns null, so `unknown` is
 * a legitimate thing to hand it.
 */
export type AvatarInput = DeepPartial<AvatarDocument> | Record<string, unknown> | null | undefined;

/** A live pose, added to the document's authored angles rather than replacing them. */
export interface Pose {
  yaw?: number;
  pitch?: number;
  roll?: number;
  eyeX?: number;
  eyeY?: number;
  blink?: number;
}

// ── schema ─────────────────────────────────────────────────────────────────

export const SCHEMA_ID: string;
/** What `SCHEMA_ID` was before 0.2.0. Read on the way in, never written. */
export const LEGACY_SCHEMA_ID: string;
export const VERSION: number;
export const UNIT: number;

export interface Limit { min: number; max: number; step: number; unit: string }
export const LIMITS: Record<string, Record<string, Limit>>;

export const EYE_SHAPES: EyeShape[];
export const MOUTH_SHAPES: MouthShape[];
export const NOSE_SHAPES: NoseShape[];
export const FRAMES: Frame[];
export const FITS: Fit[];
export const BACKGROUND_STYLES: BackgroundStyle[];
export const PART_ROLES: PartRole[];

export function defaultPart(over?: Partial<Part>): Part;
export function defaultScene(): AvatarDocument;
/** The only door in. Never throws, never returns null. */
export function normalize(input: AvatarInput): AvatarDocument;
/** Documents from an older id or another producer, brought to this schema. */
export function migrate<T>(input: T): T;
export function cloneScene(doc: AvatarDocument): AvatarDocument;

// ── palettes ───────────────────────────────────────────────────────────────

export interface Palette {
  id: PaletteId;
  name: string;
  body: string;
  shade: string;
  outline: string;
  face: string;
  background: string;
}

export const PALETTES: Palette[];
export const PALETTE_IDS: PaletteId[];
/** Never null — an unknown id falls back to the first palette. */
export function palette(id: PaletteId): Palette;
export function mix(a: string, b: string, t: number): string;
export function grade(hex: string, g?: Partial<ColorGrade> | null): string;
export function contrast(a: string, b: string): number;
export function luminance(hex: string): number;
export function readableInk(bg: string, dark?: string, light?: string): string;
export function hexToRgb(hex: string): [number, number, number];
export function rgbToHex(r: number, g: number, b: number): string;

// ── shapes and presets ─────────────────────────────────────────────────────

export const SHAPES: Shape[];
export const SHAPE_LABELS: Record<string, string>;

export interface Preset {
  id: PresetId;
  name: string;
  parts: Part[];
  face?: Partial<Face>;
}

export const PRESETS: Preset[];
export const PRESET_IDS: PresetId[];
export function preset(id: PresetId): Preset | null;
/** Swap the body, keeping palette, camera, effects and view as they are. */
export function applyPreset(doc: AvatarInput, id: PresetId): AvatarDocument;

// ── generating ─────────────────────────────────────────────────────────────

export interface GenerateOptions {
  /** Pin the palette — one product's agents in its own brand colours. */
  palette?: PaletteId;
  /** Pin the body. */
  preset?: PresetId;
  name?: string;
}

/** Deterministic: the same seed is the same avatar, every time, everywhere. */
export function generateScene(seed: string | number | null | undefined, options?: GenerateOptions): AvatarDocument;
/** "Surprise me" — the only `Math.random` in the package. */
export function randomScene(options?: GenerateOptions): AvatarDocument;

// ── rendering ──────────────────────────────────────────────────────────────

export interface RenderModel {
  viewBox: number;
  size: number;
  name: string;
  parts: unknown[];
  face: unknown;
  background: { style: BackgroundStyle; [key: string]: unknown };
  frame: { kind: Frame; [key: string]: unknown };
  [key: string]: unknown;
}

export const VIEWBOX: number;
export function buildRenderModel(doc: AvatarDocument, options?: { pose?: Pose }): RenderModel;
export function viewMatrix(view: View, pose?: Pose): number[];

export interface SVGOptions {
  size?: number;
  /** Pass when you need reproducible bytes — SVG ids are document-global. */
  idPrefix?: string;
  title?: string | null;
  hooks?: boolean;
}

export function toSVG(model: RenderModel, options?: SVGOptions): string;
export function toSVGBody(model: RenderModel, options?: SVGOptions): { defs: string; content: string };
export function toDataURL(model: RenderModel, options?: SVGOptions): string;

export interface CreateAvatarOptions {
  /** Pixel size. Defaults to `camera.size`; ignored unless `responsive: false`. */
  size?: number;
  /** `false` pins width/height instead of filling the box CSS gives it. */
  responsive?: boolean;
  /** `aria-label`. Defaults to the document's name. */
  title?: string;
  /** Overrides the document's follow settings without editing it. */
  follow?: Partial<Follow>;
  /** Drag the preview to turn the avatar. */
  draggable?: boolean;
  /** Called with the edited document when a drag changes the camera. */
  onChange?: (doc: AvatarDocument) => void;
  /** Pins the blink stagger. Derived from the name and instance id otherwise. */
  seed?: number;
}

export interface AvatarInstance {
  readonly el: SVGSVGElement;
  /** A copy, always — the live document is never handed out by reference. */
  readonly document: AvatarDocument;
  readonly model: RenderModel | null;
  /** Swap the document. Pose and follow settings carry over. */
  setDocument(next: AvatarInput): void;
  /** Drive the pose by hand, for a host with its own animation source. */
  setPose(pose: Pose): void;
  setFollow(config: Partial<Follow>): void;
  setSize(px: number): void;
  toSVGString(size?: number): string;
  /** Call on unmount, or the follow loop holds an element nobody can see. */
  destroy(): void;
}

/** Mount a live avatar. `target` may be a selector, an element, or an `<svg>`. */
export function createAvatar(
  target: string | Element,
  doc?: AvatarInput,
  options?: CreateAvatarOptions,
): AvatarInstance;

export interface RenderToStringOptions {
  size?: number;
  idPrefix?: string;
  title?: string | null;
  pose?: Pose;
}

/** An SVG string with no DOM — for lists, exports and servers. */
export function renderToString(doc: AvatarInput, options?: RenderToStringOptions): string;

// ── following the cursor ───────────────────────────────────────────────────

export class FollowController {
  constructor(element: Element, config?: Partial<Follow>, onPose?: (pose: Required<Pose>) => void, seed?: number);
  configure(config?: Partial<Follow>): void;
  step(dt: number, nowMs?: number): void;
  destroy(): void;
  readonly enabled: boolean;
  readonly pose: Required<Pose>;
}

/** Test hook, not API. Use `instance.setPose()` to drive the pose yourself. */
export function _setPointer(x: number, y: number): void;
/** Test hook, not API. */
export function _activeCount(): number;

// ── a link, and a file ─────────────────────────────────────────────────────

export function encode(doc: AvatarDocument): string;
/** `null` when the payload is not a document — a truncated link, say. */
export function decode(payload: string): AvatarDocument | null;
export function fromURL(url: string, keys?: string[]): AvatarDocument | null;
export function toURL(doc: AvatarDocument, base: string, key?: string): string;

export function toPNGBlob(doc: AvatarInput, size: number): Promise<Blob>;
export function svgToPNGBlob(svg: string, size: number): Promise<Blob>;
export function downloadSVG(doc: AvatarInput, filename?: string, size?: number): void;
export function downloadPNG(doc: AvatarInput, size?: number, filename?: string): Promise<Blob>;
export function downloadBlob(blob: Blob, filename: string): void;
