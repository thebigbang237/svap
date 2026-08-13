"use client";

import { useState } from "react";
import { DOCUMENT_KIND_LABELS_FR, label } from "@/lib/constants/admin-labels";
import type { DocumentView } from "@/lib/admin/dossier";

/**
 * Opens a candidate's identity documents.
 *
 * The signed URL is fetched on click, never rendered into the page. Two
 * reasons: it expires in 60 seconds, so embedding it in the HTML would burn
 * most of its life before anyone clicks; and every mint is written to the
 * audit log — pre-fetching would record an access that never happened, and
 * would log every document every time a dossier is merely opened.
 */
export function DocumentViewer({ documents }: { documents: DocumentView[] }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open(documentId: string) {
    setLoading(documentId);
    setError(null);

    try {
      const res = await fetch(`/api/admin/documents/${documentId}`);
      if (!res.ok) {
        setError("Impossible d'ouvrir ce document.");
        return;
      }
      const { url } = (await res.json()) as { url: string };
      // noopener/noreferrer so the signed URL never leaks through
      // window.opener or a Referer header to the storage host.
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(null);
    }
  }

  if (documents.length === 0) {
    return (
      <p className="text-sm text-ink-dim">Aucune pièce transmise pour l'instant.</p>
    );
  }

  const casier = documents.find((d) => d.kind === "casier_judiciaire");

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {documents.map((doc) => (
          <li
            key={doc.id}
            className="flex flex-wrap items-center justify-between gap-4 border border-ink-dim/20 p-4"
          >
            <div>
              <p className="text-sm font-medium text-ink">
                {label(DOCUMENT_KIND_LABELS_FR, doc.kind)}
              </p>
              <p className="text-xs text-ink-dim">
                {doc.mime_type} · {Math.round(doc.size_bytes / 1024)} Ko ·
                transmis le{" "}
                {new Date(doc.uploaded_at).toLocaleString("fr-FR")}
              </p>
              {doc.sha256 && (
                <p className="mt-1 font-mono text-[10px] text-ink-dim/70">
                  sha256 {doc.sha256.slice(0, 16)}…
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={loading === doc.id}
              onClick={() => open(doc.id)}
              className="border border-blue px-4 py-2 text-xs font-semibold uppercase tracking-wide text-blue transition-colors hover:bg-blue hover:text-white disabled:opacity-40"
            >
              {loading === doc.id ? "Ouverture..." : "Ouvrir"}
            </button>
          </li>
        ))}
      </ul>

      {casier?.casier_numero && (
        <div className="grid grid-cols-1 gap-3 border-t border-ink-dim/20 pt-4 sm:grid-cols-2">
          <Ref label="N° du casier" value={casier.casier_numero} />
          <Ref
            label="Date d'établissement"
            value={
              casier.casier_date
                ? new Date(casier.casier_date).toLocaleDateString("fr-FR")
                : "—"
            }
          />
          <Ref label="Lieu" value={casier.casier_lieu ?? "—"} />
          <Ref label="Structure émettrice" value={casier.casier_structure ?? "—"} />
        </div>
      )}

      <p className="text-xs text-ink-dim">
        Chaque ouverture est journalisée (lien valable 60 secondes).
      </p>

      {error && <p className="text-xs text-terracotta">{error}</p>}
    </div>
  );
}

function Ref({ label: l, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
        {l}
      </p>
      <p className="text-sm text-ink">{value}</p>
    </div>
  );
}
