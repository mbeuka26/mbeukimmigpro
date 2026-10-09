/**
 * Moteur déterministe v1 — France & Canada (pilotes).
 * Entrées validées côté UI ; sorties structurées sans promesse de visa.
 */

export const RULES_VERSION = '2026.10.0-fr-ca';

const COUNTRY_RULES = {
  FR: {
    label: 'France',
    pathways: ['travail', 'etudes', 'famille'],
  },
  CA: {
    label: 'Canada',
    pathways: ['express_entry', 'etudes', 'pnp'],
  },
};

/**
 * @param {{ countryCode: string, pathwayCode: string, input: Record<string, unknown> }} params
 * @returns {{ countryCode: string, pathwayCode: string, rulesVersion: string, checks: Array<{ id: string, status: 'pass'|'fail'|'unknown'|'needs_review', message: string }>, summary: string }}
 */
export function runEligibilityV1({ countryCode, pathwayCode, input }) {
  const cc = (countryCode || '').toUpperCase();
  const country = COUNTRY_RULES[cc];
  const checks = [];

  if (!country) {
    return {
      countryCode: cc,
      pathwayCode,
      rulesVersion: RULES_VERSION,
      checks: [{ id: 'country', status: 'unknown', message: 'Pays non couvert en v1 (France et Canada uniquement).' }],
      summary: 'Évaluation non disponible pour ce pays en v1.',
    };
  }

  if (!country.pathways.includes(pathwayCode)) {
    checks.push({
      id: 'pathway',
      status: 'unknown',
      message: `Voie « ${pathwayCode} » non configurée pour ${country.label}.`,
    });
  }

  const age = typeof input.age === 'number' ? input.age : null;
  if (age === null) {
    checks.push({ id: 'age', status: 'unknown', message: 'Âge non renseigné.' });
  } else if (age < 18) {
    checks.push({ id: 'age', status: 'needs_review', message: 'Mineur : parcours à valider avec un professionnel habilité.' });
  } else {
    checks.push({ id: 'age', status: 'pass', message: 'Âge renseigné (critère générique v1).' });
  }

  const funds = typeof input.funds_eur === 'number' ? input.funds_eur : null;
  if (funds === null) {
    checks.push({ id: 'funds', status: 'unknown', message: 'Ressources financières non renseignées.' });
  } else if (funds <= 0) {
    checks.push({ id: 'funds', status: 'needs_review', message: 'Montant à confirmer selon la voie et la situation.' });
  } else {
    checks.push({ id: 'funds', status: 'pass', message: 'Ressources déclarées (seuils officiels à vérifier dans le guide).' });
  }

  const lang = input.language_level;
  if (!lang || typeof lang !== 'string') {
    checks.push({ id: 'language', status: 'unknown', message: 'Niveau de langue non renseigné.' });
  } else {
    checks.push({ id: 'language', status: 'pass', message: `Langue déclarée : ${lang}.` });
  }

  const hasFail = checks.some((c) => c.status === 'fail');
  const hasUnknown = checks.some((c) => c.status === 'unknown');

  let summary =
    'Pré-analyse indicative v1 — ne remplace pas une décision administrative ni un conseil juridique.';
  if (hasFail) summary += ' Au moins un critère explicite n’est pas satisfait.';
  else if (hasUnknown) summary += ' Informations incomplètes : complétez le profil.';
  else summary += ' Critères génériques renseignés ; consultez les sources officielles.';

  return {
    countryCode: cc,
    pathwayCode,
    rulesVersion: RULES_VERSION,
    checks,
    summary,
  };
}

export function listSupportedCountriesV1() {
  return Object.entries(COUNTRY_RULES).map(([code, meta]) => ({
    code,
    label: meta.label,
    pathways: meta.pathways,
  }));
}
