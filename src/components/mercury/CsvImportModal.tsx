"use client";

import { useCallback, useRef, useState } from "react";

// IMPORT_FIELDS is a plain const array — no server-only imports in csv.ts.
import { IMPORT_FIELDS } from "@/lib/mercury/csv";
import type { ColumnMapping, ImportField } from "@/lib/mercury/csv";

type Step = "drop" | "map" | "done";

interface PreviewData {
  headers: string[];
  rowCount: number;
  sampleRows: Record<string, string>[];
  rows: Record<string, string>[];
  suggestedMapping: ColumnMapping;
}

interface ImportResult {
  created: number;
  duplicates: number;
  needs_review: number;
}

interface Props {
  roleId: string;
  onImported: () => void;
  onClose: () => void;
}

const FIELD_LABELS: Record<ImportField, string> = {
  name: "Name",
  email: "Email",
  years_exp: "Years exp",
  skills: "Skills",
  current_role: "Current role",
  location: "Location",
  stage: "Stage",
};

export function CsvImportModal({ roleId, onImported, onClose }: Props) {
  const [step, setStep] = useState<Step>("drop");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);
      setLoading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/mercury/roles/${roleId}/import/preview`, {
          method: "POST",
          body: fd,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not read CSV");
        setPreview(json);
        setMapping(json.suggestedMapping);
        setStep("map");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setLoading(false);
      }
    },
    [roleId],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile],
  );

  async function commit() {
    if (!preview || !mapping) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/mercury/roles/${roleId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapping, rows: preview.rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      setResult(json);
      setStep("done");
      if (json.created > 0) onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  // Columns that have at least one mapping assignment (for the sample table).
  const mappedCols = mapping ? (Object.values(mapping).filter(Boolean) as string[]) : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-deep/70 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Import CSV"
    >
      <div
        className="panel rise flex max-h-[90vh] w-full max-w-lg flex-col gap-5 overflow-y-auto p-6"
        style={{ boxShadow: "var(--shadow-pop)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Import CSV</h2>
          <button type="button" onClick={onClose} className="text-dim hover:text-text-2" aria-label="Close">
            ✕
          </button>
        </div>

        {/* ── Step 1: Drop zone ── */}
        {step === "drop" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-14 transition-colors"
            style={{
              borderColor: dragging ? "var(--signal)" : "var(--border)",
              background: dragging ? "rgba(255,255,255,.03)" : "transparent",
            }}
          >
            <UploadIcon />
            <div className="text-center">
              <p className="text-sm text-text-2">{loading ? "Reading…" : "Drop a CSV file here"}</p>
              <p className="mt-1 text-[11px] text-dim">or click to browse · max 2 MB · 2 000 rows</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f);
              }}
            />
          </div>
        )}

        {/* ── Step 2: Column mapping ── */}
        {step === "map" && preview && mapping && (
          <>
            <p className="text-[12px] text-muted">
              {preview.rowCount} row{preview.rowCount !== 1 ? "s" : ""} · Map your CSV columns to applicant fields.
            </p>

            <div className="flex flex-col gap-2.5">
              {IMPORT_FIELDS.map((field) => (
                <div key={field} className="grid grid-cols-2 items-center gap-3">
                  <span className="text-[12px] text-text-2">
                    {FIELD_LABELS[field]}
                    {(field === "name" || field === "email") && (
                      <span className="ml-1 text-dim text-[10px]">(recommended)</span>
                    )}
                  </span>
                  <select
                    value={mapping[field] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m!, [field]: e.target.value || null }))
                    }
                    className="csv-select"
                  >
                    <option value="">— skip —</option>
                    {preview.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Sample rows for the mapped columns */}
            {mappedCols.length > 0 && preview.sampleRows.length > 0 && (
              <div className="overflow-x-auto rounded border border-border-soft">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr>
                      {mappedCols.map((col) => (
                        <th
                          key={col}
                          className="border-b border-border-soft px-2 py-1.5 text-left font-medium text-muted"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sampleRows.slice(0, 3).map((row, i) => (
                      <tr key={i} className="border-b border-border-soft last:border-0">
                        {mappedCols.map((col) => (
                          <td
                            key={col}
                            className="max-w-[130px] truncate px-2 py-1.5 text-dim"
                            title={row[col] ?? ""}
                          >
                            {row[col] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={onClose} className="text-xs text-muted hover:text-text-2">
                Cancel
              </button>
              <button
                onClick={commit}
                disabled={loading || (!mapping.name && !mapping.email)}
                className="mercury-btn px-5 py-2.5 text-xs tracking-wider disabled:opacity-60"
              >
                {loading ? "IMPORTING…" : `IMPORT ${preview.rowCount} ROWS`}
              </button>
            </div>
          </>
        )}

        {/* ── Step 3: Result ── */}
        {step === "done" && result && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-3">
              <ResultCell value={result.created} label="Created" />
              <ResultCell value={result.duplicates} label="Skipped" />
              <ResultCell value={result.needs_review} label="Need review" warn={result.needs_review > 0} />
            </div>
            {result.needs_review > 0 && (
              <p className="text-[11px] text-dim">
                Flagged cards are visible on the board — open each one to fill in the missing details.
              </p>
            )}
            <div className="flex justify-end">
              <button onClick={onClose} className="mercury-btn px-5 py-2.5 text-xs tracking-wider">
                DONE
              </button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded tone-negative px-3 py-2 text-xs">
            {error}
          </p>
        )}

        <style>{`
          .csv-select {
            width: 100%;
            border-radius: 4px;
            border: 1px solid var(--border);
            background: var(--bg);
            padding: 6px 10px;
            font-size: 12px;
            color: var(--text);
            outline: none;
            cursor: pointer;
          }
          .csv-select:focus { border-color: var(--signal); }
        `}</style>
      </div>
    </div>
  );
}

function ResultCell({ value, label, warn }: { value: number; label: string; warn?: boolean }) {
  return (
    <div className="rounded border border-border-soft py-4 text-center">
      <div
        className="tnum text-xl font-semibold leading-none"
        style={{ color: warn ? "var(--waiting)" : "var(--text)" }}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[10px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-dim"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
