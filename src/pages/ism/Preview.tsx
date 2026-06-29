import React, { useEffect, useState } from 'react'
import { useLocation, useParams } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'

interface SubmissionData {
  formId: string
  formName: string
  formType: string
  submittedAt: string
  signerName: string
  checks: Record<string, boolean>
  extraValues?: Record<string, string>
  notes: string
  emergencyHeader?: Record<string, string>
  specificCol?: string
  id: string
  pdfUrl?: string
  pdfError?: string
}

export function IsmPreviewPage() {
  const [, setLocation] = useLocation()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [submission, setSubmission] = useState<SubmissionData | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem(`ism-submission-${id}`)
    if (raw) {
      try {
        setSubmission(JSON.parse(raw) as SubmissionData)
      } catch {
        // ignore
      }
    }
  }, [id])

  if (!submission) {
    return (
      <MenuLayout title="Submission" showBack backHref="/ism">
        <div className="py-16 text-center space-y-4">
          <p className="text-muted-foreground">Loading submission…</p>
          <Button variant="outline" onClick={() => setLocation('/ism')}>
            Back to ISM
          </Button>
        </div>
      </MenuLayout>
    )
  }

  const checkedItems = Object.entries(submission.checks)
    .filter(([, v]) => v)
    .map(([k]) => k)

  const submittedAt = new Date(submission.submittedAt)

  return (
    <MenuLayout title="Submission Preview" showBack backHref="/ism">
      <div className="space-y-6 pb-8">
        {/* Success banner */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 border border-primary/20">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-primary">Form Saved</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Recorded in ISM_Log tab · ID: {id.slice(0, 8)}…
            </p>
          </div>
        </div>

        {/* PDF link */}
        {submission.pdfUrl ? (
          <a
            href={submission.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 p-4 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-primary">Open PDF in Google Drive</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{submission.pdfUrl}</p>
            </div>
          </a>
        ) : submission.pdfError ? (
          <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-sm text-destructive">
            <p className="font-semibold">PDF upload failed</p>
            <p className="text-xs mt-1">{submission.pdfError}</p>
            <p className="text-xs mt-1 text-muted-foreground">Form was still saved — you can retry by re-submitting.</p>
          </div>
        ) : null}

        {/* Summary */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold">{submission.formName}</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-card border border-border">
              <p className="text-xs text-muted-foreground">Signed by</p>
              <p className="font-medium mt-0.5">{submission.signerName}</p>
            </div>
            <div className="p-3 rounded-lg bg-card border border-border">
              <p className="text-xs text-muted-foreground">Submitted</p>
              <p className="font-medium mt-0.5">
                {submittedAt.toLocaleDateString()}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-card border border-border">
              <p className="text-xs text-muted-foreground">Time</p>
              <p className="font-medium mt-0.5">
                {submittedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-card border border-border">
              <p className="text-xs text-muted-foreground">Category</p>
              <p className="font-medium mt-0.5 capitalize">{submission.formType}</p>
            </div>
          </div>

          {/* Emergency header data */}
          {submission.emergencyHeader && Object.keys(submission.emergencyHeader).length > 0 && (
            <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 space-y-2">
              <h3 className="text-sm font-semibold text-destructive uppercase tracking-wider">Incident Details</h3>
              {Object.entries(submission.emergencyHeader).map(([k, v]) => v ? (
                <div key={k} className="flex justify-between text-sm gap-2">
                  <span className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}:</span>
                  <span className="text-right font-medium">{v}</span>
                </div>
              ) : null)}
            </div>
          )}

          {/* Extra fields */}
          {submission.extraValues && Object.keys(submission.extraValues).length > 0 && (
            <div className="p-4 rounded-xl border border-border bg-card space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Details</h3>
              {Object.entries(submission.extraValues).map(([k, v]) => v ? (
                <div key={k} className="flex justify-between text-sm gap-2">
                  <span className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}:</span>
                  <span className="text-right font-medium">{v}</span>
                </div>
              ) : null)}
            </div>
          )}

          {/* Checked items count */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Checklist — {checkedItems.length} items confirmed
            </h3>
            {checkedItems.length === 0 && (
              <p className="text-sm text-muted-foreground">No items checked.</p>
            )}
          </div>

          {/* Notes */}
          {submission.notes && (
            <div className="p-4 rounded-xl border border-border bg-card space-y-1">
              <h3 className="text-xs text-muted-foreground uppercase tracking-wider">Notes</h3>
              <p className="text-sm">{submission.notes}</p>
            </div>
          )}

          {/* Submission ID */}
          <p className="text-xs text-muted-foreground font-mono">Submission ID: {id}</p>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            onClick={() => setLocation(`/ism/form/${submission.formId}`)}
            className="w-full h-12"
          >
            Fill Another
          </Button>
          <Button
            onClick={() => setLocation('/ism')}
            className="w-full h-12"
          >
            Back to ISM
          </Button>
        </div>
      </div>
    </MenuLayout>
  )
}