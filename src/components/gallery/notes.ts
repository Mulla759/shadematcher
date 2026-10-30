/**
 * In-person sourcing notes.
 *
 * Auriga has no account system and no database. The only external store the
 * project has is Vercel KV, and it is used for rate limiting, not for saving
 * anything a person typed. So these notes live in this browser's local
 * storage, on this device, and nowhere else.
 *
 * That is a deliberate limit, not a hidden one:
 *   - nothing here is uploaded, and nothing here is shared with anyone;
 *   - the UI labels every note as device-local;
 *   - the only way a note leaves the device is an explicit export the person
 *     triggers, which they then share by hand.
 *
 * The keys are versioned so a future format change can migrate or discard
 * without touching older data.
 */

const NOTES_KEY = "auriga.gallery.notes.v1";
const LIST_KEY = "auriga.gallery.list.v1";

/** What the buyer felt when they held the cloth. */
export interface FabricNote {
  /** How it falls. */
  drape?: string;
  /** How it feels under the hand. */
  texture?: string;
  /** How much it shows, seen in person. */
  opacity?: string;
  /** The call. */
  verdict?: string;
  /** Anything else worth remembering. */
  text?: string;
  /** ISO timestamp of the last edit. */
  updatedAt?: string;
}

/** An entry in the seasonal materials list. */
export interface ListEntry {
  /** The season the buyer is buying it for. */
  season: string;
  addedAt: string;
}

export type Notes = Record<string, FabricNote>;
export type SeasonalList = Record<string, ListEntry>;

export const DRAPE_OPTIONS = [
  "Fluid",
  "Falls well",
  "Has body",
  "Stiff",
  "Holds a shape",
];

export const TEXTURE_OPTIONS = [
  "Smooth",
  "Matte",
  "Satin",
  "Crinkled",
  "Rough",
  "Coarse",
];

export const IN_PERSON_OPACITY_OPTIONS = ["Opaque", "Medium", "Sheer", "Translucent"];

export const VERDICT_OPTIONS = ["Buy", "Hold", "Pass"];

export const SEASON_OPTIONS = [
  "Spring",
  "Summer",
  "Autumn",
  "Winter",
  "All year",
];

const SEASON_ORDER = ["Spring", "Summer", "Autumn", "Winter", "All year"];

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const test = window.localStorage;
    const probe = "__auriga_probe__";
    test.setItem(probe, "1");
    test.removeItem(probe);
    return test;
  } catch {
    return null;
  }
}

/** True when this browser will keep the notes. False on locked-down browsers. */
export function storageAvailable(): boolean {
  return storage() !== null;
}

