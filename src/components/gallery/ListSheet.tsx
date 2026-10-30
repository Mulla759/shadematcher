"use client";

import { Copy, Download, ExternalLink, Trash2 } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import type { ExportRow } from "./notes";

interface ListSheetProps {
  open: boolean;
  onClose: () => void;
  rows: ExportRow[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onCopy: () => void;
  onDownloadMarkdown: () => void;
  onDownloadJson: () => void;
  copied: boolean;
  storageOk: boolean;
}

/**
 * The seasonal materials list.
 *
 * Everything here came from this device's own notes. It is labelled as such,
 * and the only way it leaves the device is one of the export buttons.
 */
export function ListSheet({
  open,
  onClose,
  rows,
  onRemove,
  onClearAll,
  onCopy,
  onDownloadMarkdown,
  onDownloadJson,
  copied,
  storageOk,
}: ListSheetProps) {
  const bySeason = new Map<string, ExportRow[]>();
  for (const row of rows) {
    const season = row.season || "Unassigned";
    const bucket = bySeason.get(season) ?? [];
    bucket.push(row);
    bySeason.set(season, bucket);
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Seasonal materials list"
      subtitle={`${rows.length} ${rows.length === 1 ? "fabric" : "fabrics"} kept on this device`}
      footer={
        <>
          <button
            type="button"
            className="gal-btn gal-btn--ghost"
            onClick={onClearAll}
            disabled={rows.length === 0}
          >
            <Trash2 size={14} strokeWidth={1.8} aria-hidden="true" />
            Clear list
          </button>
          <button
            type="button"
            className="gal-btn gal-btn--solid"
            onClick={onCopy}
            disabled={rows.length === 0}
          >
            <Copy size={14} strokeWidth={1.8} aria-hidden="true" />
            {copied ? "Copied" : "Copy list"}
          </button>
        </>
      }
    >
      <p className="gal-local-notice">
        <strong>These notes stay on this device.</strong> Nothing here is uploaded
        and nothing here is shared with Auriga or anyone else. Export the list
        and send it on yourself.
      </p>

      {!storageOk ? (
        <p className="gal-local-warning">
          This browser is blocking local storage, so notes cannot be kept between
          visits. Copy them out before you close the page.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="gal-empty">
          Nothing kept yet. Tap the star on any fabric to add it to the list.
        </p>
      ) : (
        [...bySeason.entries()].map(([season, seasonRows]) => (
          <section key={season} className="gal-list-group">
            <h3 className="gal-list-season">{season}</h3>
            <ul className="gal-list">
              {seasonRows.map((row) => (
                <li key={row.id} className="gal-list-item">
                  <span
                    className="gal-list-swatch"
                    style={{ background: row.hex }}
                    aria-hidden="true"
                  />
                  <span className="gal-list-copy">
                    <strong>{row.name}</strong>
                    <span>
                      {[row.fabric, row.siteLabel].filter(Boolean).join(" · ")}
                    </span>
                    <span className="gal-list-note">
                      {[
                        row.note?.drape,
                        row.note?.texture,
                        row.note?.opacity,
                        row.note?.verdict,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "No feel note yet"}
                    </span>
                    {row.note?.text ? (
                      <span className="gal-list-text">{row.note.text}</span>
                    ) : null}
                  </span>
                  <span className="gal-list-actions">
                    {row.url ? (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${row.name} at ${row.siteLabel}`}
                        className="gal-list-icon"
                      >
                        <ExternalLink size={13} strokeWidth={1.8} />
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className="gal-list-icon"
                      onClick={() => onRemove(row.id)}
                      aria-label={`Remove ${row.name} from the list`}
                    >
                      <Trash2 size={13} strokeWidth={1.8} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <div className="gal-export">
        <h3 className="gal-export-title">Share it by hand</h3>
        <p className="gal-detail-note">
          Export reads the list out of this browser. Send the file or paste the
          text into a message yourself.
        </p>
        <div className="gal-export-actions">
          <button
            type="button"
            className="gal-btn gal-btn--outline"
            onClick={onCopy}
            disabled={rows.length === 0}
          >
            <Copy size={14} strokeWidth={1.8} aria-hidden="true" />
            Copy as text
          </button>
          <button
            type="button"
            className="gal-btn gal-btn--outline"
            onClick={onDownloadMarkdown}
            disabled={rows.length === 0}
          >
            <Download size={14} strokeWidth={1.8} aria-hidden="true" />
            Download .md
          </button>
          <button
            type="button"
            className="gal-btn gal-btn--outline"
            onClick={onDownloadJson}
            disabled={rows.length === 0}
          >
            <Download size={14} strokeWidth={1.8} aria-hidden="true" />
            Download .json
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
