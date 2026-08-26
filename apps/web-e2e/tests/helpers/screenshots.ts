import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Where specs drop screenshots. Somewhere disposable by default; point
 * OPENSLAQ_SHOT_DIR at a real folder when you want to look at them.
 */
export const SHOT_DIR = process.env.OPENSLAQ_SHOT_DIR ?? join(tmpdir(), "openslaq-shots");