function readJson<T>(key: string, fallback: T): T {
  const store = storage();
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readNotes(): Notes {
  return readJson<Notes>(NOTES_KEY, {});
}

export function readList(): SeasonalList {
  return readJson<SeasonalList>(LIST_KEY, {});
}

/** Saves (or replaces) the feel note for one fabric. */
export function saveNote(id: string, note: FabricNote): boolean {
  const notes = readNotes();
  const clean: FabricNote = { ...note, updatedAt: new Date().toISOString() };
  for (const key of Object.keys(clean)) {
    if (!clean[key as keyof FabricNote]) delete clean[key as keyof FabricNote];
  }
  if (!Object.keys(clean).some((key) => key !== "updatedAt")) {
    delete notes[id];
  } else {
    notes[id] = clean;
  }
  return writeJson(NOTES_KEY, notes);
}

export function clearNote(id: string): boolean {
  const notes = readNotes();
  delete notes[id];
  return writeJson(NOTES_KEY, notes);
}

/** Adds a fabric to the seasonal materials list, or moves it to another season. */
export function addToList(id: string, season: string): boolean {
  const list = readList();
  list[id] = { season, addedAt: new Date().toISOString() };
  return writeJson(LIST_KEY, list);
}
export function removeFromList(id: string): boolean {
  const list = readList();
  delete list[id];
  return writeJson(LIST_KEY, list);
}

export function clearList(): boolean {
  return writeJson(LIST_KEY, {});
}

/** The list, ordered by season then by when each fabric was added. */
export function sortedList(
  list: SeasonalList,
): Array<{ id: string; entry: ListEntry }> {
  return Object.entries(list)
    .map(([id, entry]) => ({ id, entry }))
    .sort((a, b) => {
      const seasonDiff =
        SEASON_ORDER.indexOf(a.entry.season) - SEASON_ORDER.indexOf(b.entry.season);
      if (seasonDiff !== 0) return seasonDiff;
      return a.entry.addedAt.localeCompare(b.entry.addedAt);
    });
}

/* ------------------------------------------------------------------ export */

export interface ExportRow {
  id: string;
  name: string;
  title: string;
  hex: string;
  family: string;
  fabric: string;
  siteLabel: string;
  url: string;
  note?: FabricNote;
  season?: string;
}

const noteLine = (note: FabricNote | undefined, key: keyof FabricNote): string => {
  const value = note?.[key];
  return typeof value === "string" ? value : "";
};

/** A Markdown list a person can paste into an email or a notebook. */
export function buildMarkdown(rows: ExportRow[], collectedAt: Date): string {
  const lines: string[] = [];
  lines.push("# Auriga — seasonal materials list");
  lines.push("");
  lines.push(
    `Collected in person on ${collectedAt.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}. Exported from one device — these notes were never uploaded.`,
  );
  lines.push("");
  lines.push(
    "Colours are digital approximations measured from scraped product photos, not physical swatches. The drape, texture and opacity below were observed in person.",
  );
  lines.push("");

  if (rows.length === 0) {
    lines.push("_Nothing on the list yet._");
    lines.push("");
    return lines.join("\n");
  }

  const bySeason = new Map<string, ExportRow[]>();
  for (const row of rows) {
    const season = row.season || "Unassigned";
    const bucket = bySeason.get(season) ?? [];
    bucket.push(row);
    bySeason.set(season, bucket);
  }

  const seasons = [
    ...SEASON_ORDER.filter((season) => bySeason.has(season)),
    ...[...bySeason.keys()].filter(
      (season) => !SEASON_ORDER.includes(season),
    ),
  ];

  for (const season of seasons) {
    lines.push(`## ${season}`);
    lines.push("");
    for (const row of bySeason.get(season) ?? []) {
      lines.push(`### ${row.name}`);
      lines.push("");
      lines.push(`- **Colour:** ${row.hex} (measured from the product photo)`);
      lines.push(`- **Family:** ${row.family}`);
      if (row.fabric) lines.push(`- **Fabric:** ${row.fabric}`);
      if (row.siteLabel) lines.push(`- **Shop:** ${row.siteLabel}`);
      const drape = noteLine(row.note, "drape");
      const texture = noteLine(row.note, "texture");
      const opacity = noteLine(row.note, "opacity");
      const verdict = noteLine(row.note, "verdict");
      if (drape) lines.push(`- **Drape:** ${drape}`);
      if (texture) lines.push(`- **Texture:** ${texture}`);
      if (opacity) lines.push(`- **In-person opacity:** ${opacity}`);
      if (verdict) lines.push(`- **Verdict:** ${verdict}`);
      const text = noteLine(row.note, "text");
      if (text) lines.push(`- **Note:** ${text}`);
      if (row.url) lines.push(`- **Product:** ${row.url}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

/** The same list as JSON, for feeding back into a spreadsheet or a notebook. */
export function buildJson(rows: ExportRow[], collectedAt: Date): string {
  return JSON.stringify(
    {
      kind: "auriga.seasonal-materials-list",
      version: 1,
      exportedAt: collectedAt.toISOString(),
      origin: "Device-local notes exported by hand. Never uploaded to a server.",
      colourCaveat:
        "Colours are digital approximations measured from scraped product photos, not physical swatches.",
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        title: row.title,
        hex: row.hex,
        family: row.family,
        fabric: row.fabric,
        shop: row.siteLabel,
        productUrl: row.url,
        season: row.season ?? null,
        note: row.note ?? null,
      })),
    },
    null,
    2,
  );
}

/** Copies text to the clipboard, with a fallback for browsers without it. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea fallback.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** Saves a file to the device, so it can be attached to a message. */
export function downloadFile(filename: string, content: string, type: string): boolean {
  try {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Give the browser a moment to start the download before revoking.
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}

export function exportFilename(stamp: Date): string {
  const day = stamp.toISOString().slice(0, 10);
  return `auriga-materials-${day}.`;
}
