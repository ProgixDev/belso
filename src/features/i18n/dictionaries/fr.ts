/**
 * French — the default locale and the client's working language.
 * `en.ts` is typed against this file, so adding a key here forces a translation.
 *
 * Copy follows docs/conventions/copy.md: curly apostrophes, sentence case.
 */
// Deliberately not `as const`: that would make every value a literal type, so
// `Dictionary` would demand the exact French strings and no translation could
// ever satisfy it. We want the shape enforced, not the words.
export const fr = {
  nav: {
    home: "Accueil",
    properties: "Biens",
    about: "À propos",
    amenities: "Prestations",
    location: "Situation",
    contact: "Contact",
    menu: "Menu principal",
    skipToContent: "Aller au contenu",
  },
  locale: {
    label: "Langue",
    switchTo: "Passer en anglais",
    current: "Français",
  },
  home: {
    searchLabel: "Décrivez le bien que vous cherchez",
    searchPlaceholder: "Villa moderne à Marrakech avec vue sur l’Atlas, entre 8 et 12 M MAD",
    searchSubmit: "Rechercher",
  },
  properties: {
    title: "Nos biens",
    resultCount: "{count} biens",
    resultCountOne: "1 bien",
    searchedFor: "Votre recherche",
    clearSearch: "Effacer la recherche",
    browseAll: "Voir tous les biens",
    sortLabel: "Trier par",
    sortNewest: "Plus récents",
    sortPriceAsc: "Prix croissant",
    sortPriceDesc: "Prix décroissant",
    reference: "Référence",
    bedrooms: "Chambres",
    bathrooms: "Salles d’eau",
    landArea: "Terrain",
    builtArea: "Surface habitable",
    similar: "Biens similaires",
    gallery: "Galerie",
    previousPhoto: "Photo précédente",
    nextPhoto: "Photo suivante",
    forSale: "À vendre",
    forRent: "En location longue durée",
    statusUnderOffer: "Sous compromis",
    statusSold: "Vendu",
    statusRented: "Loué",
    untranslated: "Cette description n’est pas encore traduite. Texte original en français.",
    emptyTitle: "Aucun bien ne correspond à votre recherche",
    emptyBody: "Essayez une description plus large, ou parcourez l’ensemble de nos biens.",
    notFoundTitle: "Ce bien n’existe plus",
    notFoundBody: "Il a peut-être été vendu ou retiré. Voici de quoi poursuivre votre recherche.",
  },
  enquiry: {
    title: "Demander des informations",
    titleFor: "Demander des informations sur {reference}",
    name: "Nom",
    email: "E-mail",
    phone: "Téléphone",
    phoneOptional: "Téléphone (facultatif)",
    message: "Message",
    submit: "Envoyer la demande",
    sending: "Envoi…",
    successTitle: "Votre demande est bien partie",
    successBody: "Nous revenons vers vous sous 24 heures au sujet de {subject}.",
    errorName: "Indiquez votre nom.",
    errorEmail: "Indiquez une adresse e-mail valide.",
    errorMessage: "Écrivez quelques mots sur ce que vous cherchez.",
    errorGeneric: "La demande n’a pas pu être envoyée. Réessayez dans un instant.",
  },
  contact: {
    title: "Nous contacter",
    lede: "Une question, une visite, un projet — écrivez-nous.",
  },
  legal: {
    privacy: "Confidentialité",
    cookies: "Cookies",
    terms: "Conditions d’utilisation",
    placeholder: "Ce texte est en cours de rédaction et sera publié avant la mise en ligne.",
  },
  footer: {
    tagline: "Une adresse privée à Marrakech.",
    sections: { explore: "Explorer", legal: "Informations légales" },
    rights: "Tous droits réservés.",
  },
  common: {
    loading: "Chargement…",
    errorTitle: "Quelque chose s’est mal passé",
    errorBody: "Rechargez la page. Si le problème persiste, écrivez-nous.",
    retry: "Réessayer",
    backHome: "Retour à l’accueil",
    approx: "environ",
  },
};

export type Dictionary = typeof fr;
