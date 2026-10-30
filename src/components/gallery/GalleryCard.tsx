"use client";

import { ArrowUpRight, Check, Star } from "lucide-react";
import { GALLERY_PHOTOS } from "@/lib/beta";
import type { GalleryItem } from "@/lib/gallery";

interface GalleryCardProps {
  item: GalleryItem;
  kept: boolean;
  noted: boolean;
  onOpen: (item: GalleryItem) => void;
  onToggleKeep: (item: GalleryItem) => void;
}

/** The short label that keeps a digital colour from reading as cloth. */
const APPROXIMATION = {
  scraped: "Digital approximation",
  own: "Digital value",
  atlas: "Generated reference",
} as const;

/**
 * Builds a resized copy of the store's own CDN URL.
 *
 * The photography stays on the store's servers; only the size parameter
 * changes, so the browser pulls a few kilobytes instead of the original.
 */
export function thumbnailUrl(remote: string | undefined, size: number): string | undefined {
  if (!remote) return undefined;
  if (!remote.includes("cdn.shopify.com")) return remote;
  const separator = remote.includes("?") ? "&" : "?";
  return `${remote}${separator}width=${size}&height=${size}&crop=center`;
}

/** A responsive set of thumbnails for one photograph. */
export function thumbnailSrcSet(remote: string | undefined): string | undefined {
  if (!remote || !remote.includes("cdn.shopify.com")) return undefined;
  return [240, 480, 960]
    .map((size) => `${thumbnailUrl(remote, size)} ${size}w`)
    .join(", ");
}

/**
 * The colour shown when there is no photograph: the measured gradient for an
 * ombré, the measured palette for a print, the measured hex for a solid.
 * All three are readings from the photo, never a display value.
 */
export function swatchBackground(item: GalleryItem): string {
  const stops = item.gradient?.stops ?? [];
  if (stops.length >= 2) {
    return `linear-gradient(${item.gradient?.angle ?? 0}deg, ${stops.join(", ")})`;
  }
  if (item.palette.length >= 2) {
    return `linear-gradient(135deg, ${item.palette.join(", ")})`;
  }
  return item.hex;
}

function SwatchImage({ item }: { item: GalleryItem }) {
  const remote = GALLERY_PHOTOS ? item.remoteThumb ?? item.remote : undefined;
  const src = thumbnailUrl(remote, 480);
  const srcSet = thumbnailSrcSet(remote);

  return (
    <span className="gal-card-media" style={{ background: swatchBackground(item) }}>
      {src ? (
        <img
          src={src}
          srcSet={srcSet}
          sizes="(max-width: 480px) 45vw, (max-width: 900px) 30vw, 220px"
          alt=""
          width={600}
          height={600}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(event) => {
            // Never leave a broken image behind: fall back to the measured colour.
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <span className="gal-card-approx">{APPROXIMATION[item.source]}</span>
    </span>
  );
}

export function GalleryCard({
  item,
  kept,
  noted,
  onOpen,
  onToggleKeep,
}: GalleryCardProps) {
  const traits = [
    ...(item.traits?.weight ?? []),
    ...(item.traits?.opacity ?? []),
    ...(item.traits?.season ?? []),
  ].slice(0, 3);

  return (
    <article className="gal-card">
      <div className="gal-card-top">
        <button
          type="button"
          className="gal-card-media-button"
          onClick={() => onOpen(item)}
          aria-label={`Open ${item.name}, ${item.hex}`}
        >
          <SwatchImage item={item} />
        </button>
        <button
          type="button"
          className={`gal-keep${kept ? " is-on" : ""}`}
          onClick={() => onToggleKeep(item)}
          aria-pressed={kept}
          aria-label={
            kept
              ? `Remove ${item.name} from the seasonal list`
              : `Keep ${item.name} on the seasonal list`
          }
          title={
            kept
              ? "On the seasonal list"
              : "Keep on the seasonal list (saved on this device)"
          }
        >
          {kept ? (
            <Check size={14} strokeWidth={2.2} aria-hidden="true" />
          ) : (
            <Star size={14} strokeWidth={1.8} aria-hidden="true" />
          )}
        </button>
      </div>

      <button type="button" className="gal-card-body" onClick={() => onOpen(item)}>
        <span className="gal-card-name">{item.name}</span>
        <span className="gal-card-colour">
          <span className="gal-card-hex">{item.hex.toUpperCase()}</span>
          <span className="gal-card-lab">
            L{item.lab.l.toFixed(0)} a{item.lab.a.toFixed(0)} b{item.lab.b.toFixed(0)}
          </span>
        </span>
        <span className="gal-card-meta">
          {[item.fabric, item.siteLabel].filter(Boolean).join(" · ")}
        </span>
        {traits.length > 0 ? (
          <span className="gal-card-traits">
            {traits.map((trait) => (
              <span key={trait} className="gal-trait">
                {trait}
              </span>
            ))}
          </span>
        ) : null}
      </button>

      <div className="gal-card-foot">
        {item.url ? (
          <a
            className="gal-card-link"
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${item.name} at ${item.siteLabel}`}
            title={`View this product at ${item.siteLabel}`}
          >
            <ArrowUpRight size={13} strokeWidth={1.8} aria-hidden="true" />
            <span>{item.siteLabel}</span>
          </a>
        ) : (
          <span className="gal-card-link is-static">{item.siteLabel}</span>
        )}
        {noted ? <span className="gal-card-noted">Noted</span> : null}
      </div>
    </article>
  );
}
