/**
 * French — the default locale and the client's working language.
 * `en.ts` is typed against this file, so adding a key here forces a translation.
 *
 * Copy follows docs/conventions/copy.md: curly apostrophes, sentence case.
 */
/**
 * Fixed-length copy, annotated where the length is load-bearing.
 *
 * The scene's splash timeline staggers exactly three stats (`--in-s1..3`) and
 * four lede lines (`--in-l1..4`), so a translation offering a different number
 * would animate some of them and not others. Written as tuples, that is a build
 * error rather than a missing fade. (Declared here rather than imported from the
 * scene slice: features may not import features.)
 */
type Figure = { value: string; label: string };
type Step = { title: string; body: string };
type Three<T> = [T, T, T];
type Four<T> = [T, T, T, T];

// Deliberately not `as const`: that would make every value a literal type, so
// `Dictionary` would demand the exact French strings and no translation could
// ever satisfy it. We want the shape enforced, not the words.
export const fr = {
  nav: {
    home: "Accueil",
    properties: "Biens",
    residences: "Résidences",
    about: "À propos",
    amenities: "Prestations",
    location: "Situation",
    districts: "Quartiers",
    sell: "Vendre",
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
    searchHint: "Recherche en langage naturel — écrivez une phrase, pas des mots-clés.",
    searchPlaceholder: "Villa à Marrakech, vue Atlas, 8–12 M MAD",
    searchSubmit: "Rechercher",
    // The cinematic scene. It used to hold its own English copy, so /fr played
    // French search chrome inside an English film.
    scene: {
      sceneLabel: "Belso, en images",
      heroLabel: "Présentation de Belso",
      stats: [
        { value: "30+", label: "Résidences privées" },
        { value: "06", label: "Niveaux d’habitation" },
        { value: "24/7", label: "Gardiennage" },
      ] as Three<Figure>,
      // Four lines, staggered one at a time by the splash timeline.
      lede: ["Là où", "l’héritage", "rencontre", "le foyer"] as Four<string>,
      scrollHint: "Faites défiler",
      about: {
        name: "À propos de Belso",
        place: "Marrakech · Palmeraie",
        statement: "Une adresse plus calme",
        lede: "Belso est une adresse privée dans la Palmeraie — trente résidences dessinées dans la pierre chaude, le bois d’ombrage et l’eau immobile.",
        body: "Elle est bâtie pour la façon dont Marrakech vit vraiment : lentement, à l’ombre, portes ouvertes. Chaque maison est traversante et tournée loin de la route, si bien que la lumière l’habite tout le jour et que la ville n’arrive jamais tout à fait.",
        facts: [
          { value: "2027", label: "Livraison" },
          { value: "1,4 ha", label: "Terrain" },
          { value: "Marrakech", label: "Palmeraie" },
        ] as Three<Figure>,
        // Written against the photograph, not the file name — the stock names
        // describe something else entirely.
        shots: {
          facade: "Balcons plantés descendant une façade habillée de bois, à l’heure dorée",
          walkway: "Une allée ensoleillée le long de la cour intérieure",
          bedroom: "Une chambre dans des tons neutres, un plaid tissé jeté sur le lit",
          terraces: "Les terrasses plantées au-dessus du jardin, vues d’en bas",
        },
      },
    },
    // The three sections below the scene. Each is a doorway to a real page.
    residences: {
      index: "02",
      name: "La sélection",
      place: "Marrakech et alentours",
      statement: "Par où commencer",
      lede: "Chaque bien est visité, photographié et documenté par nos soins avant d’être publié.",
      cta: "Voir tous les biens",
    },
    grounds: {
      index: "03",
      name: "Le domaine",
      place: "Dans les murs",
      statement: "Tout à portée, rien à proximité",
      lede: "Un bassin sous la colonnade, un hammam taillé dans la pierre, une oliveraie et des jardins d’eau — le tout derrière un seul portail.",
      items: [
        "Bassin de nage sous la colonnade",
        "Hammam et salle de soins",
        "Oliveraie et jardins d’eau",
        "Gardiennage et conciergerie 24 h/24",
      ],
      cta: "Découvrir le domaine",
    },
    enquire: {
      index: "04",
      name: "Nous écrire",
      place: "Réponse sous 24 h",
      statement: "Dites-nous ce que vous cherchez",
      lede: "Décrivez le bien, le quartier, le calendrier. Nous revenons vers vous avec une sélection, pas un catalogue.",
      cta: "Nous contacter",
    },
  },
  about: {
    title: "À propos",
    lede: "Une adresse privée dans la Palmeraie, dessinée pour la façon dont Marrakech vit vraiment.",
    storyTitle: "L’adresse",
    storyBody:
      "Belso occupe 1,4 hectare de palmeraie, à vingt minutes de la médina et à dix du golf. Le terrain était une oliveraie ; il l’est resté. Les trente résidences sont posées entre les arbres existants plutôt qu’à leur place, et aucune ne dépasse six niveaux.",
    designTitle: "Le dessin",
    designBody:
      "Pierre chaude, bois d’ombrage, eau immobile. Chaque maison est traversante et tournée loin de la route : la lumière la traverse tout le jour, l’air circule sans climatisation la moitié de l’année, et la ville n’arrive jamais tout à fait.",
    groundsTitle: "Le domaine",
    groundsBody:
      "Le bassin de nage court sous la colonnade, à l’ombre toute la journée. Le hammam est taillé dans la pierre du site. Les jardins d’eau reprennent le tracé des séguias qui irriguaient l’oliveraie.",
    teamTitle: "Nous joindre",
    teamBody:
      "Belso est représenté par une seule équipe, à Marrakech. Les visites se font sur rendez-vous, du lundi au samedi.",
  },
  districts: {
    title: "Les quartiers",
    lede: "Marrakech ne se lit pas comme une seule ville. Voici ce que chaque adresse propose vraiment — et ce qu’il vaut mieux vérifier avant de s’y engager.",
    place: "Marrakech",
    count: "{count} biens",
    countOne: "1 bien",
    countNone: "Aucun bien publié",
    listingsHere: "Les biens de ce quartier",
    backToDistricts: "Tous les quartiers",
    otherDistricts: "Ailleurs à Marrakech",
    empty:
      "Aucun bien publié dans ce quartier pour le moment. Écrivez-nous : ce qui s’y prépare ne passe pas toujours par le site.",
    seeListings: "Voir les biens",
    label: "Quartier",
  },
  sell: {
    title: "Vendre avec Belso",
    lede: "Nous ne prenons pas tous les mandats. Ceux que nous prenons, nous les portons jusqu’au bout.",
    place: "Mandat exclusif",
    statement: "Un bien, un acheteur",
    body: "Un bien haut de gamme ne se vend pas en étant vu par le plus grand nombre : il se vend en étant montré à la bonne personne, au bon moment, correctement documenté. C’est le seul travail que nous faisons.\n\nNous refusons les mandats que nous ne saurions pas défendre — mauvais prix, titre incertain, propriétaire indécis. Le dire au premier rendez-vous coûte moins cher à tout le monde que de le découvrir six mois plus tard.",
    stepsTitle: "Comment cela se passe",
    steps: [
      {
        title: "La visite",
        body: "Nous venons voir le bien, sans photographe et sans promesse de prix. Nous repartons avec ce qu’il faut pour vous dire honnêtement s’il est vendable, à quelles conditions, et dans quel délai.",
      },
      {
        title: "Le dossier",
        body: "Titre, superficies, autorisations, charges, servitudes. Un acheteur sérieux pose ces questions au deuxième rendez-vous ; un dossier prêt fait gagner des semaines et évite les renégociations de dernière minute.",
      },
      {
        title: "La mise en marché",
        body: "Photographie professionnelle, texte rédigé, traduction, et une diffusion choisie. Le bien est présenté aux acheteurs dont nous savons déjà qu’ils cherchent cela avant d’être publié plus largement.",
      },
      {
        title: "La transaction",
        body: "Visites accompagnées, retours transmis tels quels, négociation menée avec vous et non à votre place, puis suivi jusqu’à la signature chez le notaire.",
      },
    ] as Four<Step>,
    formTitle: "Parlez-nous de votre bien",
    formLede:
      "Le quartier, la surface, l’état, et ce que vous en attendez. Nous répondons sous 24 heures, en français ou en anglais.",
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
    reference: "Réf.",
    referenceLabel: "Référence",
    listedOn: "Publié le",
    parking: "Stationnement",
    builtYear: "Année de construction",
    bedsShort: "ch.",
    bathsShort: "sdb",
    parkingShort: "pkg",
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
    forRentShort: "En location",
    statusUnderOffer: "Sous compromis",
    statusSold: "Vendu",
    statusRented: "Loué",
    untranslated: "Cette description n’est pas encore traduite. Texte original en français.",
    emptyTitle: "Aucun bien ne correspond à votre recherche",
    emptyBody: "Essayez une description plus large, ou parcourez l’ensemble de nos biens.",
    notFoundTitle: "Ce bien n’existe plus",
    notFoundBody: "Il a peut-être été vendu ou retiré. Voici de quoi poursuivre votre recherche.",
    perMonth: "par mois",
    viewProperty: "Voir le bien",
    apply: "Appliquer",
    description: "Description",
    amenities: "Prestations",
    keyFacts: "En bref",
    type: "Type",
    photoOf: "Photo {index} sur {total}",
    backToProperties: "Retour aux biens",
  },
  propertyType: {
    villa: "Villa",
    riad: "Riad",
    apartment: "Appartement",
    penthouse: "Penthouse",
    townhouse: "Maison de ville",
    land: "Terrain",
    chalet: "Chalet",
    estate: "Domaine",
  },
  amenity: {
    pool: "Piscine",
    garden: "Jardin",
    terrace: "Terrasse",
    hammam: "Hammam",
    gym: "Salle de sport",
    garage: "Garage",
    airConditioning: "Climatisation",
    underfloorHeating: "Plancher chauffant",
    staffQuarters: "Logement de personnel",
    security: "Gardiennage",
    elevator: "Ascenseur",
    golfAccess: "Accès au golf",
    atlasView: "Vue sur l’Atlas",
    furnished: "Meublé",
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
    errorPhone: "Ce numéro de téléphone est trop long.",
    successBodyGeneral: "Nous revenons vers vous sous 24 heures.",
    referenceNote: "Votre demande portera la référence {reference}.",
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
    sectionPlaceholder: "Section à rédiger.",
  },
  footer: {
    tagline: "Une adresse privée à Marrakech.",
    place: "Marrakech · Palmeraie",
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
