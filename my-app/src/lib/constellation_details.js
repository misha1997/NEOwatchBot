// Detailed metadata for the 88 constellations: translation fallbacks, brightest stars,
// best seasons, and mythology details in both UK and EN.
export const CONSTELLATION_DETAILS = {
  UMa: {
    star: { uk: "Аліот (ε UMa)", en: "Alioth (ε UMa)" },
    season: { uk: "Цілий рік (найкраще навесні)", en: "Year-round (best in spring)" },
    myth: {
      uk: "У давньогрецьких міфах — німфа Каллісто, супутниця Артеміди, яку Зевс перетворив на ведмедицю, щоб врятувати від гніву своєї ревнивої дружини Гери.",
      en: "In Greek mythology, it represents Callisto, a nymph turned into a bear by Zeus to protect her from the jealousy of his wife, Hera."
    },
    abbr: "ursa-major",
    seasonKey: "spring"
  },
  UMi: {
    star: { uk: "Полярна зоря (α UMi)", en: "Polaris (α UMi)" },
    season: { uk: "Цілий рік (завжди на півночі)", en: "Year-round (always in the north)" },
    myth: {
      uk: "Мала Ведмедиця містить Полярну зорю. У міфах це Аркас, син Каллісто, якого Зевс також перетворив на сузір'я, щоб він не вбив свою матір на полюванні.",
      en: "Ursa Minor contains the North Star (Polaris). In mythology, it represents Arcas, the son of Callisto, placed in the heavens to prevent him from hunting his mother."
    },
    abbr: "ursa-minor",
    seasonKey: "spring"
  },
  Cas: {
    star: { uk: "Шедар (α Cas)", en: "Schedar (α Cas)" },
    season: { uk: "Осінь та зима", en: "Autumn and winter" },
    myth: {
      uk: "Пихата цариця Ефіопії, дружина Цефея та мати Андромеди. За свою гордість була покарана богами — прикута до трону, що вічно обертається навколо полюса неба.",
      en: "The vain queen of Ethiopia, wife of Cepheus and mother of Andromeda. Placed in the heavens on her throne as punishment for her boasting."
    },
    abbr: "cassiopeia",
    seasonKey: "autumn"
  },
  Ori: {
    star: { uk: "Рігель (β Ori)", en: "Rigel (β Ori)" },
    season: { uk: "Зима", en: "Winter" },
    myth: {
      uk: "Величний мисливець, син Посейдона. За легендою, він хвастався, що може вбити будь-якого звіра, тому обурена Гея послала гігантського Скорпіона вбити його.",
      en: "A giant hunter of Greek mythology, placed in the stars by Zeus after stepping on a giant scorpion sent by Gaia."
    },
    abbr: "orion",
    seasonKey: "winter"
  },
  Cyg: {
    star: { uk: "Денеб (α Cyg)", en: "Deneb (α Cyg)" },
    season: { uk: "Літо та осінь", en: "Summer and autumn" },
    myth: {
      uk: "Зевс набув подоби прекрасного лебедя, щоб зблизитися з Ледою, дружиною царя Спарти. Звідси — величні крила, що розпростерті вздовж Чумацького Шляху.",
      en: "Associated with Zeus, who disguised himself as a swan to seduce Leda, mother of Helen of Troy."
    },
    abbr: "cygnus",
    seasonKey: "summer"
  },
  Lyr: {
    star: { uk: "Вега (α Lyr)", en: "Vega (α Lyr)" },
    season: { uk: "Літо та осінь", en: "Summer and autumn" },
    myth: {
      uk: "Чарівна ліра великого музиканта Орфея, звуками якої він заворожував тварин, дерева та навіть каміння, а також спустився в Аїд, щоб повернути Еврідіку.",
      en: "The lyre of Orpheus, the legendary musician. Placed in the sky by Apollo after Orpheus's death."
    },
    abbr: "lyra",
    seasonKey: "summer"
  },
  Sco: {
    star: { uk: "Антарес (α Sco)", en: "Antares (α Sco)" },
    season: { uk: "Літо (низько на півдні)", en: "Summer (low in the south)" },
    myth: {
      uk: "Гігантський скорпіон, посланий богинею землі Геєю, щоб покарати мисливця Оріона. Вони знаходяться в протилежних частинах неба і ніколи не видно разом.",
      en: "The scorpion that killed Orion. The two constellations are placed opposite each other so they are never seen in the sky at the same time."
    },
    abbr: "scorpius",
    seasonKey: "summer"
  },
  Leo: {
    star: { uk: "Регул (α Leo)", en: "Regulus (α Leo)" },
    season: { uk: "Весна", en: "Spring" },
    myth: {
      uk: "Немейський лев з непробивною шкурою, який тримав у страху околиці. Його здолав Геракл у своєму першому подвигу, задушивши лева голими руками.",
      en: "The mythical Nemean Lion slain by Hercules as the first of his Twelve Labors, later placed in the stars."
    },
    abbr: "leo",
    seasonKey: "spring"
  },
  And: {
    star: { uk: "Альферац (α And)", en: "Alpheratz (α And)" },
    season: { uk: "Осінь", en: "Autumn" },
    myth: {
      uk: "Царівна Ефіопії, прикута до скелі біля моря як жертва чудовиську Кету, щоб вгамувати гнів Посейдона. Була врятована героєм Персеєм.",
      en: "The princess Andromeda, chained to a rock to appease a sea monster and rescued by the hero Perseus."
    },
    abbr: "andromeda",
    seasonKey: "autumn"
  },
  Peg: {
    star: { uk: "Еніф (ε Peg)", en: "Enif (ε Peg)" },
    season: { uk: "Осінь", en: "Autumn" },
    myth: {
      uk: "Крилатий кінь, що народився з крові Медузи Горгони. Допоміг Беллерофонту здолати Химеру і доставляв блискавки Зевсу на Олімп.",
      en: "The winged horse of Greek mythology who helped Bellerophon defeat the Chimera and later carried Zeus's thunderbolts."
    },
    abbr: "pegasus",
    seasonKey: "autumn"
  },
  Per: {
    star: { uk: "Мірфак (α Per)", en: "Mirfak (α Per)" },
    season: { uk: "Осінь та зима", en: "Autumn and winter" },
    myth: {
      uk: "Син Зевса і Данаї, герой, який здійснив безліч подвигів: переміг Медузу Горгону, врятував царівну Андромеду і взяв її за дружину.",
      en: "The Greek hero who killed Medusa and saved Andromeda from the sea monster Cetus."
    },
    abbr: "perseus",
    seasonKey: "autumn"
  },
  Tau: {
    star: { uk: "Альдебаран (α Tau)", en: "Aldebaran (α Tau)" },
    season: { uk: "Зима", en: "Winter" },
    myth: {
      uk: "Білий бик, подобу якого прийняв Зевс, щоб викрасти фінікійську царівну Європу і перевезти її через море на острів Крит.",
      en: "The white bull that Zeus disguised himself as in order to abduct the Phoenician princess Europa."
    },
    abbr: "taurus",
    seasonKey: "winter"
  },
  Gem: {
    star: { uk: "Поллукс (β Gem)", en: "Pollux (β Gem)" },
    season: { uk: "Зима та весна", en: "Winter and spring" },
    myth: {
      uk: "Близнюки Кастор та Поллукс (Діоскури). Коли смертний Кастор загинув, його безсмертний брат Поллукс благав Зевса розділити його безсмертя на двох.",
      en: "The twin brothers Castor and Pollux. Upon Castor's death, Pollux shared his immortality, allowing them to remain together in the stars."
    },
    abbr: "gemini",
    seasonKey: "winter"
  },
  Vir: {
    star: { uk: "Спіка (α Vir)", en: "Spica (α Vir)" },
    season: { uk: "Весна", en: "Spring" },
    myth: {
      uk: "Астрея — богиня справедливості, дочка Зевса і Феміди, яка жила серед людей у Золотому віці, але покинула Землю через людську жорстокість.",
      en: "Astrea, goddess of justice, who left Earth at the end of the Golden Age because of human wickedness."
    },
    abbr: "virgo",
    seasonKey: "spring"
  },
  Sgr: {
    star: { uk: "Нункі (σ Sgr)", en: "Nunki (σ Sgr)" },
    season: { uk: "Літо (низько на півдні)", en: "Summer (low in the south)" },
    myth: {
      uk: "У грецькій міфології асоціюється з мудрим кентавром Кротосом, покровителем муз, стрілком та винахідником стрільби з лука.",
      en: "Often represented as a centaur pulling a bow, associated with the archer Crotus, friend and protector of the Muses."
    },
    abbr: "sagittarius",
    seasonKey: "summer"
  },
  CMa: {
    star: { uk: "Сіріус (α CMa)", en: "Sirius (α CMa)" },
    season: { uk: "Зима", en: "Winter" },
    myth: {
      uk: "Великий мисливський пес Оріона, що невпинно переслідує зайця небом. Містить зорю Сіріус — найяскравішу на всьому нічному небі.",
      en: "The larger hunting dog of Orion, containing Sirius, the brightest star in the night sky."
    },
    abbr: "canis-major",
    seasonKey: "winter"
  },
  Boo: {
    star: { uk: "Арктур (α Boo)", en: "Arcturus (α Boo)" },
    season: { uk: "Весна та літо", en: "Spring and summer" },
    myth: {
      uk: "Волопас, який вічно жене Велику Ведмедицю навколо полюса. Містить Арктур — найяскравішу зорю північної півкулі неба.",
      en: "The Herdsman who drives the bears around the celestial pole, containing Arcturus, the brightest star in the northern celestial hemisphere."
    },
    abbr: "bootes",
    seasonKey: "spring"
  },
  Aur: {
    star: { uk: "Капелла (α Aur)", en: "Capella (α Aur)" },
    season: { uk: "Осінь та зима", en: "Autumn and winter" },
    myth: {
      uk: "Візничий Еріхтоній, легендарний цар Афін і винахідник квадриги (колісниці з 4 кіньми), за що Зевс з поваги помістив його на небо.",
      en: "Erichthonius of Athens, inventor of the four-horse chariot (quadriga), placed in the stars by Zeus."
    },
    abbr: "auriga",
    seasonKey: "winter"
  }
};

export const getConstellationDetails = (desig, lang) => {
  const d = CONSTELLATION_DETAILS[desig];
  const l = lang === "en" ? "en" : "uk";
  if (d) {
    return {
      star: d.star[l],
      season: d.season[l],
      myth: d.myth[l],
      seasonKey: d.seasonKey
    };
  }
  
  // Dynamic fallback for other constellations
  return {
    star: lang === "en" ? "Check star list" : "Дивись список зірок",
    season: lang === "en" ? "Varies" : "Змінюється відповідно до сезону",
    myth: lang === "en"
      ? `One of the 88 constellations of the celestial sphere. Named in classical or modern times.`
      : `Одне з 88 сузір'їв небесної сфери. Затверджене Міжнародним астрономічним союзом.`,
    seasonKey: "spring"
  };
};
