export type FormType = 'operating' | 'emergency'

export interface FormItem {
  id: string
  label: string
  indent?: 0 | 1 | 2
  isGroup?: boolean
  noCheckbox?: boolean
}

export interface SpecificIncidentColumn {
  label: string
  rows: string[]
}

export interface ExtraField {
  key: string
  label: string
  type: 'text' | 'number' | 'time' | 'date' | 'textarea' | 'coordinates'
  placeholder?: string
  unit?: string
  autoFillGps?: boolean
}

export interface ExtraFieldGroup {
  title: string
  position?: 'top' | 'bottom'
  fields: ExtraField[]
}

export interface ISMForm {
  formId: string
  formName: string
  formType: FormType
  category: string
  alarmBanner?: boolean
  headerNote?: string
  items: FormItem[]
  // Extra structured input fields beyond checkboxes
  extraFields?: ExtraFieldGroup[]
  specificIncidents?: {
    columns: SpecificIncidentColumn[]
  }
  // Special sections for emergency-broadcast
  sections?: {
    sectionLabel: string
    sectionDescription?: string
    items: FormItem[]
  }[]
}

export const FORMS_CATALOG: ISMForm[] = [
  // ─── OPERATING PROCEDURES ────────────────────────────────────────────────

  {
    formId: 'watchkeeping-in-port',
    formName: 'Watchkeeping in Port',
    formType: 'operating',
    category: 'Operating Procedures',
    items: [
      { id: 'wip-1', label: 'Captains instructions', indent: 0 },
      { id: 'wip-2', label: 'Mooring', indent: 0 },
      { id: 'wip-3', label: 'Passerelle/Gangway', indent: 0 },
      { id: 'wip-4', label: 'Fenders and lines', indent: 0 },
      { id: 'wip-5', label: 'Security level', indent: 0 },
      { id: 'wip-6', label: 'Weather forecast', indent: 0 },
      { id: 'wip-7', label: 'Persons on board and locations', indent: 0 },
      { id: 'wip-8', label: 'Communications equipment status', indent: 0 },
      { id: 'wip-9', label: 'Lighting status', indent: 0 },
      { id: 'wip-10', label: 'Shore power and water', indent: 0 },
      { id: 'wip-11', label: 'Other equipment status', indent: 0 },
      { id: 'wip-12', label: 'Expected visitors or movements', indent: 0 },
      { id: 'wip-13', label: 'Port/Marina protocols', indent: 0 },
    ],
  },

  {
    formId: 'watchkeeping-at-sea',
    formName: 'Watchkeeping at Sea',
    formType: 'operating',
    category: 'Operating Procedures',
    items: [
      { id: 'was-1', label: 'Navigational Status confirmed', indent: 0 },
      { id: 'was-2', label: 'Operational Status confirmed', indent: 0 },
      { id: 'was-3', label: 'Standing orders read and understood', indent: 0 },
      { id: 'was-4', label: 'Night orders read and understood', indent: 0 },
      { id: 'was-5', label: 'Security level known', indent: 0 },
      { id: 'was-6', label: 'Radar settings and autopilot', indent: 0 },
      { id: 'was-7', label: 'Traffic', indent: 0 },
      { id: 'was-8', label: 'Communications equipment status', indent: 0 },
      { id: 'was-9', label: 'Navigation light status', indent: 0 },
      { id: 'was-10', label: 'Engine status', indent: 0 },
      { id: 'was-11', label: 'Other equipment status', indent: 0 },
      { id: 'was-12', label: 'Stability/Tanks', indent: 0 },
      { id: 'was-13', label: 'Night vision – fitness to take watch', indent: 0 },
    ],
  },

  {
    formId: 'towing',
    formName: 'Towing',
    formType: 'operating',
    category: 'Operating Procedures',
    headerNote: 'Generally consider the following:',
    items: [
      { id: 'tow-1', label: 'Check Status of Vessel Seaworthiness and Damage Control', indent: 0 },
      { id: 'tow-2', label: 'Inform Insurance Company', indent: 0 },
      { id: 'tow-3', label: 'Inform Shore Support Company & Owner if Applicable', indent: 0 },
      { id: 'tow-4', label: 'Illuminate the Fore Deck', indent: 0 },
      { id: 'tow-5', label: 'Ready Towing Bridle and Quick Disconnect Coupling', indent: 0 },
      { id: 'tow-6', label: "Ready Monkey's Fist & Coil Line Neatly", indent: 0 },
      { id: 'tow-7', label: 'Establish Radio Communications with Bridge & Tow Boat & Fore Deck', indent: 0 },
      { id: 'tow-8', label: 'Ready Life Jackets and other Life Saving Gear', indent: 0 },
      { id: 'tow-9', label: 'Ready Rigging Tools including an Axe and Flashlights', indent: 0 },
      { id: 'tow-10', label: 'Steering to Neutral and Locked Position', indent: 0 },
      { id: 'tow-11', label: 'Establish Status of Hydraulic & Electrical Power', indent: 0 },
      { id: 'tow-12', label: 'Establish Safe Towing Speed with Regards to Sea State & Deck Equipment', indent: 0 },
    ],
  },

  {
    formId: 'jet-ski-pre-voyage',
    formName: 'Jet Ski Pre Voyage Checklist',
    formType: 'operating',
    category: 'Operating Procedures',
    items: [
      { id: 'jsp-0', label: 'Consider the Following:-', indent: 0, isGroup: true, noCheckbox: true },
      { id: 'jsp-1', label: 'Check Oil Level', indent: 0 },
      { id: 'jsp-2', label: 'Check Coolant Level', indent: 0 },
      { id: 'jsp-3', label: 'Check Engine', indent: 0 },
      { id: 'jsp-4', label: 'Check Bung is in place', indent: 0 },
      { id: 'jsp-5', label: 'Check Lifting Sling and Harness is in good condition', indent: 0 },
      { id: 'jsp-6', label: 'Check Safety Gear including Fire Extinguisher & Noise Making Device & Flares', indent: 0 },
      { id: 'jsp-7', label: 'Check Operator is not under the influence of Drugs or Alcohol', indent: 0 },
      { id: 'jsp-8', label: 'Check the Kill Switch and Lanyard', indent: 0 },
      { id: 'jsp-9', label: 'Check Life Vests for Condition and Fit', indent: 0 },
      { id: 'jsp-10', label: 'Ensure User is aware of Local Laws and Ordinances regarding Personal Water Craft', indent: 0 },
      { id: 'jsp-11', label: 'Check Weather Forecast and Sea Conditions', indent: 0 },
      { id: 'jsp-12', label: 'Agree Communications Procedures (VHF, UHF in waterproof bag)', indent: 0 },
      { id: 'jsp-13', label: 'Supervision (If required for Persons under legal operators age or beginners)', indent: 0 },
      { id: 'jsp-14', label: 'Ensure User is aware of any speed limits.', indent: 0 },
      { id: 'jsp-15', label: 'Check Maintenance Records', indent: 0 },
      { id: 'jsp-16', label: 'Ensure User is aware of the safe distance away from the Mother Vessel', indent: 0 },
      { id: 'jsp-17', label: 'Ensure User is aware of who has Right of Way and other Rules of the Road', indent: 0 },
      { id: 'jsp-18', label: 'Check Fuel Levels', indent: 0 },
    ],
  },

  {
    formId: 'security-patrols',
    formName: 'Security Patrols',
    formType: 'operating',
    category: 'Operating Procedures',
    items: [
      { id: 'sp-1', label: 'Refer to Captains standing orders and security plan', indent: 0 },
      { id: 'sp-2', label: 'Potential security threats understood', indent: 0 },
      { id: 'sp-3', label: 'Route agreed and familiarised', indent: 0 },
      { id: 'sp-4', label: 'Patrol timings and frequency agreed', indent: 0 },
      { id: 'sp-5', label: 'Keys obtained', indent: 0 },
      { id: 'sp-6', label: 'Communications agreed', indent: 0 },
      { id: 'sp-7', label: 'EMERGENCY PROCEDURES AGREED', indent: 0 },
    ],
  },

  {
    formId: 'leaving-port',
    formName: 'Leaving Port',
    formType: 'operating',
    category: 'Operating Procedures',
    items: [
      { id: 'lp-1', label: 'ETD advised to crew, dock master and agent', indent: 0 },
      { id: 'lp-2', label: 'Crew preparation and briefing', indent: 0 },
      { id: 'lp-3', label: 'Weather forecast and tide conditions', indent: 0 },
      { id: 'lp-4', label: 'Wind speed and direction', indent: 0 },
      { id: 'lp-5', label: 'Test and Ready', indent: 0, isGroup: true, noCheckbox: true },
      { id: 'lp-5a', label: 'Steering', indent: 1 },
      { id: 'lp-5b', label: 'Engines', indent: 1 },
      { id: 'lp-5c', label: 'Bow Thrusters', indent: 1 },
      { id: 'lp-5d', label: 'Winches', indent: 1 },
      { id: 'lp-5e', label: 'Wing Stations', indent: 1 },
      { id: 'lp-6', label: 'Communications with Shore', indent: 0, isGroup: true, noCheckbox: true },
      { id: 'lp-6a', label: 'Agent', indent: 1 },
      { id: 'lp-6b', label: 'Permission', indent: 1 },
      { id: 'lp-6c', label: 'Customs and Clearance', indent: 1 },
      { id: 'lp-6d', label: 'Security', indent: 1 },
      { id: 'lp-6e', label: 'Crew and Passenger list', indent: 1 },
      { id: 'lp-6f', label: 'Practique', indent: 1 },
      { id: 'lp-7', label: 'Range and fuel on board', indent: 0 },
      { id: 'lp-8', label: 'Passage plan', indent: 0 },
      { id: 'lp-9', label: 'Stow and secure items', indent: 0 },
      { id: 'lp-10', label: 'Passerelle or gangway stowed', indent: 0 },
      { id: 'lp-11', label: 'Fenders and mooring lines stowed', indent: 0 },
      { id: 'lp-12', label: 'Notice of Departure to Authorities', indent: 0 },
    ],
  },

  {
    formId: 'entering-port',
    formName: 'Entering Port',
    formType: 'operating',
    category: 'Operating Procedures',
    items: [
      { id: 'ep-1', label: 'ETA advised to crew, dockmaster and agent', indent: 0 },
      { id: 'ep-2', label: 'Crew preparation and briefing', indent: 0 },
      { id: 'ep-3', label: 'Weather forecast and tide conditions', indent: 0 },
      { id: 'ep-4', label: 'Wind speed and direction', indent: 0 },
      { id: 'ep-5', label: 'Test and Ready', indent: 0, isGroup: true, noCheckbox: true },
      { id: 'ep-5a', label: 'Steering', indent: 1 },
      { id: 'ep-5b', label: 'Engines', indent: 1 },
      { id: 'ep-5c', label: 'Bow Thrusters', indent: 1 },
      { id: 'ep-5d', label: 'Winches', indent: 1 },
      { id: 'ep-5e', label: 'Wing Stations', indent: 1 },
      { id: 'ep-6', label: 'Communications with Shore', indent: 0, isGroup: true, noCheckbox: true },
      { id: 'ep-6a', label: 'Agent', indent: 1 },
      { id: 'ep-6b', label: 'Permission', indent: 1 },
      { id: 'ep-6c', label: 'Customs and Clearance', indent: 1 },
      { id: 'ep-6d', label: 'Security', indent: 1 },
      { id: 'ep-6e', label: 'Crew and Passenger list', indent: 1 },
      { id: 'ep-6f', label: 'Practique', indent: 1 },
      { id: 'ep-7', label: 'Clear anchors', indent: 0 },
      { id: 'ep-8', label: 'Mooring plan', indent: 0 },
      { id: 'ep-9', label: 'Power and Water requirements', indent: 0 },
      { id: 'ep-10', label: 'Passerelle or gangway prepared', indent: 0 },
      { id: 'ep-11', label: 'Fenders and mooring lines deployed', indent: 0 },
      { id: 'ep-12', label: 'Notice of Arrival to Authorities', indent: 0 },
    ],
  },

  {
    formId: 'diving',
    formName: 'Diving',
    formType: 'operating',
    category: 'Operating Procedures',
    items: [
      { id: 'div-1', label: 'Weather – current/forecast/tide/swell', indent: 0 },
      { id: 'div-2', label: 'Agree dive plan', indent: 0 },
      { id: 'div-3', label: 'Equipment checked', indent: 0 },
      { id: 'div-4', label: 'Equipment familiarisation for new users', indent: 0 },
      { id: 'div-5', label: 'Tender deployed and manned', indent: 0, isGroup: true, noCheckbox: true },
      { id: 'div-5a', label: 'Ensure sufficient fuel and supplies in tender', indent: 1 },
      { id: 'div-5b', label: 'Ensure distress flares and rescue equipment in tender', indent: 1 },
      { id: 'div-5c', label: 'Agree communications protocol with tender', indent: 1 },
      { id: 'div-6', label: 'Communications procedures agreed', indent: 0 },
      { id: 'div-7', label: 'EMERGENCY COMMUNICATIONS AGREED', indent: 0 },
      { id: 'div-8', label: 'Supervision of divers', indent: 0 },
      { id: 'div-9', label: 'Local laws and restrictions understood', indent: 0 },
      { id: 'div-10', label: 'Display required flags/lights', indent: 0 },
      { id: 'div-11', label: 'Briefing on conduct and behaviour', indent: 0 },
      { id: 'div-12', label: 'Operational briefing', indent: 0 },
      { id: 'div-13', label: 'Emergency procedure briefing', indent: 0 },
      { id: 'div-14', label: 'Disclaimers agreed and signed', indent: 0 },
    ],
  },

  {
    formId: 'bunkering',
    formName: 'Bunkering',
    formType: 'operating',
    category: 'Operating Procedures',
    items: [
      { id: 'bun-1', label: 'Assign Responsibilities', indent: 0 },
      { id: 'bun-2', label: 'Bunker Plan', indent: 0, isGroup: true, noCheckbox: true },
      { id: 'bun-2a', label: 'Quantity required', indent: 1 },
      { id: 'bun-2b', label: 'Rate of transfer', indent: 1 },
      { id: 'bun-2c', label: 'Tanks to be filled', indent: 1 },
      { id: 'bun-2d', label: 'Supervision', indent: 1 },
      { id: 'bun-2e', label: 'Communications', indent: 1 },
      { id: 'bun-3', label: 'Check condition of hoses and fittings', indent: 0 },
      { id: 'bun-4', label: 'Display required flags/lights', indent: 0 },
      { id: 'bun-5', label: 'AGREE EMERGENCY PROCEDURES WITH SHORE', indent: 0 },
      { id: 'bun-6', label: 'Ready or deploy pollution counter measures', indent: 0, isGroup: true, noCheckbox: true },
      { id: 'bun-6a', label: 'Mats', indent: 1 },
      { id: 'bun-6b', label: 'Granules', indent: 1 },
      { id: 'bun-6c', label: 'Boom', indent: 1 },
      { id: 'bun-7', label: 'Ensure no naked lights – post warning signs', indent: 0 },
      { id: 'bun-8', label: 'Fuel samples taken', indent: 0 },
      { id: 'bun-9', label: 'Oil record book completed', indent: 0 },
      { id: 'bun-10', label: 'Receipts checked and filed', indent: 0 },
    ],
    extraFields: [
      {
        title: 'Bunkering Times',
        position: 'top',
        fields: [
          { key: 'start_time', label: 'Start Time', type: 'time' },
          { key: 'end_time', label: 'End Time', type: 'time' },
        ],
      },
      {
        title: 'Fuel Levels — Before Bunkering',
        position: 'top',
        fields: [
          { key: 'daily_fuel_before', label: 'Daily Tank Before', type: 'number', unit: 'L', placeholder: 'L' },
          { key: 'aft_fuel_before', label: 'Aft Tank Before', type: 'number', unit: 'L', placeholder: 'L' },
          { key: 'fwd_fuel_before', label: 'Fwd Tank Before', type: 'number', unit: 'L', placeholder: 'L' },
        ],
      },
      {
        title: 'Fuel Levels — After Bunkering',
        position: 'bottom',
        fields: [
          { key: 'daily_fuel_after', label: 'Daily Tank After', type: 'number', unit: 'L', placeholder: 'L' },
          { key: 'aft_fuel_after', label: 'Aft Tank After', type: 'number', unit: 'L', placeholder: 'L' },
          { key: 'fwd_fuel_after', label: 'Fwd Tank After', type: 'number', unit: 'L', placeholder: 'L' },
          { key: 'total_fuel_taken', label: 'Total Fuel Taken', type: 'number', unit: 'L', placeholder: 'L' },
        ],
      },
    ],
  },

  {
    formId: 'anchoring',
    formName: 'Anchoring',
    formType: 'operating',
    category: 'Operating Procedures',
    items: [
      { id: 'anc-1', label: 'Consider the following', indent: 0, isGroup: true, noCheckbox: true },
      { id: 'anc-1a', label: 'How many shackles are required', indent: 1 },
      { id: 'anc-1b', label: 'What holding ground', indent: 1 },
      { id: 'anc-1c', label: 'Current/Depth/Tide', indent: 1 },
      { id: 'anc-1d', label: 'Other vessels in proximity', indent: 1 },
      { id: 'anc-2', label: 'Swinging circle', indent: 0 },
      { id: 'anc-3', label: 'Weather Forecast', indent: 0 },
      { id: 'anc-4', label: "Location – Check chart or pilot book warnings", indent: 0 },
      { id: 'anc-5', label: "Display 'At Anchor' signals", indent: 0 },
      { id: 'anc-6', label: 'Plan crew/passenger movements on and off yacht', indent: 0 },
      { id: 'anc-7', label: 'Agree communications procedures', indent: 0 },
      { id: 'anc-8', label: 'Toys', indent: 0, isGroup: true, noCheckbox: true },
      { id: 'anc-8a', label: 'Intended use', indent: 1 },
      { id: 'anc-8b', label: 'Supervision', indent: 1 },
      { id: 'anc-8c', label: 'Communications', indent: 1 },
      { id: 'anc-9', label: 'Tender', indent: 0, isGroup: true, noCheckbox: true },
      { id: 'anc-9a', label: 'Intended use', indent: 1 },
      { id: 'anc-9b', label: 'Designated person to remain with tender if ashore', indent: 1 },
      { id: 'anc-9c', label: 'Communications', indent: 1 },
      { id: 'anc-10', label: 'Shore Communications', indent: 0, isGroup: true, noCheckbox: true },
      { id: 'anc-10a', label: 'Shore permission/clearance', indent: 1 },
      { id: 'anc-10b', label: 'Customs', indent: 1 },
      { id: 'anc-10c', label: 'Security', indent: 1 },
      { id: 'anc-10d', label: 'Practique', indent: 1 },
      { id: 'anc-10e', label: 'Crew/Passenger list', indent: 1 },
      { id: 'anc-11', label: 'Security Watch', indent: 0 },
    ],
    extraFields: [
      {
        title: 'Anchor Position',
        position: 'top',
        fields: [
          { key: 'coordinates', label: 'Coordinates (GPS)', type: 'coordinates', autoFillGps: true },
          { key: 'depth', label: 'Depth', type: 'text', unit: 'm', placeholder: 'm' },
          { key: 'shackles_out', label: 'Shackles Out', type: 'text', placeholder: '#' },
          { key: 'holding_ground', label: 'Holding Ground', type: 'text', placeholder: 'e.g. sand, mud' },
        ],
      },
    ],
  },

  // ─── EMERGENCY PROCEDURES ────────────────────────────────────────────────

  {
    formId: 'violent-act',
    formName: 'Violent Act',
    formType: 'emergency',
    category: 'Emergency Procedures',
    alarmBanner: false,
    headerNote: 'Generally consider the following:',
    items: [
      { id: 'va-1', label: 'Attempt to diffuse incident if safely possible', indent: 0 },
      { id: 'va-2', label: 'Remove passengers away from incident if possible', indent: 0 },
      { id: 'va-3', label: 'Remove non essential crew from incident if possible', indent: 0 },
      { id: 'va-4', label: 'Retreat to secure area if possible', indent: 0 },
      { id: 'va-5', label: 'Preserve evidence', indent: 0 },
    ],
  },

  {
    formId: 'steering-failure',
    formName: 'Steering Failure',
    formType: 'emergency',
    category: 'Emergency Procedures',
    alarmBanner: false,
    items: [
      { id: 'sf-1', label: 'Determine proximity of traffic and navigational dangers', indent: 0 },
      { id: 'sf-2', label: 'Determine if emergency steering can be used', indent: 0 },
      { id: 'sf-3', label: 'Determine if yacht can be manoeuvred on the engine', indent: 0 },
      { id: 'sf-4', label: 'Request assistance from nearby vessels if possible', indent: 0 },
      { id: 'sf-5', label: 'Switch on NUC lights', indent: 0 },
      { id: 'sf-6', label: 'Identify nearest anchorages or safe havens', indent: 0 },
      { id: 'sf-7', label: 'Make anchor ready', indent: 0 },
    ],
  },

  {
    formId: 'security-breach',
    formName: 'Security Breach',
    formType: 'emergency',
    category: 'Emergency Procedures',
    alarmBanner: false,
    items: [
      { id: 'sb-1', label: 'Refer to Ship Security Plan', indent: 0 },
      { id: 'sb-2', label: 'Activate covert Ships Security Alert alarm', indent: 0 },
      { id: 'sb-3', label: 'Contact shore - other vessels - security response organisation', indent: 0 },
      { id: 'sb-4', label: 'Remove passengers away from incident if possible', indent: 0 },
      { id: 'sb-5', label: 'Retreat to secure area if possible', indent: 0 },
      { id: 'sb-6', label: 'Preserve evidence', indent: 0 },
    ],
  },

  {
    formId: 'pollution',
    formName: 'Pollution',
    formType: 'emergency',
    category: 'Emergency Procedures',
    alarmBanner: true,
    items: [
      { id: 'pol-1', label: 'Stop source of spill and close all valves', indent: 0 },
      { id: 'pol-2', label: 'Sound emergency alarm and activate response plan', indent: 0 },
      { id: 'pol-3', label: 'Reduce level of oil by transfer to empty/slack tanks', indent: 0 },
      { id: 'pol-4', label: 'Pump water into tank to create water cushion to prevent further oil spill', indent: 0 },
      { id: 'pol-5', label: 'Commence clean up procedures, deploy containment boom', indent: 0 },
      { id: 'pol-6', label: 'Assess fire risks', indent: 0 },
      { id: 'pol-7', label: 'Assess weather and tide effects on spill', indent: 0 },
      { id: 'pol-8', label: 'Make initial report as per Appendix 5 SOPEP', indent: 0 },
      { id: 'pol-9', label: 'Complete clean up', indent: 0 },
      { id: 'pol-10', label: 'Follow up reports as necessary as per Section 2.3 SOPEP', indent: 0 },
      { id: 'pol-11', label: 'Contact Company/Owners/Insurers/Flag Administration', indent: 0 },
      { id: 'pol-12', label: 'Take photographs and document steps taken to reduce pollution', indent: 0 },
    ],
    specificIncidents: {
      columns: [
        {
          label: 'Collision',
          rows: [
            'Assess possibility of further damage, capsize, sinking',
            'Check stability',
            'Request assistance',
          ],
        },
        {
          label: 'Bunkering',
          rows: [
            'Stop operations',
            'Check scuppers/freeing ports',
            'Open other tank',
          ],
        },
        {
          label: 'Discharge of Slops',
          rows: [
            'Stop operations',
            'Check scuppers/freeing ports',
          ],
        },
        {
          label: 'Garbage',
          rows: [
            'Collect by tender',
          ],
        },
      ],
    },
  },

  {
    formId: 'medical-emergency',
    formName: 'Medical Emergency',
    formType: 'emergency',
    category: 'Emergency Procedures',
    alarmBanner: false,
    items: [
      { id: 'med-1', label: 'Administer First Aid', indent: 0 },
      { id: 'med-2', label: 'Seek radio medical advice', indent: 0 },
      { id: 'med-3', label: 'Identify nearest landing point accessible by ambulance', indent: 0 },
      { id: 'med-4', label: 'Determine what assistance required', indent: 0 },
      { id: 'med-5', label: 'Contact emergency services', indent: 0 },
    ],
  },

  {
    formId: 'man-overboard',
    formName: 'Man Overboard',
    formType: 'emergency',
    category: 'Emergency Procedures',
    alarmBanner: true,
    items: [
      { id: 'mob-1', label: 'Deploy life rings, smoke buoy and light', indent: 0 },
      { id: 'mob-2', label: 'Activate MOB function on GPS', indent: 0 },
      { id: 'mob-3', label: 'Sound Emergency Alarm and/or alert all crew', indent: 0 },
      { id: 'mob-4', label: 'Post lookout to maintain visual reference to the man overboard', indent: 0 },
      { id: 'mob-5', label: 'Perform MOB yacht manoeuvres', indent: 0 },
      { id: 'mob-6', label: 'Man Searchlights', indent: 0 },
      { id: 'mob-7', label: 'Launch rescue boat to recover casualty', indent: 0 },
      { id: 'mob-8', label: 'Administer first aid as required', indent: 0 },
      { id: 'mob-9', label: 'Identify suitable landing point to disembark casualty if required', indent: 0 },
      { id: 'mob-10', label: 'Contact contracted medical assistance', indent: 0 },
    ],
  },

  {
    formId: 'main-propulsion-failure',
    formName: 'Main Propulsion Failure',
    formType: 'emergency',
    category: 'Emergency Procedures',
    alarmBanner: true,
    items: [
      { id: 'mpf-1', label: 'Can the yacht be manoeuvred', indent: 0 },
      { id: 'mpf-2', label: 'Identify nearest anchorages or safe haven', indent: 0 },
      { id: 'mpf-3', label: 'Request assistance from nearby vessels', indent: 0 },
      { id: 'mpf-4', label: 'Determine if repairs can be made in-situ', indent: 0 },
      { id: 'mpf-5', label: 'Prepare tow if required', indent: 0 },
    ],
  },

  {
    formId: 'grounding',
    formName: 'Grounding',
    formType: 'emergency',
    category: 'Emergency Procedures',
    alarmBanner: true,
    items: [
      { id: 'gnd-1', label: 'Sound Emergency Alarm', indent: 0 },
      { id: 'gnd-2', label: 'Assess damage', indent: 0 },
      { id: 'gnd-3', label: 'Passengers Mustered', indent: 0 },
      { id: 'gnd-4', label: 'All persons not involved in tackling incident to don lifejackets', indent: 0 },
      { id: 'gnd-5', label: 'Start bilge pumps', indent: 0 },
      { id: 'gnd-6', label: 'Minimise Pollution – Deploy pollution control kit if required', indent: 0 },
      { id: 'gnd-7', label: 'Identify nearest safe haven or landing point', indent: 0 },
      { id: 'gnd-8', label: 'Request assistance from nearby vessels', indent: 0 },
      { id: 'gnd-9', label: 'Display lights and shapes', indent: 0 },
      { id: 'gnd-10', label: 'Ready liferafts for deployment', indent: 0 },
      { id: 'gnd-11', label: 'Initiate PAN PAN or MAYDAY', indent: 0 },
    ],
    specificIncidents: {
      columns: [
        {
          label: 'Remaining Aground',
          rows: [
            'Consider state of tide',
            'Consider ballast/fuel transfer',
            'Lay out ground tackle',
            'Request external assistance',
            'Consider transfer of passengers',
          ],
        },
        {
          label: 'Before refloating',
          rows: [
            'Assess damage and stability',
            'Repair any damaged areas or isolate damaged areas',
            'Test engines, intakes and filters',
            'Formulate plan to refloat vessel',
            'Agree procedures and communications',
          ],
        },
        {
          label: 'After refloating',
          rows: [
            'Reassess damage and stability',
            'Test engines, intakes and filters',
            'Assess seaworthiness',
            'Clear away tackle etc',
            'Contact insurers and notify authorities',
          ],
        },
      ],
    },
  },

  {
    formId: 'flooding',
    formName: 'Flooding',
    formType: 'emergency',
    category: 'Emergency Procedures',
    alarmBanner: true,
    items: [
      { id: 'fld-1', label: 'Sea/swell state – position yacht head to wind ?', indent: 0 },
      { id: 'fld-2', label: 'Close watertight doors, deadlights, hatches and all openings', indent: 0 },
      { id: 'fld-3', label: 'Sound emergency alarm', indent: 0 },
      { id: 'fld-4', label: 'Start bilge pumps', indent: 0 },
      { id: 'fld-5', label: 'Ready emergency bilge pump', indent: 0 },
      { id: 'fld-6', label: 'Remove Passengers away from the damaged area', indent: 0 },
      { id: 'fld-7', label: 'Passengers mustered & counted', indent: 0 },
      { id: 'fld-8', label: 'All persons not involved in response to don lifejackets', indent: 0 },
      { id: 'fld-9', label: 'Assess damage paying particular attention to stability', indent: 0 },
      { id: 'fld-10', label: 'Identify nearest safe haven or landing point', indent: 0 },
      { id: 'fld-11', label: 'Request assistance from nearby vessels', indent: 0 },
      { id: 'fld-12', label: 'Ready liferafts for deployment', indent: 0 },
      { id: 'fld-13', label: 'Initiate PAN PAN or MAYDAY', indent: 0 },
    ],
    specificIncidents: {
      columns: [
        {
          label: 'Ingress in engine room',
          rows: [
            'Will pumps start ?',
            'Can pumps cope ?',
            'Extra pumping available?',
            'Is stability affected?',
          ],
        },
        {
          label: 'Ingress from hull outside engine room',
          rows: [
            'Locate ingress',
            'Isolate space',
            'Can pumps cope',
            'Extra pumping available?',
            'Is stability affected?',
          ],
        },
      ],
    },
  },

  {
    formId: 'fire',
    formName: 'Fire',
    formType: 'emergency',
    category: 'Emergency Procedures',
    alarmBanner: true,
    items: [
      { id: 'fire-1', label: 'Sound emergency alarm', indent: 0 },
      { id: 'fire-2', label: 'Close all doors & watertight doors', indent: 0 },
      { id: 'fire-3', label: 'Remove Passengers away from the source of fire', indent: 0 },
      { id: 'fire-4', label: 'Ready emergency fire pump', indent: 0 },
      { id: 'fire-5', label: 'Close Dampers and Ready Emergency Fuel Cutoffs', indent: 0 },
      { id: 'fire-6', label: 'Deploy fire fighting team', indent: 0 },
      { id: 'fire-7', label: 'Treat and record any injuries to passengers and crew', indent: 0 },
      { id: 'fire-8', label: 'Muster and count passengers and crew not involved in dealing with incident', indent: 0 },
      { id: 'fire-9', label: 'All persons not involved in fighting fire to don lifejackets', indent: 0 },
      { id: 'fire-10', label: 'Identify nearest safe haven or landing point', indent: 0 },
      { id: 'fire-11', label: 'Request assistance from nearby vessels', indent: 0 },
      { id: 'fire-12', label: 'Ready liferafts for deployment', indent: 0 },
      { id: 'fire-13', label: 'Initiate PAN PAN or MAYDAY', indent: 0 },
    ],
    specificIncidents: {
      columns: [
        {
          label: 'Engine Room Fire',
          rows: [
            'Batten down Engine Room',
            'Shut down fans & vents',
            'Inject CO2 from remote release',
            'Close fuel shut off valves',
            'Boundary Cooling',
          ],
        },
        {
          label: 'Wheelhouse Fire',
          rows: [
            'Remove essentials (Handheld VHF, SART, etc)',
            'Shut down fans & vents',
            'Batten down',
            'Activate sprinkler system',
            'Boundary Cooling',
          ],
        },
        {
          label: 'Accommodation Space Fire',
          rows: [
            'Evacuate persons',
            'Shut down fans & vents',
            'Batten down',
            'Activate sprinkler system',
            'Boundary Cooling',
          ],
        },
      ],
    },
  },

  {
    formId: 'emergency-broadcast',
    formName: 'Emergency Broadcast',
    formType: 'emergency',
    category: 'Emergency Procedures',
    alarmBanner: false,
    items: [],
    sections: [
      {
        sectionLabel: 'Pan Pan — urgency call',
        sectionDescription:
          'Use when there is an urgent safety concern that is NOT immediately life-threatening, e.g. injury that is serious but stable, mechanical or steering failure, person overboard recovered, slow controllable leak, vessel drifting. Pan Pan takes priority over all traffic except a Mayday. Upgrade to Mayday if the situation becomes grave and imminent.',
        items: [
          { id: 'eb-pp-1', label: 'Pan Pan, Pan Pan, Pan Pan' },
          { id: 'eb-pp-2', label: 'All stations, all stations, all stations' },
          { id: 'eb-pp-3', label: 'This is "Rise Above", "Rise Above", "Rise Above"' },
          { id: 'eb-pp-4', label: 'Call sign Victor 7 Bravo 3 2 5 8, Victor 7 Bravo 3 2 5 8, Victor 7 Bravo 3 2 5 8' },
          { id: 'eb-pp-5', label: 'In position Lat……..Long……… or by reference to known point' },
          { id: 'eb-pp-6', label: 'I require ……………………type of assistance' },
          { id: 'eb-pp-7', label: 'We have …… Persons on board and …….. (Any further information)' },
          { id: 'eb-pp-8', label: 'Over' },
        ],
      },
      {
        sectionLabel: 'MAYDAY — distress call',
        sectionDescription:
          'Use ONLY when the vessel or a person on board is in grave and imminent danger and immediate assistance is required, e.g. uncontrolled fire, sinking, life-threatening medical emergency, abandoning ship, collision with major flooding. Mayday takes absolute priority over all radio traffic.',
        items: [
          { id: 'eb-md-1', label: 'MAYDAY, MAYDAY, MAYDAY' },
          { id: 'eb-md-2', label: 'All stations, all stations, all stations' },
          { id: 'eb-md-3', label: 'This is "Rise Above", "Rise Above", "Rise Above"' },
          { id: 'eb-md-4', label: 'Call sign Victor 7 Bravo 3 2 5 8, Victor 7 Bravo 3 2 5 8, Victor 7 Bravo 3 2 5 8' },
          { id: 'eb-md-5', label: 'In position Lat……..Long……… or by reference to known point' },
          { id: 'eb-md-6', label: 'I require ……………………type of assistance' },
          { id: 'eb-md-7', label: 'We have …… Persons on board and …….. (Any further information)' },
          { id: 'eb-md-8', label: 'Over' },
        ],
      },
    ],
  },

  {
    formId: 'collision',
    formName: 'Collision',
    formType: 'emergency',
    category: 'Emergency Procedures',
    alarmBanner: true,
    items: [
      { id: 'col-1', label: 'Close watertight doors, deadlights and openings', indent: 0 },
      { id: 'col-2', label: 'Sound emergency alarm', indent: 0 },
      { id: 'col-3', label: 'Remove Passengers away from the damaged area', indent: 0 },
      { id: 'col-4', label: 'Muster and count passengers and crew not involved in dealing with incident', indent: 0 },
      { id: 'col-5', label: 'Lifejackets are to be worn by guests', indent: 0 },
      { id: 'col-6', label: 'Assess damage throughout whole vessel and sound tanks', indent: 0 },
      { id: 'col-7', label: 'Start bilge pumps if hull is breached or water is being taken on board', indent: 0 },
      { id: 'col-8', label: 'Identify nearest landing point', indent: 0 },
      { id: 'col-9', label: 'Request assistance from nearby vessels', indent: 0 },
      { id: 'col-10', label: 'Display navigation lights/shapes & illuminate muster & embarkation areas', indent: 0 },
      { id: 'col-11', label: 'Prepare liferafts to be deployed if required', indent: 0 },
      { id: 'col-12', label: 'Prepare SART + EPIRB', indent: 0 },
    ],
    specificIncidents: {
      columns: [
        {
          label: 'Collision with another vessel',
          rows: [
            'Consider own vessel stability/condition and withdrawal from other vessel',
            'Minimise pollution',
            'Offer assistance to other vessel if capable',
            'Exchange vessels details',
            'Inform insurance company as soon as possible',
          ],
        },
        {
          label: 'Collision with fixed structure',
          rows: [
            'Consider own vessel stability/condition/withdrawal from structure',
            'Minimise pollution',
            'Inform insurance company as soon as possible',
          ],
        },
        {
          label: 'Collision with submerged object',
          rows: [
            'Consider own vessel stability/condition. Identify object if possible',
            'Minimise pollution',
            'Broadcast navigation warning',
            'Inform insurance company as soon as possible',
          ],
        },
      ],
    },
  },
]

export const OPERATING_FORMS = FORMS_CATALOG.filter(f => f.formType === 'operating')
export const EMERGENCY_FORMS = FORMS_CATALOG.filter(f => f.formType === 'emergency')

export function getFormById(formId: string): ISMForm | undefined {
  return FORMS_CATALOG.find(f => f.formId === formId)
}