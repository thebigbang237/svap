import { Body, Container, Head, Heading, Hr, Link, Preview, Section, Text, Html } from "react-email";
import { styles } from "./styles";
import { PAYS_LABELS, SECTEUR_LABELS, PACK_LABELS } from "../labels";
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
} as const;

export function AdminNewCandidatureEmail({
  candidature,
  adminUrl,
  locale,
}: AdminNewCandidatureEmailProps) {
  const t = copy[locale];

  return (
    <Html>
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
            <Text style={styles.value}>{candidature.email}</Text>

            <Text style={styles.label}>{t.fields.telephone}</Text>
            <Text style={styles.value}>{candidature.telephone}</Text>

            <Text style={styles.label}>{t.fields.pack}</Text>
            <Text style={styles.value}>
              {PACK_LABELS[locale][candidature.pack] ?? candidature.pack}
            </Text>

            <Text style={styles.label}>{t.fields.pays}</Text>
            <Text style={styles.value}>
              {PAYS_LABELS[locale][candidature.pays] ?? candidature.pays}
            </Text>

            <Text style={styles.label}>{t.fields.secteur}</Text>
            <Text style={{ ...styles.value, margin: 0 }}>
              {SECTEUR_LABELS[locale][candidature.secteur] ?? candidature.secteur}
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
