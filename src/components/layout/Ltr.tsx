/**
 * Isolates always-left-to-right content inside an RTL page.
 *
 * The Unicode bidi algorithm reorders neutral characters — punctuation,
 * currency symbols, separators — according to the surrounding paragraph
 * direction. Inside the Arabic tree that quietly mangles anything that isn't
 * prose:
 *
 *   $330              renders as  330$
 *   SVAP-4F2A-9C11    the groups reverse
 *   +237 6 12 34 56   the country code jumps to the wrong end
 *   contact@svap.com  breaks around the @ and the dots
 *
 * `dir="ltr"` alone isn't enough — it sets the direction but still lets the
 * element reorder relative to its neighbours. `unicode-bidi: isolate` is what
 * seals it off, which is exactly what the `isolate` CSS below does.
 *
 * Use for: access codes, emails, phone numbers, passport numbers, monetary
 * amounts, times, URLs, and anything else read as a literal token rather than
 * as language. Do NOT use for translated copy — Arabic text needs to stay RTL.
 */
export function Ltr({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span dir="ltr" className={`[unicode-bidi:isolate] ${className}`}>
      {children}
    </span>
  );
}
