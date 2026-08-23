import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchCatalogSnapshot } from '../../lib/adminCatalog'
import { adminErrorMessage } from '../../lib/adminQuestions'
import { isSupabaseConfigured } from '../../lib/supabase'
import { CatalogCurriculum } from './CatalogCurriculum'
import { MediaStudio } from './MediaStudio'
import { PromptStudio } from './PromptStudio'

type CatalogView = 'curriculum' | 'prompts' | 'media'

function parseView(raw: string | null): CatalogView {
  if (raw === 'prompts' || raw === 'media') return raw
  return 'curriculum'
}

export function CatalogPage() {
  const [params] = useSearchParams()
  const view = parseView(params.get('v'))
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
        Loading…
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
    <div className="h-full min-h-0 overflow-hidden">
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
  )
}
