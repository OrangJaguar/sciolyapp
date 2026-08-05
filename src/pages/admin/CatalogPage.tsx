import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCatalogSnapshot } from '../../lib/adminCatalog'
import { adminErrorMessage } from '../../lib/adminQuestions'
import { isSupabaseConfigured } from '../../lib/supabase'
import { CatalogCurriculum } from './CatalogCurriculum'
import { MediaStudio } from './MediaStudio'
import { PromptStudio } from './PromptStudio'

type CatalogView = 'curriculum' | 'prompts' | 'media'

const views: Array<{
  id: CatalogView
  label: string
  detail: string
}> = [
  { id: 'curriculum', label: 'Curriculum', detail: 'Taxonomy + Clinic guides' },
  { id: 'prompts', label: 'Prompt packs', detail: 'Master + event + topic' },
  { id: 'media', label: 'Event media', detail: 'Reusable image references' },
]

export function CatalogPage() {
  const [view, setView] = useState<CatalogView>('curriculum')
  const catalogQuery = useQuery({
    queryKey: ['admin-catalog'],
    queryFn: fetchCatalogSnapshot,
    enabled: isSupabaseConfigured,
  })

  if (!isSupabaseConfigured) {
    return (
      <div className="hud-panel flex h-full items-center justify-center p-6 text-sm text-muted">
        Configure Supabase to use Catalog Studio.
      </div>
    )
  }

  if (catalogQuery.isLoading) {
    return (
      <div className="hud-panel flex h-full items-center justify-center p-6 text-sm text-muted">
        Loading catalog…
      </div>
    )
  }

  if (catalogQuery.isError || !catalogQuery.data) {
    return (
      <div className="hud-panel flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-alert">
          {adminErrorMessage(catalogQuery.error)}
        </p>
        <p className="text-xs text-dim">
          Run SCIOLY-0805-ADMIN-CATALOG SQL, then reload.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 flex-wrap gap-1.5">
        {views.map((item) => (
          <button
            key={item.id}
            type="button"
            title={item.detail}
            onClick={() => setView(item.id)}
            className={`hud-pill px-2.5 py-1 text-[10px] ${
              view === item.id ? 'hud-pill-active' : ''
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {view === 'curriculum' ? (
          <CatalogCurriculum snapshot={catalogQuery.data} />
        ) : null}
        {view === 'prompts' ? (
          <PromptStudio snapshot={catalogQuery.data} />
        ) : null}
        {view === 'media' ? (
          <MediaStudio events={catalogQuery.data.events} />
        ) : null}
      </div>
    </div>
  )
}
