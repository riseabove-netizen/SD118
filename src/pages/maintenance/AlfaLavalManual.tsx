// Alfa Laval MIB 303 — onboard operation manual.
// URL: /maintenance/alfa-laval/manual
//
// Condensed from the MIB 303 system manual, chapters 2 (Operation) and
// 5 (Maintenance). Figures are the original manual illustrations.

import React from 'react'
import { MenuLayout } from '@/components/MenuLayout'

const IMG = '/maintenance/alfa-laval'

function Section({ id, num, title, children }: { id: string; num: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="rounded-xl border border-border bg-card p-4 space-y-3 scroll-mt-20">
      <h2 className="flex items-baseline gap-2 text-base font-semibold">
        <span className="text-red-400 font-mono text-sm">{num}</span>
        <span>{title}</span>
      </h2>
      {children}
    </section>
  )
}

function Callout({ kind, children }: { kind: 'warning' | 'caution' | 'note'; children: React.ReactNode }) {
  const style = {
    warning: 'border-red-500/60 bg-red-500/10 text-red-200',
    caution: 'border-amber-500/60 bg-amber-500/10 text-amber-100',
    note: 'border-border bg-background/40 text-muted-foreground',
  }[kind]
  const label = { warning: '⚠ Warning', caution: '⚠ Caution', note: 'ℹ Note' }[kind]
  return (
    <div className={`rounded-lg border-l-4 border px-3 py-2 text-xs leading-relaxed ${style}`}>
      <div className="text-[10px] uppercase tracking-wider font-bold mb-0.5">{label}</div>
      {children}
    </div>
  )
}

function Figure({ src, alt, caption, narrow }: { src: string; alt: string; caption?: string; narrow?: boolean }) {
  return (
    <figure className={`mx-auto ${narrow ? 'max-w-[260px]' : 'max-w-md'}`}>
      <div className="rounded-md overflow-hidden border border-border/60 bg-white">
        <img src={src} alt={alt} className="w-full h-auto" loading="lazy" />
      </div>
      {caption && <figcaption className="text-[11px] text-muted-foreground text-center mt-1">{caption}</figcaption>}
    </figure>
  )
}

// Numbering restarts per <Steps> block; `start` continues a sequence
// that was interrupted by a figure.
function Steps({ children, start = 1 }: { children: React.ReactNode; start?: number }) {
  const items = React.Children.toArray(children)
  return (
    <ol className="space-y-2 text-sm leading-relaxed">
      {items.map((child, i) => (
        <li key={i} className="flex gap-3">
          <span className="shrink-0 mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white text-[11px] font-bold">
            {start + i}
          </span>
          <div className="min-w-0 text-foreground/90">{child}</div>
        </li>
      ))}
    </ol>
  )
}

