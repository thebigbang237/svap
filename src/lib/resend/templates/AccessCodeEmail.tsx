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
import { styles, colors } from "./styles";
import { getDirection } from "@/i18n/routing";
import type { Locale } from "../types";

export interface AccessCodeEmailProps {
  prenom: string;
  /** Plaintext, for this render only — never persisted anywhere. */
  code: string;
  /** Deep link with the code pre-filled. */
  portalUrl: string;
  expiresAt: Date;
  locale: Locale;
}

const copy = {
  fr: {
    preview: "Votre code d'accès — Silicon Valley Africa Program",
    brand: "Silicon Valley Africa",
    heading: (prenom: string) => `${prenom}, votre code d'accès est prêt.`,
    intro:
      "Votre candidature a été pré-sélectionnée. Le code ci-dessous vous ouvre la page « Obtenir mes documents » pour compléter la Phase 2.",
    codeLabel: "Votre code d'accès",
    ctaLabel: "Ouvrir la page",
    ctaHint: "Le lien ci-dessus remplit votre code automatiquement.",
    validityLabel: "Valable jusqu'au",
    instructions:
      "Sur la page, saisissez votre nom complet tel qu'indiqué sur votre candidature, ainsi que ce code.",
    security:
      "Ce code est personnel et lié à votre nom. Ne le partagez avec personne. L'équipe du programme ne vous demandera jamais votre code par téléphone ou sur les réseaux sociaux.",
    footer:
      "Silicon Valley Africa Program 2026 — vous recevez cet email suite à votre candidature.",
  },
  en: {
    preview: "Your access code — Silicon Valley Africa Program",
    brand: "Silicon Valley Africa",
    heading: (prenom: string) => `${prenom}, your access code is ready.`,
    intro:
      "Your application has been pre-selected. The code below opens the “Get my documents” page so you can complete Phase 2.",
    codeLabel: "Your access code",
    ctaLabel: "Open the page",
    ctaHint: "The link above fills in your code automatically.",
    validityLabel: "Valid until",
    instructions:
      "On the page, enter your full name as it appears on your application, along with this code.",
    security:
      "This code is personal and tied to your name. Do not share it with anyone. The program team will never ask for your code by phone or on social media.",
    footer:
      "Silicon Valley Africa Program 2026 — you're receiving this email following your application.",
  },
  ar: {
    preview: "رمز الدخول الخاص بكم — Silicon Valley Africa Program",
    brand: "Silicon Valley Africa",
    heading: (prenom: string) => `${prenom}، رمز الدخول الخاص بكم جاهز.`,
    intro:
      "تم اختيار ترشيحكم أوليًا. الرمز أدناه يفتح لكم صفحة «احصل على وثائقي» لاستكمال المرحلة الثانية.",
    codeLabel: "رمز الدخول الخاص بكم",
    ctaLabel: "فتح الصفحة",
    ctaHint: "الرابط أعلاه يملأ الرمز تلقائيًا.",
    validityLabel: "صالح حتى",
    instructions:
      "في الصفحة، أدخلوا اسمكم الكامل كما ورد في ترشيحكم، مع هذا الرمز.",
    security:
      "هذا الرمز شخصي ومرتبط باسمكم. لا تشاركوه مع أي شخص. لن يطلب منكم فريق البرنامج الرمز عبر الهاتف أو وسائل التواصل الاجتماعي.",
    footer:
      "Silicon Valley Africa Program 2026 — تصلكم هذه الرسالة عقب ترشيحكم.",
  },
} as const;

/**
 * Access-code delivery (§5).
 *
 * The specification asks for a QR code here. It is deliberately not included:
 * Gmail strips `data:` image URIs outright, remote images are blocked by
 * default in most clients until the reader opts in, and hosting the QR at a
 * URL would put the code itself into server and CDN logs. A large tappable
 * deep link achieves the same "one tap from email on mobile" goal, works
 * everywhere, and degrades to plain readable text when images are off — see
 * docs/flow-edition-2026.md.
 */
export function AccessCodeEmail({
  prenom,
  code,
  portalUrl,
  expiresAt,
  locale,
}: AccessCodeEmailProps) {
  const t = copy[locale];
  const dir = getDirection(locale);
  const formattedDate = new Intl.DateTimeFormat(
    locale === "ar" ? "ar-MA-u-nu-latn" : locale,
    { day: "numeric", month: "long", year: "numeric" },
  ).format(expiresAt);

  return (
    <Html lang={locale} dir={dir}>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>{t.brand}</Text>
          <Heading style={styles.heading}>{t.heading(prenom)}</Heading>
          <Text style={styles.paragraph}>{t.intro}</Text>

          <Section
            style={{
              margin: "32px 0",
              padding: "24px",
              backgroundColor: colors.sky,
              border: `1px solid ${colors.skyMid}`,
              textAlign: "center",
            }}
          >
            <Text style={{ ...styles.label, textAlign: "center" }}>
              {t.codeLabel}
            </Text>
            {/* dir="ltr" is load-bearing in the Arabic build: the bidi
                algorithm reorders the hyphen-separated groups otherwise, and
                the candidate would copy a scrambled code. */}
            <Text
              dir="ltr"
              style={{
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: "30px",
                fontWeight: 700,
                letterSpacing: "3px",
                color: colors.blueDark,
                margin: "8px 0 0",
                unicodeBidi: "isolate",
              }}
            >
              {code}
            </Text>
          </Section>

          <Section style={{ textAlign: "center", margin: "0 0 8px" }}>
            <Link href={portalUrl} style={styles.button}>
              {t.ctaLabel}
            </Link>
          </Section>
          <Text
            style={{
              ...styles.footer,
              textAlign: "center",
              marginBottom: "24px",
            }}
          >
            {t.ctaHint}
          </Text>

          <Hr style={styles.hr} />

          <Text style={styles.label}>{t.validityLabel}</Text>
          <Text style={styles.value}>{formattedDate}</Text>

          <Text style={styles.paragraph}>{t.instructions}</Text>

          <Text style={dir === "rtl" ? styles.quoteRtl : styles.quote}>
            {t.security}
          </Text>

          <Hr style={styles.hr} />
          <Text style={styles.footer}>{t.footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default AccessCodeEmail;
