
'use client';

import type {
  DashboardTile,
  QueryResult,
  ChartVisualization,
  QueryDefinition,
  QueryFilter,
  QueryDimension,
  QueryMeasure,
  QuerySort,
  ChartType,
} from '@/types/builder';
import type { CustomChartType } from '@/components/chart-detail/SupportingCharts';

export interface AnalyticalChart {

  visualization: ChartVisualization;

  query: QueryDefinition;

  explanation: string;

  customChartType?: CustomChartType;
}

interface AnalyticalChartsResult {

  charts: AnalyticalChart[];

  dataMap: Record<number, QueryResult>;
}

const DIM_ALIASES: Record<string, string> = {
  airline: 'airlines',
  main_category: 'category',
  date_of_event: 'month',
};

function normalizeDimField(field: string): string {
  return DIM_ALIASES[field] || field;
}

const REPORT_DIMENSIONS: Record<string, { label: string; isDate?: boolean }> = {
  branch:                        { label: 'Cabang (Bandara)' },
  station_code:                  { label: 'Kode Bandara' },
  hub:                           { label: 'Hub' },
  airlines:                      { label: 'Maskapai' },
  jenis_maskapai:                { label: 'Jenis Maskapai' },
  category:                      { label: 'Kategori Utama' },
  severity:                      { label: 'Severity' },
  area:                          { label: 'Area' },
  status:                        { label: 'Status' },
  irregularity_complain_category:{ label: 'Sub-Kategori' },
  terminal_area_category:        { label: 'Area Terminal' },
  apron_area_category:           { label: 'Area Apron' },
  general_category:              { label: 'Kategori Umum' },
  month:                         { label: 'Bulan', isDate: true },
  day:                           { label: 'Hari' },
};

const GAPURA_GREEN_LIGHT = '#7cb342';
const GAPURA_GREEN_DARK = '#558b2f';
const GAPURA_BLUE = '#42a5f5';
const GAPURA_YELLOW = '#fdd835';
const GAPURA_RED = '#ef5350';
const GAPURA_ORANGE = '#ffa726';
const GAPURA_GREY = '#bdbdbd';
const GAPURA_AMBER = '#ffca28';

const CROSS_ANALYSIS_PRIORITY = [
  'branch',
  'category',
  'airlines',
  'area',
  'jenis_maskapai',
  'status',
  'irregularity_complain_category',
  'hub',
  'month',
];

function detectMainDimension(tile: DashboardTile): string | null {
  const chartType = tile.visualization.chartType;
  const isPivotOrTable = chartType === 'pivot' || chartType === 'table';

  if (isPivotOrTable) {
    const xAxis = tile.visualization.xAxis;
    if (xAxis) {
      const normalized = normalizeDimField(xAxis);
      if (REPORT_DIMENSIONS[normalized]) return normalized;
    }
  }

  for (const d of tile.query.dimensions || []) {
    if (d.table === 'reports') {
      const normalized = normalizeDimField(d.field);
      if (REPORT_DIMENSIONS[normalized]) return normalized;
    }
  }

  const xAxis = tile.visualization.xAxis;
  if (xAxis) {
    const normalized = normalizeDimField(xAxis);
    if (REPORT_DIMENSIONS[normalized]) return normalized;
  }
  return null;
}

function detectAllDimensions(tile: DashboardTile): Set<string> {
  const dims = new Set<string>();
  for (const d of tile.query.dimensions || []) {
    if (d.table === 'reports') {
      const normalized = normalizeDimField(d.field);
      if (REPORT_DIMENSIONS[normalized]) dims.add(normalized);
    }
  }
  return dims;
}

function buildCrossQuery(
  parentFilters: QueryFilter[],
  dimension: string,
  limit?: number,
): QueryDefinition {
  const dims: QueryDimension[] = [{ table: 'reports', field: dimension }];
  const measures: QueryMeasure[] = [{
    table: 'reports',
    field: 'id',
    function: 'COUNT',
    alias: 'jumlah',
  }];
  const sorts: QuerySort[] = [{ field: 'jumlah', direction: 'desc', alias: 'jumlah' }];

  return {
    source: 'reports',
    joins: [],
    dimensions: dims,
    measures,
    filters: [...parentFilters],
    sorts,
    limit: limit || 10000,
  };
}

