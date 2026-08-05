import { supabase } from './supabase'

export type CatalogEvent = {
  id: string
  name: string
  division: 'B' | 'C'
  domain: string
  test_component: string
  studyable: boolean
  season: number
  active: boolean
  official_scope: string | null
}

export type CatalogTopic = {
  id: string
  event_id: string
  name: string
  sort_order: number
}

export type CatalogConcept = {
  id: string
  event_id: string
  topic_id: string
  name: string
  description: string
  depth_tags: string[]
  sort_order: number
}

export type ConceptGuide = {
  concept_id: string
  read_body: string
  see_html: string | null
  status: 'draft' | 'live'
  do_prompt: string
  do_options: Record<string, string>
  do_correct_key: 'A' | 'B' | 'C' | null
  updated_at: string
}

export type Coverage = {
  concept_id: string
  live_count: number
  draft_count: number
  archived_count: number
}

export type PromptPack = {
  id: string
  scope_type: 'master' | 'event' | 'topic'
  scope_id: string | null
  name: string
  system_body: string
  few_shots: unknown[]
  active: boolean
  version: number
  updated_at: string
}

export type EventMedia = {
  id: string
  event_id: string
  label: string
  source_url: string | null
  storage_path: string | null
  tags: string[]
  notes: string
  active: boolean
  created_at: string
  updated_at: string
}

export type CatalogSnapshot = {
  events: CatalogEvent[]
  topics: CatalogTopic[]
  concepts: CatalogConcept[]
  guides: ConceptGuide[]
  coverage: Coverage[]
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

export async function fetchCatalogSnapshot(): Promise<CatalogSnapshot> {
  const db = requireSupabase()
  const [events, topics, concepts, guides, coverage] = await Promise.all([
    db
      .from('taxonomy_events')
      .select(
        'id, name, division, domain, test_component, studyable, season, active, official_scope',
      )
      .order('name'),
    db
      .from('taxonomy_topics')
      .select('id, event_id, name, sort_order')
      .order('sort_order'),
    db
      .from('taxonomy_concepts')
      .select(
        'id, event_id, topic_id, name, description, depth_tags, sort_order',
      )
      .order('sort_order'),
    db
      .from('concept_guides')
      .select(
        'concept_id, read_body, see_html, status, do_prompt, do_options, do_correct_key, updated_at',
      ),
    db.rpc('admin_question_coverage'),
  ])

  for (const result of [events, topics, concepts, guides, coverage]) {
    if (result.error) throw result.error
  }

  return {
    events: (events.data ?? []) as CatalogEvent[],
    topics: (topics.data ?? []) as CatalogTopic[],
    concepts: (concepts.data ?? []) as CatalogConcept[],
    guides: (guides.data ?? []) as ConceptGuide[],
    coverage: ((coverage.data ?? []) as Array<Record<string, unknown>>).map(
      (row) => ({
        concept_id: row.concept_id as string,
        live_count: Number(row.live_count ?? 0),
        draft_count: Number(row.draft_count ?? 0),
        archived_count: Number(row.archived_count ?? 0),
      }),
    ),
  }
}

export async function updateEventStudyable(id: string, studyable: boolean) {
  const { error } = await requireSupabase()
    .from('taxonomy_events')
    .update({ studyable })
    .eq('id', id)
  if (error) throw error
}

export async function updateConcept(input: {
  id: string
  description: string
  depthTags: string[]
}) {
  const { error } = await requireSupabase()
    .from('taxonomy_concepts')
    .update({
      description: input.description.trim(),
      depth_tags: input.depthTags,
    })
    .eq('id', input.id)
  if (error) throw error
}

export async function saveConceptGuide(
  guide: Omit<ConceptGuide, 'updated_at'>,
) {
  const { error } = await requireSupabase().from('concept_guides').upsert(
    {
      ...guide,
      read_body: guide.read_body.trim(),
      see_html: guide.see_html?.trim() || null,
      do_prompt: guide.do_prompt.trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'concept_id' },
  )
  if (error) throw error
}

export async function fetchPromptPacks(): Promise<PromptPack[]> {
  const { data, error } = await requireSupabase()
    .from('prompt_packs')
    .select(
      'id, scope_type, scope_id, name, system_body, few_shots, active, version, updated_at',
    )
    .order('scope_type')
    .order('name')
  if (error) throw error
  return (data ?? []) as PromptPack[]
}

export async function ensurePromptPack(input: {
  scopeType: 'event' | 'topic'
  scopeId: string
  name: string
}): Promise<string> {
  const id = `${input.scopeType}:${input.scopeId}`
  const { error } = await requireSupabase().from('prompt_packs').upsert(
    {
      id,
      scope_type: input.scopeType,
      scope_id: input.scopeId,
      name: input.name,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  )
  if (error) throw error
  return id
}

export async function savePromptPack(input: {
  id: string
  name: string
  systemBody: string
  fewShots: unknown[]
  active: boolean
  version: number
  userId: string
}) {
  const { error } = await requireSupabase()
    .from('prompt_packs')
    .update({
      name: input.name.trim(),
      system_body: input.systemBody,
      few_shots: input.fewShots,
      active: input.active,
      version: input.version + 1,
      updated_by: input.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
  if (error) throw error
}

export async function fetchEventMedia(): Promise<EventMedia[]> {
  const { data, error } = await requireSupabase()
    .from('event_media')
    .select(
      'id, event_id, label, source_url, storage_path, tags, notes, active, created_at, updated_at',
    )
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as EventMedia[]
}

export async function addEventMedia(input: {
  eventId: string
  label: string
  sourceUrl: string
  tags: string[]
  notes: string
  userId: string
}) {
  const { error } = await requireSupabase().from('event_media').insert({
    event_id: input.eventId,
    label: input.label.trim(),
    source_url: input.sourceUrl.trim(),
    tags: input.tags,
    notes: input.notes.trim(),
    created_by: input.userId,
  })
  if (error) throw error
}

export async function setEventMediaActive(id: string, active: boolean) {
  const { error } = await requireSupabase()
    .from('event_media')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteEventMedia(id: string) {
  const { error } = await requireSupabase()
    .from('event_media')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export function parseCommaTags(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ]
}
