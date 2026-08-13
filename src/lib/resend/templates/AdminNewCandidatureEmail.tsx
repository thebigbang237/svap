import { Body, Container, Head, Heading, Hr, Link, Preview, Section, Text, Html } from "react-email";
import { styles } from "./styles";
import { paysLabel, secteurLabel, packLabel } from "../labels";
import { getDirection } from "@/i18n/routing";
import type { CandidatureData, Locale } from "../types";

export interface AdminNewCandidatureEmailProps {
  candidature: CandidatureData;
  adminUrl: string;
  locale: Locale;
}

// Internal-only notification — plain and functional rather than branded
// marketing copy, but still respects candidature.locale per spec.
const copy = {
  fr: {
    preview: "Nouvelle candidature reçue",
    heading: "Nouvelle candidature",
    fields: {
      name: "Nom",
      email: "Email",
      telephone: "Téléphone",
      pack: "Pack",
      pays: "Pays",
      secteur: "Secteur",
    },
    ctaLabel: "Voir le dossier dans l'admin",
  },
  en: {
    preview: "New application received",
    heading: "New Application",
    fields: {
      name: "Name",
      email: "Email",
      telephone: "Phone",
      pack: "Pack",
      pays: "Country",
      secteur: "Sector",
    },
    ctaLabel: "View in admin",
  },
  // Kept locale-driven to preserve the existing documented behaviour, but
  // worth revisiting: the admin UI is French-only by design, so an internal
  // alert rendered in Arabic is harder for the team to triage than it is
  // useful as a signal of which language to reply in.
  ar: {
    preview: "ترشيح جديد",
    heading: "ترشيح جديد",
    fields: {
      name: "الاسم",
      email: "البريد الإلكتروني",
      telephone: "الهاتف",
      pack: "الباقة",
      pays: "البلد",
      secteur: "القطاع",
    },
    ctaLabel: "عرض الملف في لوحة الإدارة",
  },
} as const;

export function AdminNewCandidatureEmail({
  candidature,
  adminUrl,
  locale,
}: AdminNewCandidatureEmailProps) {
  const t = copy[locale];

  return (
    <Html lang={locale} dir={getDirection(locale)}>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>{t.heading}</Heading>

          <Section>
            <Text style={styles.label}>{t.fields.name}</Text>
            <Text style={styles.value}>
              {candidature.prenom} {candidature.nom}
            </Text>

            <Text style={styles.label}>{t.fields.email}</Text>
            <Text style={styles.value} dir="ltr">
              {candidature.email}
            </Text>

            <Text style={styles.label}>{t.fields.telephone}</Text>
            <Text style={styles.value} dir="ltr">
              {candidature.telephone}
            </Text>

            <Text style={styles.label}>{t.fields.pack}</Text>
            <Text style={styles.value}>
              {packLabel(locale, candidature.pack)}
            </Text>

            <Text style={styles.label}>{t.fields.pays}</Text>
            <Text style={styles.value}>
              {paysLabel(locale, candidature.pays)}
            </Text>

            <Text style={styles.label}>{t.fields.secteur}</Text>
            <Text style={{ ...styles.value, margin: 0 }}>
              {secteurLabel(locale, candidature.secteur)}
            </Text>
          </Section>

          <Hr style={styles.hr} />

          <Link href={adminUrl} style={styles.button}>
            {t.ctaLabel}
          </Link>
        </Container>
      </Body>
    </Html>
  );
}

export default AdminNewCandidatureEmail;
