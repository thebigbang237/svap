import Link from "next/link";

export interface PaginationProps {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams: URLSearchParams;
}

export function Pagination({
  page,
  totalPages,
  basePath,
  searchParams,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const hrefForPage = (targetPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(targetPage));
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-between text-sm">
      <p className="text-ink-dim">
        Page {page} sur {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={hrefForPage(page - 1)}
            className="border border-ink-dim/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-mid hover:border-blue hover:text-blue"
          >
            Précédent
          </Link>
        ) : (
          <span className="border border-ink-dim/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-dim/40">
            Précédent
          </span>
        )}
        {page < totalPages ? (
          <Link
            href={hrefForPage(page + 1)}
            className="border border-ink-dim/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-mid hover:border-blue hover:text-blue"
          >
            Suivant
          </Link>
        ) : (
          <span className="border border-ink-dim/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-dim/40">
            Suivant
          </span>
        )}
      </div>
    </div>
  );
}
