import { thumbnailUrl } from "@/lib/articles";
import { ExternalLinkIcon } from "./icons";
import type { ArticleRow } from "@/lib/supabase/types";

/**
 * One piece of press coverage.
 *
 * The whole card is the link, and it leaves the site — so it is a plain
 * anchor, not next-intl's `Link`: there is no locale to carry onto a third
 * party's domain. `rel="noopener"` is not optional on a URL an administrator
 * typed; `nofollow` keeps the page from reading as a link farm.
 *
 * The image is a plain <img> rather than next/image on purpose. It comes from
 * the Supabase storage host, which would otherwise have to be allowlisted in
 * next.config from an environment variable — coupling the build to an env var
 * that may not be set. The admin editor downscales before upload instead, so
 * what ships is already thumbnail-sized.
 */
export function ArticleCard({
  article,
  locale,
  readLabel,
}: {
  article: ArticleRow;
  locale: string;
  readLabel: string;
}) {
  const src = thumbnailUrl(article.thumbnail_path);

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="group flex h-full flex-col border border-ink-dim/20 bg-white transition-colors hover:border-blue"
    >
      {src ? (
        /* eslint-disable-next-line @next/next/no-img-element -- the thumbnail
           lives on the Supabase storage host, which next/image would require
           allowlisting in next.config from an environment variable. The admin
           editor downscales before upload instead. */
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="aspect-video w-full object-cover"
        />
      ) : (
        // No thumbnail is a normal state, not a broken one: some outlets have
        // no usable image and a grey band reads better than a broken icon.
        <div aria-hidden="true" className="aspect-video w-full bg-sky-mid" />
      )}

      <div className="flex flex-1 flex-col p-6">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[10px] font-semibold uppercase tracking-[0.2em]">
          <span className="text-terracotta">{article.media_name}</span>
          <time className="text-ink-dim" dateTime={article.published_at}>
            {new Date(article.published_at).toLocaleDateString(locale, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
        </div>

        <h3 className="mb-3 font-serif text-[22px] font-normal leading-[1.3] text-blue-dark">
          {article.title}
        </h3>

        {article.caption && (
          <p className="mb-6 text-sm leading-relaxed text-ink-mid">
            {article.caption}
          </p>
        )}

        <span className="mt-auto inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue transition-colors group-hover:text-terracotta">
          {readLabel}
          <ExternalLinkIcon className="h-3.5 w-3.5" />
        </span>
      </div>
    </a>
  );
}
