"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Check, Info, Star, Trash2 } from "lucide-react";
import { GALLERY_PHOTOS } from "@/lib/beta";
import type { GalleryItem } from "@/lib/gallery";
import {
  DRAPE_OPTIONS,
  IN_PERSON_OPACITY_OPTIONS,
  SEASON_OPTIONS,
  TEXTURE_OPTIONS,
  VERDICT_OPTIONS,
  type FabricNote,
  type ListEntry,
} from "./notes";
import { thumbnailSrcSet, thumbnailUrl, swatchBackground } from "./GalleryCard";
import { BottomSheet } from "./BottomSheet";

interface ItemSheetProps {
  open: boolean;
  item: GalleryItem | null;
  note?: FabricNote;
  listEntry?: ListEntry;
  onClose: () => void;
  onSaveNote: (id: string, note: FabricNote) => void;
  onClearNote: (id: string) => void;
  onSetSeason: (id: string, season: string) => void;
  onRemoveFromList: (id: string) => void;
}

const SELECT_CLASS = "gal-select";

/**
 * The detail sheet: everything known about one colour, plus the note the
 * buyer writes while holding the cloth.
 *
 * The measurement is shown with its capture conditions every time, so a colour
 * never leaves this sheet looking like a measured physical swatch.
 */
export function ItemSheet({
  open,
  item,
  note,
  listEntry,
  onClose,
  onSaveNote,
  onClearNote,
  onSetSeason,
  onRemoveFromList,
}: ItemSheetProps) {
  const [drape, setDrape] = useState("");
  const [texture, setTexture] = useState("");
  const [opacity, setOpacity] = useState("");
  const [verdict, setVerdict] = useState("");
  const [text, setText] = useState("");

  // Reseed the form whenever a different fabric is opened.
  useEffect(() => {
    setDrape(note?.drape ?? "");
    setTexture(note?.texture ?? "");
    setOpacity(note?.opacity ?? "");
    setVerdict(note?.verdict ?? "");
    setText(note?.text ?? "");
  }, [item?.id, note]);

  if (!item) return null;

  const onList = Boolean(listEntry);
  const season = listEntry?.season ?? "Spring";
  const remote = GALLERY_PHOTOS ? item.remoteThumb ?? item.remote : undefined;  const src = thumbnailUrl(remote, 960);
  const srcSet = thumbnailSrcSet(remote);

  const save = () => {
    onSaveNote(item.id, { drape, texture, opacity, verdict, text });
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={item.name}
      subtitle={[item.siteLabel, item.fabric].filter(Boolean).join(" · ")}
      eyebrow={
        <span className="gal-sheet-chip">
          <span
            className="gal-sheet-chip-swatch"
            style={{ background: swatchBackground(item) }}
          />
          {item.hex.toUpperCase()}
        </span>
      }
      footer={
        <>
          <button
            type="button"
            className="gal-btn gal-btn--ghost"
            onClick={() => {
              onClearNote(item.id);
              setDrape("");
              setTexture("");
              setOpacity("");
              setVerdict("");
              setText("");
            }}
            disabled={!note}
          >
            <Trash2 size={14} strokeWidth={1.8} aria-hidden="true" />
            Clear note
          </button>
          <button type="button" className="gal-btn gal-btn--solid" onClick={save}>
            <Check size={15} strokeWidth={2} aria-hidden="true" />
            Save note
          </button>
        </>
      }
    >
      <div className="gal-detail-media">
        {src ? (
          <img
            src={src}
            srcSet={srcSet}
            sizes="(max-width: 720px) 92vw, 560px"
            alt={`Product photograph of ${item.name}`}
            width={900}
            height={900}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <span className="gal-detail-swatch" style={{ background: swatchBackground(item) }} />
        )}
      </div>

      <p className="gal-detail-origin">{item.originDetail}</p>

      <section className="gal-detail-block">
        <h3>Colour values</h3>
        <dl className="gal-detail-values">
          <div>
            <dt>Hex</dt>
            <dd>{item.hex.toUpperCase()}</dd>
          </div>
          <div>
            <dt>CIELAB</dt>
            <dd>
              L {item.lab.l.toFixed(1)} · a {item.lab.a.toFixed(1)} · b {item.lab.b.toFixed(1)}
            </dd>
          </div>
          <div>
            <dt>Family</dt>
            <dd>{item.family}</dd>
          </div>
          {item.colorFamily ? (
            <div>
              <dt>Shop&rsquo;s word</dt>
              <dd>{item.colorFamily}</dd>
            </div>
          ) : null}
          {item.measuredFamily ? (
            <div>
              <dt>Measured as</dt>
              <dd>{item.measuredFamily}</dd>
            </div>
          ) : null}
          <div>
            <dt>Finish</dt>
            <dd>{item.finish}</dd>
          </div>
          {item.price ? (
            <div>
              <dt>Price</dt>
              <dd>{item.price.startsWith("$") ? item.price : `$${item.price}`}</dd>
            </div>
          ) : null}
        </dl>

        {item.palette.length > 0 ? (
          <div className="gal-palette">
            <span className="gal-detail-label">Measured palette</span>
            <div className="gal-palette-strip">
              {item.palette.map((hex) => (
                <span
                  key={hex}
                  className="gal-palette-chip"
                  style={{ background: hex }}
                  title={hex}
                />
              ))}
            </div>
          </div>
        ) : null}

        <p className="gal-detail-caveat">
          <Info size={13} strokeWidth={1.8} aria-hidden="true" />
          <span>
            Hex is the measured dominant colour of the store&rsquo;s product photograph.
            CIELAB is derived from that hex, not measured separately.{" "}
            {item.flatness !== undefined
              ? `Photo flatness score ${item.flatness.toLocaleString()} (lower is flatter).`
              : null}{" "}
            {item.familySource
              ? `The colour was labelled from the shop’s ${item.familySource}.`
              : null}
          </span>
        </p>
      </section>

      {item.traits && (item.traits.weight || item.traits.opacity || item.traits.season) ? (
        <section className="gal-detail-block">
          <h3>As the shop describes it</h3>
          <div className="gal-detail-traits">
            {item.traits.weight?.length ? (
              <div className="gal-detail-trait">
                <span className="gal-detail-label">Weight</span>
                <span className="gal-trait-list">
                  {item.traits.weight.map((value) => (
                    <span key={value} className="gal-trait">
                      {value}
                    </span>
                  ))}
                </span>
                <span className="gal-detail-source">
                  stated in {item.traits.weightFrom === "title" ? "the product title" : "the shop’s tags"}
                </span>
              </div>
            ) : null}
            {item.traits.opacity?.length ? (
              <div className="gal-detail-trait">
                <span className="gal-detail-label">Opacity</span>
                <span className="gal-trait-list">
                  {item.traits.opacity.map((value) => (
                    <span key={value} className="gal-trait">
                      {value}
                    </span>
                  ))}
                </span>
                <span className="gal-detail-source">
                  stated in {item.traits.opacityFrom === "title" ? "the product title" : "the shop’s tags"}
                </span>
              </div>
            ) : null}
            {item.traits.season?.length ? (
              <div className="gal-detail-trait">
                <span className="gal-detail-label">Season</span>
                <span className="gal-trait-list">
                  {item.traits.season.map((value) => (
                    <span key={value} className="gal-trait">
                      {value}
                    </span>
                  ))}
                </span>
                <span className="gal-detail-source">
                  stated in{" "}
                  {item.traits.seasonFrom === "title"
                    ? "the product title"
                    : item.traits.seasonFrom === "tags+title"
                      ? "the shop’s tags and title"
                      : "the shop’s tags"}
                </span>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="gal-detail-block">
        <h3>Keep on the seasonal list</h3>
        <p className="gal-detail-note">
          Saved on this device only. Use the list to build the seasonal materials
          you want to order.
        </p>
        <div className="gal-keep-row">
          <button
            type="button"
            className={`gal-btn ${onList ? "gal-btn--solid" : "gal-btn--outline"}`}
            onClick={() =>
              onList ? onRemoveFromList(item.id) : onSetSeason(item.id, season)
            }
            aria-pressed={onList}
          >
            <Star size={14} strokeWidth={1.9} aria-hidden="true" />
            {onList ? "On the list" : "Keep it"}
          </button>
          <label className="gal-inline-field">
            <span className="gal-inline-label">Season</span>
            <select
              className={SELECT_CLASS}
              value={season}
              onChange={(event) => onSetSeason(item.id, event.target.value)}
              aria-label="Season for this fabric"
              disabled={!onList}
            >
              {SEASON_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="gal-detail-block">
        <h3>How does it feel?</h3>
        <p className="gal-detail-note">
          Notes from holding the cloth. They stay on this device until you export
          them.
        </p>
        <div className="gal-note-grid">
          <label className="gal-field">
            <span>Drape</span>
            <select
              className={SELECT_CLASS}
              value={drape}
              onChange={(event) => setDrape(event.target.value)}
            >
              <option value="">Not noted</option>
              {DRAPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="gal-field">
            <span>Texture</span>
            <select
              className={SELECT_CLASS}
              value={texture}
              onChange={(event) => setTexture(event.target.value)}
            >
              <option value="">Not noted</option>
              {TEXTURE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="gal-field">
            <span>In-person opacity</span>
            <select
              className={SELECT_CLASS}
              value={opacity}
              onChange={(event) => setOpacity(event.target.value)}
            >
              <option value="">Not noted</option>
              {IN_PERSON_OPACITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="gal-field">
            <span>Verdict</span>
            <select
              className={SELECT_CLASS}
              value={verdict}
              onChange={(event) => setVerdict(event.target.value)}
            >
              <option value="">Not decided</option>
              {VERDICT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="gal-field gal-field--wide">
          <span>Note</span>
          <textarea
            className="gal-textarea"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            placeholder="Anything you want to remember about this cloth"
          />
        </label>
      </section>

      {item.url ? (
        <a
          className="gal-detail-link"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          View this product at {item.siteLabel}
          <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden="true" />
        </a>
      ) : null}
    </BottomSheet>
  );
}