function buildStackedQuery(
  parentFilters: QueryFilter[],
  dim1: string,
  dim2: string,
  limit?: number,
): QueryDefinition {
  return {
    source: 'reports',
    joins: [],
    dimensions: [
      { table: 'reports', field: dim1 },
      { table: 'reports', field: dim2 },
    ],
    measures: [{
      table: 'reports',
      field: 'id',
      function: 'COUNT',
      alias: 'jumlah',
    }],
    filters: [...parentFilters],
    sorts: [{ field: 'jumlah', direction: 'desc', alias: 'jumlah' }],
    limit: limit || 10000,
  };
}

function buildTimeTrendQuery(
  parentFilters: QueryFilter[],
  granularity: 'month' | 'day' = 'month',
): QueryDefinition {
  return {
    source: 'reports',
    joins: [],
    dimensions: [{ table: 'reports', field: granularity }],
    measures: [{
      table: 'reports',
      field: 'id',
      function: 'COUNT',
      alias: 'jumlah',
    }],
    filters: [...parentFilters],
    sorts: [{ field: granularity, direction: 'asc' }],
    limit: 10000,
  };
}

function buildReportTableQuery(parentFilters: QueryFilter[]): QueryDefinition {
  return {
    source: 'reports',
    joins: [],
    dimensions: [
      { table: 'reports', field: 'date_of_event', alias: 'Date' },
      { table: 'reports', field: 'main_category', alias: 'Category' },
      { table: 'reports', field: 'branch', alias: 'Branch' },
      { table: 'reports', field: 'airline', alias: 'Airlines' },
      { table: 'reports', field: 'flight_number', alias: 'Flight' },
      { table: 'reports', field: 'description', alias: 'Report' },
      { table: 'reports', field: 'root_caused', alias: 'Root Caused' },
      { table: 'reports', field: 'action_taken', alias: 'Action Taken' },
      { table: 'reports', field: 'evidence_url', alias: 'Evidence Link' },
    ],
    measures: [],
    filters: [...parentFilters],
    sorts: [{ field: 'Date', direction: 'desc' }],
    limit: 10000,
  };
}

