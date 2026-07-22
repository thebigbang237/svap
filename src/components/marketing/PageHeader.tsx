import { Link } from "@/i18n/navigation";
import { SectionEyebrow } from "./SectionEyebrow";

export interface PageHeaderProps {
  breadcrumbHome: string;
  breadcrumbCurrent: string;
  eyebrow?: string;
  title: string;
  lead: string;
}

export function PageHeader({
  breadcrumbHome,
  breadcrumbCurrent,
  eyebrow,
  title,
  lead,
}: PageHeaderProps) {
  return (
    <section className="bg-sky-mid px-8 py-16 md:py-24">
      <div className="mx-auto max-w-[1280px]">
        <nav
          aria-label="Breadcrumb"
          className="mb-8 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink-dim"
        >
          <Link href="/" className="transition-colors hover:text-blue">
            {breadcrumbHome}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-blue">{breadcrumbCurrent}</span>
        </nav>
        <div className="max-w-2xl">
          {eyebrow && <SectionEyebrow label={eyebrow} className="mb-6" />}
          <h1 className="font-serif text-[40px] sm:text-[56px] leading-[1.1] font-normal text-blue-dark mb-8">
            {title}
          </h1>
          <p className="text-[18px] leading-[1.6] text-ink-mid">{lead}</p>
        </div>
      </div>
    </section>
  );
}
