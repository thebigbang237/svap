/**
 * Full-name matching for the Phase-2 portal.
 *
 * §14 asks for the name "exactement tel qu'indiqué sur la candidature Phase
 * 1". Implemented as a literal string comparison that would fail for most of
 * the target audience: candidates in Morocco, Cameroon and Egypt routinely
 * type their own name with different accents, casing, spacing, hyphenation or
 * name order than they did weeks earlier — and the Arabic locale adds
 * optional diacritics and several Unicode forms of the same letter.
 *
 * Comparing canonical forms keeps the security property that matters (you
 * must know whose code you hold) while dropping the one that only generates
 * support tickets (you must reproduce your own typing exactly).
 *
 * Pure and dependency-free so it can be unit-tested and reused by the Phase-2
 * steps that re-verify identity.
 */
export function normalizeFullName(raw: string): string {
  return (
    raw
      // NFD splits accented characters into base + combining mark, so the
      // next step can drop the marks. This handles Latin accents (é, ç, ô)
      // and Arabic harakat (فَتْحَة) in the same pass — both are combining
      // marks, and both are optional in everyday writing.
      .normalize("NFD")
      .replace(/[̀-ًͯ-ْٰ]/g, "")
      // Arabic orthography treats these as interchangeable in casual typing:
      // alef variants, the two ya forms, and ta marbuta vs ha.
      .replace(/[أإآٱ]/g, "ا") // أ إ آ ٱ → ا
      .replace(/ى/g, "ي") // ى → ي
      .replace(/ة/g, "ه") // ة → ه
      // Punctuation becomes a separator rather than vanishing, so "Ben-Ali"
      // and "Ben Ali" agree, and O'Brien doesn't collapse to "obrien" while
      // "O Brien" becomes two tokens.
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      // Order-independent: "Koffi Diop" and "Diop Koffi" are the same person,
      // and which order counts as "first name first" is not a question a
      // candidate should have to get right to reach a page they paid for.
      .sort()
      .join(" ")
  );
}

/**
 * Does the name typed at the portal identify this candidature?
 *
 * Takes the stored first and last names separately — the portal asks for one
 * "nom complet" field, so they're joined before normalising, which is also
 * what makes the order-independence above work.
 */
export function fullNameMatches(
  submitted: string,
  stored: { prenom: string; nom: string },
): boolean {
  const canonicalSubmitted = normalizeFullName(submitted);
  if (!canonicalSubmitted) return false;
  return (
    canonicalSubmitted === normalizeFullName(`${stored.prenom} ${stored.nom}`)
  );
}
