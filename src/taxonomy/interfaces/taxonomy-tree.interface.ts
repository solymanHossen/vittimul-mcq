/**
 * Shape returned by `GET /taxonomy/tree`. Capped at two Topic levels
 * (top-level topics + their direct sub-topics) — matches the depth
 * `TaxonomyService.createTopic`/`updateTopic` enforce when assigning
 * `parentId`, so every topic that can exist is represented here.
 */
export interface TaxonomyTreeSubTopic {
  id: number;
  name: string;
  slug: string;
  displayOrder: number;
}

export interface TaxonomyTreeTopic extends TaxonomyTreeSubTopic {
  subTopics: TaxonomyTreeSubTopic[];
}

export interface TaxonomyTreeSubject {
  id: number;
  name: string;
  slug: string;
  code: string | null;
  iconUrl: string | null;
  displayOrder: number;
  topics: TaxonomyTreeTopic[];
}

export interface TaxonomyTreeCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  displayOrder: number;
  subjects: TaxonomyTreeSubject[];
}
