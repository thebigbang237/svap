import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";
import { styles } from "./styles";
import { getDirection } from "@/i18n/routing";
import type { Locale } from "../types";

export interface CodeExpiringEmailProps {
  prenom: string;
  /** Whole days remaining before the code stops working. */
  daysLeft: number;
  portalUrl: string;
  locale: Locale;
}

const copy = {
  fr: {
    preview: "Votre code d'accès expire bientôt",
    brand: "Silicon Valley Africa",
    heading: (prenom: string) => `${prenom}, il vous reste peu de temps.`,
    body: (days: number) =>
      `Votre code d'accès expire dans ${days} ${days > 1 ? "jours" : "jour"}. Passé ce délai, vous devrez en demander un nouveau, sous réserve d'une vérification d'identité supplémentaire.`,
    next: "La Phase 2 vous demande vos informations personnelles, le règlement des frais de vérification, puis vos pièces justificatives. Prévoyez une vingtaine de minutes.",
    ctaLabel: "Reprendre ma Phase 2",
    lost: "Vous avez perdu votre code ? Utilisez le bouton « Renvoyer le code » sur la page.",
    footer:
      "Silicon Valley Africa Program 2026 — cet email concerne votre candidature.",
  },
  en: {
    preview: "Your access code expires soon",
    brand: "Silicon Valley Africa",
    heading: (prenom: string) => `${prenom}, you're running short on time.`,
    body: (days: number) =>
      `Your access code expires in ${days} ${days > 1 ? "days" : "day"}. After that you'll need to request a new one, subject to an additional identity check.`,
    next: "Phase 2 asks for your personal details, the verification fee, then your supporting documents. Set aside around twenty minutes.",
    ctaLabel: "Resume my Phase 2",
    lost: "Lost your code? Use the “Resend code” button on the page.",
    footer:
      "Silicon Valley Africa Program 2026 — this email concerns your application.",
  },
  ar: {
    preview: "رمز الدخول الخاص بكم ينتهي قريبًا",
    brand: "Silicon Valley Africa",
    heading: (prenom: string) => `${prenom}، لم يتبقَّ لكم وقت طويل.`,
    body: (days: number) =>
      `ينتهي رمز الدخول الخاص بكم خلال ${days} ${days > 1 ? "أيام" : "يوم"}. بعد هذا الأجل سيتعيّن عليكم طلب رمز جديد، رهنًا بتحقّق إضافي من الهوية.`,
    next: "تتطلب المرحلة الثانية معلوماتكم الشخصية، ثم أداء رسوم التحقّق، ثم وثائقكم الثبوتية. خصّصوا لها نحو عشرين دقيقة.",
    ctaLabel: "استئناف المرحلة الثانية",
    lost: "هل فقدتم رمزكم؟ استخدموا زر «إعادة إرسال الرمز» في الصفحة.",
    footer: "Silicon Valley Africa Program 2026 — تتعلق هذه الرسالة بترشيحكم.",
  },
} as const;

/**
 * Expiry nudge, sent at day 7 and day 12 of the 14-day window.
 *
 * Contains no code: it isn't recoverable (only the hash is stored), and a
 * reminder is a lower-trust context than the original delivery — this may be
 * forwarded or read on a shared device. It points at the portal instead.
 */
export function CodeExpiringEmail({
  prenom,
  daysLeft,
  portalUrl,
  locale,
}: CodeExpiringEmailProps) {
  const t = copy[locale];

  return (
    <Html lang={locale} dir={getDirection(locale)}>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>{t.brand}</Text>
          <Heading style={styles.heading}>{t.heading(prenom)}</Heading>
          <Text style={styles.paragraph}>{t.body(daysLeft)}</Text>
          <Text style={styles.paragraph}>{t.next}</Text>

          <Section style={{ margin: "32px 0" }}>
            <Link href={portalUrl} style={styles.button}>
              {t.ctaLabel}
            </Link>
          </Section>

          <Text style={styles.paragraph}>{t.lost}</Text>

          <Hr style={styles.hr} />
          <Text style={styles.footer}>{t.footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default CodeExpiringEmail;
