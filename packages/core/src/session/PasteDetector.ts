import { PASTE_THRESHOLD_LINES } from "../config/defaults.js";

export function isPasteBurst(
  linesInserted: number,
  isSingleOperation: boolean,
): boolean {
  return linesInserted >= PASTE_THRESHOLD_LINES && isSingleOperation;
}
