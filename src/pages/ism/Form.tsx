import React, { useEffect, useState } from 'react'
import { useLocation, useParams } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { getFormById, ISMForm, FormItem, ExtraFieldGroup } from '@/data/forms-catalog'
import { saveIsmForm } from '@/lib/api'
import { getCrewName } from '@/lib/auth'
import { formatDate, formatTime } from '@/lib/utils'
import { useGeolocation } from '@/lib/useGeolocation'
import { VESSEL } from '@/lib/vessel'
import { useMutation } from '@tanstack/react-query'

function ChecklistItem({ item, checked, onChange }: {
  item: FormItem
  checked: boolean
  onChange: (id: string, checked: boolean) => void
}) {
  if (item.isGroup && item.noCheckbox) {
    return (
      <div className={`
        pt-4 pb-1
        ${item.indent === 1 ? 'pl-6' : item.indent === 2 ? 'pl-12' : ''}
      `}>
        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{item.label}</span>
      </div>
    )
  }

  return (
    <Checkbox
      id={item.id}
      label={item.label}
      checked={checked}
      onChange={e => onChange(item.id, e.target.checked)}
      indent={item.indent ?? 0}
    />
  )
}

interface EmergencyHeaderFields {
  yachtName: string
  callSign: string
  officialNumber: string
  mmsi: string
  dateOfIncident: string
  time: string
  location: string
  weather: string
  typeOfIncident: string
  personsInvolved: string
  injuriesSustained: string
  damageToVessel: string
}

