import { getCollection, type CollectionEntry } from 'astro:content';
import { SUBJECTS, subjectByKey, type SubjectKey } from './subjects';

export type Chapter = CollectionEntry<'chapters'>;

export const subjectOf = (c: Chapter) => c.id.split('/')[0] as SubjectKey;
export const slugOf = (c: Chapter) => c.id.split('/').slice(1).join('/').replace(/^\d+-/, '');

export async function allChapters() {
  const all = await getCollection('chapters');
  return all.sort((a, b) => {
    const sa = SUBJECTS.findIndex((s) => s.key === subjectOf(a));
    const sb = SUBJECTS.findIndex((s) => s.key === subjectOf(b));
    return sa - sb || a.data.order - b.data.order;
  });
}

export async function chaptersFor(key: SubjectKey) {
  return (await allChapters()).filter((c) => subjectOf(c) === key);
}

/** Group a subject's chapters by part, in the part order declared on the subject. */
export function groupByPart(key: SubjectKey, list: Chapter[]) {
  const parts = subjectByKey[key].parts;
  const groups = parts.map((p) => ({ part: p, chapters: list.filter((c) => c.data.part === p) }));
  const stray = list.filter((c) => !parts.includes(c.data.part));
  if (stray.length) groups.push({ part: 'More', chapters: stray });
  return groups.filter((g) => g.chapters.length);
}
