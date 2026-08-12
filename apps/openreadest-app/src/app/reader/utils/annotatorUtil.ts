import { HIGHLIGHT_COLOR_HEX } from '@/services/constants';
import { BookFormat, FIXED_LAYOUT_FORMATS, HighlightColor } from '@/types/book';
import { SystemSettings } from '@/types/settings';

// Proofread rewrites the rendered text through the content transformers, which
// every reflowable format runs (Markdown wires the same pipeline in
// utils/md.ts without an EPUB conversion). Only the fixed-layout formats are
// out: they render pages, not text. The toolbar button used to require EPUB,
// the sole format the feature shipped for (#2725). (Upstream readest
// utils/annotationToolbar.ts.)
export const supportsProofread = (format: BookFormat | undefined): boolean =>
  !!format && !FIXED_LAYOUT_FORMATS.has(format);

export const getHighlightColorHex = (settings: SystemSettings, color?: HighlightColor) => {
  if (!color) return color;

  const customColors = settings.globalReadSettings.customHighlightColors;
  return customColors?.[color] ?? HIGHLIGHT_COLOR_HEX[color];
};
