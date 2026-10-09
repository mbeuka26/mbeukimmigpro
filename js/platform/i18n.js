const STR = {
  fr: {
    brainTitle: 'Brain AI',
    modeCentral: 'IA centrale MbeukImmig',
    modeByok: 'Clé API personnelle',
    search: 'Rechercher dans les sources validées',
    noResults: 'Aucune source fiable trouvée.',
    genDisabled: 'Génération IA indisponible — consultation textuelle possible.',
    login: 'Se connecter',
    logout: 'Déconnexion',
  },
  en: {
    brainTitle: 'Brain AI',
    modeCentral: 'MbeukImmig central AI',
    modeByok: 'Personal API key',
    search: 'Search validated sources',
    noResults: 'No reliable source found.',
    genDisabled: 'AI generation unavailable — text search still works.',
    login: 'Sign in',
    logout: 'Sign out',
  },
};

export function t(key, locale = 'fr') {
  return STR[locale]?.[key] ?? STR.fr[key] ?? key;
}
