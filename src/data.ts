import type { ConservationStatus, Observation, Region, Species, TaxonomicRank } from './types'

export const statusLabels: Record<ConservationStatus, string> = {
  LC: 'Préoccupation mineure',
  NT: 'Quasi menacé',
  VU: 'Vulnérable',
  EN: 'En danger',
  CR: 'En danger critique',
  DD: 'Données insuffisantes',
  NE: 'Non évalué',
}

function taxonomy(
  classe: string,
  ordre: string,
  famille: string,
  scientificName: string,
): Species['taxonomy'] {
  const names = [
    'Animalia',
    classe === 'Insecta' ? 'Arthropoda' : 'Chordata',
    classe,
    ordre,
    famille,
    scientificName.split(' ')[0],
    scientificName,
  ]
  const ranks: TaxonomicRank[] = ['Règne', 'Embranchement', 'Classe', 'Ordre', 'Famille', 'Genre', 'Espèce']
  return names.map((name, index) => ({ rank: ranks[index], name }))
}

type Entry = {
  id: string
  name: string
  scientificName: string
  category: Species['category']
  status: ConservationStatus
  classe: string
  ordre: string
  famille: string
  habitat: string
  diet: string
  range: string
  description: string
  wiki: string
  statusNote?: string
}

// Textes de synthèse originaux. Les statuts sont des repères éducatifs,
// pas une consultation en temps réel des évaluations UICN.
const entries: Entry[] = [
  {
    id: 'lion',
    name: 'Lion',
    scientificName: 'Panthera leo',
    category: 'Mammifères',
    status: 'VU',
    classe: 'Mammalia',
    ordre: 'Carnivora',
    famille: 'Felidae',
    wiki: 'Lion',
    habitat: 'Savanes, prairies et boisements ouverts, avec des zones de repos ombragées.',
    diet: 'Carnivore : principalement des ongulés, parfois des proies plus petites et des charognes.',
    range: 'Populations fragmentées en Afrique subsaharienne ; une population asiatique subsiste en Inde.',
    description:
      'Le lion vit souvent en groupes familiaux, un comportement peu fréquent chez les félins. Les femelles assurent une grande part de la chasse. La perte d’habitat et les conflits avec l’élevage menacent ses populations.',
  },
  {
    id: 'elephant',
    name: 'Éléphant de savane',
    scientificName: 'Loxodonta africana',
    category: 'Mammifères',
    status: 'EN',
    classe: 'Mammalia',
    ordre: 'Proboscidea',
    famille: 'Elephantidae',
    wiki: 'Éléphant_de_savane_d’Afrique',
    habitat:
      'Savanes, forêts claires et zones humides ; l’accès à l’eau et aux corridors de déplacement est essentiel.',
    diet: 'Herbivore : herbes, feuilles, écorces, branches et fruits selon la saison.',
    range: 'Afrique subsaharienne, dans des territoires aujourd’hui souvent fragmentés.',
    description:
      'Les femelles et les jeunes forment des groupes à forte cohésion sociale. En déplaçant des graines et en modifiant la végétation, les éléphants façonnent leurs paysages. Gardez toujours une grande distance et une voie de passage libre.',
    statusNote:
      'En danger dans l’évaluation UICN publiée en 2021. L’éléphant de forêt est une espèce distincte ; ce statut ne décrit pas toutes les populations locales.',
  },
  {
    id: 'giraffe',
    name: 'Girafe',
    scientificName: 'Giraffa camelopardalis',
    category: 'Mammifères',
    status: 'VU',
    classe: 'Mammalia',
    ordre: 'Artiodactyla',
    famille: 'Giraffidae',
    wiki: 'Girafe',
    habitat: 'Savanes arborées et boisements ouverts.',
    diet: 'Feuilles, pousses et fleurs, notamment de nombreux acacias.',
    range: 'Afrique subsaharienne ; l’aire varie selon les populations et le découpage taxonomique retenu.',
    description:
      'La girafe atteint des feuilles inaccessibles à de nombreux autres herbivores. Son pelage permet de distinguer les individus. La fragmentation des paysages réduit les déplacements entre populations.',
    statusNote:
      'Vulnérable dans l’évaluation UICN de 2016 sous Giraffa camelopardalis au sens large. La classification du genre Giraffa fait l’objet de révisions ; les statuts peuvent varier par taxon.',
  },
  {
    id: 'zebra',
    name: 'Zèbre des plaines',
    scientificName: 'Equus quagga',
    category: 'Mammifères',
    status: 'NT',
    classe: 'Mammalia',
    ordre: 'Perissodactyla',
    famille: 'Equidae',
    wiki: 'Zèbre_des_plaines',
    habitat: 'Prairies et savanes ouvertes, généralement à proximité d’un accès à l’eau.',
    diet: 'Principalement des graminées ; peut aussi consommer des feuilles.',
    range: 'Afrique orientale et australe.',
    description:
      'Chaque zèbre possède un motif de rayures individuel. Des groupes familiaux se rassemblent parfois en grands troupeaux. Les routes migratoires et les points d’eau comptent autant pour sa protection que les réserves elles-mêmes.',
  },
  {
    id: 'leopard',
    name: 'Léopard',
    scientificName: 'Panthera pardus',
    category: 'Mammifères',
    status: 'VU',
    classe: 'Mammalia',
    ordre: 'Carnivora',
    famille: 'Felidae',
    wiki: 'Léopard',
    habitat:
      'Forêts, savanes, montagnes et milieux semi-arides, lorsque des abris et des proies sont disponibles.',
    diet: 'Carnivore opportuniste : mammifères de tailles variées, oiseaux et autres petites proies.',
    range: 'Afrique et certaines régions d’Asie, avec des populations très fragmentées.',
    description:
      'Discret et généralement solitaire, le léopard peut hisser ses proies dans un arbre. Malgré sa capacité d’adaptation, il subit la disparition de ses proies et des conflits avec les activités humaines. Ne cherchez pas à l’attirer pour une photo.',
  },
  {
    id: 'cheetah',
    name: 'Guépard',
    scientificName: 'Acinonyx jubatus',
    category: 'Mammifères',
    status: 'VU',
    classe: 'Mammalia',
    ordre: 'Carnivora',
    famille: 'Felidae',
    wiki: 'Guépard',
    habitat: 'Savanes, prairies et milieux ouverts ou semi-arides.',
    diet: 'Carnivore : surtout des ongulés de taille petite ou moyenne.',
    range: 'Populations fragmentées en Afrique ; une très petite population asiatique subsiste en Iran.',
    description:
      'Le guépard utilise des accélérations très rapides sur de courtes distances pour chasser. Ses marques sombres sous les yeux et ses griffes peu rétractiles aident à le reconnaître. Son besoin de vastes territoires rend les corridors naturels précieux.',
  },
  {
    id: 'rhino',
    name: 'Rhinocéros noir',
    scientificName: 'Diceros bicornis',
    category: 'Mammifères',
    status: 'CR',
    classe: 'Mammalia',
    ordre: 'Perissodactyla',
    famille: 'Rhinocerotidae',
    wiki: 'Rhinocéros_noir',
    habitat: 'Savanes arbustives, boisements et régions semi-arides.',
    diet: 'Feuilles, rameaux et jeunes pousses, saisis avec sa lèvre supérieure préhensile.',
    range: 'Populations protégées et fragmentées d’Afrique orientale et australe.',
    description:
      'Le rhinocéros noir broute surtout des végétaux ligneux, contrairement au rhinocéros blanc davantage spécialisé dans les herbes. Le braconnage demeure une menace majeure. Ne communiquez jamais une localisation précise, même dans la légende d’une photo.',
  },
  {
    id: 'tiger',
    name: 'Tigre',
    scientificName: 'Panthera tigris',
    category: 'Mammifères',
    status: 'EN',
    classe: 'Mammalia',
    ordre: 'Carnivora',
    famille: 'Felidae',
    wiki: 'Tigre',
    habitat: 'Forêts tropicales ou tempérées, mangroves et prairies riches en proies.',
    diet: 'Carnivore : principalement des ongulés, comme les cerfs et les sangliers.',
    range: 'Populations discontinues d’Asie, de l’Inde à l’Extrême-Orient russe.',
    description:
      'Le tigre est un grand félin généralement solitaire dont les rayures sont propres à chaque individu. La protection de ses proies et de vastes habitats connectés est essentielle. Une observation se fait uniquement à distance et dans un cadre autorisé.',
  },
  {
    id: 'fox',
    name: 'Renard roux',
    scientificName: 'Vulpes vulpes',
    category: 'Mammifères',
    status: 'LC',
    classe: 'Mammalia',
    ordre: 'Carnivora',
    famille: 'Canidae',
    wiki: 'Renard_roux',
    habitat: 'Forêts, campagnes, montagnes et parfois villes.',
    diet: 'Omnivore opportuniste : petits mammifères, invertébrés, oiseaux et fruits.',
    range: 'Une grande partie de l’hémisphère Nord ; introduit notamment en Australie.',
    description:
      'Le renard roux utilise son ouïe fine pour repérer de petites proies. Sa longue queue sert à l’équilibre et à la communication. Même en ville, il reste un animal sauvage : ne le nourrissez pas et évitez d’approcher les terriers.',
  },
  {
    id: 'wolf',
    name: 'Loup gris',
    scientificName: 'Canis lupus',
    category: 'Mammifères',
    status: 'LC',
    classe: 'Mammalia',
    ordre: 'Carnivora',
    famille: 'Canidae',
    wiki: 'Canis_lupus',
    habitat: 'Forêts, montagnes, steppes et toundra, selon les populations.',
    diet: 'Principalement des ongulés ; aussi de petites proies et des charognes.',
    range: 'Amérique du Nord, Europe et Asie ; présence et protection très variables localement.',
    description:
      'Les meutes sont généralement des groupes familiaux qui coopèrent pour élever les jeunes et se déplacer. Les vocalisations participent à leur communication. Un statut mondial favorable ne signifie pas que toutes les populations locales sont hors de danger.',
  },
  {
    id: 'lynx',
    name: 'Lynx boréal',
    scientificName: 'Lynx lynx',
    category: 'Mammifères',
    status: 'LC',
    classe: 'Mammalia',
    ordre: 'Carnivora',
    famille: 'Felidae',
    wiki: 'Lynx_boréal',
    habitat: 'Forêts et paysages boisés de montagne, avec des espaces de déplacement suffisamment continus.',
    diet: 'Carnivore : petits ongulés, lièvres et autres mammifères.',
    range: 'Europe et Asie ; petites populations fragmentées dans certaines régions européennes.',
    description:
      'Ce félin discret se reconnaît à ses oreilles ornées de pinceaux et à sa queue courte. Il chasse souvent à l’affût. Les collisions routières et la fragmentation des forêts peuvent fragiliser les populations, même lorsque le statut mondial est favorable.',
  },
  {
    id: 'bear',
    name: 'Ours brun',
    scientificName: 'Ursus arctos',
    category: 'Mammifères',
    status: 'LC',
    classe: 'Mammalia',
    ordre: 'Carnivora',
    famille: 'Ursidae',
    wiki: 'Ours_brun',
    habitat: 'Forêts, montagnes, toundra et prairies selon les régions.',
    diet: 'Omnivore : plantes, fruits, insectes, poissons, mammifères et charognes.',
    range: 'Eurasie et Amérique du Nord ; certaines populations européennes sont très réduites.',
    description:
      'L’alimentation de l’ours brun varie beaucoup avec les saisons et les ressources locales. Il dispose d’un odorat développé. Conservez la nourriture hors d’accès, restez à distance et ne vous interposez jamais entre une femelle et ses petits.',
  },
  {
    id: 'robin',
    name: 'Rougegorge familier',
    scientificName: 'Erithacus rubecula',
    category: 'Oiseaux',
    status: 'LC',
    classe: 'Aves',
    ordre: 'Passeriformes',
    famille: 'Muscicapidae',
    wiki: 'Rougegorge_familier',
    habitat: 'Sous-bois, haies, parcs et jardins présentant une végétation dense.',
    diet: 'Insectes, araignées et autres invertébrés ; fruits en complément.',
    range:
      'Europe, Afrique du Nord et parties occidentales de l’Asie ; migrations variables selon les populations.',
    description:
      'La poitrine orangée du rougegorge est portée par les mâles comme par les femelles. Son chant peut être entendu hors de la saison de reproduction. Son apparente familiarité ne doit pas conduire à approcher un nid ou à utiliser des sons pour l’attirer.',
  },
  {
    id: 'kingfisher',
    name: 'Martin-pêcheur d’Europe',
    scientificName: 'Alcedo atthis',
    category: 'Oiseaux',
    status: 'LC',
    classe: 'Aves',
    ordre: 'Coraciiformes',
    famille: 'Alcedinidae',
    wiki: 'Martin-pêcheur_d’Europe',
    habitat: 'Cours d’eau, étangs et zones humides avec des perchoirs et des berges favorables.',
    diet: 'Petits poissons et invertébrés aquatiques.',
    range: 'Europe, Afrique du Nord et une grande partie de l’Asie.',
    description:
      'Le martin-pêcheur plonge depuis un perchoir pour capturer ses proies. Il creuse souvent un tunnel dans une berge pour nicher. La qualité de l’eau et la tranquillité des berges sont essentielles ; ne stationnez pas devant une entrée de nid.',
  },
  {
    id: 'flamingo',
    name: 'Flamant rose',
    scientificName: 'Phoenicopterus roseus',
    category: 'Oiseaux',
    status: 'LC',
    classe: 'Aves',
    ordre: 'Phoenicopteriformes',
    famille: 'Phoenicopteridae',
    wiki: 'Flamant_rose',
    habitat: 'Lagunes, lacs salés et zones humides peu profondes.',
    diet: 'Petits crustacés, mollusques et autres organismes filtrés dans l’eau ou la vase.',
    range: 'Afrique, sud de l’Europe et parties de l’Asie.',
    description:
      'Le flamant filtre sa nourriture avec un bec adapté. Sa couleur dépend notamment de pigments contenus dans son alimentation. Les colonies reproductrices sont très sensibles aux dérangements : observez-les depuis les points autorisés et sans drone.',
  },
  {
    id: 'turtle',
    name: 'Tortue caouanne',
    scientificName: 'Caretta caretta',
    category: 'Reptiles',
    status: 'VU',
    classe: 'Reptilia',
    ordre: 'Testudines',
    famille: 'Cheloniidae',
    wiki: 'Caouanne',
    habitat: 'Eaux marines tempérées et subtropicales ; plages sableuses pour la ponte.',
    diet: 'Crustacés, mollusques et autres animaux marins, avec une alimentation variant selon l’âge.',
    range: 'Océans Atlantique, Indien et Pacifique, ainsi qu’en Méditerranée.',
    description:
      'La caouanne peut parcourir de longues distances entre zones d’alimentation et de reproduction. Les captures accidentelles, les déchets et l’éclairage des plages la menacent. En période de ponte, gardez vos distances et n’utilisez ni flash ni éclairage direct.',
    statusNote:
      'Vulnérable à l’échelle mondiale dans la fiche UICN de référence. Les sous-populations ont des évaluations distinctes ; consulter la source avant tout usage scientifique.',
  },
  {
    id: 'salamander',
    name: 'Salamandre tachetée',
    scientificName: 'Salamandra salamandra',
    category: 'Amphibiens',
    status: 'LC',
    classe: 'Amphibia',
    ordre: 'Caudata',
    famille: 'Salamandridae',
    wiki: 'Salamandre_tachetée',
    habitat: 'Forêts humides et ombragées, à proximité de petits cours d’eau ou de points d’eau.',
    diet: 'Invertébrés : vers, limaces, insectes et autres petites proies.',
    range:
      'Une grande partie de l’Europe ; limites variables selon les espèces voisines et les classifications.',
    description:
      'Son dessin jaune et noir signale des sécrétions cutanées défensives. La salamandre est surtout active par temps humide. Ne la manipulez pas : cela peut la stresser et favoriser la transmission de pathogènes entre sites.',
  },
  {
    id: 'dragonfly',
    name: 'Anax empereur',
    scientificName: 'Anax imperator',
    category: 'Insectes',
    status: 'LC',
    classe: 'Insecta',
    ordre: 'Odonata',
    famille: 'Aeshnidae',
    wiki: 'Anax_empereur',
    habitat: 'Mares, étangs et plans d’eau avec une végétation aquatique développée.',
    diet: 'Prédateur d’invertébrés ; larves aquatiques et adultes chassant en vol.',
    range: 'Europe, une grande partie de l’Afrique et certaines régions d’Asie.',
    description:
      'Cette grande libellule patrouille souvent au-dessus de l’eau. Avant de voler, elle passe une partie de sa vie sous forme de larve aquatique. Observer une émergence sans toucher l’animal permet de découvrir une étape particulièrement fragile.',
  },
]

