import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'
import GuideSectionEditor from '@/components/guide/GuideSectionEditor'
import type { GuideSection, Profile } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

marked.setOptions({ gfm: true, breaks: true })

function renderMarkdown(content: string): string {
  const raw = marked(content) as string
  return sanitizeHtml(raw, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
    allowedAttributes: { a: ['href', 'name', 'target'], '*': ['class'] },
    allowedSchemes: ['http', 'https', 'mailto'],
  })
}

export default async function GuidePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileRaw } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const profile = profileRaw as Pick<Profile, 'role'> | null
  const isAdmin = profile?.role === 'HR_ADMIN'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sectionsRaw } = await (supabase as any)
    .from('guide_sections')
    .select('*')
    .order('sort_order')
  const sections = (sectionsRaw ?? []) as GuideSection[]

  return (
    <div className="flex gap-8 items-start max-w-5xl">

      {/* Sticky sidebar nav */}
      {sections.length > 0 && (
        <aside className="hidden lg:block w-52 shrink-0 sticky top-6">
          <p className="text-kicker mb-3 px-2">Contents</p>
          <nav className="space-y-0.5">
            {sections.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.slug}`}
                className="flex items-center gap-2.5 rounded-[var(--radius-lr)] px-2 py-1.5 text-sm text-lr-muted hover:text-lr-text hover:bg-lr-surface transition-colors group"
              >
                <span className="text-xs text-lr-accent font-mono w-4 shrink-0 opacity-60 group-hover:opacity-100">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {s.title}
              </a>
            ))}
          </nav>
          {isAdmin && (
            <p className="text-xs text-lr-accent mt-4 px-2 leading-relaxed">
              Click <strong>Edit</strong> on any section to update content.
            </p>
          )}
        </aside>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Page header */}
        <div className="pb-2 border-b border-lr-border">
          <h1 className="text-page-title">Framework Guide</h1>
          <p className="text-body text-lr-muted mt-1">
            The BCOMM performance framework — your reference for check-ins, Goals, scoring, and values.
          </p>
        </div>

        {/* Mobile tab nav */}
        {sections.length > 0 && (
          <nav className="flex flex-wrap gap-2 lg:hidden">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.slug}`}
                className="text-xs rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface px-3 py-1.5 text-lr-muted hover:text-lr-text hover:bg-lr-surface-2 transition-colors"
              >
                {s.title}
              </a>
            ))}
          </nav>
        )}

        {sections.length === 0 && (
          <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass p-12 text-center">
            <p className="text-body text-lr-muted">No guide sections found.</p>
          </div>
        )}

        {sections.map((section) => {
          const html = renderMarkdown(section.content)
          return (
            <article
              key={section.id}
              id={section.slug}
              className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] shadow-[var(--shadow-lr-card)] scroll-mt-6 overflow-hidden"
            >
              {/* Section header bar */}
              <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-lr-border bg-lr-surface/50">
                <h2 className="text-card-title">{section.title}</h2>
                {isAdmin && <GuideSectionEditor section={section} />}
              </div>

              {/* Rendered markdown */}
              <div className="px-6 py-5">
                <div
                  className="
                    prose prose-slate prose-sm max-w-none
                    prose-headings:font-semibold prose-headings:tracking-tight
                    prose-h1:text-lg prose-h1:text-lr-text prose-h1:mb-3 prose-h1:mt-0
                    prose-h2:text-base prose-h2:text-lr-text prose-h2:mb-2 prose-h2:mt-5
                    prose-h3:text-sm prose-h3:text-lr-text prose-h3:mb-1.5 prose-h3:mt-4
                    prose-p:text-lr-text prose-p:leading-relaxed prose-p:my-2
                    prose-li:text-lr-text prose-li:leading-relaxed prose-li:my-0.5
                    prose-ul:my-2 prose-ol:my-2
                    prose-strong:text-lr-text prose-strong:font-semibold
                    prose-em:text-lr-muted
                    prose-a:text-lr-accent prose-a:no-underline hover:prose-a:underline
                    prose-table:text-sm prose-table:w-full
                    prose-th:text-lr-muted prose-th:font-medium prose-th:text-left prose-th:pb-2 prose-th:border-b prose-th:border-lr-border
                    prose-td:text-lr-text prose-td:py-2 prose-td:border-b prose-td:border-lr-border/50
                    prose-blockquote:border-l-2 prose-blockquote:border-lr-accent prose-blockquote:pl-4 prose-blockquote:text-lr-muted prose-blockquote:not-italic prose-blockquote:my-4
                    prose-hr:border-lr-border prose-hr:my-4
                    prose-code:text-lr-cyan prose-code:bg-lr-surface prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
                    [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                  "
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
