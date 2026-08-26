import type { Locale } from "@/core/i18n";

/**
 * The addresses Belso sells at, as content rather than as a filter value.
 *
 * A luxury agency is asked "where should I be looking?" long before "what have
 * you got for eight million?" — so each district is a page with its own writing
 * and its own listings, not a checkbox on a results grid. It is also the
 * strongest internal linking the site has: every listing points at its district,
 * and every district points back at its listings.
 *
 * **These live in the properties slice, not their own**, because `districtId` on
 * a listing and the meaning of that id are the same fact. Splitting them across
 * a feature boundary would let the vocabulary drift from the content describing
 * it, and a feature may not import another feature to reconcile them.
 *
 * The slug is **not** translated, unlike `/biens` vs `/properties`. These are
 * proper place names — a French buyer and an English one both type "Palmeraie" —
 * so one canonical slug per district means one URL to point `hreflang` at rather
 * than a per-locale lookup for a word that does not change.
 *
 * The writing is editorial and deliberately avoids numbers it cannot stand
 * behind: no prices, no distances, no claims about a specific development. What
 * it does carry is what an agent actually says on the phone — including the
 * things a buyer only finds out late, which is the part that earns the page.
 */

export const districtIds = [
  "palmeraie",
  "medina",
  "hivernage",
  "gueliz",
  "agdal",
  "amelkis",
  "targa",
  "route-ourika",
  "route-fes",
  "route-oukaimeden",
] as const;

export type DistrictId = (typeof districtIds)[number];

export function isDistrictId(value: unknown): value is DistrictId {
  return typeof value === "string" && (districtIds as readonly string[]).includes(value);
}

type DistrictCopy = {
  name: string;
  /** One line beneath the name: what this address is actually for. */
  lede: string;
  /** Two or three paragraphs, separated by a blank line. */
  body: string;
};

/**
 * **No photograph, deliberately.**
 *
 * These pages were built with one image each, drawn from the stock pool the
 * listings use. Then the pool was checked frame by frame against what it
 * actually contains: six bedrooms, two shots of a single glazed light well, two
 * of the same 1930s balconies, and three European exteriors. Nothing Moroccan,
 * no pool, no courtyard, no olive tree, no Atlas.
 *
 * A bedroom captioned "Palmeraie" is not a placeholder a visitor forgives — it
 * is a photograph making a claim about a place, and ten of them in a grid make
 * ten false claims at once. Set typographically the pages read as an editorial
 * decision instead of a missing asset, which is the honest state of them: the
 * writing is real, the photography does not exist yet. Add `image` back with
 * the real thing.
 */
export type District = {
  id: DistrictId;
  /**
   * A point inside the district, for the map.
   *
   * **Hand-placed, not surveyed.** These are good to roughly a kilometre —
   * enough to put a pin in the right part of Marrakech and nothing more. That
   * is the honest precision available without addresses, and it is why every
   * pin derived from one is labelled approximate (`lib.ts`,
   * `approximateLocation`). Replace them with real centroids, or better with
   * real addresses on the listings, when the back-office has them.
   *
   * This is also where the deferred district boundary geometry will attach —
   * the client's "délimitation intelligente de chaque quartier", waiting on the
   * data she wants shown on hover.
   */
  center: { lat: number; lng: number };
  copy: Record<Locale, DistrictCopy>;
};