function ExtraFieldsGroup({ group, values, onChange }: {
  group: ExtraFieldGroup
  values: Record<string, string>
  onChange: (key: string, val: string) => void
}) {
  return (
    <div className="space-y-3 p-4 rounded-xl border border-border bg-card">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{group.title}</h3>
      <div className="space-y-3">
        {group.fields.map(f => (
          <div key={f.key} className="space-y-1">
            <Label htmlFor={`ef-${f.key}`} className="text-xs">
              {f.label}{f.unit ? ` [${f.unit}]` : ''}
            </Label>
            {f.type === 'textarea' ? (
              <Textarea
                id={`ef-${f.key}`}
                value={values[f.key] || ''}
                onChange={e => onChange(f.key, e.target.value)}
                placeholder={f.placeholder || ''}
              />
            ) : (
              <Input
                id={`ef-${f.key}`}
                type={f.type === 'coordinates' ? 'text' : f.type}
                inputMode={f.type === 'number' ? 'decimal' : undefined}
                value={values[f.key] || ''}
                onChange={e => onChange(f.key, e.target.value)}
                placeholder={f.placeholder || '—'}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function EmergencyHeader({ fields, onChange }: {
  fields: EmergencyHeaderFields
  onChange: (key: keyof EmergencyHeaderFields, val: string) => void
}) {
  const headerFields: { key: keyof EmergencyHeaderFields; label: string; type?: string; readOnly?: boolean }[] = [
    { key: 'yachtName', label: 'Yacht Name', readOnly: true },
    { key: 'callSign', label: 'Call Sign', readOnly: true },
    { key: 'officialNumber', label: 'Official Number', readOnly: true },
    { key: 'mmsi', label: 'MMSI', readOnly: true },
    { key: 'dateOfIncident', label: 'Date of Incident', type: 'date' },
    { key: 'time', label: 'Time', type: 'time' },
    { key: 'location', label: 'Location (GPS)', type: 'text' },
    { key: 'weather', label: 'Weather', type: 'text' },
    { key: 'typeOfIncident', label: 'Type of Incident', type: 'text' },
    { key: 'personsInvolved', label: 'Persons Involved', type: 'text' },
    { key: 'injuriesSustained', label: 'Injuries Sustained', type: 'text' },
    { key: 'damageToVessel', label: 'Damage to Vessel', type: 'text' },
  ]

  return (
    <div className="space-y-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5">
      <h3 className="text-sm font-semibold text-destructive uppercase tracking-wider">Incident Report</h3>
      {headerFields.map(f => (
        <div key={f.key} className="space-y-1">
          <Label htmlFor={`hdr-${f.key}`} className="text-xs">{f.label}</Label>
          <Input
            id={`hdr-${f.key}`}
            type={f.type || 'text'}
            value={fields[f.key]}
            onChange={e => onChange(f.key, e.target.value)}
            readOnly={f.readOnly}
            className={f.readOnly ? 'opacity-60' : ''}
          />
        </div>
      ))}
    </div>
  )
}

function SpecificIncidents({ form, selectedCol, onColChange, colChecks, onCheckChange }: {
  form: ISMForm
  selectedCol: string
  onColChange: (col: string) => void
  colChecks: Record<string, boolean>
  onCheckChange: (id: string, val: boolean) => void
}) {
  if (!form.specificIncidents) return null
  const { columns } = form.specificIncidents
  const selected = columns.find(c => c.label === selectedCol)

  return (
    <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">For Specific Incidents</h3>

      {/* Radio buttons for incident type */}
      <div className="flex flex-wrap gap-2">
        {columns.map(col => (
          <button
            key={col.label}
            onClick={() => onColChange(col.label)}
            className={`
              px-3 py-2 rounded-lg text-sm font-medium border transition-colors
              ${selectedCol === col.label
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-secondary text-foreground border-border hover:bg-secondary/80'
              }
            `}
            type="button"
          >
            {col.label}
          </button>
        ))}
      </div>

      {/* Checklist for selected incident type */}
      {selected && (
        <div className="space-y-1">
          {selected.rows.map((row, i) => {
            const id = `specific-${selectedCol}-${i}`
            return (
              <Checkbox
                key={id}
                id={id}
                label={row}
                checked={!!colChecks[id]}
                onChange={e => onCheckChange(id, e.target.checked)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function EmergencyBroadcastForm({ form, checks, onCheck }: {
  form: ISMForm
  checks: Record<string, boolean>
  onCheck: (id: string, val: boolean) => void
}) {
  if (!form.sections) return null
  return (
    <div className="space-y-6">
      {form.sections.map(section => (
        <div key={section.sectionLabel} className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">
            {section.sectionLabel}
          </h3>
          {section.items.map(item => (
            <Checkbox
              key={item.id}
              id={item.id}
              label={item.label}
              checked={!!checks[item.id]}
              onChange={e => onCheck(item.id, e.target.checked)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function IsmFormPage() {
  const [, setLocation] = useLocation()
  const params = useParams<{ formId: string }>()
  const formId = params.formId

  const form = getFormById(formId)

  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [emergencyHeader, setEmergencyHeader] = useState<EmergencyHeaderFields>({
    yachtName: VESSEL.name,
    callSign: VESSEL.callSign,
    officialNumber: VESSEL.officialNumber,
    mmsi: VESSEL.mmsi,
    dateOfIncident: formatDate(new Date()),
    time: formatTime(new Date()),
    location: '',
    weather: '',
    typeOfIncident: '',
    personsInvolved: '',
    injuriesSustained: '',
    damageToVessel: '',
  })
  const [notes, setNotes] = useState('')
  const [extraValues, setExtraValues] = useState<Record<string, string>>({})
  const [specificCol, setSpecificCol] = useState(() =>
    form?.specificIncidents?.columns[0]?.label || ''
  )
  const [specificChecks, setSpecificChecks] = useState<Record<string, boolean>>({})

  const geo = useGeolocation()

  // Auto-fill GPS into emergency Location and any extraField marked autoFillGps / coordinates
  useEffect(() => {
    if (!geo.formatted) return
    if (form?.formType === 'emergency') {
      setEmergencyHeader(prev => (prev.location ? prev : { ...prev, location: geo.formatted }))
    }
    if (form?.extraFields) {
      const gpsKeys = form.extraFields.flatMap(g =>
        g.fields.filter(f => f.autoFillGps || f.type === 'coordinates').map(f => f.key)
      )
      if (gpsKeys.length > 0) {
        setExtraValues(prev => {
          const next = { ...prev }
          for (const k of gpsKeys) if (!next[k]) next[k] = geo.formatted
          return next
        })
      }
    }
  }, [geo.formatted, form?.formType, form?.formId])

  const crewName = getCrewName() || ''

  const mutation = useMutation({
    mutationFn: async () => {
      const fields: Record<string, unknown> = {
        ...checks,
        ...extraValues,
        notes,
        ...(form?.formType === 'emergency' ? { ...emergencyHeader, selectedIncidentType: specificCol, specificIncidentChecks: specificChecks } : {}),
        signerName: crewName,
      }
      return saveIsmForm({
        formId: formId,
        formName: form?.formName || formId,
        formType: form?.formType || 'operating',
        submittedAt: new Date().toISOString(),
        signerName: crewName,
        fields,
      })
    },
    onSuccess: data => {
      sessionStorage.setItem(`ism-submission-${data.id}`, JSON.stringify({
        formId,
        formName: form?.formName,
        formType: form?.formType,
        submittedAt: new Date().toISOString(),
        signerName: crewName,
        checks,
        extraValues,
        notes,
        emergencyHeader,
        specificCol,
        specificChecks,
        id: data.id,
      }))
      setLocation(`/ism/preview/${data.id}`)
    },
  })

  if (!form) {
    return (
      <MenuLayout title="Form Not Found" showBack backHref="/ism">
        <p className="text-muted-foreground">Form "{formId}" not found.</p>
      </MenuLayout>
    )
  }

  const toggleCheck = (id: string, val: boolean) =>
    setChecks(prev => ({ ...prev, [id]: val }))

  const toggleSpecific = (id: string, val: boolean) =>
    setSpecificChecks(prev => ({ ...prev, [id]: val }))

  const checkedCount = Object.values(checks).filter(Boolean).length
  const checkableItems = form.items.filter(i => !i.noCheckbox).length +
    (form.sections ? form.sections.reduce((a, s) => a + s.items.length, 0) : 0)

  const backHref = `/ism/${form.formType}`

  return (
    <MenuLayout title={form.formName} showBack backHref={backHref}>
      <div className="space-y-6 pb-8">
        {/* Form header */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{form.category}</p>
              <h2 className="text-xl font-bold mt-0.5">{form.formName}</h2>
            </div>
            {checkableItems > 0 && (
              <div className="flex-shrink-0 text-right">
                <span className="text-2xl font-bold text-primary">{checkedCount}</span>
                <span className="text-muted-foreground text-sm">/{checkableItems}</span>
              </div>
            )}
          </div>
          {form.headerNote && (
            <p className="text-sm text-muted-foreground mt-2 italic">{form.headerNote}</p>
          )}
        </div>

        {/* SOUND EMERGENCY ALARM banner */}
        {form.alarmBanner && (
          <div className="alarm-banner">
            🚨 SOUND EMERGENCY ALARM 🚨
          </div>
        )}

        {/* Emergency incident header */}
        {form.formType === 'emergency' && (
          <EmergencyHeader
            fields={emergencyHeader}
            onChange={(key, val) => setEmergencyHeader(prev => ({ ...prev, [key]: val }))}
          />
        )}

        {/* Extra structured fields (top) */}
        {form.extraFields
          ?.filter(g => g.position !== 'bottom')
          .map(group => (
            <ExtraFieldsGroup
              key={group.title}
              group={group}
              values={extraValues}
              onChange={(k, v) => setExtraValues(prev => ({ ...prev, [k]: v }))}
            />
          ))}

        {/* Emergency broadcast special form */}
        {form.formId === 'emergency-broadcast' && (
          <EmergencyBroadcastForm
            form={form}
            checks={checks}
            onCheck={toggleCheck}
          />
        )}

        {/* Standard checklist items */}
        {form.items.length > 0 && (
          <div className="space-y-1">
            {form.items.map(item => (
              <ChecklistItem
                key={item.id}
                item={item}
                checked={!!checks[item.id]}
                onChange={toggleCheck}
              />
            ))}
          </div>
        )}

        {/* Extra structured fields (bottom) */}
        {form.extraFields
          ?.filter(g => g.position === 'bottom')
          .map(group => (
            <ExtraFieldsGroup
              key={group.title}
              group={group}
              values={extraValues}
              onChange={(k, v) => setExtraValues(prev => ({ ...prev, [k]: v }))}
            />
          ))}

        {/* Specific incidents sub-table */}
        {form.specificIncidents && (
          <SpecificIncidents
            form={form}
            selectedCol={specificCol}
            onColChange={setSpecificCol}
            colChecks={specificChecks}
            onCheckChange={toggleSpecific}
          />
        )}

        {/* Signature */}
        <div className="space-y-2 p-4 rounded-xl border border-border bg-card">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Signature</h3>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Signed by</Label>
              <p className="text-base font-medium mt-0.5">{crewName || 'Not set'}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Date</Label>
              <p className="text-sm mt-0.5">{formatDate(new Date())}</p>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Additional notes…"
            className="min-h-[80px]"
          />
        </div>

        {mutation.isError && (
          <p className="text-sm text-destructive">
            {mutation.error instanceof Error ? mutation.error.message : 'Save failed. Please try again.'}
          </p>
        )}

        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="w-full h-14 text-base"
        >
          {mutation.isPending ? 'Saving…' : 'Save Form'}
        </Button>
      </div>
    </MenuLayout>
  )
}