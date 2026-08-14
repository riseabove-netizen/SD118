// Purchase List — items queued for restock, with a bulk "transfer to storage"
// action so the user can mark them received and place them into a chosen
// engine-room location.

import React, { useEffect, useMemo, useState } from 'react'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { getCrewName } from '@/lib/auth'
import {
  fetchPurchaseList,
  removeFromPurchaseList,
  moveToStorage,
  type PurchaseItem,
} from '@/lib/purchase-list-api'
import { SPARE_LOCATIONS, SPARE_SUB_LOCATIONS } from '@/lib/inventory'
import { exportPurchaseListPDF } from '@/lib/purchase-list-pdf'

// A small manual add form so items can be typed in without going through
// the maintenance flow.
function ManualAddRow({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState('')
  const [partNumber, setPartNumber] = useState('')
  const [qty, setQty] = useState('1')
  const [saving, setSaving] = useState(false)

  async function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      const { addToPurchaseList } = await import('@/lib/purchase-list-api')
      await addToPurchaseList(
        [{ name: trimmed, partNumber: partNumber.trim() || undefined, qty: Number(qty) || 1 }],
        { addedBy: getCrewName() || '' }
      )
      setName(''); setPartNumber(''); setQty('1')
      onAdded()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <div className="text-sm font-semibold">Add item manually</div>
      <div className="grid grid-cols-12 gap-2">
        <input
          className="col-span-6 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          placeholder="Item name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <input
          className="col-span-4 rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono"
          placeholder="Part #"
          value={partNumber}
          onChange={e => setPartNumber(e.target.value)}
        />
        <input
          className="col-span-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          type="number"
          min={1}
          value={qty}
          onChange={e => setQty(e.target.value)}
        />
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={saving || !name.trim()}>
          {saving ? 'Adding…' : '+ Add'}
        </Button>
      </div>
    </div>
  )
}

interface TransferModalProps {
  count: number
  onCancel(): void
  onConfirm(loc: string, subLoc: string, notes: string, incrementStock: boolean): Promise<void>
}