export const districts: Record<DistrictId, District> = {
  palmeraie: {
    id: "palmeraie",
    center: { lat: 31.678, lng: -7.958 },
    copy: {
      fr: {
        name: "Palmeraie",
        lede: "De grandes propriétés closes sous les palmiers, à dix minutes de la ville et à mille lieues de son bruit.",
        body: "La Palmeraie est l’adresse historique de Marrakech pour qui cherche de la terre. On y achète rarement moins d’un hectare, souvent davantage, et les maisons se tiennent au bout d’allées privées que l’on ne voit pas depuis la route.\n\nC’est un quartier de murs et d’arbres : pisé, oliviers centenaires, bougainvilliers, et la ligne de l’Atlas au fond dès que le ciel se dégage. On y construit bas, par nécessité autant que par goût, ce qui explique que l’on n’y trouve presque pas d’immeubles et presque que des villas.\n\nÀ régler avant de visiter : l’eau. Un forage déclaré et une autorisation de pompage transférable pèsent bien plus sur la valeur d’une propriété que dix mètres carrés de salon, et tout le monde ne le dit pas spontanément.",
      },
      en: {
        name: "Palmeraie",
        lede: "Large walled properties under the palms, ten minutes from the city and nowhere near its noise.",
        body: "The Palmeraie is Marrakech’s historic address for anyone buying land. Rarely less than a hectare, usually more, and the houses stand at the end of private drives you cannot see from the road.\n\nIt is a district of walls and trees: rammed earth, century-old olives, bougainvillea, and the line of the Atlas behind it all the moment the sky clears. Building is low here, by necessity as much as by taste, which is why you will find almost no apartment blocks and almost nothing but villas.\n\nOne thing to settle before you visit: water. A registered borehole with a transferable pumping licence moves the value of a property far more than ten square metres of drawing room, and not everyone volunteers it.",
      },
    },
  },

  medina: {
    id: "medina",
    center: { lat: 31.63, lng: -7.988 },
    copy: {
      fr: {
        name: "Médina",
        lede: "Des riads derrière des murs aveugles, où toute la maison regarde vers l’intérieur.",
        body: "Acheter dans la médina, c’est acheter la logique inverse de celle d’une villa : rien ne se montre depuis la rue, tout se joue autour du patio. Une porte basse, un couloir coudé, puis la lumière.\n\nLes riads se distinguent moins par leur surface que par leur état. Une restauration honnête a déposé, nettoyé et reposé les zelliges, refait la plomberie et laissé les plafonds en cèdre là où ils tenaient encore ; une restauration pressée a passé du plâtre sur tout cela. La différence ne se voit pas sur une photographie.\n\nLa Kasbah, au sud, tient du même tissu avec des rues un peu plus larges et un accès véhicule moins acrobatique — ce qui, pour une résidence principale, compte davantage qu’on ne l’imagine.",
      },
      en: {
        name: "Medina",
        lede: "Riads behind blank walls, where the whole house looks inward.",
        body: "Buying in the medina means buying the opposite logic to a villa: nothing shows from the street, everything happens around the patio. A low door, a bent corridor, then light.\n\nRiads differ less in size than in condition. An honest restoration lifted, cleaned and relaid the zellige, redid the plumbing and left the cedar ceilings where they still held; a hurried one skimmed plaster over all of it. That difference does not photograph.\n\nThe Kasbah, to the south, is the same fabric with slightly wider streets and less acrobatic vehicle access — which for a main residence matters more than people expect.",
      },
    },
  },

  hivernage: {
    id: "hivernage",
    center: { lat: 31.626, lng: -8.008 },
    copy: {
      fr: {
        name: "Hivernage",
        lede: "Des avenues plantées et des appartements à vraies terrasses, à pied de la médina.",
        body: "L’Hivernage a été dessiné comme un quartier de villégiature et n’a jamais tout à fait cessé de l’être : larges avenues, jacarandas, murs bas, une densité qui reste faible pour un quartier aussi central.\n\nC’est le meilleur endroit de Marrakech pour un appartement, et le seul où l’on trouve régulièrement des terrasses de quarante mètres carrés plutôt que des balcons. Beaucoup de résidences sont sous gardiennage, avec ascenseur et parking, ce qui n’est pas la règle ailleurs dans le centre.\n\nOn y vient pour pouvoir marcher : la médina d’un côté, Guéliz de l’autre, sans reprendre la voiture.",
      },
      en: {
        name: "Hivernage",
        lede: "Planted avenues and apartments with real terraces, walking distance from the medina.",
        body: "Hivernage was laid out as a resort district and has never entirely stopped being one: wide avenues, jacarandas, low walls, and a density that stays gentle for somewhere this central.\n\nIt is the best address in Marrakech for an apartment, and the only one where forty-square-metre terraces turn up regularly instead of balconies. Many buildings are staffed and come with a lift and parking, which is not the rule elsewhere in the centre.\n\nPeople come here to be able to walk: the medina one way, Guéliz the other, without getting back in the car.",
      },
    },
  },

  gueliz: {
    id: "gueliz",
    center: { lat: 31.638, lng: -8.01 },
    copy: {
      fr: {
        name: "Guéliz",
        lede: "Le centre moderne : galeries, cafés, maisons de ville et appartements que l’on habite toute l’année.",
        body: "Guéliz est le quartier où Marrakech vit son quotidien. On y trouve des immeubles des années trente dont l’ossature reste lisible sous les rénovations, des maisons de ville avec patio et étage, et des programmes récents dont la qualité varie beaucoup d’une rue à l’autre.\n\nC’est l’adresse la plus pratique de la ville et la plus facile à louer. C’est aussi celle qui demande le plus d’attention à l’exposition : une façade plein ouest sur une avenue passante et une façade nord sur une rue plantée ne se vivent pas de la même manière en juillet.\n\nPour un premier achat à Marrakech, ou pour un pied-à-terre que l’on veut pouvoir fermer et quitter, la réponse se trouve presque toujours ici.",
      },
      en: {
        name: "Guéliz",
        lede: "The modern centre: galleries, cafés, townhouses and apartments people live in year-round.",
        body: "Guéliz is where Marrakech gets on with its day. There are 1930s buildings whose bones are still legible under the renovations, townhouses with a patio and a first floor, and recent developments whose quality varies a great deal from one street to the next.\n\nIt is the most practical address in the city and the easiest to let. It is also the one that most rewards attention to aspect: a due-west façade on a busy avenue and a north face on a planted street are not the same house in July.\n\nFor a first purchase in Marrakech, or a pied-à-terre you want to be able to lock and leave, the answer is almost always here.",
      },
    },
  },

  agdal: {
    id: "agdal",
    center: { lat: 31.605, lng: -7.985 },
    copy: {
      fr: {
        name: "Agdal",
        lede: "Au sud du centre, en bordure des oliveraies historiques : du calme sans être loin.",
        body: "L’Agdal doit son nom aux jardins qui le bordent, et une partie de son caractère au fait qu’il n’a jamais été densifié comme le reste du sud de la ville.\n\nLes programmes récents y sont plus généreux qu’au centre : appartements de deux cents mètres carrés, penthouses avec piscine privée en terrasse, résidences fermées avec un vrai jardin commun plutôt qu’une bande de gazon. Le rapport surface-prix y est parmi les meilleurs de Marrakech pour du neuf.\n\nEn contrepartie, tout se fait en voiture. C’est un quartier que l’on choisit pour l’espace, pas pour la marche.",
      },
      en: {
        name: "Agdal",
        lede: "South of the centre, along the historic olive gardens: quiet without being far.",
        body: "Agdal takes its name from the gardens on its edge, and some of its character from never having been densified the way the rest of the southern city was.\n\nRecent buildings here are more generous than in the centre: two-hundred-square-metre apartments, penthouses with a private pool on the terrace, gated residences with a real shared garden rather than a strip of lawn. Square metre for square metre it is among the best value in Marrakech for something new.\n\nThe trade is that everything happens by car. This is a district you choose for space, not for walking.",
      },
    },
  },

  amelkis: {
    id: "amelkis",
    center: { lat: 31.598, lng: -7.938 },
    copy: {
      fr: {
        name: "Amelkis",
        lede: "Un domaine de golf fermé à l’est de la ville : villas sur fairway, murs bas, Atlas en fond.",
        body: "Amelkis est l’un des rares endroits de Marrakech où l’on peut acheter une villa sans acheter un mur de trois mètres. Le domaine est clos et gardienné dans son ensemble, ce qui permet aux parcelles de s’ouvrir les unes sur les autres et sur le parcours.\n\nLes maisons y sont pour la plupart de plain-pied ou à un niveau, posées sur des terrains de mille à deux mille cinq cents mètres carrés, avec piscine et jardin mature — le domaine a désormais l’âge qu’il faut pour que les plantations soient formées.\n\nOn y trouve aussi des terrains constructibles, ce qui est devenu rare aussi près de la ville. Le cahier des charges du domaine encadre les hauteurs et les implantations : à lire avant de dessiner quoi que ce soit.",
      },
      en: {
        name: "Amelkis",
        lede: "A gated golf estate east of the city: villas on the fairway, low walls, the Atlas behind.",
        body: "Amelkis is one of the few places in Marrakech where you can buy a villa without buying a three-metre wall. The estate is enclosed and staffed as a whole, which lets the plots open onto one another and onto the course.\n\nThe houses are mostly single-storey or one-storey villas on plots of a thousand to two and a half thousand square metres, with a pool and a mature garden — the estate is now old enough for the planting to have come in.\n\nBuilding plots turn up here too, which has become rare this close to the city. The estate’s covenants govern heights and setbacks: read them before you draw anything.",
      },
    },
  },

  targa: {
    id: "targa",
    center: { lat: 31.648, lng: -8.043 },
    copy: {
      fr: {
        name: "Targa",
        lede: "L’ouest résidentiel : des villas familiales avec jardin, sur des parcelles que le centre n’offre plus.",
        body: "Targa est le quartier où les familles de Marrakech s’installent quand elles veulent un jardin sans quitter la ville. Les rues sont larges, les parcelles régulières, et l’on y construit depuis assez longtemps pour que les arbres soient hauts.\n\nC’est aussi le meilleur secteur pour une location longue durée meublée : les biens y sont grands, la demande stable, et la desserte vers les écoles et le centre directe.\n\nLa qualité de construction y varie plus qu’ailleurs, parce que le quartier s’est bâti par vagues. L’âge d’une villa se lit à ses menuiseries et à l’isolation de sa toiture bien avant de se lire à son prix.",
      },
      en: {
        name: "Targa",
        lede: "The residential west: family villas with gardens, on plots the centre no longer offers.",
        body: "Targa is where Marrakech families move when they want a garden without leaving the city. Wide streets, regular plots, and long enough under construction for the trees to have grown tall.\n\nIt is also the best sector for a furnished long let: the houses are large, demand is steady, and the run to the schools and the centre is direct.\n\nBuild quality varies more here than elsewhere, because the district went up in waves. A villa’s age shows in its joinery and its roof insulation long before it shows in its price.",
      },
    },
  },

  "route-ourika": {
    id: "route-ourika",
    center: { lat: 31.573, lng: -7.947 },
    copy: {
      fr: {
        name: "Route de l’Ourika",
        lede: "La route du sud vers les vallées : de la vraie surface, des vergers, et la montagne qui se rapproche.",
        body: "Passé la ceinture de la ville, la route de l’Ourika ouvre sur un paysage agricole où les propriétés se comptent en hectares plutôt qu’en mètres carrés. C’est là que se trouvent les domaines : oliveraies en production, vergers, écuries, maisons d’invités indépendantes.\n\nL’Atlas y est franchement présent, pas seulement en silhouette au fond d’une terrasse. Les nuits sont plus fraîches qu’en ville et la lumière de fin de journée y est différente — c’est la première chose que remarquent ceux qui visitent en fin d’après-midi.\n\nDeux points de vigilance : la nature exacte du titre foncier, qui sur du terrain agricole n’est pas toujours celle que l’on imagine, et l’accès à l’eau. L’un et l’autre se vérifient avant de tomber amoureux.",
      },
      en: {
        name: "Ourika road",
        lede: "The road south to the valleys: real acreage, orchards, and the mountains closing in.",
        body: "Past the city’s ring, the Ourika road opens onto farmland where properties are counted in hectares rather than square metres. This is where the estates are: productive olive groves, orchards, stabling, self-contained guest houses.\n\nThe Atlas is frankly present here, not merely a silhouette at the end of a terrace. Nights are cooler than in town and the late light is different — the first thing people notice when they visit at the end of the afternoon.\n\nTwo things to watch: the exact nature of the land title, which on agricultural ground is not always what people assume, and access to water. Both are worth settling before you fall in love.",
      },
    },
  },

  "route-fes": {
    id: "route-fes",
    center: { lat: 31.668, lng: -7.945 },
    copy: {
      fr: {
        name: "Route de Fès",
        lede: "Au nord-est : de grands jardins déjà formés, et une tranquillité qui commence au portail.",
        body: "La route de Fès s’est urbanisée plus tard et plus doucement que l’ouest de la ville, si bien qu’on y trouve encore des villas sur de vrais jardins à quinze minutes du centre.\n\nLes propriétés y datent souvent des années deux mille, ce qui est l’âge idéal pour un jardin : assez ancien pour que les arbres soient formés, assez récent pour que la maison n’ait pas besoin d’être reprise en totalité.\n\nC’est un secteur discret, choisi par des gens qui vivent à Marrakech à l’année plutôt que par des acheteurs de résidence secondaire — ce qui se ressent dans les rues un dimanche.",
      },
      en: {
        name: "Fès road",
        lede: "To the north-east: large gardens already grown in, and quiet that starts at the gate.",
        body: "The Fès road urbanised later and more gently than the west of the city, so villas on genuine gardens still turn up fifteen minutes from the centre.\n\nProperties here are often from the 2000s, which is the ideal age for a garden: old enough for the trees to have come in, recent enough that the house does not need taking back to the frame.\n\nIt is a discreet sector, chosen by people who live in Marrakech all year rather than by second-home buyers — which you can feel in the streets on a Sunday.",
      },
    },
  },

  "route-oukaimeden": {
    id: "route-oukaimeden",
    center: { lat: 31.56, lng: -7.976 },
    copy: {
      fr: {
        name: "Route de l’Oukaïmeden",
        lede: "Plein sud, vers la station : de l’espace, un ciel immense, et l’Atlas en ligne de mire.",
        body: "C’est la route qui monte vers la neige, et elle en garde quelque chose : dès la sortie de la ville l’horizon s’ouvre, et la montagne cesse d’être un décor pour devenir la direction dans laquelle on regarde.\n\nOn y achète du terrain, et des maisons posées dessus, rarement l’inverse. Les parcelles sont larges, les voisins lointains, et les constructions récentes y sont souvent contemporaines plutôt que néo-traditionnelles — le paysage supporte mieux les lignes simples.\n\nC’est un choix de vie autant qu’un choix immobilier : tout est à vingt minutes, ce qui convient très bien à certains et pas du tout à d’autres. Cela se teste un mardi matin, pas un samedi.",
      },
      en: {
        name: "Oukaïmeden road",
        lede: "Due south, towards the ski road: space, an enormous sky, and the Atlas straight ahead.",
        body: "This is the road that climbs to the snow, and it keeps something of that: the moment you leave the city the horizon opens, and the mountain stops being scenery and becomes the direction you look in.\n\nPeople buy land here, and houses sitting on it, rarely the other way round. Plots are wide, neighbours distant, and recent building tends to be contemporary rather than neo-traditional — the landscape carries simple lines better.\n\nIt is a decision about how you want to live as much as what you want to own: everything is twenty minutes away, which suits some people entirely and others not at all. Test it on a Tuesday morning, not a Saturday.",
      },
    },
  },
};

/** The order they are presented in — city outwards, not alphabetical. */
export const districtOrder: DistrictId[] = [
  "palmeraie",
  "medina",
  "gueliz",
  "hivernage",
  "agdal",
  "amelkis",
  "targa",
  "route-ourika",
  "route-fes",
  "route-oukaimeden",
];
