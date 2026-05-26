'use client'

import { useState } from 'react'
import { Upload, Sparkles, Save, ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { extractReviewWithLLM, saveHistoricalReview, type ExtractedReview } from '@/lib/actions/historical-review-actions'

const SOURCES = [
  { value: 'notion', label: 'Notion' },
  { value: 'hibob', label: 'HiBob' },
  { value: 'fathom', label: 'Fathom' },
  { value: 'manual', label: 'Manual notes' },
  { value: 'other', label: 'Other' },
]

function ScoreInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-lr-muted">{label}</label>
      <input
        type="number"
        min="1"
        max="5"
        step="0.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
        className="w-full rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface/60 px-3 py-2.5 text-sm text-lr-text placeholder:text-lr-muted/40 focus:outline-none focus:border-lr-accent/60 transition-colors"
      />
    </div>
  )
}

export default function AddHistoricalReviewSheet({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'paste' | 'review'>('paste')
  const [rawText, setRawText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [periodLabel, setPeriodLabel] = useState('')
  const [source, setSource] = useState('')
  const [pm, setPm] = useState('')
  const [okrs, setOkrs] = useState('')
  const [bv, setBv] = useState('')
  const [summary, setSummary] = useState('')

  function applyExtracted(e: ExtractedReview) {
    setPeriodLabel(e.period_label ?? '')
    setSource(e.source ?? '')
    setPm(e.professional_mastery != null ? String(e.professional_mastery) : '')
    setOkrs(e.okrs_stretch_goals != null ? String(e.okrs_stretch_goals) : '')
    setBv(e.behaviours_values != null ? String(e.behaviours_values) : '')
    setSummary(e.summary ?? '')
  }

  function resetForm() {
    setStep('paste')
    setRawText('')
    setExtractError(null)
    setSaveError(null)
    setPeriodLabel('')
    setSource('')
    setPm('')
    setOkrs('')
    setBv('')
    setSummary('')
  }

  async function handleExtract() {
    if (!rawText.trim()) return
    setExtracting(true)
    setExtractError(null)
    const { data, error } = await extractReviewWithLLM(rawText)
    setExtracting(false)
    if (error || !data) {
      setExtractError(error ?? 'Extraction failed')
      setStep('review')
      return
    }
    applyExtracted(data)
    setStep('review')
  }

  async function handleSave() {
    if (!periodLabel.trim()) { setSaveError('Period label is required'); return }
    setSaving(true)
    setSaveError(null)
    const { error } = await saveHistoricalReview({
      employeeId,
      periodLabel: periodLabel.trim(),
      source,
      professionalMastery: pm ? parseFloat(pm) : null,
      okrsStretchGoals: okrs ? parseFloat(okrs) : null,
      behavioursValues: bv ? parseFloat(bv) : null,
      summary: summary.trim(),
      rawImport: rawText,
    })
    setSaving(false)
    if (error) { setSaveError(error); return }
    setOpen(false)
    resetForm()
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-lr-border text-lr-text hover:bg-lr-surface text-sm"
        >
          <Upload className="h-4 w-4" />
          Import review
        </Button>
      </SheetTrigger>

      {/* Wide sheet — enough room for two-column layout on review step */}
      <SheetContent className="w-full sm:max-w-4xl bg-lr-bg border-lr-border flex flex-col gap-0 p-0">
        <SheetHeader className="px-8 pt-6 pb-4 border-b border-lr-border shrink-0">
          <div>
            <SheetTitle className="text-lr-text text-base font-semibold">
              {step === 'paste' ? 'Import historical review' : 'Review & save'}
            </SheetTitle>
            <p className="text-xs text-lr-muted mt-0.5">{employeeName}</p>
          </div>

          {/* Step indicator + back button */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              {(['paste', 'review'] as const).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <div className="w-8 h-px bg-lr-border" />}
                  <div className={[
                    'flex items-center gap-1.5 text-xs font-medium',
                    step === s ? 'text-lr-accent' : step === 'review' && s === 'paste' ? 'text-lr-muted/50' : 'text-lr-muted',
                  ].join(' ')}>
                    <span className={[
                      'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                      step === s ? 'bg-lr-accent text-white' : step === 'review' && s === 'paste' ? 'bg-lr-surface text-lr-muted/40' : 'bg-lr-surface text-lr-muted',
                    ].join(' ')}>
                      {step === 'review' && s === 'paste' ? '✓' : i + 1}
                    </span>
                    {s === 'paste' ? 'Paste notes' : 'Review & edit'}
                  </div>
                </div>
              ))}
            </div>
            {step === 'review' && (
              <button
                type="button"
                onClick={() => setStep('paste')}
                className="flex items-center gap-1.5 text-xs text-lr-muted hover:text-lr-text transition-colors border border-lr-border rounded-[var(--radius-lr)] px-3 py-1.5 hover:bg-lr-surface"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to paste
              </button>
            )}
          </div>
        </SheetHeader>

        {/* ── STEP 1: PASTE ── */}
        {step === 'paste' && (
          <div className="flex-1 flex flex-col px-8 py-6 gap-5 overflow-y-auto">
            <div className="space-y-2">
              <p className="text-sm text-lr-muted">
                Paste raw notes from Notion, HiBob, Fathom, or any other source. AI will extract the period, scores, and a summary — you can edit everything before saving.
              </p>
            </div>

            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste meeting notes, performance summary, or any review content here…"
              className="flex-1 min-h-[320px] w-full rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface/60 px-5 py-4 text-sm text-lr-text placeholder:text-lr-muted/40 focus:outline-none focus:border-lr-accent/50 resize-none leading-relaxed transition-colors"
            />

            <div className="flex gap-3">
              <Button
                onClick={handleExtract}
                disabled={!rawText.trim() || extracting}
                className="flex-1 bg-lr-accent hover:bg-lr-accent/90 text-white gap-2 h-11"
              >
                {extracting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Extracting with AI…</>
                ) : (
                  <><Sparkles className="h-4 w-4" />Extract with AI <span className="text-xs opacity-60 font-normal">(beta)</span></>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep('review')}
                className="border-lr-border text-lr-muted hover:bg-lr-surface h-11 px-5"
              >
                Fill manually
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: REVIEW (two-column) ── */}
        {step === 'review' && (
          <div className="flex-1 flex min-h-0">
            {/* Left: raw notes (read-only reference) */}
            {rawText && (
              <div className="w-2/5 shrink-0 border-r border-lr-border flex flex-col">
                <div className="px-5 py-3 border-b border-lr-border shrink-0">
                  <p className="text-xs font-semibold text-lr-muted uppercase tracking-wide">Original notes</p>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <p className="text-xs text-lr-muted leading-relaxed whitespace-pre-wrap">{rawText}</p>
                </div>
              </div>
            )}

            {/* Right: editable form */}
            <div className={['flex-1 flex flex-col overflow-y-auto', rawText ? '' : 'w-full'].join(' ')}>
              <div className="px-6 py-6 space-y-5">
                {extractError && (
                  <div className="rounded-[var(--radius-lr)] border border-lr-error/20 bg-lr-error/10 px-4 py-3">
                    <p className="text-xs text-lr-error">{extractError} — fill in the fields below manually.</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-lr-muted">
                    Period label <span className="text-lr-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={periodLabel}
                    onChange={(e) => setPeriodLabel(e.target.value)}
                    placeholder="e.g. Q2 2024 or H1 2023"
                    className="w-full rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface/60 px-3 py-2.5 text-sm text-lr-text placeholder:text-lr-muted/40 focus:outline-none focus:border-lr-accent/60 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-lr-muted">Source</label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface/60 px-3 py-2.5 text-sm text-lr-text focus:outline-none focus:border-lr-accent/60 transition-colors"
                  >
                    <option value="">Select source…</option>
                    {SOURCES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-lr-muted">Scores (1–5)</label>
                    <span className="text-[10px] text-lr-muted/50">Leave blank if not assessable</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <ScoreInput label="Prof. Mastery" value={pm} onChange={setPm} />
                    <ScoreInput label="Goals & OKRs" value={okrs} onChange={setOkrs} />
                    <ScoreInput label="Behaviours" value={bv} onChange={setBv} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-lr-muted">Summary</label>
                  <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    rows={6}
                    placeholder="Brief summary of the review…"
                    className="w-full rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface/60 px-3 py-3 text-sm text-lr-text placeholder:text-lr-muted/40 focus:outline-none focus:border-lr-accent/60 resize-none leading-relaxed transition-colors"
                  />
                </div>

                {saveError && (
                  <div className="rounded-[var(--radius-lr)] border border-lr-error/20 bg-lr-error/10 px-4 py-3">
                    <p className="text-xs text-lr-error">{saveError}</p>
                  </div>
                )}

                <Button
                  onClick={handleSave}
                  disabled={saving || !periodLabel.trim()}
                  className="w-full bg-lr-accent hover:bg-lr-accent/90 text-white gap-2 h-11"
                >
                  {saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
                  ) : (
                    <><Save className="h-4 w-4" />Save historical review</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
