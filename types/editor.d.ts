/**
 * avatarkit/editor — the editor panel.
 *
 * Framework-free by design, so this is a function that takes an element, not a
 * component. Restyle it by setting the `--ce-*` custom properties on `.ce`.
 */

import type { AvatarDocument, AvatarInput, Face } from "./index.js";

/** Controls under the preview. Export and share are opt-in. */
export type EditorAction = "randomize" | "reset" | "export" | "share";

export interface EditorOptions {
  /** The avatar to start from. Default: a fresh one. */
  document?: AvatarInput;
  /** Called after every edit, with a normalised document. */
  onChange?: (doc: AvatarDocument) => void;
  /** If given, a Save control appears. The host owns persistence. */
  onSave?: (doc: AvatarDocument) => void;
  /** Default `["randomize", "reset"]`. */
  actions?: EditorAction[];
  /**
   * Where saved presets live in `localStorage`. Default `"avatarkit.presets"`;
   * `null` removes the saved-presets row entirely.
   */
  storageKey?: string | null;
  /** Base URL for "Copy link". Default: the current page. */
  shareBase?: string;
  /** `false` renders only the panel, beside a preview the host draws itself. */
  showPreview?: boolean;
}

export interface EditorInstance {
  readonly element: HTMLElement;
  /** A copy — the live document is never handed out by reference. */
  getDocument(): AvatarDocument;
  setDocument(next: AvatarInput): void;
  /** Returns an unsubscribe function. */
  on(event: "change", fn: (doc: AvatarDocument) => void): () => void;
  destroy(): void;
}

export function mountEditor(container: string | Element, options?: EditorOptions): EditorInstance;

/** The twelve faces in the presets row, as partial `face` objects. */
export const FACE_PRESETS: Array<{ name: string; face: Partial<Face> }>;
