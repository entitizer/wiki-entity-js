import { WikiEntity, WikiEntities, WikiEntitiesParams } from "./types";
import { getEntities as getWikidataEntities } from "./wikidata";
import { Api as WikipediaApi } from "./wikipedia/api";
import { isValidWikiId } from "./utils";
import { getEntityTypesByName } from "./wikidata/get_entity_types";

export { simplifyEntity } from "./wikidata/simplify_entity";
export { WikipediaApi };
export * from "./simpleEntity";
export * from "./types";

export async function getEntities(
  params: WikiEntitiesParams
): Promise<WikiEntity[]> {
  const lang = params.language || "en";

  const entities = await getWikidataEntities(params);

  const ids = Object.keys(entities).filter((id) => isValidWikiId(id));

  if (ids.length === 0) return [];

  const wikiApi = new WikipediaApi({}, params.httpTimeout);

  if (params.extract) wikiApi.extract(params.extract);
  if (params.redirects) wikiApi.redirects();
  if (params.categories) wikiApi.categories();
  const useWikiApi =
    params.extract ||
    params.redirects ||
    params.categories ||
    params.wikiPageId !== false;

  const tasks: unknown[] = [];

  if (useWikiApi && entities[ids[0]] && entities[ids[0]].sitelinks) {
    const titleIds = ids.reduce((prev: any, id) => {
      if (
        entities[id] &&
        entities[id].sitelinks &&
        entities[id].sitelinks[lang]
      ) {
        prev[entities[id].sitelinks[lang]] = id;
      }
      return prev;
    }, {});
    tasks.push(
      wikiApi
        .query(lang, {
          titles: ids
            .map(
              (id) =>
                (entities[id] &&
                  entities[id].sitelinks &&
                  entities[id].sitelinks[lang]) ||
                null
            )
            .filter((item) => !!item)
            .join("|")
        })
        .then((apiResults) =>
          apiResults.forEach((result) => {
            const entity = entities[titleIds[result.title]];
            entity.pageid = result.pageid;
            if (params.extract) entity.extract = result.extract;

            if (params.redirects) entity.redirects = result.redirects;

            if (params.categories) entity.categories = result.categories;
          })
        )
    );
  }

  if (params.types === true || Array.isArray(params.types)) {
    const prefixes: string[] = Array.isArray(params.types)
      ? params.types
      : null;
    ids.forEach((id) => {
      if (entities[id] && entities[id].sitelinks) {
        const enName = entities[id].sitelinks["en"];
        if (enName) {
          tasks.push(
            getEntityTypesByName(enName, prefixes).then((types) => {
              entities[id].types = types;
            })
          );
        }
      }
    });
  }

  await Promise.all(tasks);

  return Object.keys(entities)
    .map((id) => entities[id])
    .filter((it) => !!it);
}

export async function mapRedirects(
  titles: string[],
  lang: string
): Promise<Record<string, string>> {
  const wikiApi = new WikipediaApi();
  return wikiApi
    .redirects()
    .query(lang, {
      titles: titles.map((it) => it.replace(/\s+/g, "_")).join("|"),
      redirects: "yes"
    })
    .then((apiResults) => {
      const result: Record<string, string> = {};
      apiResults.forEach((r) => {
        if (r.redirects?.length) {
          const it = r.redirects.find((it) => titles.includes(it));
          if (it && it !== r.title) result[it] = r.title;
        }
      });

      return result;
    });
}
