# Forms Catalog — All 22 ISM Forms

Source: M/Y RISE ABOVE III Safety Management System binder. Each form has been transcribed exactly from the binder photos.

In the app: every form gets a `formId` (kebab-case), `formName` (Title Case as printed), `formType` ('operating' | 'emergency'), `category` ('Operating Procedures' | 'Emergency Procedures'), `items` (array of `{id, label, indent?: 0|1|2, isGroup?: boolean}`), and emergency forms additionally have a `specificIncidents` table (array of columns each with `{label, rows: [...]}`).

Indent levels: `0` = main item, `1` = sub-item (printed indented under a parent), `2` = sub-sub-item.

---

## OPERATING PROCEDURES

### 1. watchkeeping-in-port — "Watchkeeping in Port"
Items (all indent 0, all checkboxes):
- Captains instructions
- Mooring
- Passerelle/Gangway
- Fenders and lines
- Security level
- Weather forecast
- Persons on board and locations
- Communications equipment status
- Lighting status
- Shore power and water
- Other equipment status
- Expected visitors or movements
- Port/Marina protocols

### 2. watchkeeping-at-sea — "Watchkeeping at Sea"
- Navigational Status confirmed
- Operational Status confirmed
- Standing orders read and understood
- Night orders read and understood
- Security level known
- Radar settings and autopilot
- Traffic
- Communications equipment status
- Navigation light status
- Engine status
- Other equipment status
- Stability/Tanks
- Night vision – fitness to take watch

### 3. towing — "Towing"
Header note: "Generally consider the following:"
- Check Status of Vessel Seaworthiness and Damage Control
- Inform Insurance Company
- Inform Shore Support Company & Owner if Applicable
- Illuminate the Fore Deck
- Ready Towing Bridle and Quick Disconnect Coupling
- Ready Monkey's Fist & Coil Line Neatly
- Establish Radio Communications with Bridge & Tow Boat & Fore Deck
- Ready Life Jackets and other Life Saving Gear
- Ready Rigging Tools including an Axe and Flashlights
- Steering to Neutral and Locked Position
- Establish Status of Hydraulic & Electrical Power
- Establish Safe Towing Speed with Regards to Sea State & Deck Equipment

### 4. jet-ski-pre-voyage — "Jet Ski Pre Voyage Checklist"
- Consider the Following:- (group label, indent 0, no checkbox — or render as a header)
- Check Oil Level
- Check Coolant Level
- Check Engine
- Check Bung is in place
- Check Lifting Sling and Harness is in good condition
- Check Safety Gear including Fire Extinguisher & Noise Making Device & Flares
- Check Operator is not under the influence of Drugs or Alcohol
- Check the Kill Switch and Lanyard
- Check Life Vests for Condition and Fit
- Ensure User is aware of Local Laws and Ordinances regarding Personal Water Craft
- Check Weather Forecast and Sea Conditions
- Agree Communications Procedures (VHF, UHF in waterproof bag)
- Supervision (If required for Persons under legal operators age or beginners)
- Ensure User is aware of any speed limits.
- Check Maintenance Records
- Ensure User is aware of the safe distance away from the Mother Vessel
- Ensure User is aware of who has Right of Way and other Rules of the Road
- Check Fuel Levels

### 5. security-patrols — "Security Patrols"
- Refer to Captains standing orders and security plan
- Potential security threats understood
- Route agreed and familiarised
- Patrol timings and frequency agreed
- Keys obtained
- Communications agreed
- EMERGENCY PROCEDURES AGREED

### 6. leaving-port — "Leaving Port"
- ETD advised to crew, dock master and agent
- Crew preparation and briefing
- Weather forecast and tide conditions
- Wind speed and direction
- Test and Ready (group, indent 0)
  - Steering (indent 1)
  - Engines (indent 1)
  - Bow Thrusters (indent 1)
  - Winches (indent 1)
  - Wing Stations (indent 1)
- Communications with Shore (group, indent 0)
  - Agent (indent 1)
  - Permission (indent 1)
  - Customs and Clearance (indent 1)
  - Security (indent 1)
  - Crew and Passenger list (indent 1)
  - Practique (indent 1)
