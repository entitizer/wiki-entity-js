# wiki-entity

Wiki(pedia/data) entity extractor.

## Usage

```
import { getEntities } from 'wiki-entity';

// get Europe by title
getEntities({ language: 'en', titles: 'Europe' }).then(entities => {});

// get Europe by id
getEntities({ language: 'en', ids: 'Q46' }).then(entities => {});
```

## API

### getEntities(params): Promise<WikiEntity[]>

Gets entities from wikidata and wikipedia.

#### params

Required. `ids` or `titles` require. Params properties:

- **ids** :*string* - wikidata ids separated by a `|`;
- **titles** :*string* - wikipedia article titles separated by a `|`;
- **language** :*string* - language of `titles` param and of the result object info; default: `en`
- **props** :*string* - entity props to get. Can by: `info`|`sitelinks`|`aliases`|`labels`|`descriptions`|`claims`|`datatype`;
- **claims** :*string* - How to resolve the claims. Can be: `none`, `all`, `item`, `property`. Default: `none`. `all` resolves `item` and `property` types.
- **extract** :*number* - Sentences in the extract. Default: `0`.

## WikiEntity

`WikiEntity` is a simple version of an item returned by Wikidata API. It also may include some extra properties from Wikipadia API.

```ts

type WikiEntity = {
    id: string;
    label?: string;
    description?: string;
    extract?: string;
    pageid?: number;
    aliases?: string[];
    sitelinks?: IIndexType<string>;
    claims?: IIndexType<WikidataProperty>;
}

type WikidataProperty = {
    id: string;
    label?: string;
    description?: string;
    values: WikidataPropertyValue[];
}

type WikidataPropertyValue = {
    datatype: string;
    value: any;
    pageid?: number;
    value_string?: string;
    label?: string;
    description?: string;
}

type IIndexType<T> = {
    [index: string]: T
}

```