function TransferModal({ count, onCancel, onConfirm }: TransferModalProps) {
  const [location, setLocation] = useState('Engine Room')
  const [subLocation, setSubLocation] = useState('')
  const [customSub, setCustomSub] = useState('')
  const [notes, setNotes] = useState('')
  const [incrementStock, setIncrementStock] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setSaving(true); setError('')
    try {
      const finalSub = subLocation === '__custom__' ? customSub.trim() : subLocation
      await onConfirm(location.trim(), finalSub, notes.trim(), incrementStock)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Transfer to storage</div>
            <div className="text-xs text-muted-foreground">
              {count} {count === 1 ? 'item' : 'items'} · mark received & assign a location
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium">Location</label>
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={location}
            onChange={e => setLocation(e.target.value)}
          >
            {SPARE_LOCATIONS.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium">Sub-location (bin / locker)</label>
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={subLocation}
            onChange={e => setSubLocation(e.target.value)}
          >
            <option value="">— select bin —</option>
            {SPARE_SUB_LOCATIONS.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
            <option value="__custom__">Custom…</option>
          </select>
          {subLocation === '__custom__' && (
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Enter sub-location"
              value={customSub}
              onChange={e => setCustomSub(e.target.value)}
            />
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium">Notes (optional)</label>
          <textarea
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="e.g. Received from Palma chandlery on Aug 14"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={incrementStock}
            onChange={e => setIncrementStock(e.target.checked)}
          />
          Also increase the inventory stock for items linked to an existing row
        </label>

        {error && <div className="text-xs text-red-500">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            className="px-4 py-2 rounded-md border border-border text-sm"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <Button onClick={submit} disabled={saving || !location.trim()}>
            {saving ? 'Transferring…' : 'Transfer'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function PurchaseListPage() {
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showTransfer, setShowTransfer] = useState(false)
  const [filter, setFilter] = useState<'open' | 'received' | 'all'>('open')

  async function reload() {
    setLoading(true)
    setError('')
    try {
      const data = await fetchPurchaseList()
      setItems(data)
      // Keep selection only for still-existing ids
      setSelected(prev => new Set([...prev].filter(id => data.some(d => d.Id === id))))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [])

  const visible = useMemo(() => {
    return items.filter(it => {
      const status = (it.Status || 'open').toLowerCase()
      if (filter === 'open') return status === 'open'
      if (filter === 'received') return status === 'received'
      return true
    }).sort((a, b) => {
      // newest first
      return (b.AddedAt || '').localeCompare(a.AddedAt || '')
    })
  }, [items, filter])

  const openCount = items.filter(i => (i.Status || 'open').toLowerCase() === 'open').length
  const receivedCount = items.length - openCount

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllVisible() {
    const openVisibleIds = visible
      .filter(v => (v.Status || 'open').toLowerCase() === 'open')
      .map(v => v.Id)
    const allSelected = openVisibleIds.length > 0 && openVisibleIds.every(id => selected.has(id))
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) openVisibleIds.forEach(id => next.delete(id))
      else openVisibleIds.forEach(id => next.add(id))
      return next
    })
  }

  async function handleRemove() {
    if (selected.size === 0) return
    if (!confirm(`Remove ${selected.size} item${selected.size === 1 ? '' : 's'} from the list?`)) return
    try {
      await removeFromPurchaseList([...selected])
      setSelected(new Set())
      reload()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  async function handleTransfer(loc: string, sub: string, notes: string, incrementStock: boolean) {
    await moveToStorage([...selected], loc, {
      subLocation: sub,
      notes,
      incrementStock,
      receivedBy: getCrewName() || '',
    })
    setSelected(new Set())
    setShowTransfer(false)
    reload()
  }

  async function handleExport() {
    if (selected.size === 0) return
    const rows = items.filter(it => selected.has(it.Id))
    if (rows.length === 0) return
    try {
      await exportPurchaseListPDF(rows, { preparedBy: getCrewName() || '' })
    } catch (e) {
      alert('PDF export failed: ' + (e as Error).message)
    }
  }

  return (
    <MenuLayout title="Purchase List" showBack backHref="/inventory">
      <div className="space-y-3">
        <ManualAddRow onAdded={reload} />

        <div className="flex gap-2 items-center">
          <div className="flex gap-1 rounded-full border border-border bg-secondary p-0.5 text-xs">
            <button
              onClick={() => setFilter('open')}
              className={`px-3 py-1 rounded-full ${filter === 'open' ? 'bg-primary text-primary-foreground' : ''}`}
            >
              Open ({openCount})
            </button>
            <button
              onClick={() => setFilter('received')}
              className={`px-3 py-1 rounded-full ${filter === 'received' ? 'bg-primary text-primary-foreground' : ''}`}
            >
              Received ({receivedCount})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-full ${filter === 'all' ? 'bg-primary text-primary-foreground' : ''}`}
            >
              All
            </button>
          </div>
          <div className="flex-1" />
          <button
            onClick={reload}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {selected.size > 0 && (
          <div className="rounded-xl border border-primary/60 bg-primary/5 p-3 flex items-center gap-2 flex-wrap">
            <div className="text-sm font-medium flex-1 min-w-0">
              {selected.size} selected
            </div>
            <button
              className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-secondary"
              onClick={handleExport}
            >
              Export PDF
            </button>
            <button
              className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-secondary"
              onClick={handleRemove}
            >
              Remove
            </button>
            <Button size="sm" onClick={() => setShowTransfer(true)}>
              Transfer to storage
            </Button>
          </div>
        )}

        {visible.some(v => (v.Status || 'open').toLowerCase() === 'open') && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pl-1">
            <button
              onClick={toggleAllVisible}
              className="underline hover:text-foreground"
            >
              Select all open
            </button>
            {selected.size === 0 && (
              <>
                <span>·</span>
                <span>Select items to export or transfer</span>
              </>
            )}
          </div>
        )}

        {error && (
          <div className="text-red-500 text-sm p-3 rounded-lg border border-red-900/40 bg-red-950/30">
            {error}
          </div>
        )}

        <div className="space-y-2">
          {visible.map(it => {
            const status = (it.Status || 'open').toLowerCase()
            const isReceived = status === 'received'
            const checked = selected.has(it.Id)
            return (
              <label
                key={it.Id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  checked
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card'
                } ${isReceived ? 'opacity-60' : ''}`}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 accent-primary"
                  checked={checked}
                  disabled={isReceived}
                  onChange={() => toggle(it.Id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-base font-medium truncate">{it.Name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {it.PartNumber ? `P/N ${it.PartNumber} · ` : ''}
                    Qty {it.Qty || 1}
                    {it.SourceEventId ? ` · from ${it.SourceEventId}` : ''}
                  </div>
                  {isReceived && (
                    <div className="text-xs text-emerald-400 mt-0.5">
                      ✓ Received · {it.StorageLocation}
                      {it.SubLocation ? ` / ${it.SubLocation}` : ''}
                    </div>
                  )}
                  {it.Notes && (
                    <div className="text-xs text-muted-foreground italic mt-0.5 truncate">
                      {it.Notes}
                    </div>
                  )}
                </div>
              </label>
            )
          })}
          {!loading && visible.length === 0 && (
            <div className="text-muted-foreground text-sm text-center py-8">
              {filter === 'open'
                ? 'Nothing to buy right now. Items used in maintenance can be added from that flow.'
                : filter === 'received'
                  ? 'No received items yet.'
                  : 'Purchase list is empty.'}
            </div>
          )}
        </div>
      </div>

      {showTransfer && (
        <TransferModal
          count={selected.size}
          onCancel={() => setShowTransfer(false)}
          onConfirm={handleTransfer}
        />
      )}
    </MenuLayout>
  )
}
