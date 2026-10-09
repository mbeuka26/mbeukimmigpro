export const RULES_VERSION = '2026.10.0-fr-ca';

const COUNTRY_RULES: Record<string, { label: string; pathways: string[] }> = {
  FR: { label: 'France', pathways: ['travail', 'etudes', 'famille'] },
  CA: { label: 'Canada', pathways: ['express_entry', 'etudes', 'pnp'] },
};

export function runEligibilityV1(params: {
  countryCode: string;
  pathwayCode: string;
  input: Record<string, unknown>;
}) {
  const cc = (params.countryCode || '').toUpperCase();
  const country = COUNTRY_RULES[cc];
  const checks: Array<{ id: string; status: string; message: string }> = [];

  if (!country) {
    return {
      countryCode: cc,
      pathwayCode: params.pathwayCode,
      rulesVersion: RULES_VERSION,
      checks: [{ id: 'country', status: 'unknown', message: 'Pays non couvert en v1.' }],
      summary: 'Évaluation non disponible pour ce pays en v1.',
    };
  }

  if (!country.pathways.includes(params.pathwayCode)) {
    checks.push({
      id: 'pathway',
      status: 'unknown',
      message: `Voie « ${params.pathwayCode} » non configurée pour ${country.label}.`,
    });
  }

  const age = typeof params.input.age === 'number' ? params.input.age : null;
  checks.push(
    age === null
      ? { id: 'age', status: 'unknown', message: 'Âge non renseigné.' }
      : age < 18
        ? { id: 'age', status: 'needs_review', message: 'Mineur : validation professionnelle recommandée.' }
        : { id: 'age', status: 'pass', message: 'Âge renseigné.' }
  );

  return {
    countryCode: cc,
    pathwayCode: params.pathwayCode,
    rulesVersion: RULES_VERSION,
    checks,
    summary:
      'Pré-analyse indicative v1 — ne remplace pas une décision administrative ni un conseil juridique.',
  };
}
