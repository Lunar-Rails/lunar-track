'use client'

import { useState } from 'react'
import { Upload, Sparkles, Save, X, Loader2 } from 'lucide-react'
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
    <div className="space-y-1">
      <label className="text-xs font-medium text-lr-muted">{label}</label>
      <input
        type="number"
        min="1"
        max="5"
        step="0.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
        className="w-full rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface px-3 py-2 text-sm text-lr-text placeholder:text-lr-muted/50 focus:outline-none focus:border-lr-accent/50"
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

  function handleSkipExtraction() {
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

      <SheetContent className="w-full sm:max-w-lg bg-lr-bg border-lr-border flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-lr-border">
          <SheetTitle className="text-lr-text text-base font-semibold">
            Import historical review
          </SheetTitle>
          <p className="text-xs text-lr-muted mt-0.5">{employeeName}</p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {step === 'paste' ? (
            <>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-lr-muted uppercase tracking-wide">
                  Paste review notes
                </label>
                <p className="text-xs text-lr-muted">
                  Paste raw notes from Notion, HiBob, Fathom, or any other source. AI will extract the key data.
                </p>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={14}
                  placeholder="Paste meeting notes, performance summary, or any review content here…"
                  className="w-full rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface px-4 py-3 text-sm text-lr-text placeholder:text-lr-muted/50 focus:outline-none focus:border-lr-accent/50 resize-none leading-relaxed"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleExtract}
                  disabled={!rawText.trim() || extracting}
                  className="flex-1 bg-lr-accent hover:bg-lr-accent/90 text-white gap-2"
                >
                  {extracting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Extracting…</>
                  ) : (
                    <><Sparkles className="h-4 w-4" />Extract with AI</>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSkipExtraction}
                  className="border-lr-border text-lr-muted hover:bg-lr-surface"
                >
                  Fill manually
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-lr-muted uppercase tracking-wide">Review extracted data</p>
                <button
                  type="button"
                  onClick={() => setStep('paste')}
                  className="text-xs text-lr-muted hover:text-lr-text transition-colors flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  Back to paste
                </button>
              </div>

              {extractError && (
                <div className="rounded-[var(--radius-lr)] border border-lr-error/20 bg-lr-error/10 px-4 py-3">
                  <p className="text-xs text-lr-error">{extractError} — fill in the fields below manually.</p>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-lr-muted">Period label <span className="text-lr-error">*</span></label>
                  <input
                    type="text"
                    value={periodLabel}
                    onChange={(e) => setPeriodLabel(e.target.value)}
                    placeholder="e.g. Q2 2024 or H1 2023"
                    className="w-full rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface px-3 py-2 text-sm text-lr-text placeholder:text-lr-muted/50 focus:outline-none focus:border-lr-accent/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-lr-muted">Source</label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface px-3 py-2 text-sm text-lr-text focus:outline-none focus:border-lr-accent/50"
                  >
                    <option value="">Select source…</option>
                    {SOURCES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <ScoreInput label="Prof. Mastery" value={pm} onChange={setPm} />
                  <ScoreInput label="Goals & OKRs" value={okrs} onChange={setOkrs} />
                  <ScoreInput label="Behaviours" value={bv} onChange={setBv} />
                </div>
                <p className="text-[10px] text-lr-muted/60">Scores 1–5. Leave blank if not assessable from the notes.</p>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-lr-muted">Summary</label>
                  <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    rows={5}
                    placeholder="Brief summary of the review…"
                    className="w-full rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface px-3 py-3 text-sm text-lr-text placeholder:text-lr-muted/50 focus:outline-none focus:border-lr-accent/50 resize-none leading-relaxed"
                  />
                </div>
              </div>

              {saveError && (
                <div className="rounded-[var(--radius-lr)] border border-lr-error/20 bg-lr-error/10 px-4 py-3">
                  <p className="text-xs text-lr-error">{saveError}</p>
                </div>
              )}

              <Button
                onClick={handleSave}
                disabled={saving || !periodLabel.trim()}
                className="w-full bg-lr-accent hover:bg-lr-accent/90 text-white gap-2"
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
                ) : (
                  <><Save className="h-4 w-4" />Save historical review</>
                )}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
