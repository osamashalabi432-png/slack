/**
 * Scenery for the huddle surface. Every option is pure CSS so there are no
 * assets to ship, and the value is applied straight to the `background`
 * shorthand of the huddle shell.
 */
export interface HuddleBackground {
  id: string;
  name: string;
  css: string;
}

export const HUDDLE_BACKGROUNDS: HuddleBackground[] = [
  {
    id: "midnight",
    name: "Midnight",
    css: "linear-gradient(to bottom right, #020617 0%, #172554 50%, #020617 100%)",
  },
  {
    id: "aubergine",
    name: "Aubergine",
    css: "linear-gradient(140deg, #3f0f3f 0%, #611f69 45%, #1a0b1f 100%)",
  },
  {
    id: "forest",
    name: "Forest",
    css: "radial-gradient(120% 90% at 20% 10%, rgba(31,122,90,0.85) 0%, transparent 60%), linear-gradient(160deg, #062e24 0%, #0d4f3c 55%, #04211a 100%)",
  },
  {
    id: "sunset",
    name: "Sunset",
    css: "radial-gradient(100% 80% at 80% 0%, rgba(240,128,60,0.45) 0%, transparent 55%), linear-gradient(160deg, #4c1d3d 0%, #a3423c 55%, #2b1024 100%)",
  },
  {
    id: "ocean",
    name: "Ocean",
    css: "radial-gradient(90% 70% at 15% 85%, rgba(14,165,233,0.45) 0%, transparent 60%), linear-gradient(150deg, #04283f 0%, #0b5e79 60%, #021a2b 100%)",
  },
  {
    id: "lavender",
    name: "Lavender",
    css: "linear-gradient(150deg, #2b2350 0%, #6d5bb5 55%, #241d3f 100%)",
  },
  {
    id: "ember",
    name: "Ember",
    css: "radial-gradient(80% 70% at 50% 100%, rgba(180,83,15,0.55) 0%, transparent 60%), linear-gradient(180deg, #1a0f0a 0%, #3b1a10 100%)",
  },
  {
    id: "graphite",
    name: "Graphite",
    css: "linear-gradient(160deg, #14161a 0%, #2a2f38 55%, #0d0f12 100%)",
  },
  {
    id: "aurora",
    name: "Aurora",
    css: "radial-gradient(60% 50% at 25% 20%, rgba(34,211,238,0.35) 0%, transparent 60%), radial-gradient(55% 45% at 75% 30%, rgba(168,85,247,0.35) 0%, transparent 60%), radial-gradient(70% 60% at 50% 100%, rgba(16,185,129,0.28) 0%, transparent 60%), #060b18",
  },
  {
    id: "dots",
    name: "Dots",
    css: "radial-gradient(rgba(255,255,255,0.14) 1.5px, transparent 1.6px) 0 0 / 22px 22px, linear-gradient(160deg, #0b1220 0%, #1e293b 100%)",
  },
  {
    id: "blueprint",
    name: "Blueprint",
    css: "linear-gradient(rgba(96,165,250,0.10) 1px, transparent 1px) 0 0 / 100% 32px, linear-gradient(90deg, rgba(96,165,250,0.10) 1px, transparent 1px) 0 0 / 32px 100%, linear-gradient(160deg, #061224 0%, #0b2545 100%)",
  },
  {
    id: "rose",
    name: "Rose",
    css: "radial-gradient(85% 70% at 30% 15%, rgba(244,114,182,0.35) 0%, transparent 60%), linear-gradient(155deg, #2a0f22 0%, #7a2a4d 60%, #1b0a16 100%)",
  },
];

export const DEFAULT_HUDDLE_BACKGROUND_ID = "midnight";

export function getHuddleBackground(id: string): HuddleBackground {
  return (
    HUDDLE_BACKGROUNDS.find((b) => b.id === id) ??
    HUDDLE_BACKGROUNDS.find((b) => b.id === DEFAULT_HUDDLE_BACKGROUND_ID)!
  );
}