function Step({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

const TOC = [
  ['checklist', '2.1', 'Checklist before start-up'],
  ['start', '2.2', 'Start-up'],
  ['during', '2.3', 'Checks during operation'],
  ['stop', '2.4', 'Stop'],
  ['sludge', '2.5', 'Sludge removal'],
  ['emergency', '2.6', 'Emergency stop'],
  ['after-emergency', '2.7', 'After an emergency stop'],
  ['maintenance', '5', 'Maintenance schedule'],
]

export function AlfaLavalManualPage() {
  return (
    <MenuLayout title="MIB 303 · Operation manual" showBack backHref="/maintenance/calendar/alfa-laval-mib303">
      <div className="space-y-5">
        {/* Header */}
        <div className="rounded-xl border border-red-500/40 bg-gradient-to-br from-red-500/10 to-transparent p-4 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-red-300 font-semibold">Alfa Laval · Fuel separator</div>
          <div className="text-xl font-bold">MIB 303 Operation Manual</div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Onboard quick reference for starting, running, stopping and servicing the MIB 303 separator.
            Condensed from the Alfa Laval system manual (59999580).
          </p>
        </div>

        {/* TOC */}
        <nav className="rounded-xl border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 px-1">Contents</div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {TOC.map(([id, n, l]) => (
              <li key={id}>
                <a href={`#${id}`} className="flex gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-secondary">
                  <span className="font-mono text-red-400 w-7">{n}</span>
                  <span>{l}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <Section id="checklist" num="2.1" title="Checklist before start-up">
          <Callout kind="warning">
            The separator is fitted with a safety yoke and a magnetic safety switch. Any modification that disables
            them can cause serious injury and damage to the equipment.
          </Callout>
          <Figure
            src={`${IMG}/separator-safety.jpg`}
            alt="Separator top: 1 paring disc knob, 2 safety yoke, 3 magnet, 4 magnetic safety switch"
            caption="1 Paring disc knob · 2 Safety yoke · 3 Magnet · 4 Magnetic safety switch"
            narrow
          />
          <Steps>
            <Step>Make sure the separator has been reassembled and reconnected correctly.</Step>
            <Step>
              Check that the correct level ring is fitted:
              <div className="mt-2 rounded-md border border-border/60 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-background/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="text-left px-3 py-1.5">Fuel / oil</th>
                      <th className="text-left px-3 py-1.5">Level ring</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td className="px-3 py-1.5 border-t border-border/40">Gas oil only</td><td className="px-3 py-1.5 border-t border-border/40 font-semibold">White · 43 mm hole</td></tr>
                    <tr><td className="px-3 py-1.5 border-t border-border/40">Marine diesel oil / lube oil</td><td className="px-3 py-1.5 border-t border-border/40 font-semibold">Black · 50 mm hole</td></tr>
                    <tr><td className="px-3 py-1.5 border-t border-border/40">Alternating MDO and gas oil</td><td className="px-3 py-1.5 border-t border-border/40 font-semibold">Black · 50 mm hole</td></tr>
                  </tbody>
                </table>
              </div>
            </Step>
            <Step>Hood screws and the paring disc knob are firmly tightened, and the safety yoke is closed (vertical).</Step>
            <Step>Valves on the suction and delivery sides are open.</Step>
            <Step>
              After installation, and after every dismantling and assembly, fill the pump with oil before starting.
              The pump is self-priming — you will hear the sound change once the suction line is primed.
            </Step>
          </Steps>
        </Section>

        <Section id="start" num="2.2" title="Start-up">
          <Figure
            src={`${IMG}/main-switch-start.jpg`}
            alt="Main switch turned to 1 ON and start knob turned to 1"
            caption="Main switch to 1 ON · start knobs to 1"
          />
          <Steps>
            <Step>Turn the black/red main switch on the control cabinet to <b>1 ON</b>.</Step>
            <Step>Turn both start knobs to <b>1</b> to power up the control system.</Step>
            <Step>
              <span className="text-[10px] uppercase tracking-wider font-bold text-red-300 mr-1">Purifying only</span>
              Close the funnel's bottom valve and fill the funnel with water. When the separator is at full speed,
              connect the funnel to the quick coupling on the separator oil inlet and open the bottom valve — this
              establishes the water seal. Close the funnel valve and remove the funnel.
            </Step>
          </Steps>
          <Figure
            src={`${IMG}/water-seal-funnel.jpg`}
            alt="Filling the funnel with water and connecting it to the separator oil inlet"
            caption="Water seal — fill funnel, connect to oil inlet quick coupling"
          />
          <Steps start={4}>
            <Step>Turn the pump Start/Stop knob to Start and hold for <b>15 seconds</b>. The pump is primed when the pump indicator lights.</Step>
            <Step>Turn the separating Start/Stop knob to <b>Start</b>. The starting lamp lights and the separator reaches full speed after about <b>20 seconds</b>.</Step>
          </Steps>
          <Figure
            src={`${IMG}/separating-start.jpg`}
            alt="Separating start knob turned to START"
            caption="Separating Start/Stop knob to Start"
          />
          <Steps start={6}>
            <Step>
              Set the counter-pressure in the oil outlet line to <b>50–100 kPa (0.5–1.0 bar)</b>.
            </Step>
            <Step>
              After 60 seconds, check that no oil is leaving through the water outlet to the collecting tank.
              If it is, see Trouble Shooting in the system manual.
            </Step>
          </Steps>
          <Callout kind="note">Separation temperature: see Technical Data in the system manual.</Callout>
        </Section>

        <Section id="during" num="2.3" title="Checks during operation">
          <ul className="text-sm space-y-1.5 list-disc pl-5 text-foreground/90">
            <li>Confirm correct operation — especially on the first runs after installation or dismantling.</li>
            <li>Check all connections for leaks.</li>
            <li>Check the collecting-tank level at regular intervals.</li>
          </ul>
          <Callout kind="caution">Slip hazard — clean up any oil spills immediately.</Callout>
        </Section>

        <Section id="stop" num="2.4" title="Stop">
          <Steps>
            <Step>Stop the feed pump — pump Start/Stop knob to <b>0</b>.</Step>
            <Step>
              Stop the separator — separating Start/Stop knob to <b>0</b>. It comes to rest within two minutes;
              confirm standstill through the front hatch with a torch. About 1 L of oil and water drains to the
              collecting tank as the bowl stops.
            </Step>
            <Step>Turn the main switch to <b>0 OFF</b>.</Step>
            <Step>Close the feed and outlet valves — otherwise oil can leak or overflow.</Step>
          </Steps>
        </Section>

        <Section id="sludge" num="2.5" title="Sludge removal">
          <p className="text-sm text-foreground/90 leading-relaxed">
            Sludge collects inside the bowl and must be cleaned out at regular intervals, depending on the solids
            content of the fuel. <b>Never exceed 72 operating hours (3 days)</b> between cleanings — see 5.1.
          </p>
        </Section>

        <Section id="emergency" num="2.6" title="Emergency stop">
          <div className="rounded-lg border border-red-500/60 bg-red-600/15 p-3 text-sm font-semibold text-red-100">
            Stop the separator and the oil feed pump immediately.
          </div>
        </Section>

        <Section id="after-emergency" num="2.7" title="After an emergency stop">
          <div className="grid grid-cols-2 gap-3">
            <Figure src={`${IMG}/lockout.jpg`} alt="Main switch locked in the off position" caption="Lock out power" />
            <Figure src={`${IMG}/standstill.jpg`} alt="Wait for complete standstill before using tools" caption="Wait for standstill" />
          </div>
          <Steps>
            <Step>Remedy the cause before restarting. If the cause can't be found, carry out a major service and check all moving parts.</Step>
            <Step>Lock out the power before any dismantling. Consult the separator manual and alarm list.</Step>
            <Step>Do not dismantle until the separator has come to a <b>complete standstill</b>.</Step>
            <Step>Reassemble with all covers and guards in place before unlocking the power.</Step>
          </Steps>
          <Callout kind="caution">Entrapment hazard — never reach into the separator while any part is moving.</Callout>
        </Section>

        <Section id="maintenance" num="5" title="Maintenance schedule">
          <Callout kind="warning">
            Entrapment hazard. Lock out the power and make sure the separator is at a complete standstill before
            starting any dismantling.
          </Callout>
          <div className="rounded-md border border-border/60 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-background/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-3 py-1.5">Interval</th>
                  <th className="text-left px-3 py-1.5">Task</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2 border-t border-border/40 font-semibold text-red-300 align-top whitespace-nowrap">≤ 72 op h</td>
                  <td className="px-3 py-2 border-t border-border/40">
                    <b>5.1 Cleaning.</b> Remove sludge from the bowl manually. Interval depends on flow and sludge load,
                    but never more than 72 operating hours (3 days). See 5.4.2 Cleaning of bowl in the system manual.
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border-t border-border/40 font-semibold text-red-300 align-top whitespace-nowrap">Yearly</td>
                  <td className="px-3 py-2 border-t border-border/40">
                    <b>5.2 O-rings and discs.</b> Replace all O-rings from the O-ring service kit and lubricate with the
                    supplied silicone grease. Check disc condition; replace if necessary.
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border-t border-border/40 font-semibold text-red-300 align-top whitespace-nowrap">Every 2 years</td>
                  <td className="px-3 py-2 border-t border-border/40">
                    <b>5.3.1 Disc stack.</b> New disc stack every two years at a separation temperature of 60 °C or
                    below. Above 60 °C, replace every year or at any sign of brittleness. Supplied as a set.
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border-t border-border/40 font-semibold text-red-300 align-top whitespace-nowrap">Every 2 years</td>
                  <td className="px-3 py-2 border-t border-border/40">
                    <b>5.3.2 Vibration dampers.</b> Fit new vibration dampers and inspect the stop flanges; replace
                    the flanges if damaged. Supplied as a set.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <Callout kind="note">Never use cleaning agents with a pH below 6 or above 9.</Callout>
        </Section>
      </div>
    </MenuLayout>
  )
}
