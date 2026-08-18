import type { Property } from "../types";
import { gallery } from "./media";

/**
 * Twenty Marrakech listings standing in for the real catalogue (spec, out of
 * scope: real listing content).
 *
 * Two per district, deliberately: a district page that opens on a single card
 * reads as a site with nothing in it, whichever district you happen to land on.
 *
 * These are shaped to be *hostile to a flattering screenshot*, because
 * docs/design/quality-bar.md rejects UI proven only against uniform data:
 *
 * - descriptions run from one line to five paragraphs, so cards must cope with
 *   both a title that wraps to three lines and a body that barely fills one;
 * - galleries run from 3 to 15 frames;
 * - BL-1108 has **no English translation** — it is what AC-9 is proven against;
 * - two listings are sold or under offer, one is a long-term rental priced per
 *   month, and one is priced in euros rather than dirhams;
 * - one is land with no bedrooms and no built area to speak of, which is the
 *   case that breaks a key-facts row written for villas.
 *
 * `listedAt` dates are fixed strings, never computed — a fixture built from
 * `Date.now()` reorders itself between runs and makes the sort tests lie.
 */

export const propertyFixtures: Property[] = [
  {
    id: "p-01",
    reference: "BL-1101",
    districtId: "palmeraie",
    kind: "sale",
    type: "villa",
    status: "available",
    price: 12_800_000,
    currency: "MAD",
    bedrooms: 5,
    bathrooms: 5,
    builtArea: 620,
    landArea: 2400,
    amenities: ["pool", "garden", "terrace", "hammam", "staffQuarters", "atlasView", "security"],
    media: gallery("BL-1101", 12, 0),
    listedAt: "2026-07-28",
    translations: {
      fr: {
        slug: "villa-vue-atlas-palmeraie",
        title: "Villa vue Atlas, Palmeraie",
        district: "Palmeraie",
        city: "Marrakech",
        description:
          "Posée au bout d’une allée d’oliviers, la villa tourne le dos à la route et s’ouvre entièrement au sud, sur la chaîne de l’Atlas.\n\nLes pièces de réception s’enfilent sur près de trente mètres, séparées par des portes en cèdre que l’on peut replier entièrement : en hiver la maison se compartimente, en été elle ne fait plus qu’une seule pièce traversante. Le salon principal garde son plafond d’origine en tataoui.\n\nÀ l’étage, quatre chambres donnent chacune sur une terrasse privative. La suite parentale occupe l’aile ouest et dispose de son propre hammam.\n\nLe jardin, dessiné il y a vingt ans, est arrivé à maturité : oliviers centenaires, bougainvilliers, et une piscine de dix-huit mètres orientée pour capter la lumière de fin de journée. Un logement de gardien indépendant complète la propriété.",
      },
      en: {
        slug: "atlas-view-villa-palmeraie",
        title: "Atlas view villa, Palmeraie",
        district: "Palmeraie",
        city: "Marrakech",
        description:
          "Set at the end of an olive-lined drive, the villa turns its back on the road and opens entirely to the south, onto the Atlas range.\n\nThe reception rooms run in sequence for nearly thirty metres, divided by cedar doors that fold away completely: in winter the house closes into rooms, in summer it becomes a single space you can walk straight through. The main salon keeps its original tataoui ceiling.\n\nUpstairs, four bedrooms each open onto a private terrace. The principal suite takes the west wing and has its own hammam.\n\nThe garden was laid out twenty years ago and has come into its own: century-old olive trees, bougainvillea, and an eighteen-metre pool oriented to catch the late light. A separate caretaker’s house completes the property.",
      },
    },
  },
  {
    id: "p-02",
    reference: "BL-1102",
    districtId: "medina",
    kind: "sale",
    type: "riad",
    status: "available",
    price: 6_400_000,
    currency: "MAD",
    bedrooms: 4,
    bathrooms: 4,
    builtArea: 310,
    amenities: ["terrace", "hammam", "airConditioning", "furnished"],
    media: gallery("BL-1102", 9, 3),
    listedAt: "2026-08-04",
    translations: {
      fr: {
        slug: "riad-restaure-medina",
        title: "Riad restauré, médina",
        district: "Médina",
        city: "Marrakech",
        description:
          "Un riad de quatre chambres restauré sans être dénaturé : les zelliges d’origine ont été déposés, nettoyés et reposés un à un.\n\nLe patio, planté d’un seul oranger, distribue toutes les pièces. La terrasse en toiture donne sur les toits de la médina et, par temps clair, sur la Koutoubia.",
      },
      en: {
        slug: "restored-riad-medina",
        title: "Restored riad, medina",
        district: "Medina",
        city: "Marrakech",
        description:
          "A four-bedroom riad restored without being stripped of itself: the original zellige was lifted, cleaned and relaid tile by tile.\n\nThe patio, planted with a single orange tree, gives onto every room. The roof terrace looks over the rooftops of the medina and, on a clear day, to the Koutoubia.",
      },
    },
  },
  {
    id: "p-03",
    reference: "BL-1103",
    districtId: "hivernage",
    kind: "sale",
    type: "apartment",
    status: "available",
    price: 2_150_000,
    currency: "MAD",
    bedrooms: 2,
    bathrooms: 2,
    builtArea: 128,
    amenities: ["terrace", "elevator", "airConditioning", "security", "garage"],
    media: gallery("BL-1103", 6, 6),
    listedAt: "2026-08-11",
    translations: {
      fr: {
        slug: "appartement-terrasse-hivernage",
        title: "Appartement avec terrasse, Hivernage",
        district: "Hivernage",
        city: "Marrakech",
        description:
          "Deux chambres au quatrième étage, avec une terrasse de quarante mètres carrés qui double la surface de vie une bonne partie de l’année.",
      },
      en: {
        slug: "terrace-apartment-hivernage",
        title: "Apartment with terrace, Hivernage",
        district: "Hivernage",
        city: "Marrakech",
        description:
          "Two bedrooms on the fourth floor, with a forty-square-metre terrace that doubles the living space for a good part of the year.",
      },
    },
  },
  {
    id: "p-04",
    reference: "BL-1104",
    districtId: "route-ourika",
    kind: "sale",
    type: "estate",
    status: "underOffer",
    price: 3_900_000,
    currency: "EUR",
    bedrooms: 8,
    bathrooms: 9,
    builtArea: 1450,
    landArea: 18_000,
    amenities: [
      "pool",
      "garden",
      "terrace",
      "hammam",
      "gym",
      "staffQuarters",
      "security",
      "atlasView",
      "garage",
    ],
    media: gallery("BL-1104", 15, 1),
    listedAt: "2026-06-19",
    translations: {
      fr: {
        slug: "domaine-route-ourika",
        title: "Domaine de dix-huit hectares, route de l’Ourika",
        district: "Route de l’Ourika",
        city: "Marrakech",
        description:
          "Dix-huit hectares clos, dont six d’oliveraie en production et deux de verger.\n\nLa maison principale — huit chambres, mille quatre cent cinquante mètres carrés — a été construite en 2009 en pisé sur une ossature béton, ce qui lui donne l’inertie thermique d’une construction traditionnelle sans ses contraintes d’entretien. Les pièces de réception ouvrent au nord sur une cour d’eau de trente mètres et au sud sur la palmeraie, si bien qu’aucune façade ne prend le soleil de plein fouet aux heures chaudes.\n\nAutour, trois pavillons d’invités indépendants, un bâtiment technique, des écuries pour six chevaux et un manège en sable. Le forage est déclaré et l’autorisation de pompage transférable, ce qui est rare sur ce secteur et mérite d’être vérifié avant toute comparaison avec des biens voisins.\n\nL’ensemble est desservi par une allée privée de quatre cents mètres bordée de cyprès, plantée à la création du domaine et aujourd’hui pleinement formée. Le clos est en pisé sur tout son périmètre, sans grillage visible depuis la maison.\n\nLa propriété est vendue avec l’exploitation oléicole en cours, dont les rendements des trois dernières campagnes sont disponibles sur demande.",
      },
      en: {
        slug: "eighteen-hectare-estate-ourika",
        title: "Eighteen-hectare estate, Ourika road",
        district: "Ourika road",
        city: "Marrakech",
        description:
          "Eighteen walled hectares, six of them productive olive grove and two orchard.\n\nThe main house — eight bedrooms, fourteen hundred and fifty square metres — was built in 2009 in rammed earth over a concrete frame, which gives it the thermal mass of traditional construction without the upkeep.\n\nAround it: three self-contained guest pavilions, a plant building, stabling for six horses and a sand school. The borehole is registered and the pumping licence transferable.\n\nThe property is sold with the olive operation running; yields for the last three harvests are available on request.",
      },
    },
  },
  {
    id: "p-05",
    reference: "BL-1105",
    districtId: "targa",
    kind: "rent",
    type: "villa",
    status: "available",
    price: 45_000,
    currency: "MAD",
    bedrooms: 4,
    bathrooms: 4,
    builtArea: 380,
    landArea: 1100,
    amenities: ["pool", "garden", "furnished", "airConditioning", "staffQuarters", "security"],
    media: gallery("BL-1105", 8, 4),
    listedAt: "2026-08-09",
    translations: {
      fr: {
        slug: "villa-meublee-location-targa",
        title: "Villa meublée en location longue durée, Targa",
        district: "Targa",
        city: "Marrakech",
        description:
          "Quatre chambres meublées, jardin clos et piscine chauffée, disponible en location longue durée. Le prix affiché est mensuel, charges et jardinier compris.\n\nLe quartier est résidentiel et calme, à dix minutes du centre et à cinq des écoles internationales.",
      },
      en: {
        slug: "furnished-villa-long-let-targa",
        title: "Furnished villa, long-term let, Targa",
        district: "Targa",
        city: "Marrakech",
        description:
          "Four furnished bedrooms, walled garden and heated pool, available on a long-term let. The price shown is monthly, including service charge and gardener.\n\nThe district is residential and quiet, ten minutes from the centre and five from the international schools.",
      },
    },
  },
  {
    id: "p-06",
    reference: "BL-1106",
    districtId: "agdal",
    kind: "sale",
    type: "penthouse",
    status: "available",
    price: 4_750_000,
    currency: "MAD",
    bedrooms: 3,
    bathrooms: 3,
    builtArea: 210,
    amenities: ["terrace", "pool", "elevator", "airConditioning", "security", "garage", "gym"],
    media: gallery("BL-1106", 11, 8),
    listedAt: "2026-07-15",
    translations: {
      fr: {
        slug: "penthouse-piscine-privee-agdal",
        title: "Penthouse avec piscine privée, Agdal",
        district: "Agdal",
        city: "Marrakech",
        description:
          "Dernier étage d’une résidence de six niveaux, avec une terrasse de cent dix mètres carrés et une piscine privée à débordement.\n\nTrois chambres, toutes en suite. La cuisine ouvre sur la terrasse par une baie coulissante sur toute sa longueur.\n\nLa résidence dispose d’un gardiennage vingt-quatre heures sur vingt-quatre, d’une salle de sport et de deux places de parking en sous-sol attribuées au lot.",
      },
      en: {
        slug: "penthouse-private-pool-agdal",
        title: "Penthouse with private pool, Agdal",
        district: "Agdal",
        city: "Marrakech",
        description:
          "Top floor of a six-storey building, with a hundred-and-ten-square-metre terrace and a private infinity pool.\n\nThree bedrooms, all en suite. The kitchen opens onto the terrace through a sliding wall running its full length.\n\nThe building has twenty-four-hour security, a gym, and two allocated basement parking spaces.",
      },
    },
  },
  {
    id: "p-07",
    reference: "BL-1107",
    districtId: "amelkis",
    kind: "sale",
    type: "land",
    status: "available",
    price: 3_200_000,
    currency: "MAD",
    bedrooms: 0,
    bathrooms: 0,
    builtArea: 0,
    landArea: 5200,
    amenities: ["atlasView", "golfAccess"],
    media: gallery("BL-1107", 3, 10),
    listedAt: "2026-08-13",
    translations: {
      fr: {
        slug: "terrain-constructible-amelkis",
        title: "Terrain constructible, Amelkis",
        district: "Amelkis",
        city: "Marrakech",
        description:
          "Cinq mille deux cents mètres carrés viabilisés, en bordure du parcours de golf, avec un titre foncier propre et un coefficient d’emprise au sol de trente pour cent.",
      },
      en: {
        slug: "building-plot-amelkis",
        title: "Building plot, Amelkis",
        district: "Amelkis",
        city: "Marrakech",
        description:
          "Five thousand two hundred serviced square metres on the edge of the golf course, with clean title and thirty per cent site coverage permitted.",
      },
    },
  },
  {
    id: "p-08",
    reference: "BL-1108",
    districtId: "medina",
    kind: "sale",
    type: "riad",
    status: "available",
    price: 8_900_000,
    currency: "MAD",
    bedrooms: 6,
    bathrooms: 6,
    builtArea: 480,
    amenities: ["pool", "terrace", "hammam", "staffQuarters", "furnished"],
    media: gallery("BL-1108", 10, 2),
    listedAt: "2026-08-01",
    translations: {
      // No English. This is the AC-9 fixture: viewed in English it must show the
      // French text with a visible note, never an empty description.
      fr: {
        slug: "riad-double-patio-kasbah",
        title: "Riad à double patio, quartier de la Kasbah",
        district: "Kasbah",
        city: "Marrakech",
        description:
          "Deux riads mitoyens réunis en une seule maison de six chambres, ce qui lui donne une chose rare en médina : deux patios, dont l’un assez large pour y installer un bassin de nage de douze mètres.\n\nLe premier patio garde sa fonction traditionnelle de distribution et reste couvert de vigne. Le second, entièrement dégagé, sert de pièce de vie extérieure du printemps à l’automne.\n\nLa maison est vendue meublée, avec le mobilier dessiné pour elle par l’atelier qui a mené la restauration. Un logement de personnel indépendant donne sur la ruelle latérale.",
      },
    },
  },
  {
    id: "p-09",
    reference: "BL-1109",
    districtId: "route-fes",
    kind: "sale",
    type: "villa",
    status: "sold",
    price: 9_500_000,
    currency: "MAD",
    bedrooms: 5,
    bathrooms: 4,
    builtArea: 540,
    landArea: 1800,
    amenities: ["pool", "garden", "terrace", "garage", "airConditioning"],
    media: gallery("BL-1109", 7, 5),
    listedAt: "2026-05-22",
    translations: {
      fr: {
        slug: "villa-jardin-route-de-fes",
        title: "Villa avec jardin, route de Fès",
        district: "Route de Fès",
        city: "Marrakech",
        description:
          "Cinq chambres sur un terrain de mille huit cents mètres carrés, à quinze minutes du centre. Vendue.",
      },
      en: {
        slug: "garden-villa-fes-road",
        title: "Villa with garden, Fès road",
        district: "Fès road",
        city: "Marrakech",
        description:
          "Five bedrooms on eighteen hundred square metres, fifteen minutes from the centre. Sold.",
      },
    },
  },
  {
    id: "p-10",
    reference: "BL-1110",
    districtId: "gueliz",
    kind: "sale",
    type: "townhouse",
    status: "available",
    price: 1_780_000,
    currency: "MAD",
    bedrooms: 3,
    bathrooms: 2,
    builtArea: 165,
    landArea: 120,
    amenities: ["terrace", "garage", "airConditioning", "security"],
    media: gallery("BL-1110", 5, 7),
    listedAt: "2026-08-15",
    translations: {
      fr: {
        slug: "maison-de-ville-gueliz",
        title: "Maison de ville, Guéliz",
        district: "Guéliz",
        city: "Marrakech",
        description:
          "Trois chambres sur trois niveaux, dans une rue calme du Guéliz, à distance de marche des commerces et des écoles.\n\nLa maison a été refaite en 2022 : électricité, plomberie et menuiseries extérieures sont neuves. Le garage ferme et donne directement dans l’entrée.",
      },
      en: {
        slug: "townhouse-gueliz",
        title: "Townhouse, Guéliz",
        district: "Guéliz",
        city: "Marrakech",
        description:
          "Three bedrooms over three floors, on a quiet Guéliz street, walking distance from the shops and schools.\n\nThe house was redone in 2022: wiring, plumbing and external joinery are all new. The garage locks and opens straight into the hall.",
      },
    },
  },
  {
    id: "p-11",
    reference: "BL-1111",
    districtId: "gueliz",
    kind: "rent",
    type: "apartment",
    status: "rented",
    price: 14_500,
    currency: "MAD",
    bedrooms: 2,
    bathrooms: 1,
    builtArea: 96,
    amenities: ["furnished", "elevator", "airConditioning", "security"],
    media: gallery("BL-1111", 4, 9),
    listedAt: "2026-07-02",
    translations: {
      fr: {
        slug: "appartement-meuble-gueliz",
        title: "Appartement meublé, Guéliz",
        district: "Guéliz",
        city: "Marrakech",
        description: "Deux chambres meublées au cœur du Guéliz. Loué.",
      },
      en: {
        slug: "furnished-apartment-gueliz",
        title: "Furnished apartment, Guéliz",
        district: "Guéliz",
        city: "Marrakech",
        description: "Two furnished bedrooms in the heart of Guéliz. Let.",
      },
    },
  },
  {
    id: "p-12",
    reference: "BL-1112",
    districtId: "route-oukaimeden",
    kind: "sale",
    type: "chalet",
    status: "available",
    price: 2_950_000,
    currency: "MAD",
    bedrooms: 4,
    bathrooms: 3,
    builtArea: 240,
    landArea: 900,
    amenities: ["garden", "terrace", "underfloorHeating", "atlasView", "garage"],
    media: gallery("BL-1112", 6, 11),
    listedAt: "2026-06-30",
    translations: {
      fr: {
        slug: "chalet-pierre-oukaimeden",
        title: "Chalet en pierre, route de l’Oukaïmeden",
        district: "Route de l’Oukaïmeden",
        city: "Marrakech",
        description:
          "À quarante-cinq minutes de Marrakech, un chalet de quatre chambres construit en pierre du pays, à mille six cents mètres d’altitude.\n\nLe séjour est chauffé par une cheminée centrale doublée d’un plancher chauffant, ce qui rend la maison habitable toute l’année et pas seulement l’été. La vue porte sur la vallée et, au-dessus, sur les crêtes.",
      },
      en: {
        slug: "stone-chalet-oukaimeden",
        title: "Stone chalet, Oukaïmeden road",
        district: "Oukaïmeden road",
        city: "Marrakech",
        description:
          "Forty-five minutes from Marrakech, a four-bedroom chalet built in local stone at sixteen hundred metres.\n\nThe living room is heated by a central fireplace backed by underfloor heating, which makes the house usable all year rather than only in summer. The view runs down the valley and up to the ridges above.",
      },
    },
  },
  {
    id: "p-13",
    reference: "BL-1113",
    districtId: "palmeraie",
    kind: "sale",
    type: "villa",
    status: "available",
    price: 18_500_000,
    currency: "MAD",
    bedrooms: 6,
    bathrooms: 6,
    builtArea: 780,
    landArea: 4200,
    amenities: [
      "pool",
      "garden",
      "terrace",
      "hammam",
      "staffQuarters",
      "atlasView",
      "security",
      "garage",
    ],
    media: gallery("BL-1113", 8, 2),
    listedAt: "2026-08-09",
    translations: {
      fr: {
        slug: "villa-contemporaine-palmeraie",
        title: "Villa contemporaine, Palmeraie",
        district: "Palmeraie",
        city: "Marrakech",
        description:
          "Une maison basse, longue de soixante mètres, posée en L autour d’un bassin de nage.\n\nL’architecte a refusé la surenchère : murs à la chaux, sols en tadelakt gris, menuiseries en chêne, et rien d’autre. Toute la générosité est dans les volumes — quatre mètres sous plafond dans les pièces de réception, et des baies qui disparaissent entièrement dans l’épaisseur des murs.\n\nLes six chambres sont réparties en deux ailes, ce qui permet de fermer la seconde hors saison sans traverser une maison vide. Le jardin, planté d’oliviers repris sur pied, est déjà dense ; le forage est déclaré et l’autorisation transférable.",
      },
      en: {
        slug: "contemporary-villa-palmeraie",
        title: "Contemporary villa, Palmeraie",
        district: "Palmeraie",
        city: "Marrakech",
        description:
          "A low house, sixty metres long, set in an L around a swimming pond.\n\nThe architect refused to overstate anything: lime-washed walls, grey tadelakt floors, oak joinery, and nothing else. All the generosity is in the volumes — four metres to the ceiling in the reception rooms, and glazing that disappears entirely into the thickness of the walls.\n\nThe six bedrooms sit in two wings, so the second can be closed out of season without walking through an empty house. The garden, planted with mature transplanted olives, is already dense; the borehole is registered and the licence transferable.",
      },
    },
  },
  {
    id: "p-14",
    reference: "BL-1114",
    districtId: "hivernage",
    kind: "sale",
    type: "penthouse",
    status: "available",
    price: 5_800_000,
    currency: "MAD",
    bedrooms: 3,
    bathrooms: 3,
    builtArea: 210,
    amenities: ["terrace", "elevator", "airConditioning", "security", "garage", "pool"],
    media: gallery("BL-1114", 5, 4),
    listedAt: "2026-08-15",
    translations: {
      fr: {
        slug: "penthouse-dernier-etage-hivernage",
        title: "Penthouse en dernier étage, Hivernage",
        district: "Hivernage",
        city: "Marrakech",
        description:
          "Le dernier niveau d’une résidence de six étages, avec une terrasse d’angle qui prend le coucher de soleil et, derrière, la Koutoubia.",
      },
      en: {
        slug: "top-floor-penthouse-hivernage",
        title: "Top-floor penthouse, Hivernage",
        district: "Hivernage",
        city: "Marrakech",
        description:
          "The top level of a six-storey building, with a corner terrace that takes the sunset and, behind it, the Koutoubia.",
      },
    },
  },
  {
    id: "p-15",
    reference: "BL-1115",
    districtId: "route-ourika",
    kind: "sale",
    type: "villa",
    status: "available",
    price: 1_450_000,
    currency: "EUR",
    bedrooms: 5,
    bathrooms: 5,
    builtArea: 520,
    landArea: 6000,
    amenities: ["pool", "garden", "terrace", "atlasView", "staffQuarters", "underfloorHeating"],
    media: gallery("BL-1115", 11, 5),
    listedAt: "2026-07-21",
    translations: {
      fr: {
        slug: "villa-oliveraie-route-ourika",
        title: "Villa dans l’oliveraie, route de l’Ourika",
        district: "Route de l’Ourika",
        city: "Marrakech",
        description:
          "Six mille mètres carrés d’oliveraie, et une maison qui a eu l’intelligence de ne pas se mettre au milieu.\n\nElle est adossée au mur nord de la parcelle, ce qui laisse toute la vue libre depuis les pièces de vie : l’oliveraie d’abord, puis la plaine, puis l’Atlas. Les cinq chambres sont au rez-de-chaussée, chacune avec sa porte sur le jardin.\n\nLe chauffage est au sol sur l’ensemble — inhabituel ici, et déterminant de décembre à février, où la maison serait sinon froide malgré le soleil.",
      },
      en: {
        slug: "olive-grove-villa-ourika-road",
        title: "Villa in the olive grove, Ourika road",
        district: "Ourika road",
        city: "Marrakech",
        description:
          "Six thousand square metres of olive grove, and a house with the sense not to stand in the middle of it.\n\nIt backs onto the northern wall of the plot, which leaves the view clear from every living room: the grove first, then the plain, then the Atlas. All five bedrooms are on the ground floor, each with its own door to the garden.\n\nUnderfloor heating throughout — unusual here, and decisive from December to February, when the house would otherwise be cold in spite of the sun.",
      },
    },
  },
  {
    id: "p-16",
    reference: "BL-1116",
    districtId: "targa",
    kind: "sale",
    type: "villa",
    status: "available",
    price: 7_900_000,
    currency: "MAD",
    bedrooms: 5,
    bathrooms: 4,
    builtArea: 440,
    landArea: 1600,
    amenities: ["pool", "garden", "terrace", "garage", "airConditioning", "security"],
    media: gallery("BL-1116", 7, 7),
    listedAt: "2026-07-02",
    translations: {
      fr: {
        slug: "villa-familiale-jardin-targa",
        title: "Villa familiale avec jardin, Targa",
        district: "Targa",
        city: "Marrakech",
        description:
          "Une villa de 2004 sur seize cents mètres carrés, tenue par la même famille depuis sa construction — cela se voit à l’état des menuiseries et à la taille des arbres.\n\nQuatre chambres à l’étage et une au rez-de-chaussée, ce qui rend la maison utilisable par trois générations sans transformation. La cuisine a été refaite en 2021 ; le reste est d’origine et n’en a pas besoin.",
      },
      en: {
        slug: "family-villa-garden-targa",
        title: "Family villa with garden, Targa",
        district: "Targa",
        city: "Marrakech",
        description:
          "A 2004 villa on sixteen hundred square metres, held by the same family since it was built — which shows in the condition of the joinery and the size of the trees.\n\nFour bedrooms upstairs and one on the ground floor, so the house works for three generations without alteration. The kitchen was redone in 2021; the rest is original and does not need to be.",
      },
    },
  },
  {
    id: "p-17",
    reference: "BL-1117",
    districtId: "agdal",
    kind: "rent",
    type: "apartment",
    status: "available",
    price: 22_000,
    currency: "MAD",
    bedrooms: 3,
    bathrooms: 2,
    builtArea: 165,
    amenities: ["furnished", "pool", "elevator", "security", "garage", "airConditioning"],
    media: gallery("BL-1117", 4, 8),
    listedAt: "2026-08-16",
    translations: {
      fr: {
        slug: "appartement-meuble-location-agdal",
        title: "Appartement meublé en location, Agdal",
        district: "Agdal",
        city: "Marrakech",
        description:
          "Trois chambres meublées dans une résidence fermée avec piscine et jardin commun, en location longue durée. Deuxième étage, ascenseur, deux places de parking en sous-sol.",
      },
      en: {
        slug: "furnished-apartment-long-let-agdal",
        title: "Furnished apartment, long let, Agdal",
        district: "Agdal",
        city: "Marrakech",
        description:
          "Three furnished bedrooms in a gated residence with a pool and a shared garden, on a long let. Second floor, lift, two parking spaces in the basement.",
      },
    },
  },
  {
    id: "p-18",
    reference: "BL-1118",
    districtId: "amelkis",
    kind: "sale",
    type: "villa",
    status: "available",
    price: 14_200_000,
    currency: "MAD",
    bedrooms: 4,
    bathrooms: 4,
    builtArea: 520,
    landArea: 1800,
    amenities: ["pool", "garden", "terrace", "golfAccess", "atlasView", "security", "garage"],
    media: gallery("BL-1118", 9, 9),
    listedAt: "2026-06-28",
    translations: {
      fr: {
        slug: "villa-sur-fairway-amelkis",
        title: "Villa sur le fairway, Amelkis",
        district: "Amelkis",
        city: "Marrakech",
        description:
          "De plain-pied, ouverte sur le parcours, avec pour seule clôture une haie basse — ce qui n’est possible que dans un domaine déjà clos.\n\nLes pièces de réception forment un seul volume traversant, orienté nord-sud pour éviter le soleil de plein fouet. Les quatre chambres sont regroupées dans l’aile est, chacune avec sa salle d’eau.\n\nLa piscine et le jardin ont été dessinés ensemble : le bassin prolonge la terrasse plutôt que d’occuper le milieu de la pelouse, et l’Atlas apparaît dans son axe.",
      },
      en: {
        slug: "fairway-villa-amelkis",
        title: "Villa on the fairway, Amelkis",
        district: "Amelkis",
        city: "Marrakech",
        description:
          "Single storey, open to the course, fenced by nothing more than a low hedge — which is only possible inside an estate that is already enclosed.\n\nThe reception rooms form one volume running right through the house, oriented north to south to keep the sun off. The four bedrooms are gathered in the east wing, each with its own bathroom.\n\nPool and garden were drawn together: the water extends the terrace rather than sitting in the middle of the lawn, and the Atlas appears along its axis.",
      },
    },
  },
  {
    id: "p-19",
    reference: "BL-1119",
    districtId: "route-fes",
    kind: "rent",
    type: "villa",
    status: "available",
    price: 38_000,
    currency: "MAD",
    bedrooms: 5,
    bathrooms: 5,
    builtArea: 480,
    landArea: 2000,
    amenities: ["pool", "garden", "terrace", "furnished", "staffQuarters", "security"],
    media: gallery("BL-1119", 6, 11),
    listedAt: "2026-07-14",
    translations: {
      fr: {
        slug: "villa-meublee-location-route-fes",
        title: "Villa meublée en location, route de Fès",
        district: "Route de Fès",
        city: "Marrakech",
        description:
          "Cinq chambres meublées sur deux mille mètres carrés de jardin planté, en location longue durée, avec un logement de gardien occupé.\n\nLa maison est livrée équipée jusqu’à la vaisselle : c’est une location d’expatriation, pensée pour être habitable le jour de l’arrivée. Le jardin et la piscine sont entretenus par le propriétaire, charge comprise.",
      },
      en: {
        slug: "furnished-villa-long-let-fes-road",
        title: "Furnished villa, long let, Fès road",
        district: "Fès road",
        city: "Marrakech",
        description:
          "Five furnished bedrooms on two thousand square metres of planted garden, on a long let, with an occupied caretaker’s house.\n\nIt comes equipped down to the crockery: this is a relocation let, meant to be habitable on the day you land. Garden and pool are maintained by the owner, included in the rent.",
      },
    },
  },
  {
    id: "p-20",
    reference: "BL-1120",
    districtId: "route-oukaimeden",
    kind: "sale",
    type: "land",
    status: "underOffer",
    price: 2_400_000,
    currency: "MAD",
    bedrooms: 0,
    bathrooms: 0,
    builtArea: 0,
    landArea: 10_000,
    amenities: ["atlasView"],
    media: gallery("BL-1120", 3, 12),
    listedAt: "2026-06-11",
    translations: {
      fr: {
        slug: "terrain-un-hectare-route-oukaimeden",
        title: "Terrain d’un hectare, route de l’Oukaïmeden",
        district: "Route de l’Oukaïmeden",
        city: "Marrakech",
        description:
          "Un hectare plat, titré, avec la montagne plein sud et rien devant.\n\nLe terrain est viabilisé en bordure de route : électricité et eau au portail, ce qui représente l’essentiel du coût caché d’une parcelle à cette distance. Le certificat de propriété et la note de renseignements urbanistiques sont disponibles avant visite.",
      },
      en: {
        slug: "one-hectare-plot-oukaimeden-road",
        title: "One-hectare plot, Oukaïmeden road",
        district: "Oukaïmeden road",
        city: "Marrakech",
        description:
          "A flat, titled hectare, with the mountain due south and nothing in front of it.\n\nServices reach the roadside boundary: power and water at the gate, which is most of the hidden cost of a plot at this distance. Title certificate and planning note are available before a visit.",
      },
    },
  },
];
