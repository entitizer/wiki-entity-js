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

### getEntities(params, options?): Promise<WikiEntities>

Gets entities from wikidata and wikipedia.

#### params

Required. `ids` or `titles` require. Params properties:

- **ids** :*string* - wikidata ids separated by a `|`;
- **titles** :*string* - wikipedia article titles separated by a `|`;
- **language** :*string* - language of `titles` param and of the result object info; default: `en`
- **props** :*string* - entity props to get. Can by: `sitelinks`|`aliases`|`labels`|`descriptions`|`claims`|`datatype`;

#### options

Optional. Properties:

- **claims** :*string* - can be: `none`, `all`, `item`, `property`. Default: `all`.
