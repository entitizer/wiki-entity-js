import {
  WikidataEntities,
  WikidataPropertyValue,
  PlainObject,
  WikidataEntitiesParams,
  WikidataEntityClaims,
  AnyPlainObject,
  WikidataPropsParam
} from "../types";
import { getManyEntities } from "./api";
import { simplifyEntity } from "./simplify_entity";
import { eachSeries, uniq, isValidWikiId } from "../utils";

export function getEntities(
  params: WikidataEntitiesParams
): Promise<WikidataEntities> {
  const claims = params.claims || "none";
  const lang = params.language || "en";

  return getManyEntities(params).then(function (entities) {
    const ids = Object.keys(entities).filter((id) => isValidWikiId(id));
    ids.forEach((id) => {
      entities[id] = simplifyEntity(lang, entities[id]);
    });

    const tasks = [];
    if (~["all", "property"].indexOf(claims)) {
      tasks.push(exploreEntitiesProperties(entities, lang));
    }
    if (~["all", "item"].indexOf(claims)) {
      tasks.push(
        eachSeries(ids, (id) =>
          exploreEntityClaims(entities[id].claims, { language: lang })
        )
      );
    }

    return Promise.all(tasks).then(() => entities);
  });
}

function exploreEntitiesProperties(
  entities: WikidataEntities,
  lang: string
): Promise<any> {
  let ids: string[] = [];
  const entitiesIds = Object.keys(entities);
  entitiesIds.forEach((entityId) => {
    const entity = entities[entityId];
    if (entity.claims) {
      ids = ids.concat(Object.keys(entity.claims));
    }
  });

  if (!ids.length) {
    return Promise.resolve();
  }

  ids = uniq(ids);

  return getEntities({
    ids: ids,
    language: lang,
    props: [
      WikidataPropsParam.info,
      WikidataPropsParam.labels,
      WikidataPropsParam.descriptions,
      WikidataPropsParam.datatype
    ],
    claims: "none"
  }).then(function (properties) {
    Object.keys(properties).forEach((propertyId) => {
      entitiesIds.forEach((entityId) => {
        const entity = entities[entityId];
        if (entity.claims && entity.claims[propertyId]) {
          if (entity.claims && entity.claims[propertyId]) {
            for (var prop in properties[propertyId]) {
              if (~["label", "description"].indexOf(prop)) {
                entity.claims[propertyId][prop] = properties[propertyId][prop];
              }
            }
          }
        }
      });
    });
    return null;
  });
}

export function exploreEntityClaims(
  claims: WikidataEntityClaims,
  params: WikidataEntitiesParams
): Promise<void> {
  if (!claims) {
    return Promise.resolve();
  }

  const ids: string[] = [];
  const paths: PlainObject<
    { pid: string; value: WikidataPropertyValue; index: number }[]
  > = {}; // id=[key:position]
  Object.keys(claims).forEach((property) => {
    claims[property].values.forEach((propertyValue, index) => {
      if (propertyValue.datatype === "wikibase-item") {
        const id = propertyValue.value;
        paths[id] = paths[id] || [];
        paths[id].push({ pid: property, value: propertyValue, index });
        if (ids.indexOf(id) < 0) {
          ids.push(id);
        }
      }
    });
  });

  if (ids.length === 0) {
    return Promise.resolve();
  }

  params.ids = ids;
  params.props = params.props || [
    WikidataPropsParam.info,
    WikidataPropsParam.labels,
    WikidataPropsParam.descriptions,
    WikidataPropsParam.datatype
  ];
  params.claims = params.claims || "none";

  return getEntities(params).then((entities) => {
    Object.keys(entities).forEach((id) => {
      const item = entities[id];
      const pa = paths[item.id] || [];
      pa.forEach((pai) => {
        const val: AnyPlainObject = claims[pai.pid].values[pai.index];
        for (var prop in item) {
          if (~["label", "description"].indexOf(prop)) {
            val[prop] = item[prop];
          }
        }
      });
    });
  });
}
