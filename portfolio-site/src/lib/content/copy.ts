/**
 * Approved copy, looked up by id at render time.
 *
 * Components never contain an approved sentence as a literal. They ask for
 * `home.works.h2` and get whatever the registry currently holds — which the
 * approved-copy gate has already proven is the string the user approved.
 *
 * A missing id throws rather than rendering an empty heading: a silently blank
 * h2 is how an approval registry drifts out of use without anyone noticing.
 */
import { getCollection } from 'astro:content';

let cache: Map<string, string> | null = null;

export async function copyMap(): Promise<Map<string, string>> {
  if (!cache) {
    const entries = await getCollection('copy');
    cache = new Map(entries.map((e) => [e.data.id, e.data.text]));
  }
  return cache;
}

export async function copyText(id: string): Promise<string> {
  const text = (await copyMap()).get(id);
  if (text === undefined) {
    throw new Error(`copy registry に ${id} が無い（src/content/copy/shipping.json）`);
  }
  return text;
}
