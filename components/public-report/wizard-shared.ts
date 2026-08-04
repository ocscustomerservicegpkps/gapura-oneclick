import type { CSSProperties, ComponentType } from 'react';
import { AIRLINES } from '@/lib/constants/airlines';
import { AREA_CATEGORIES as AREA_CATEGORIES_SHARED, AREA_LABELS, ROOT_CAUSE_CLASSIFICATIONS as ROOT_CAUSE_CLASSIFICATIONS_SHARED, type GseType } from '@/lib/constants/incident-areas';
import { Plane, Ship, Package, MapPin, Wrench } from 'lucide-react';
import type { SeverityLevel } from '@/lib/constants/report-status';

export type QuickAccessLink = { label: string; url: string; sublabel?: string };

export type QRLink = { label: string; url: string };

export const PUBLIC_SEVERITY_OPTIONS = ['TOP RISK', 'HIGH RISK', 'MEDIUM', 'LOW'] as const;

export type QuickAccessCategory = {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  color: string;
  span: string;
  qrLinks?: QRLink[];
  links?: QuickAccessLink[];
  passwordProtected?: boolean;
  loginProtected?: boolean;
  redirectUrl?: string;
  externalRedirect?: boolean;
  requiresLogin?: boolean;
  comingSoon?: boolean;
};

export const AREA_OPTIONS = [
  { id: 'TERMINAL', label: AREA_LABELS.TERMINAL, icon: Plane },
  { id: 'APRON', label: AREA_LABELS.APRON, icon: Ship },
  { id: 'GSE', label: AREA_LABELS.GSE, icon: Wrench },
  { id: 'CARGO', label: AREA_LABELS.CARGO, icon: Package },
  { id: 'GENERAL', label: AREA_LABELS.GENERAL, icon: MapPin },
];

export const REPORT_CATEGORY_OPTIONS = ['Occurrence', 'Accident / Incident', 'Irregularity', 'Complaint', 'Compliment'];

export const AREA_CATEGORIES = AREA_CATEGORIES_SHARED as Record<string, string[]>;
export const ROOT_CAUSE_CLASSIFICATIONS = ROOT_CAUSE_CLASSIFICATIONS_SHARED as Partial<Record<string, string[]>>;

const LOKAL_AIRLINE_CODES = ['GA', 'QG', 'JT', 'ID', 'IW', 'IU', 'QZ', 'SJ', 'IN', 'IP', '8B', 'SI', 'IL'];

export function getAirlineType(airlineName: string): 'Lokal' | 'MPA' {
  const airline = AIRLINES.find((a) => a.name === airlineName);
  if (!airline) return 'MPA';
  return LOKAL_AIRLINE_CODES.includes(airline.code) ? 'Lokal' : 'MPA';
}

export function getHubForStation(stationCode: string): string {
  if (['CGK', 'SUB', 'DPS'].includes(stationCode)) return stationCode;
  if (['UPG', 'MDC', 'BPN'].includes(stationCode)) return 'UPG';
  if (['KNO', 'PDG', 'PKU', 'BTH', 'PLM'].includes(stationCode)) return 'KNO';
  return 'CGK';
}

export function getWeekInMonth(date: Date): number {
  const day = date.getDate();
  return Math.ceil(day / 7);
}

export type FormData = {
  incident_date: string;
  airline: string;
  flight_number: string;
  station_id: string;
  route: string;
  main_category: string;
  delay_code: string;
  area: string;
  area_category: string;
  area_category_other: string;
  description: string;
  root_cause: string;
  root_cause_classification: string;
  root_cause_classification_other: string;
  action_taken: string;
  preventive_action: string;
  airline_other: string;
  gse_type: GseType | '';
  gse_equipment: string;
  gse_equipment_other: string;
  severity: SeverityLevel;
  reporter_name: string;
  reporter_email: string;
  evidence_urls: string[];
};

export type CreatedReport = { id?: string } & Record<string, unknown>;

export type ChronologyEntry = {
  time: string;
  description: string;
};

export type OfficerEntry = {
  name: string;
  company: string;
  function: string;
};

export type DocEdits = {
  reference_no: string;
  to: string;
  from: string;
  cc: string;
  subject: string;
  attachment: string;

  incident_date: string;
  branch: string;
  flight_number: string;
  aircraft_reg: string;
  route: string;
  std_atd: string;
  pax: string;
  bge: string;
  gate_stand: string;
  delay: string;

  officers: OfficerEntry[];

  chronology: ChronologyEntry[];

  root_cause: string;
  action_taken: string;
  preventive_action: string;

  reporter_name: string;
  reporter_title: string;

  doc_title?: string;
  acknowledge_label?: string;
};

export type TextDocEditKey = {
  [K in keyof DocEdits]: NonNullable<DocEdits[K]> extends string ? K : never
}[keyof DocEdits];

export type EvidenceUploadStatus = {
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  message?: string;
  url?: string;
};

export type DuplicateCandidate = {
  id: string;
  title: string;
  status: string;
  date_of_event: string | null;
  station_id: string | null;
  airline: string | null;
  flight_number: string | null;
  similarity: number;
};
