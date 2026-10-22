/**
 * Load SciOly Concepts/*.json into taxonomy_topics + taxonomy_concepts.
 * Writes supabase/.temp/import_concepts.sql. Does not touch events that
 * already have a pack in JSON Concepts/ (anatomy, chem lab, water quality).
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'SciOly Concepts')
const OUT = path.join(ROOT, 'supabase', '.temp', 'import_concepts.sql')

function q(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`
}

function textArray(tags) {
  const list = Array.isArray(tags) ? tags.map((tag) => String(tag)) : []
  if (list.length === 0) return `'{}'::text[]`
  return `ARRAY[${list.map(q).join(', ')}]::text[]`
}

const files = fs.readdirSync(SRC).filter((name) => name.endsWith('.json'))
const packs = files.map((name) =>
  JSON.parse(fs.readFileSync(path.join(SRC, name), 'utf8')),
)

const eventIds = []
const topicIds = []
const statements = []

for (const pack of packs) {
  const eventId = String(pack.event_id)
  eventIds.push(eventId)
  const scope = pack.official_scope ?? pack.official_2027_scope ?? null
  if (scope) {
    statements.push(
      `UPDATE public.taxonomy_events SET official_scope = ${q(scope)} WHERE id = ${q(eventId)} AND (official_scope IS NULL OR btrim(official_scope) = '');`,
    )
  }
  for (const topic of pack.topics ?? []) {
    const topicId = String(topic.topic_id)
    topicIds.push(topicId)
    const sort = Number(topic.display_order ?? topic.sort ?? 0)
    statements.push(
      `INSERT INTO public.taxonomy_topics (id, event_id, name, sort_order) VALUES (${q(topicId)}, ${q(eventId)}, ${q(topic.title ?? topic.name ?? topicId)}, ${Number.isFinite(sort) ? sort : 0}) ON CONFLICT (id) DO UPDATE SET event_id = EXCLUDED.event_id, name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;`,
    )
    for (const [index, concept] of (topic.concepts ?? []).entries()) {
      statements.push(
        `INSERT INTO public.taxonomy_concepts (id, event_id, topic_id, name, description, depth_tags, sort_order) VALUES (${q(concept.concept_id)}, ${q(eventId)}, ${q(topicId)}, ${q(concept.title ?? concept.name ?? concept.concept_id)}, ${q(concept.description ?? '')}, ${textArray(concept.depth_tags)}, ${index}) ON CONFLICT (id) DO UPDATE SET event_id = EXCLUDED.event_id, topic_id = EXCLUDED.topic_id, name = EXCLUDED.name, description = EXCLUDED.description, depth_tags = EXCLUDED.depth_tags, sort_order = EXCLUDED.sort_order;`,
      )
    }
  }
}

const eventList = eventIds.map(q).join(', ')
const topicList = topicIds.map(q).join(', ')

const sql = `-- Generated from SciOly Concepts/*.json
BEGIN;
${statements.join('\n')}
DELETE FROM public.taxonomy_topics t
WHERE t.event_id IN (${eventList})
  AND t.id NOT IN (${topicList})
  AND NOT EXISTS (SELECT 1 FROM public.questions q WHERE q.topic_id = t.id)
  AND NOT EXISTS (SELECT 1 FROM public.taxonomy_concepts c WHERE c.topic_id = t.id);
COMMIT;

SELECT event_id, count(*)::int AS concepts
FROM public.taxonomy_concepts
WHERE event_id IN (${eventList})
GROUP BY event_id
ORDER BY event_id;
`

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, sql)
console.log(
  `wrote ${statements.length} statements for ${eventIds.length} events, ${topicIds.length} topics`,
)