const photographedSpecies = new Set(['lion', 'elephant', 'giraffe', 'zebra', 'fox', 'tiger'])

export const species: Species[] = entries.map(({ classe, ordre, famille, wiki, statusNote, ...entry }) => ({
  ...entry,
  taxonomy: taxonomy(classe, ordre, famille, entry.scientificName),
  cover: `${import.meta.env.BASE_URL}photos/${entry.id}.${photographedSpecies.has(entry.id) ? 'jpg' : 'svg'}`,
  imageCredit: photographedSpecies.has(entry.id)
    ? 'Photo de catalogue · collection Mohamed Asif A (sources Unsplash/Pixabay déclarées ; auteur non renseigné). Crédits détaillés : /photos/CREDITS.md.'
    : 'Illustration originale créée pour ce catalogue ; ne constitue pas un outil d’identification.',
  statusNote:
    statusNote ??
    `${statusLabels[entry.status]} : repère mondial issu des références UICN, sans vérification en temps réel. Les évaluations évoluent et les populations locales peuvent avoir un statut différent ; consulter la fiche source.`,
  sources: [
    { label: 'Wikipédia', url: `https://fr.wikipedia.org/wiki/${encodeURIComponent(wiki)}` },
    {
      label: 'iNaturalist',
      url: `https://www.inaturalist.org/taxa/search?q=${encodeURIComponent(entry.scientificName)}`,
    },
    {
      label: 'GBIF',
      url: `https://www.gbif.org/species/search?q=${encodeURIComponent(entry.scientificName)}`,
    },
    {
      label: 'Liste rouge UICN',
      url: `https://www.iucnredlist.org/search?query=${encodeURIComponent(entry.scientificName)}&searchType=species`,
    },
  ],
}))

