import type { WikiEntity } from "../types";
import type { SimpleEntityData } from "./simple-entity";

/**
 * Flatten an entity's claims to `{ propertyId: [renderedValue, …] }`, keeping
 * the rendered form (`value_string`) when Wikidata's raw value is structured.
 */
export function getEntityData(wikiEntity: WikiEntity): SimpleEntityData | null {
  if (!wikiEntity.claims) return null;

  const data: SimpleEntityData = {};

  for (const [property, claim] of Object.entries(wikiEntity.claims)) {
    const values: string[] = [];

    for (const value of claim.values) {
      const rendered = value.value_string ?? renderValue(value.value);
      // Structured values without a rendering carry no useful scalar form.
      if (rendered !== undefined) values.push(rendered);
    }

    if (values.length) data[property] = values;
  }

  return data;
}

function renderValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return undefined;
}
