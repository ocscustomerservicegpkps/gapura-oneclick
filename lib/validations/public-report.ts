type PublicReportStation = {
  id: string;
  code: string;
  name: string;
};

type PublicReportValidationInput = {
  airline: string;
  flight_number: string;
  station_id: string;
  route?: string;
};

export type PublicReportValidationErrors = Partial<Record<keyof PublicReportValidationInput, string>>;

export function normalizeFlightNumber(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, '');
}

function validateFlightNumber(value: string): string | null {
  if (!value.trim()) return 'Nomor penerbangan wajib diisi.';
  return null;
}

function validateAirline(value: string): string | null {
  if (!value.trim()) return 'Maskapai wajib dipilih.';
  return null;
}

function validateStation(value: string, stations: PublicReportStation[]): string | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 'Branch/station wajib dipilih.';
  if (stations.length === 0) return null;

  const exists = stations.some((station) => (
    station.id.toLowerCase() === normalized ||
    station.code.toLowerCase() === normalized
  ));

  return exists ? null : 'Branch/station tidak ada di data master.';
}

function validateRoute(): string | null {
  return null;
}

export function validatePublicReportFlightStation(
  input: PublicReportValidationInput,
  stations: PublicReportStation[]
): PublicReportValidationErrors {
  const errors: PublicReportValidationErrors = {};
  const airlineError = validateAirline(input.airline);
  const flightError = validateFlightNumber(input.flight_number);
  const stationError = validateStation(input.station_id, stations);
  const routeError = validateRoute();

  if (airlineError) errors.airline = airlineError;
  if (flightError) errors.flight_number = flightError;
  if (stationError) errors.station_id = stationError;
  if (routeError) errors.route = routeError;

  return errors;
}