// Les coordonnées décrivent exclusivement les centres approximatifs des régions.
// Aucune observation ne possède de champ de coordonnées.
export const regions: Region[] = [
  { id: 'france', name: 'France métropolitaine', continent: 'Europe', latitude: 46.6, longitude: 2.5 },
  { id: 'iberia', name: 'Péninsule Ibérique', continent: 'Europe', latitude: 40, longitude: -4 },
  { id: 'alps', name: 'Arc alpin', continent: 'Europe', latitude: 46.5, longitude: 10 },
  { id: 'north-europe', name: 'Europe du Nord', continent: 'Europe', latitude: 62, longitude: 17 },
  { id: 'east-europe', name: 'Europe orientale', continent: 'Europe', latitude: 49, longitude: 25 },
  { id: 'east-africa', name: 'Afrique de l’Est', continent: 'Afrique', latitude: -2, longitude: 36 },
  { id: 'southern-africa', name: 'Afrique australe', continent: 'Afrique', latitude: -24, longitude: 25 },
  { id: 'north-africa', name: 'Afrique du Nord', continent: 'Afrique', latitude: 29, longitude: 13 },
  { id: 'west-africa', name: 'Afrique de l’Ouest', continent: 'Afrique', latitude: 10, longitude: -3 },
  { id: 'south-asia', name: 'Asie du Sud', continent: 'Asie', latitude: 22, longitude: 78 },
  { id: 'southeast-asia', name: 'Asie du Sud-Est', continent: 'Asie', latitude: 8, longitude: 107 },
  { id: 'east-asia', name: 'Asie orientale', continent: 'Asie', latitude: 35, longitude: 115 },
  { id: 'north-america', name: 'Amérique du Nord', continent: 'Amérique', latitude: 45, longitude: -105 },
  { id: 'central-america', name: 'Amérique centrale', continent: 'Amérique', latitude: 15, longitude: -88 },
  { id: 'south-america', name: 'Amérique du Sud', continent: 'Amérique', latitude: -15, longitude: -60 },
  { id: 'oceania', name: 'Océanie', continent: 'Océanie', latitude: -25, longitude: 140 },
  {
    id: 'mediterranean',
    name: 'Bassin méditerranéen',
    continent: 'Europe / Afrique / Asie',
    latitude: 36,
    longitude: 18,
  },
]

