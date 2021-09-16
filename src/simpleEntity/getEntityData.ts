import { SimpleEntityData } from "./simpleEntity";
import { WikiEntity } from "../types";

export function getEntityData(wikiEntity: WikiEntity): SimpleEntityData {
  if (!wikiEntity.claims) {
    return null;
  }

  const data: SimpleEntityData = {};

  for (let key in wikiEntity.claims) {
    const values = wikiEntity.claims[key].values;
    data[key] = [];

    values.forEach((value) => {
      if (!value.value_string && value.value === null) {
        throw new Error(
          `WikiEntity claim value cannot be null: ${wikiEntity.id}:${key}`
        );
      }
      const v: { value: string; label?: string } = {
        value: value.value_string || value.value.toString()
      };
      if (value.label && v.value !== value.label) {
        v.label = value.label;
      }
      data[key].push(v.value);
    });
  }

  return data;
}