export function generateAnalyticalCharts(
  tile: DashboardTile,
  result: QueryResult,
): AnalyticalChartsResult {
  const viz = tile.visualization;
  const mainType = viz.chartType || 'bar';
  const mainDimension = detectMainDimension(tile);
  let parentFilters = tile.query.filters || [];

  const isCgoContext = parentFilters.some(f => f.field === 'source_sheet' && f.value === 'CGO');

  if (!isCgoContext) {
    const hasNonCargo = parentFilters.some(f => (f.field === 'source_sheet' || f.field === 'sheet_name') && f.value === 'NON CARGO');

    if (!hasNonCargo) {
       parentFilters = [
         ...parentFilters, 
         {
           table: 'reports',
           field: 'source_sheet',
           operator: 'eq',
           value: 'NON CARGO',
           conjunction: 'AND'
         }
       ];
    }
  }
  const title = viz.title || 'Data';

  if (result.rows.length < 1) {
    return { charts: [], dataMap: {} };
  }

  const charts: AnalyticalChart[] = [];
  const dataMap: Record<number, QueryResult> = {};
  let idx = 0;

  const NON_VISUAL_TYPES = new Set(['table', 'pivot', 'heatmap']);

  if (!NON_VISUAL_TYPES.has(mainType)) {
    const HIGH_CARDINALITY_DIMS = new Set(['branch', 'station_code', 'airlines']);
    const isHighCardinality = mainDimension && HIGH_CARDINALITY_DIMS.has(mainDimension) && result.rows.length >= 10;

    if (isHighCardinality && mainDimension) {
      const heatmapQuery = buildStackedQuery(parentFilters, mainDimension, 'category', 10000);
      charts.push({
        visualization: {
          chartType: 'heatmap',
          xAxis: mainDimension,
          yAxis: ['category'],
          colorField: 'jumlah',
          title: `${title} — Heatmap per Kategori`,
          showLegend: true,
          showLabels: true,
        },
        query: heatmapQuery,
        explanation: 'Peta panas distribusi laporan: dimensi utama vs kategori (Irregularity/Complaint/Compliment). Warna lebih gelap = volume lebih tinggi.',
      });
      idx++;
    } else {
      const altType = (mainType === 'bar' || mainType === 'horizontal_bar' || mainType === 'stacked_bar')
        ? 'donut' : 'bar';

      charts.push({
        visualization: {
          ...viz,
          chartType: altType,
          title: `${title} — ${altType === 'donut' ? 'Proporsi' : 'Perbandingan'}`,
          showLegend: altType === 'donut',
          showLabels: true,
        },
        query: tile.query,
        explanation: altType === 'donut'
          ? 'Proporsi relatif setiap kategori terhadap total keseluruhan.'
          : 'Perbandingan langsung antar kategori dalam bentuk batang.',
      });
      dataMap[idx] = result;
      idx++;
    }
  }

  const usedDims = detectAllDimensions(tile);
  const crossDimensions = CROSS_ANALYSIS_PRIORITY.filter(d => !usedDims.has(d));

  const crossChartConfigs: Array<{
    dimension: string;
    chartType: 'horizontal_bar' | 'donut' | 'bar' | 'line' | 'grouped_bar' | 'heatmap';
    titlePrefix: string;
    explanation: string;
    limit?: number;
    colors?: string[];
    customChartType?: CustomChartType;
  }> = [];

  for (const dim of crossDimensions) {
    if (crossChartConfigs.length >= 4) break;

    const dimInfo = REPORT_DIMENSIONS[dim];
    if (!dimInfo) continue;

    if (dim === 'branch' || dim === 'station_code') {
      continue;
    } else if (dim === 'airlines') {
      crossChartConfigs.push({
        dimension: dim,
        chartType: 'grouped_bar',
        titlePrefix: `Top Maskapai Penyumbang`,
        explanation: `Maskapai mana yang paling sering terlibat? Data ini membantu prioritisasi engagement dengan mitra.`,
        limit: 10000,
      });
    } else if (dim === 'category') {
      crossChartConfigs.push({
        dimension: dim,
        chartType: 'donut',
        titlePrefix: `Komposisi Kategori`,
        explanation: `Berapa proporsi Irregularity vs Complaint vs Compliment? Indikator health operasional.`,
        colors: [GAPURA_RED, GAPURA_ORANGE, GAPURA_GREEN_LIGHT],
      });
    } else if (dim === 'area') {
      crossChartConfigs.push({
        dimension: dim,
        chartType: 'grouped_bar',
        titlePrefix: `Kategori per Area`,
        explanation: `Distribusi Irregularity, Complaint, dan Compliment di Terminal, Apron, dan General Area.`,
        limit: 10000,
        customChartType: 'area_breakdown',
      });
    } else if (dim === 'jenis_maskapai') {
      crossChartConfigs.push({
        dimension: dim,
        chartType: 'donut',
        titlePrefix: `Breakdown Jenis Maskapai`,
        explanation: `Perbandingan antara maskapai Lokal, MPA, Garuda Indonesia, Citilink, Pelita Air, dll.`,
      });
    } else if (dim === 'status') {
      crossChartConfigs.push({
        dimension: dim,
        chartType: 'donut',
        titlePrefix: `Status Penyelesaian`,
        explanation: `Berapa banyak kasus masih Open vs Closed? Indikator efektivitas penanganan.`,
        colors: [GAPURA_RED, GAPURA_GREEN_LIGHT, GAPURA_YELLOW],
      });
    } else if (dim === 'month') {
      crossChartConfigs.push({
        dimension: dim,
        chartType: 'line',
        titlePrefix: `Tren Bulanan`,
        explanation: `Bagaimana tren volume laporan dari bulan ke bulan? Identifikasi pola musiman dan lonjakan.`,
      });
    } else if (dim === 'irregularity_complain_category') {
      crossChartConfigs.push({
        dimension: dim,
        chartType: 'horizontal_bar',
        titlePrefix: `Detail Sub-Kategori`,
        explanation: `Breakdown lebih detail: sub-kategori apa yang paling dominan?`,
        limit: 10000,
      });
    } else if (dim === 'hub') {
      crossChartConfigs.push({
        dimension: dim,
        chartType: 'bar',
        titlePrefix: `Distribusi per Hub`,
        explanation: `Perbandingan volume laporan antar hub operasional.`,
      });
    }
  }

  for (const config of crossChartConfigs) {
    const isTimeSeries = config.dimension === 'month' || config.dimension === 'day';
    let query;

    const isHeatmapOrGrouped = config.chartType === 'heatmap' || config.chartType === 'grouped_bar';
    if (isHeatmapOrGrouped) {

       query = buildStackedQuery(parentFilters, config.dimension, 'category', config.limit);
    } else {
       query = isTimeSeries
        ? buildTimeTrendQuery(parentFilters, config.dimension as 'month' | 'day')
        : buildCrossQuery(parentFilters, config.dimension, config.limit);
    }

    charts.push({
      visualization: {
        chartType: config.chartType,
        xAxis: config.dimension,
        yAxis: ['jumlah'],
        title: config.titlePrefix,
        showLegend: config.chartType === 'donut',
        showLabels: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        colors: (config as any).colors,
      },
      query,
      explanation: config.explanation,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customChartType: (config as any).customChartType,
    });

    idx++;
  }

  if (!usedDims.has('severity') && false) {
    const severityQuery = buildCrossQuery(parentFilters, 'severity', 10000);
    charts.push({
      visualization: {
        chartType: 'bar',
        xAxis: 'severity',
        yAxis: ['jumlah'],
        title: 'Distribusi Severity',
        showLegend: false,
        showLabels: true,
        colors: [GAPURA_RED, GAPURA_ORANGE, GAPURA_YELLOW, GAPURA_GREEN_LIGHT],
      },
      query: severityQuery,
      explanation: 'Breakdown kasus berdasarkan tingkat keparahan: Critical, High, Medium, Low. Fokus pada kasus kritis untuk penanganan prioritas.',
      customChartType: 'severity_distribution',
    });
    idx++;
  }

  if (!usedDims.has('status') && idx < 10) {
    const statusQuery = buildCrossQuery(parentFilters, 'status', 10000);
    charts.push({
      visualization: {
        chartType: 'donut',
        xAxis: 'status',
        yAxis: ['jumlah'],
        title: 'Status Penyelesaian',
        showLegend: true,
        showLabels: true,
        colors: [GAPURA_GREEN_LIGHT, GAPURA_RED, GAPURA_YELLOW, GAPURA_BLUE, GAPURA_ORANGE],
      },
      query: statusQuery,
      explanation: 'Proporsi status penyelesaian kasus: Selesai, Terbuka, Dalam Proses, Menunggu Feedback, Ditolak. Indikator efektivitas penanganan.',
      customChartType: 'status_breakdown',
    });
    idx++;
  }

  if (!usedDims.has('irregularity_complain_category') && idx < 10) {
    const subCategoryQuery: QueryDefinition = {
      source: 'reports',
      joins: [],
      dimensions: [
        { table: 'reports', field: 'irregularity_complain_category', alias: 'subCategory' },
        { table: 'reports', field: 'category', alias: 'parentCategory' },
      ],
      measures: [{
        table: 'reports',
        field: 'id',
        function: 'COUNT',
        alias: 'count',
      }],
      filters: [
        ...parentFilters,
        { table: 'reports', field: 'irregularity_complain_category', operator: 'is_not_null', value: '', conjunction: 'AND' }
      ],
      sorts: [{ field: 'count', direction: 'desc' }],
      limit: 10000,
    };
    charts.push({
      visualization: {
        chartType: 'horizontal_bar',
        xAxis: 'subCategory',
        yAxis: ['count'],
        title: 'Detail Sub-Kategori',
        showLegend: false,
        showLabels: true,
        displayLimit: 15,
      },
      query: subCategoryQuery,
      explanation: 'Breakdown detail sub-kategori keluhan dan irregularitas. Identifikasi masalah spesifik yang paling sering terjadi.',
      customChartType: 'subcategory_detail',
    });
    idx++;
  }

  if (!usedDims.has('terminal_area_category') && idx < 15) {
    const terminalAreaQuery: QueryDefinition = {
      source: 'reports',
      joins: [],
      dimensions: [
        { table: 'reports', field: 'terminal_area_category', alias: 'Category' },
        { table: 'reports', field: 'area', alias: 'Area' },
      ],
      measures: [{
        table: 'reports',
        field: 'id',
        function: 'COUNT',
        alias: 'Total',
      }],
      filters: [
        ...parentFilters,
        { table: 'reports', field: 'terminal_area_category', operator: 'is_not_null', value: '', conjunction: 'AND' }
      ],
      sorts: [{ field: 'Total', direction: 'desc' }],
      limit: 10000,
    };

    charts.push({
      visualization: {
        chartType: 'horizontal_bar',
        xAxis: 'Category',
        yAxis: ['Total'],
        title: 'Sub-Kategori Area Terminal',
        showLegend: false,
        showLabels: true,
        colors: [GAPURA_BLUE],
        displayLimit: 10,
      },
      query: terminalAreaQuery,
      explanation: 'Breakdown sub-kategori masalah di area Terminal: Check-in, Boarding Gate, Arrival, dll.',
      customChartType: 'area_subcategory',
    });
    idx++;
  }

  if (!usedDims.has('apron_area_category') && idx < 15) {
    const apronAreaQuery: QueryDefinition = {
      source: 'reports',
      joins: [],
      dimensions: [
        { table: 'reports', field: 'apron_area_category', alias: 'Category' },
        { table: 'reports', field: 'area', alias: 'Area' },
      ],
      measures: [{
        table: 'reports',
        field: 'id',
        function: 'COUNT',
        alias: 'Total',
      }],
      filters: [
        ...parentFilters,
        { table: 'reports', field: 'apron_area_category', operator: 'is_not_null', value: '', conjunction: 'AND' }
      ],
      sorts: [{ field: 'Total', direction: 'desc' }],
      limit: 10000,
    };

    charts.push({
      visualization: {
        chartType: 'horizontal_bar',
        xAxis: 'Category',
        yAxis: ['Total'],
        title: 'Sub-Kategori Area Apron',
        showLegend: false,
        showLabels: true,
        colors: [GAPURA_AMBER],
        displayLimit: 10,
      },
      query: apronAreaQuery,
      explanation: 'Breakdown sub-kategori masalah di area Apron: Parking Stand, Taxiway, dll.',
      customChartType: 'area_subcategory',
    });
    idx++;
  }

  if (!usedDims.has('general_category') && idx < 15) {
    const generalCategoryQuery: QueryDefinition = {
      source: 'reports',
      joins: [],
      dimensions: [
        { table: 'reports', field: 'general_category', alias: 'Category' },
        { table: 'reports', field: 'area', alias: 'Area' },
      ],
      measures: [{
        table: 'reports',
        field: 'id',
        function: 'COUNT',
        alias: 'Total',
      }],
      filters: [
        ...parentFilters,
        { table: 'reports', field: 'general_category', operator: 'is_not_null', value: '', conjunction: 'AND' }
      ],
      sorts: [{ field: 'Total', direction: 'desc' }],
      limit: 10000,
    };

    charts.push({
      visualization: {
        chartType: 'horizontal_bar',
        xAxis: 'Category',
        yAxis: ['Total'],
        title: 'Sub-Kategori Area General',
        showLegend: false,
        showLabels: true,
        colors: [GAPURA_GREY],
        displayLimit: 10,
      },
      query: generalCategoryQuery,
      explanation: 'Breakdown sub-kategori masalah di area General: Overall Company Service, Safety Performance, dll.',
      customChartType: 'area_subcategory',
    });
    idx++;
  }

  const HEATMAP_CONFIGS: Record<string, { crossDim: string; title: string; explanation: string; limit: number }> = {
    category:  { crossDim: 'branch',   title: 'Kategori per Bandara',           explanation: 'Bandara mana paling banyak Irregularity/Complaint/Compliment?', limit: 10000 },
    branch:    { crossDim: 'category', title: 'Komposisi Kategori per Bandara',  explanation: 'Breakdown Irregularity/Complaint/Compliment per bandara.',       limit: 10000 },
    station_code: { crossDim: 'category', title: 'Komposisi Kategori per Bandara', explanation: 'Breakdown per stasiun.',                                      limit: 10000 },
    airlines:  { crossDim: 'category', title: 'Kategori per Maskapai',          explanation: 'Maskapai mana paling banyak Complaint vs Irregularity?',         limit: 10000 },
    area:      { crossDim: 'category', title: 'Kategori per Area',              explanation: 'Distribusi Irregularity/Complaint/Compliment di Terminal, Apron, dan General.', limit: 10000 },
    hub:       { crossDim: 'category', title: 'Kategori per Hub',               explanation: 'Breakdown kategori laporan per hub operasional.',                limit: 10000 },
    terminal_area_category: { crossDim: 'branch', title: 'Area Terminal per Bandara', explanation: 'Distribusi sub-kategori Terminal Area per bandara.',        limit: 10000 },
    apron_area_category:    { crossDim: 'branch', title: 'Area Apron per Bandara',    explanation: 'Distribusi sub-kategori Apron Area per bandara.',           limit: 10000 },
    general_category:       { crossDim: 'branch', title: 'Kategori Umum per Bandara', explanation: 'Distribusi sub-kategori Umum per bandara.',                limit: 10000 },
  };

  if (mainDimension && HEATMAP_CONFIGS[mainDimension]) {
    let config = HEATMAP_CONFIGS[mainDimension];

    if (usedDims.has(config.crossDim)) {
      const fallback = mainDimension === 'category' ? 'airlines' : 'area';
      if (!usedDims.has(fallback)) {
        const fallbackLabel = REPORT_DIMENSIONS[fallback]?.label || fallback;
        config = { crossDim: fallback, title: `${REPORT_DIMENSIONS[mainDimension]?.label} per ${fallbackLabel}`, explanation: `Heatmap cross-tabulation ${mainDimension} × ${fallback}.`, limit: 10000 };
      }
    }

    if (!usedDims.has(config.crossDim)) {
      const dim1 = mainDimension;
      const dim2 = config.crossDim;
      const hmQuery = buildStackedQuery(parentFilters, dim1, dim2, config.limit);

      let hmColor = GAPURA_BLUE;
      let configChartType = 'heatmap';

      if (dim1 === 'airlines' || dim1 === 'area') {
        configChartType = 'grouped_bar';
      }
      else if (dim1 === 'category') hmColor = GAPURA_RED;
      else if (dim1 === 'branch') hmColor = GAPURA_GREEN_DARK;

      charts.push({
        visualization: {
          chartType: configChartType as ChartType,
          xAxis: dim2,
          yAxis: [dim1],
          colorField: 'jumlah',
          title: config.title,
          showLegend: true,
          showLabels: true,
          colors: [hmColor],
        },
        query: hmQuery,
        explanation: config.explanation,
      });
      idx++;
    }
  }

  if (!usedDims.has('priority') && idx < 12 && false) {
    const priorityQuery = buildCrossQuery(parentFilters, 'priority', 10000);
    charts.push({
      visualization: {
        chartType: 'bar',
        xAxis: 'priority',
        yAxis: ['jumlah'],
        title: 'Analisis Prioritas',
        showLegend: false,
        showLabels: true,
        colors: [GAPURA_RED, GAPURA_YELLOW, GAPURA_GREEN_LIGHT],
      },
      query: priorityQuery,
      explanation: 'Distribusi kasus berdasarkan tingkat prioritas: High, Medium, Low. Prioritaskan penanganan kasus High Priority.',
      customChartType: 'priority_analysis',
    });
    idx++;
  }

  if (!usedDims.has('jenis_maskapai') && idx < 12) {
    const airlineTypeQuery = buildStackedQuery(parentFilters, 'jenis_maskapai', 'category', 10000);
    charts.push({
      visualization: {
        chartType: 'grouped_bar',
        xAxis: 'jenis_maskapai',
        yAxis: ['jumlah'],
        title: 'Kategori per Jenis Maskapai',
        showLegend: true,
        showLabels: true,
      },
      query: airlineTypeQuery,
      explanation: 'Cross-analysis antara jenis maskapai (Lokal, MPA, Garuda, Citilink, dll) dan kategori kasus. Identifikasi pola maskapai spesifik.',
      customChartType: 'airline_type_category',
    });
    idx++;
  }

  if (!usedDims.has('month') && idx < 12) {
    const monthlyQuery = buildTimeTrendQuery(parentFilters, 'month');
    charts.push({
      visualization: {
        chartType: 'line',
        xAxis: 'month',
        yAxis: ['jumlah'],
        title: 'Tren Bulanan',
        showLegend: false,
        showLabels: true,
      },
      query: monthlyQuery,
      explanation: 'Analisis tren volume laporan dari bulan ke bulan dengan indikator perubahan. Identifikasi pola musiman dan lonjakan kasus.',
      customChartType: 'monthly_trend',
    });
    idx++;
  }

  if (!usedDims.has('category') && idx < 12) {
    const categoryQuery = buildCrossQuery(parentFilters, 'category', 10000);
    charts.push({
      visualization: {
        chartType: 'donut',
        xAxis: 'category',
        yAxis: ['jumlah'],
        title: 'Distribusi Kategori',
        showLegend: true,
        showLabels: true,
        colors: [GAPURA_RED, GAPURA_ORANGE, GAPURA_GREEN_LIGHT],
      },
      query: categoryQuery,
      explanation: 'Proporsi Irregularity vs Complaint vs Compliment dengan Health Score. Indikator kesehatan operasional secara keseluruhan.',
      customChartType: 'category_distribution',
    });
    idx++;
  }

  const reportTableQuery = buildReportTableQuery(parentFilters);
  charts.push({
    visualization: {
      chartType: 'table',
      xAxis: 'Date',
      yAxis: [],
      title: 'Detail Laporan Terkait',
      showLegend: false,
      showLabels: false,
    },
    query: reportTableQuery,
    explanation: 'Daftar lengkap laporan yang mendasari visualisasi di atas. Gunakan ini untuk cross-referencing detail kejadian, penyebab, dan tindakan yang telah diambil.',
  });
  idx++;

  return { charts, dataMap };
}

