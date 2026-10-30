/**
 * Trait extraction for the scraped textile catalogue.
 *
 * The scrape only records what each shop says about its own product: a title,
 * a tag list and a product type. Weight, opacity and season are therefore
 * *store-stated* traits, not measurements, and the wording is whatever the
 * retailer used ("lightweight", "95 gsm", "semi-sheer", "fall").
 *
 * This module reads those words out of the store's own text and normalises the
 * spelling so the gallery can filter on them. Nothing is invented: a row with
 * no matching wording gets no trait, and the gallery says so out loud.
 *
 * Where a shop contradicts itself we do not average or guess:
 *   - Weight and opacity follow the product title, because a title is the
 *     specification ("Medium Weight (95 GSM)") and a tag is a shelf label.
 *   - Season is the union of both, because a season tag and a season in the
 *     product name are two statements about the same product and neither is
 *     more authoritative.
 * Every trait records where the wording came from, so the gallery can say
 * "stated in the product title" rather than implying the shop classified it.
 */

/** Normalised weight wording. `gsm` keeps the number the shop published. */
const WEIGHT_RULES = [
  { canonical: "lightweight", re: /\blight[\s-]?weight\b/gi },
  { canonical: "medium weight", re: /\bmedium[\s-]?weight\b/gi },
  { canonical: "heavyweight", re: /\bheavy[\s-]?weight\b/gi },
  { canonical: "weightless", re: /\bweightless\b/gi },
  { canonical: "gsm", re: /\b(\d{2,4})\s*gsm\b/gi, expand: (match) => `${match[1]} gsm` },
];

/** Normalised opacity wording. "semi-sheer" wins over a bare "sheer". */
const OPACITY_RULES = [
  { canonical: "semi-sheer", re: /\bsemi[\s-]?sheer\b/gi },
  { canonical: "sheer", re: /\bsheer\b/gi },
  { canonical: "translucent", re: /\btranslucent\b/gi },
  { canonical: "opaque", re: /\bopaque\b/gi },
];

/** Normalised season wording. Retailers say "fall" or "autumn"; both map to autumn. */
const SEASON_RULES = [
  { canonical: "spring", re: /\bspring\b/gi },
  { canonical: "summer", re: /\bsummer\b/gi },
  { canonical: "autumn", re: /\b(?:autumn|fall)\b/gi },
  { canonical: "winter", re: /\bwinter\b/gi },
  { canonical: "all-season", re: /\b(?:all|four)[\s-]?season\b/gi },
];

const DIMENSIONS = [
  { key: "weight", rules: WEIGHT_RULES },
  { key: "opacity", rules: OPACITY_RULES },
  { key: "season", rules: SEASON_RULES },
];

/**
 * Runs one dimension's rules over a string and returns normalised values.
 * `matchAll` is used rather than `match` because a global `match` returns the
 * matched text only, dropping the capture group the GSM rule needs.
 */
function matchRules(text, rules) {
  const found = [];
  const source = String(text ?? "");
  if (!source) return found;
  for (const rule of rules) {
    for (const match of source.matchAll(rule.re)) {
      const value = rule.expand ? rule.expand(match) : rule.canonical;
      if (!found.includes(value)) found.push(value);
    }
  }
  return found;
}

/** "semi-sheer" is also a "sheer"; keep the more specific word only. */
function dedupeOpacity(values) {
  if (values.includes("semi-sheer")) {
    return values.filter((value) => value !== "sheer");
  }
  return values;
}

/**
 * Reads weight, opacity and season out of one piece of store text.
 *
 * @param {string} text tags or title
 * @returns {{weight: string[], opacity: string[], season: string[]}}
 */
export function traitsFromText(text) {
  const result = { weight: [], opacity: [], season: [] };
  for (const dimension of DIMENSIONS) {
    const values = matchRules(text, dimension.rules);
    result[dimension.key] =
      dimension.key === "opacity" ? dedupeOpacity(values) : values;
  }
  return result;
}

/**
 * The specification wins: the product title if it says anything about this
 * dimension, otherwise the shop's tags.
 */
function preferSpec(titleValues, tagValues) {
  if (titleValues.length > 0) return { values: titleValues, from: "title" };
  if (tagValues.length > 0) return { values: tagValues, from: "tags" };
  return { values: [], from: null };
}

/** A season stated anywhere in the shop's text counts, from either place. */
function unionSeasons(tagValues, titleValues) {
  const values = [...tagValues];
  for (const value of titleValues) if (!values.includes(value)) values.push(value);
  let from = null;
  if (tagValues.length > 0 && titleValues.length > 0) from = "tags+title";
  else if (tagValues.length > 0) from = "tags";
  else if (titleValues.length > 0) from = "title";
  return { values, from };
}

/**
 * Derives the store-stated traits for one catalogue row.
 *
 * @param {{tags?: string, title?: string}} row
 * @returns {Record<string, string[] | string>}
 */
export function deriveTraits(row) {
  const fromTags = traitsFromText(row?.tags);
  const fromTitle = traitsFromText(row?.title);

  const traits = {};

  const weight = preferSpec(fromTitle.weight, fromTags.weight);
  if (weight.values.length > 0) {
    traits.weight = weight.values;
    traits.weightFrom = weight.from;
  }

  const opacity = preferSpec(fromTitle.opacity, fromTags.opacity);
  if (opacity.values.length > 0) {
    traits.opacity = opacity.values;
    traits.opacityFrom = opacity.from;
  }

  const season = unionSeasons(fromTags.season, fromTitle.season);
  if (season.values.length > 0) {
    traits.season = season.values;
    traits.seasonFrom = season.from;
  }

  return traits;
}

/**
 * Drops empty trait lists so the published index stays small.
 * Rows with no store-stated traits carry no `traits` key at all.
 */
export function compactTraits(traits) {
  const compact = {};
  for (const key of ["weight", "opacity", "season"]) {
    if (traits[key]?.length) compact[key] = traits[key];
  }
  for (const key of ["weightFrom", "opacityFrom", "seasonFrom"]) {
    if (traits[key]) compact[key] = traits[key];
  }
  if (!compact.weight && !compact.opacity && !compact.season) return undefined;
  return compact;
}
