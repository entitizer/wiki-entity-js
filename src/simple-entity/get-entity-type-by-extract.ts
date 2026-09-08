import { SimpleEntityType } from "./simple-entity";

/**
 * Unicode-aware word boundaries. JavaScript's `\b` only knows ASCII, so
 * `/\boraș\b/` never matches "oraș " — the boundary check fails on `ș`.
 */
const START = "(?<![\\p{L}\\p{N}])";
const END = "(?![\\p{L}\\p{N}])";

const word = (pattern: string): RegExp =>
  new RegExp(`${START}${pattern}${END}`, "iu");

type InfoRegType = { reg: RegExp; type: SimpleEntityType };

/**
 * Last-resort type detection from the opening words of a Wikipedia extract.
 * Only languages with curated patterns are covered.
 */
const MAP: Record<string, InfoRegType[]> = {
  ro: [
    {
      reg: word("(este|a fost) un (sat|oraș|orășel|județ|raion|municipiu)"),
      type: SimpleEntityType.PLACE
    },
    {
      reg: word("(este|a fost) o (comună|biserică|mănăstire|localitate)"),
      type: SimpleEntityType.PLACE
    },
    {
      reg: word("(este|a fost) o (organizație|companie|întreprindere)"),
      type: SimpleEntityType.ORG
    },
    {
      reg: word(
        "(este|a fost) un (om|scriitor|poet|cercetător|politician|businessman|cântăreț|muzician|actor|regizor|pictor)"
      ),
      type: SimpleEntityType.PERSON
    },
    {
      reg: word(
        "(este|a fost) o (scriitoare|poetă|cercetătoare|politiciană|cântăreață|actriță|regizoare|pictoriță)"
      ),
      type: SimpleEntityType.PERSON
    }
  ],
  en: [
    {
      reg: word(
        "is a (city|town|village|country|county|district|municipality|region|commune)"
      ),
      type: SimpleEntityType.PLACE
    },
    {
      reg: word(
        "(was|is) an? [\\p{L}\\s-]{0,40}?(politician|writer|poet|singer|actor|actress|player|musician|scientist|physicist|footballer|painter|director)"
      ),
      type: SimpleEntityType.PERSON
    },
    {
      reg: word(
        "is an? [\\p{L}\\s-]{0,40}?(company|organization|organisation|corporation|agency|institution)"
      ),
      type: SimpleEntityType.ORG
    }
  ]
};

/** Guess an entity type from the first sentence of its extract. */
export function getEntityTypeByExtract(
  extract: string | undefined,
  lang: string
): SimpleEntityType | undefined {
  if (!extract) return undefined;

  const head = extract.slice(0, 120);
  const patterns = MAP[lang.toLowerCase()];
  if (!patterns) return undefined;

  for (const { reg, type } of patterns) {
    if (reg.test(head)) return type;
  }

  return undefined;
}