- Range and fuel on board
- Passage plan
- Stow and secure items
- Passerelle or gangway stowed
- Fenders and mooring lines stowed
- Notice of Departure to Authorities

### 7. entering-port — "Entering Port"
- ETA advised to crew, dockmaster and agent
- Crew preparation and briefing
- Weather forecast and tide conditions
- Wind speed and direction
- Test and Ready (group)
  - Steering
  - Engines
  - Bow Thrusters
  - Winches
  - Wing Stations
- Communications with Shore (group)
  - Agent
  - Permission
  - Customs and Clearance
  - Security
  - Crew and Passenger list
  - Practique
- Clear anchors
- Mooring plan
- Power and Water requirements
- Passerelle or gangway prepared
- Fenders and mooring lines deployed
- Notice of Arrival to Authorities

### 8. diving — "Diving"
- Weather – current/forecast/tide/swell
- Agree dive plan
- Equipment checked
- Equipment familiarisation for new users
- Tender deployed and manned (group)
  - Ensure sufficient fuel and supplies in tender
  - Ensure distress flares and rescue equipment in tender
  - Agree communications protocol with tender
- Communications procedures agreed
- EMERGENCY COMMUNICATIONS AGREED
- Supervision of divers
- Local laws and restrictions understood
- Display required flags/lights
- Briefing on conduct and behaviour
- Operational briefing
- Emergency procedure briefing
- Disclaimers agreed and signed

### 9. bunkering — "Bunkering"
- Assign Responsibilities
- Bunker Plan (group)
  - Quantity required
  - Rate of transfer
  - Tanks to be filled
  - Supervision
  - Communications
- Check condition of hoses and fittings
- Display required flags/lights
- AGREE EMERGENCY PROCEDURES WITH SHORE
- Ready or deploy pollution counter measures (group)
  - Mats
  - Granules
  - Boom
- Ensure no naked lights – post warning signs
- Fuel samples taken
- Oil record book completed
- Receipts checked and filed

### 10. anchoring — "Anchoring"
- Consider the following (group)
  - How many shackles are required
  - What holding ground
  - Current/Depth/Tide
  - Other vessels in proximity
- Swinging circle
- Weather Forecast
- Location – Check chart or pilot book warnings
- Display 'At Anchor' signals
- Plan crew/passenger movements on and off yacht
- Agree communications procedures
- Toys (group)
  - Intended use
  - Supervision
  - Communications
- Tender (group)
  - Intended use
  - Designated person to remain with tender if ashore
  - Communications
- Shore Communications (group)
  - Shore permission/clearance
  - Customs
  - Security
  - Practique
  - Crew/Passenger list
- Security Watch

---

## EMERGENCY PROCEDURES

All emergency forms share this incident header (table at top, fillable text fields):
- Yacht name (auto-fill "Rise Above")
- Call sign (text)
- Date of incident (date picker, default today)
- Time (time picker, default now)
- Location (text)
- Weather (text)
- Type of incident (text — describe)
- Persons involved (text)
- Injuries sustained (text)
- Damage to vessel (text)

Forms 11–22 below. Forms marked "SOUND EMERGENCY ALARM" should display that banner in red at the top of the form.

### 11. violent-act — "Violent Act"
No alarm banner.
Section: "Generally consider the following:"
- Attempt to diffuse incident if safely possible
- Remove passengers away from incident if possible
- Remove non essential crew from incident if possible
- Retreat to secure area if possible
- Preserve evidence

### 12. steering-failure — "Steering Failure"
No alarm banner.
- Determine proximity of traffic and navigational dangers
- Determine if emergency steering can be used
- Determine if yacht can be manoeuvred on the engine
- Request assistance from nearby vessels if possible
- Switch on NUC lights
- Identify nearest anchorages or safe havens
- Make anchor ready

### 13. security-breach — "Security Breach"
No alarm banner.
- Refer to Ship Security Plan
- Activate covert Ships Security Alert alarm
- Contact shore - other vessels - security response organisation
- Remove passengers away from incident if possible
- Retreat to secure area if possible
- Preserve evidence