export async function fetchAnalyticalChartData(
  charts: AnalyticalChart[],
  existingDataMap: Record<number, QueryResult>,
): Promise<Record<number, QueryResult>> {
  const dataMap = { ...existingDataMap };
  const fetchTasks: Array<{ idx: number; query: QueryDefinition }> = [];

  for (let i = 0; i < charts.length; i++) {
    if (dataMap[i]) continue;
    fetchTasks.push({ idx: i, query: charts[i].query });
  }

  if (fetchTasks.length === 0) return dataMap;

  const results = await Promise.allSettled(
    fetchTasks.map(async (task) => {
      const normalizedQuery = {
        ...task.query,
        dimensions: task.query.dimensions || [],
        measures: task.query.measures || [],
        filters: task.query.filters || [],
        joins: task.query.joins || [],
        sorts: task.query.sorts || [],
      };

      const chartTitle = charts[task.idx]?.visualization?.title || '';
      if (chartTitle.includes('Area') || chartTitle.includes('Sub-Kategori')) {
      }

      const res = await fetch('/api/dashboards/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: normalizedQuery }),
      });

      if (!res.ok) throw new Error(`Query failed: ${res.status}`);
      const result: QueryResult = await res.json();

      return { idx: task.idx, result };
    }),
  );

  for (const outcome of results) {
    if (outcome.status === 'fulfilled') {
      dataMap[outcome.value.idx] = outcome.value.result;
    }
  }

  return dataMap;
}
