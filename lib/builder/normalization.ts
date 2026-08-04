
import type { QueryDefinition, DashboardTile } from '@/types/builder';
import { TABLES, JOINS, getFieldDef } from './schema';

function mapReportsField(field: string): string {
  if (!field) return field;
  const fieldLower = field.toLowerCase().replace(/[\s\-_]/g, '');

  const mapping: Record<string, string> = {
    'tipemaskapai': 'jenis_maskapai',
    'airlinetype': 'jenis_maskapai',
    'jenismaskapai': 'jenis_maskapai',

    'maskapai': 'airlines',
    'masapai': 'airlines',
    'maskapaiid': 'airlines',
    'airline': 'airlines',
    'airlines': 'airlines',

    'flight': 'flight_number',
    'flightnumber': 'flight_number',
    'penerbangan': 'flight_number',
    'nomorpenerbangan': 'flight_number',

    'cabang': 'branch',
    'branch': 'branch',

    'unit': 'unit_id',

    'total': 'id',
    'volume': 'id',
    'jumlah': 'id',
    'count': 'id',
    'total_laporan': 'id',
    'totallaporan': 'id',
    'jumlahlaporan': 'id',
    'jumlah_laporan': 'id',
    'jumlahdata': 'id',
    'jumlah_data': 'id',
    'idlaporan': 'id',
    'uuid': 'id',
    'id': 'id',

    'tanggal': 'date_of_event',
    'date': 'date_of_event',
    'incidentdate': 'date_of_event',
    'tanggalinsiden': 'date_of_event',

    'tanggalkejadian': 'event_date',
    'eventdate': 'event_date',
    'waktu': 'event_date',
    'time': 'event_date',

    'kategori': 'category',
    'category': 'category',
    'maincategory': 'category',
    'kategoriutama': 'category',
    'reportcategory': 'category',

    'subkategori': 'irregularity_complain_category',
    'subcategory': 'irregularity_complain_category',
    'irregularitycomplaincategory': 'irregularity_complain_category',

    'stasiun': 'station_code',
    'station': 'station_code',
    'stationcode': 'station_code',
    'kodestasiun': 'station_code',

    'stationid': 'station_id',
    'idstasiun': 'station_id',

    'incidenttypeid': 'incident_type_id',
    'idtipeinsiden': 'incident_type_id',
    'tipeinsidenid': 'incident_type_id',

    'locationid': 'location_id',
    'idlokasi': 'location_id',

    'userid': 'user_id',
    'iduser': 'user_id',
    'idpelapor': 'user_id',

    'pelapor': 'reporter_name',
    'reporter': 'reporter_name',
    'reportername': 'reporter_name',
    'namapelapor': 'reporter_name',
    'reportby': 'reporter_name',

    'hub': 'hub',

    'waktuinsiden': 'incident_time',
    'incidenttime': 'incident_time',
    'jamkejadian': 'incident_time',
    'jam': 'incident_time',

    'monthly_compliments': 'id',
    'compliments_count': 'id',
    'total_compliments': 'id',
    'compliments': 'id',
    'jumlah_compliments': 'id',
    'total_reports': 'id',  
    'lokasi': 'specific_location',
    'location': 'specific_location',
    'specificlocation': 'specific_location',
    'lokasispesifik': 'specific_location',

    'deskripsi': 'description',
    'description': 'description',
    'desc': 'description',

    'isilaporan': 'report',
    'report': 'report',
    'reportcontent': 'report',

    'severity': 'severity',
    'tingkatkeparahan': 'severity',

    'priority': 'priority',
    'prioritas': 'priority',

    'status': 'status',

    'rute': 'route',
    'route': 'route',

    'aircraft': 'aircraft_reg',
    'aircraftreg': 'aircraft_reg',
    'registrasipesawat': 'aircraft_reg',

    'rootcause': 'root_caused',
    'akaramsalah': 'root_caused',
    'rootcaused': 'root_caused',

    'actiontaken': 'action_taken',
    'gapurakpsactiontaken': 'gapura_kps_action_taken',

    'terminalareacategory': 'terminal_area_category',
    'apronareacategory': 'apron_area_category',
    'generalcategory': 'general_category',

    'uploadirregularityphoto': 'evidence_url',

    'sourcesheet': 'source_sheet',
    'sheet': 'source_sheet',
    'sumberdata': 'source_sheet',
    'source_sheet': 'source_sheet',

    'bulan': 'month',
    'month': 'month',
    'tahun': 'year',
    'year': 'year',
    'hari': 'day',
    'day': 'day',
    'kuartal': 'quarter',
    'quarter': 'quarter',
    'minggu': 'week_in_month',
    'week': 'week_in_month'
  };

  return mapping[fieldLower] || field;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeMonthValue(val: any): any {
  if (typeof val !== 'string') return val;
  const lower = val.toLowerCase().trim();
  const months: Record<string, string> = {
    'januari': '01', 'january': '01', 'jan': '01', '1': '01', '01': '01',
    'februari': '02', 'february': '02', 'feb': '02', '2': '02', '02': '02',
    'maret': '03', 'march': '03', 'mar': '03', '3': '03', '03': '03',
    'april': '04', 'apr': '04', '4': '04', '04': '04',
    'mei': '05', 'may': '05', '5': '05', '05': '05',
    'juni': '06', 'june': '06', 'jun': '06', '6': '06', '06': '06',
    'juli': '07', 'july': '07', 'jul': '07', '7': '07', '07': '07',
    'agustus': '08', 'august': '08', 'aug': '08', '8': '08', '08': '08',
    'september': '09', 'sep': '09', '9': '09', '09': '09',
    'oktober': '10', 'october': '10', 'oct': '10', '10': '10',
    'november': '11', 'nov': '11', '11': '11',
    'desember': '12', 'december': '12', 'dec': '12', '12': '12'
  };
  return months[lower] || val;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeQuery(query: any): QueryDefinition {
  if (!query || typeof query !== 'object') {
    throw new Error('Invalid query definition');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalized: any = { ...query };

  if (!normalized.source || !TABLES.some(t => t.name === normalized.source)) {
    normalized.source = 'reports';
  }

  if (normalized.source === 'raw_data_sample' || normalized.source === 'raw_data' || normalized.source === 'data' || normalized.source === 'data_sample') {
    normalized.source = 'reports';
  }

  normalized.dimensions = Array.isArray(normalized.dimensions) ? normalized.dimensions : [];
  normalized.measures = Array.isArray(normalized.measures) ? normalized.measures : [];
  normalized.filters = Array.isArray(normalized.filters) ? normalized.filters : [];
  normalized.sorts = Array.isArray(normalized.sorts) ? normalized.sorts : [];
  normalized.joins = Array.isArray(normalized.joins) ? normalized.joins : [];

  const usedTables = new Set<string>([normalized.source]);

  const normalizeTableName = (t: string | undefined): string => {
    if (!t) return normalized.source;
    if (t === 'raw_data_sample' || t === 'raw_data' || t === 'data' || t === 'data_sample') return 'reports';
    return t;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  normalized.dimensions = normalized.dimensions.map((d: any) => {
    const table = normalizeTableName(d.table);
    usedTables.add(table);

    let field = d.field;
    let dateGranularity = d.dateGranularity;

    if (table === 'reports') {
      field = mapReportsField(field);
    }

    if (table === 'reports') {
      if (field === 'month') {
        field = 'date_of_event';
        dateGranularity = 'month';
      } else if (field === 'day') {
        field = 'date_of_event';
        dateGranularity = 'day';
      } else if (field === 'year') {
        field = 'date_of_event';
        dateGranularity = 'year';
      } else if (field === 'quarter') {
        field = 'date_of_event';
        dateGranularity = 'quarter';
      } else if (field === 'week_in_month' || field === 'week') {
        field = 'date_of_event';
        dateGranularity = 'week';
      }
    }

    return { ...d, table, field, dateGranularity };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  normalized.measures = normalized.measures.map((m: any) => {
    const table = normalizeTableName(m.table);
    usedTables.add(table);

    let field = m.field;
    if (table === 'reports') {
      field = mapReportsField(field);

      if (field === 'total' || field === 'count' || !field) {
        field = 'id';
      }
    }

    let func = (m.function || 'COUNT').toUpperCase();

    if (func === 'SUM' || func === 'AVG') {
      const fieldDef = getFieldDef(table, field);
      if (fieldDef) {
        const isNonNumeric = ['uuid', 'string', 'date', 'datetime', 'boolean'].includes(fieldDef.type);
        if (isNonNumeric) {
          func = 'COUNT';
        }
      }
    }

    const alias = m.alias || `${func.toLowerCase()}_${table}_${field}`;

    return { 
      ...m, 
      table, 
      field, 
      function: func,
      alias
    };
  });

  usedTables.forEach(table => {
    if (table !== normalized.source) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const alreadyJoined = normalized.joins.some((j: any) => {
        const joinKey = j.joinKey;
        const joinDef = JOINS.find(jd => jd.key === joinKey);
        return joinDef?.to === table;
      });

      if (!alreadyJoined) {
        const possibleJoin = JOINS.find(j => j.from === normalized.source && j.to === table);
        if (possibleJoin) {
          normalized.joins.push({
            from: possibleJoin.from,
            to: possibleJoin.to,
            joinKey: possibleJoin.key
          });
        }
      }
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  normalized.filters = normalized.filters.map((f: any) => {
    const table = normalizeTableName(f.table);
    usedTables.add(table);

    let field = f.field;
    let value = f.value;

    if (table === 'reports') {
      field = mapReportsField(field);

      if (field === 'month') {
        if (Array.isArray(value)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          value = value.map((v: any) => normalizeMonthValue(v));
        } else {
          value = normalizeMonthValue(value);
        }
      }
    }

    return {
      ...f,
      table,
      field,
      value,
      conjunction: f.conjunction || 'AND',
      operator: f.operator || 'eq'
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  normalized.sorts = normalized.sorts.map((s: any) => {
    const table = normalizeTableName(s.table);
    let field = s.field;
    if (table === 'reports') {
      field = mapReportsField(field);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const measureMatch = normalized.measures.find((m: any) => 
      (m.field === field || m.alias === field) && 
      m.table === table
    );

    if (measureMatch && !s.alias) {
      return { ...s, table, field, alias: measureMatch.alias };
    }
    return { ...s, table, field };
  });

  return normalized as QueryDefinition;
}

export function normalizeVisualization(tile: DashboardTile): DashboardTile {
  if (!tile.visualization) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tile as any).visualization = { chartType: 'bar', title: 'Untitled Chart' };
  }

  const { chartType } = tile.visualization;
  const dimensions = tile.query.dimensions || [];
  const measures = tile.query.measures || [];

  if (chartType === 'heatmap') {
    if (dimensions.length < 2 || measures.length < 1) {

      tile.visualization.chartType = 'bar';
    } else {
      tile.visualization.xAxis = dimensions[0].alias || dimensions[0].field;
      tile.visualization.yAxis = [dimensions[1].alias || dimensions[1].field];
      tile.visualization.colorField = measures[0].alias || measures[0].field;
    }
  }

  const categoricalTypes = ['bar', 'horizontal_bar', 'line', 'area', 'radar', 'pie', 'donut'];
  if (categoricalTypes.includes(tile.visualization.chartType)) {
    if (dimensions.length > 0) {
      tile.visualization.xAxis = dimensions[0].alias || dimensions[0].field;
    }
    if (measures.length > 0) {
      tile.visualization.yAxis = measures.map(m => m.alias || m.field);
    }

    if (tile.visualization.chartType === 'pie' || tile.visualization.chartType === 'donut') {
      tile.visualization.showLabels = true;
    }
  }

  if (chartType === 'kpi' && measures.length === 0) {
    tile.visualization.chartType = 'table';
  }

  if ((chartType === 'pie' || chartType === 'donut' || chartType === 'bar' || chartType === 'horizontal_bar')) {
    const isTemporal = dimensions.some(d => d.dateGranularity);
    if (dimensions.length === 2 && measures.length === 1 && !isTemporal) {

      tile.visualization.chartType = 'heatmap';
      tile.visualization.xAxis = dimensions[0].alias || dimensions[0].field;
      tile.visualization.yAxis = [dimensions[1].alias || dimensions[1].field];
      tile.visualization.colorField = measures[0].alias || measures[0].field;
    }
  }

  return tile;
}