// Exemples opt-in : jamais insérés à l'ouverture de l'application.
export const demoObservations: Observation[] = [
  {
    id: 'demo-lion',
    speciesId: 'lion',
    regionId: 'east-africa',
    date: '2026-06-14',
    notes: 'Exemple fictif · Observé depuis un véhicule, à bonne distance.',
    photos: [],
    favorite: true,
    createdAt: '2026-06-14T08:30:00.000Z',
  },
  {
    id: 'demo-elephant',
    speciesId: 'elephant',
    regionId: 'southern-africa',
    date: '2026-06-16',
    notes: 'Exemple fictif · Un groupe familial traversait la savane.',
    photos: [],
    favorite: true,
    createdAt: '2026-06-16T08:30:00.000Z',
  },
  {
    id: 'demo-giraffe',
    speciesId: 'giraffe',
    regionId: 'east-africa',
    date: '2026-06-15',
    notes: 'Exemple fictif · Au bord d’un boisement, sans s’approcher.',
    photos: [],
    favorite: false,
    createdAt: '2026-06-15T08:30:00.000Z',
  },
  {
    id: 'demo-zebra',
    speciesId: 'zebra',
    regionId: 'east-africa',
    date: '2026-06-14',
    notes: 'Exemple fictif · Un troupeau observé depuis la piste autorisée.',
    photos: [],
    favorite: false,
    createdAt: '2026-06-14T09:30:00.000Z',
  },
  {
    id: 'demo-fox',
    speciesId: 'fox',
    regionId: 'france',
    date: '2026-05-04',
    notes: 'Exemple fictif · Rencontre au crépuscule pendant une randonnée.',
    photos: [],
    favorite: true,
    createdAt: '2026-05-04T18:30:00.000Z',
  },
  {
    id: 'demo-tiger',
    speciesId: 'tiger',
    regionId: 'south-asia',
    date: '2026-04-12',
    notes: 'Exemple fictif · Observation depuis un véhicule dans une zone autorisée.',
    photos: [],
    favorite: false,
    createdAt: '2026-04-12T08:30:00.000Z',
  },
  {
    id: 'demo-flamingo',
    speciesId: 'flamingo',
    regionId: 'mediterranean',
    date: '2026-03-28',
    notes: 'Exemple fictif · La colonie vue depuis un observatoire officiel.',
    photos: [],
    favorite: true,
    createdAt: '2026-03-28T08:30:00.000Z',
  },
  {
    id: 'demo-turtle',
    speciesId: 'turtle',
    regionId: 'mediterranean',
    date: '2026-07-10',
    notes: 'Exemple fictif · Observation à distance, sans toucher l’animal.',
    photos: [],
    favorite: false,
    createdAt: '2026-07-10T08:30:00.000Z',
  },
]