### 14. pollution — "Pollution"
**SOUND EMERGENCY ALARM** banner.
- Stop source of spill and close all valves
- Sound emergency alarm and activate response plan
- Reduce level of oil by transfer to empty/slack tanks
- Pump water into tank to create water cushion to prevent further oil spill
- Commence clean up procedures, deploy containment boom
- Assess fire risks
- Assess weather and tide effects on spill
- Make initial report as per Appendix 5 SOPEP
- Complete clean up
- Follow up reports as necessary as per Section 2.3 SOPEP
- Contact Company/Owners/Insurers/Flag Administration
- Take photographs and document steps taken to reduce pollution

**For Specific Incidents** sub-table (4 columns):
| Collision | Bunkering | Discharge of Slops | Garbage |
|-|-|-|-|
| Assess possibility of further damage, capsize, sinking | Stop operations | Stop operations | Collect by tender |
| Check stability | Check scuppers/freeing ports | Check scuppers/freeing ports | |
| Request assistance | Open other tank | | |

In the form UI: render the sub-table as **a multi-select grouped section** — user picks the incident type (radio: Collision / Bunkering / Discharge of Slops / Garbage), then sees only the relevant rows as checkboxes.

### 15. medical-emergency — "Medical Emergency"
No alarm banner.
- Administer First Aid
- Seek radio medical advice
- Identify nearest landing point accessible by ambulance
- Determine what assistance required
- Contact emergency services

### 16. man-overboard — "Man Overboard"
**SOUND EMERGENCY ALARM** banner.
- Deploy life rings, smoke buoy and light
- Activate MOB function on GPS
- Sound Emergency Alarm and/or alert all crew
- Post lookout to maintain visual reference to the man overboard
- Perform MOB yacht manoeuvres
- Man Searchlights
- Launch rescue boat to recover casualty
- Administer first aid as required
- Identify suitable landing point to disembark casualty if required
- Contact contracted medical assistance

### 17. main-propulsion-failure — "Main Propulsion Failure"
**SOUND EMERGENCY ALARM** banner.
- Can the yacht be manoeuvred
- Identify nearest anchorages or safe haven
- Request assistance from nearby vessels
- Determine if repairs can be made in-situ
- Prepare tow if required

### 18. grounding — "Grounding"
**SOUND EMERGENCY ALARM** banner.
- Sound Emergency Alarm
- Assess damage
- Passengers Mustered
- All persons not involved in tackling incident to don lifejackets
- Start bilge pumps
- Minimise Pollution – Deploy pollution control kit if required
- Identify nearest safe haven or landing point
- Request assistance from nearby vessels
- Display lights and shapes
- Ready liferafts for deployment
- Initiate PAN PAN or MAYDAY

**For Specific Incidents** sub-table (3 columns: Remaining Aground / Before refloating / After refloating):
| Remaining Aground | Before refloating | After refloating |
|-|-|-|
| Consider state of tide | Assess damage and stability | Reassess damage and stability |
| Consider ballast/fuel transfer | Repair any damaged areas or isolate damaged areas | Test engines, intakes and filters |
| Lay out ground tackle | Test engines, intakes and filters | Assess seaworthiness |
| Request external assistance | Formulate plan to refloat vessel | Clear away tackle etc |
| Consider transfer of passengers | Agree procedures and communications | Contact insurers and notify authorities |

In UI: user picks current phase (radio), checkboxes appear for that phase only.

### 19. flooding — "Flooding"
**SOUND EMERGENCY ALARM** banner.
- Sea/swell state – position yacht head to wind ?
- Close watertight doors, deadlights, hatches and all openings
- Sound emergency alarm
- Start bilge pumps
- Ready emergency bilge pump
- Remove Passengers away from the damaged area
- Passengers mustered & counted
- All persons not involved in response to don lifejackets
- Assess damage paying particular attention to stability
- Identify nearest safe haven or landing point
- Request assistance from nearby vessels
- Ready liferafts for deployment
- Initiate PAN PAN or MAYDAY

