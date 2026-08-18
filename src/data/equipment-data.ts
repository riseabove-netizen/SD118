// Static equipment data (make, model, S/N, capacities, service manuals)
// shown as a small "Equipment data" card at the top of each maintenance
// detail page. Keyed by MaintenanceSystem.id.
//
// Data sourced from the MY Rise Above technical binder and the SD118
// SANLORENZO handover manual.

export interface EquipmentDataRow {
  label: string
  value: string
}

export interface EquipmentDataEntry {
  title: string       // shown in the header, e.g. "Cat C32 ACERT"
  rows: EquipmentDataRow[]
  manualUrl?: string
  manualLabel?: string
}

export const EQUIPMENT_DATA: Record<string, EquipmentDataEntry> = {
  'main-engine-port': {
    title: 'Caterpillar C32 ACERT — Port',
    rows: [
      { label: 'Serial number', value: 'RPM01202' },
      { label: 'Engine family', value: 'C32P16001' },
      { label: 'Crankcase oil', value: '85 L / 90 qt' },
      { label: 'Coolant (engine + expansion)', value: '79 L / 83.5 qt' },
    ],
    manualUrl: 'https://drive.google.com/file/d/1e5WDgb3HVKIgCmXx1xRKDxvqgQWONo-H/view?usp=sharing',
    manualLabel: 'C32 ACERT Operation & Maintenance Manual',
  },
  'main-engine-starboard': {
    title: 'Caterpillar C32 ACERT — Starboard',
    rows: [
      { label: 'Serial number', value: 'RPM01203' },
      { label: 'Engine family', value: 'C32P16001' },
      { label: 'Crankcase oil', value: '85 L / 90 qt' },
      { label: 'Coolant (engine + expansion)', value: '79 L / 83.5 qt' },
    ],
    manualUrl: 'https://drive.google.com/file/d/1e5WDgb3HVKIgCmXx1xRKDxvqgQWONo-H/view?usp=sharing',
    manualLabel: 'C32 ACERT Operation & Maintenance Manual',
  },
  'generator-port': {
    title: 'Kohler 70EFOZDJ — Port',
    rows: [
      { label: 'Model', value: '70EFOZDJ' },
      { label: 'Oil capacity', value: '18 L · 15W-40' },
      { label: 'Output', value: '230 / 400 V · 3-ph · 50 Hz · 126 A' },
      { label: 'Battery', value: '24 V' },
    ],
  },
  'generator-starboard': {
    title: 'Kohler 70EFOZDJ — Starboard',
    rows: [
      { label: 'Model', value: '70EFOZDJ' },
      { label: 'Oil capacity', value: '18 L · 15W-40' },
      { label: 'Output', value: '230 / 400 V · 3-ph · 50 Hz · 126 A' },
      { label: 'Battery', value: '24 V' },
    ],
  },
  'hamann': {
    title: 'Hamann HL-Cont Compact — Sewage treatment',
    rows: [
      { label: 'Model', value: 'HL-Cont Compact 0125' },
      { label: 'Serial number', value: '11722' },
    ],
  },
}
