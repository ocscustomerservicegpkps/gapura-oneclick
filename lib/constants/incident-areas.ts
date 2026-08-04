
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- value unused; kept to derive the AreaId type below
const AREA_IDS = ['TERMINAL', 'APRON', 'CARGO', 'GENERAL', 'GSE'] as const;
export type AreaId = typeof AREA_IDS[number];

export const AREA_LABELS: Record<AreaId, string> = {
  TERMINAL: 'Terminal Area',
  APRON: 'Apron Area',
  CARGO: 'Cargo Area',
  GENERAL: 'General',
  GSE: 'GSE Availability',
};

export const AREA_CATEGORIES: Record<AreaId, string[]> = {
  TERMINAL: [
    'Compliment Report Excellent Service',
    'Passenger, Baggage & Document Profiling',
    'Boarding Management',
    'Safety and Security',
    'Baggage/Special/Irregularities Handling',
    'Accuracy & Completeness of Service',
    'Procedure Compliance',
    'Officer Qualified Competencies',
    'Cleanliness of Area',
    'Lack Communication Skills',
    'Avoids Taking Initiative to Help',
    'Other',
  ],
  APRON: [
    'Compliment Report Excellent Service',
    'Preparation Before ETA',
    'Flight Document Handling',
    'Safety and Security (Apron)',
    'Baggage/Special/Irregularities Handling (Apron)',
    'Accuracy & Completeness of Service (Apron)',
    'Officer Qualified Competencies (Apron)',
    'Procedure Compliance (Apron)',
    'Prompt Service and Certainty',
    'Specific Needs of Customers',
    'Other',
  ],
  CARGO: [
    'Cargo Damage, Packaging & Condition Issue',
    'Cargo Live Animal Shipment, Dead Animal & Handling/Condition Issue',
    'Cargo Not On Board, Wrong Flight, Load Plan & Misrouting Issue',
    'Cargo Procedure Compliance Issue & Handling Process',
    'Cargo Data, Reporting, Team Communication & Coordination Issue',
    'Cargo Equipment, Layout & Facility Issue',
    'Cargo Safety, Accident & Asset Damage Incident',
    'Other',
  ],
  GENERAL: [
    'Compliment Report Excellent Service',
    'On Time Performance',
    'Safety and Security (General)',
    'Staff Appearance',
    'Staff attitude & Competencies',
    'Care with Customers Needs',
    'Prompt Response to Complaint Handling',
    'Overall Company Service',
    'Other',
  ],
  GSE: [
    'GSE Safety & Damage Incident',
    'GSE Operator Issue / Lack of SDM',
    'GSE Equipment Availability Issue / Lack of SDA',
    'GSE Technical Malfunction / Equipment Trouble Issue',
    'GSE Maintenance & Reliability Issue',
    'Cleanliness of GSE Area',
    'Other',
  ],
};

// Root cause classification is a separate step after Area Category. Only
// populated for areas whose full list is confirmed; areas without an entry
// here fall back to the freeform Root Cause textarea.
export const ROOT_CAUSE_CLASSIFICATIONS: Partial<Record<AreaId, string[]>> = {
  TERMINAL: [
    'Passenger Document Issue – Boarding Discrepancy, Passenger Data Mismatch',
    'Passenger Misboarding – Wrong Flight Boarding',
    'Profiling Failure',
    'Profiling Failure – Visa Issue',
    'Immigration Rejected',
    'INAD Passenger – Immigration Rejected',
    'Baggage Lost / Item(s) Lost – AHL',
    'Baggage Delay Fibag & Labag',
    'Baggage Damage – DPR',
    'Operational Issue – Check In Area',
    'Operational Issue – Boarding Area',
    'Operational Issue – Baggage Claim Area',
    'Other',
  ],
  APRON: [
    'Aircraft Body Scratch – Technical Problems',
    'Aircraft Registration Error – Incorrect Data Submission',
    'Misrouted Baggage – Baggage Wrong Destination',
    'Missed Baggage Not On Board',
    'Operational Issue – Breakdown / Make-Up Area / Loading Unloading',
    'Operational Staff Injury Accident',
    'Other',
  ],
  GENERAL: [
    'Kontraproduktif – Baggage Manipulation',
    'Kontraproduktif – Money Matter',
    'Other',
  ],
};

export const GSE_TYPES = ['GSE MOTORIZED', 'GSE NON - MOTORIZED'] as const;
export type GseType = typeof GSE_TYPES[number];

export const GSE_EQUIPMENT: Record<GseType, string[]> = {
  'GSE MOTORIZED': [
    '(ACU) - Air Conditioning Unit',
    '(ASU) - Air Starter Unit',
    '(ATN) - Aircraft Towing Tractor N/B',
    '(ATW) - Aircraft Towing Tractor W/B',
    '(BTT) - Baggage Towing Tractor',
    '(CBL) - Conveyor Belt Loader',
    '(CBL-T) - Conveyor Belt Towable',
    '(FLT) - Forklift',
    '(GPU) - Ground Power Unit',
    '(HLL) - Lower, Upper Deck Loader',
    '(IPL) - Incapacitated Passenger Lift',
    '(LSC) - Lavatory Service Cart',
    '(LST) - Lavatory Service Truck',
    '(MDL) - Main Deck Loader',
    '(PBS) - Passenger Boarding Stair',
    '(WSC) - Water Service Cart',
    '(WST) - Water Service Truck',
    'Other',
  ],
  'GSE NON - MOTORIZED': [
    '(APC) - Aircraft Passenger Canopy',
    '(ATB) - A/C Tow Bar',
    '(ATJ) - Aircraft Tailjack',
    '(BCT) - Baggage Cart',
    '(CDL) - Container Dollies',
    '(CRK) - Container Rack',
    '(LPD) - Long Pallet Dollies',
    '(PDL) - Pallet Dollies',
    '(PRK) - Pallet Rack',
    '(TPS) - Towed Passenger Stair',
    '(WMS) - Working Maintenance Stair',
    'Other',
  ],
};