**For Specific Incidents** sub-table (2 columns: Ingress in engine room / Ingress from hull outside engine room):
| Ingress in engine room | Ingress from hull outside engine room |
|-|-|
| Will pumps start ? | Locate ingress |
| Can pumps cope ? | Isolate space |
| Extra pumping available? | Can pumps cope |
| Is stability affected? | Extra pumping available? |
| | Is stability affected? |

### 20. fire — "Fire"
**SOUND EMERGENCY ALARM** banner.
- Sound emergency alarm
- Close all doors & watertight doors
- Remove Passengers away from the source of fire
- Ready emergency fire pump
- Close Dampers and Ready Emergency Fuel Cutoffs
- Deploy fire fighting team
- Treat and record any injuries to passengers and crew
- Muster and count passengers and crew not involved in dealing with incident
- All persons not involved in fighting fire to don lifejackets
- Identify nearest safe haven or landing point
- Request assistance from nearby vessels
- Ready liferafts for deployment
- Initiate PAN PAN or MAYDAY

**For Specific Incidents** sub-table (3 columns: Engine Room Fire / Wheelhouse Fire / Accommodation Space Fire):
| Engine Room Fire | Wheelhouse Fire | Accommodation Space Fire |
|-|-|-|
| Batten down Engine Room | Remove essentials (Handheld VHF, SART, etc) | Evacuate persons |
| Shut down fans & vents | Shut down fans & vents | Shut down fans & vents |
| Inject CO2 from remote release | Batten down | Batten down |
| Close fuel shut off valves | Activate sprinkler system | Activate sprinkler system |
| Boundary Cooling | Boundary Cooling | Boundary Cooling |

### 21. emergency-broadcast — "Emergency Broadcast"
No alarm banner.
This is a **template/reference form** rather than a checklist of actions, but we treat it the same way — checkboxes confirm each line was spoken.

**Section: PAN PAN PAN** (sample messages)
- Pan Pan, Pan Pan, Pan Pan
- All stations x3 or Specific Coastguard x 3 or Specific Coast Station x 3
- This is "NAME OF YACHT" x 3
- Call Sign x 3
- In position Lat……..Long……… or by reference to known point
- I require ………………………type of assistance
- We have …… Persons on board and …….. (Any further information)
- Over

**Section: MAYDAY** (sample MAYDAY message)
- MAYDAY, MAYDAY, MAYDAY
- All stations x3 or Specific Coastguard x 3 or Specific Coast Station x 3
- This is "NAME OF YACHT" x 3
- Call Sign x 3
- In position Lat……..Long……… or by reference to known point
- I require ………………………type of assistance
- We have …… Persons on board and …….. (Any further information)
- Over

In UI: two grouped sections (PAN PAN / MAYDAY). Each line a checkbox. Plus free-text fields for: type of assistance, persons on board, further information. Also auto-fill from incident header: position from Location field, Yacht name = "Rise Above", Call sign from incident header.

### 22. collision — "Collision"
**SOUND EMERGENCY ALARM** banner.
- Close watertight doors, deadlights and openings
- Sound emergency alarm
- Remove Passengers away from the damaged area
- Muster and count passengers and crew not involved in dealing with incident
- Lifejackets are to be worn by guests
- Assess damage throughout whole vessel and sound tanks
- Start bilge pumps if hull is breached or water is being taken on board
- Identify nearest landing point
- Request assistance from nearby vessels
- Display navigation lights/shapes & illuminate muster & embarkation areas
- Prepare liferafts to be deployed if required
- Prepare SART + EPIRB

**For Specific Incidents** sub-table (3 columns):
| Collision with another vessel | Collision with fixed structure | Collision with submerged object |
|-|-|-|
| Consider own vessel stability/condition and withdrawal from other vessel | Consider own vessel stability/condition/withdrawal from structure | Consider own vessel stability/condition. Identify object if possible |
| Minimise pollution | Minimise pollution | Minimise pollution |
| Offer assistance to other vessel if capable | | Broadcast navigation warning |
| Exchange vessels details | | |
| Inform insurance company as soon as possible | Inform insurance company as soon as possible | Inform insurance company as soon as possible |