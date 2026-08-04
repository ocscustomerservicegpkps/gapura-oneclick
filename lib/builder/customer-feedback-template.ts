
import type { DashboardDefinition, DashboardTile, DashboardPage, QueryFilter } from '@/types/builder';

function dateFilters(dateFrom: string, dateTo: string): QueryFilter[] {

  let safeDateTo = dateTo;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    safeDateTo = `${dateTo}T23:59:59`;
  }

  return [
    { table: 'reports', field: 'date_of_event', operator: 'gte' as const, value: dateFrom, conjunction: 'AND' as const },
    { table: 'reports', field: 'date_of_event', operator: 'lte' as const, value: safeDateTo, conjunction: 'AND' as const },
  ];
}

let tileCounter = 0;
function tileId() { return `cft-${Date.now()}-${++tileCounter}`; }

interface DashboardOptions {
  filters?: {
    hubs?: string[];
    branches?: string[];
    airlines?: string[];
    categories?: string[];
    division?: string;
  }
}

function arrayFilter(field: string, values: string[] | undefined): QueryFilter[] {
  if (!values || values.length === 0) return [];
  return [{
    table: 'reports',
    field,
    operator: 'in',
    value: values,
    conjunction: 'AND'
  }];
}

export function generateCustomerFeedbackDashboard(dateFrom: string, dateTo: string, options?: DashboardOptions): DashboardDefinition {
  tileCounter = 0;

  const df = dateFilters(dateFrom, dateTo);

  const nonCargoFilter: QueryFilter = {
    table: 'reports',
    field: 'source_sheet',
    operator: 'eq' as const,
    value: 'NON CARGO',
    conjunction: 'AND' as const
  };

  const hubFilters = arrayFilter('hub', options?.filters?.hubs);
  const branchFilters = arrayFilter('branch', options?.filters?.branches);
  const airlineFilters = arrayFilter('airline', options?.filters?.airlines);

  const categoryFilters = arrayFilter('main_category', options?.filters?.categories);
  const divisionFilter: QueryFilter[] = [];

  const cgoFilter: QueryFilter = { 
    table: 'reports', 
    field: 'source_sheet', 
    operator: 'eq', 
    value: 'CGO', 
    conjunction: 'AND' 
  };

  const baseFilters = [...df, nonCargoFilter, ...hubFilters, ...branchFilters, ...airlineFilters, ...categoryFilters, ...divisionFilter];
  const cgoBaseFilters = [...df, cgoFilter, ...hubFilters, ...branchFilters, ...airlineFilters, ...categoryFilters, ...divisionFilter];

  const displayTitle = 'Customer Feedback Dashboard';
  const displayDescription = 'Comprehensive Customer Feedback Dashboard – Irregularity, Complaint & Compliment Report';


  const page1Tiles: DashboardTile[] = [

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [], dimensions: [],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'total' }],
        filters: [...baseFilters], sorts: [], limit: 1,
      },
      visualization: { chartType: 'kpi', title: 'Report', yAxis: ['total'], showLegend: false, showLabels: false },
      layout: { x: 0, y: 0, w: 3, h: 1 },
    },
    {
      id: tileId(),
      query: {
        source: 'reports', joins: [], dimensions: [],
        measures: [{ table: 'reports', field: 'branch', function: 'COUNT_DISTINCT', alias: 'total' }],
        filters: [...baseFilters], sorts: [], limit: 1,
      },
      visualization: { chartType: 'kpi', title: 'Branch', yAxis: ['total'], showLegend: false, showLabels: false },
      layout: { x: 3, y: 0, w: 3, h: 1 },
    },
    {
      id: tileId(),
      query: {
        source: 'reports', joins: [], dimensions: [],
        measures: [{ table: 'reports', field: 'airline', function: 'COUNT_DISTINCT', alias: 'total' }],
        filters: [...baseFilters], sorts: [], limit: 1,
      },
      visualization: { chartType: 'kpi', title: 'Airlines', yAxis: ['total'], showLegend: false, showLabels: false },
      layout: { x: 6, y: 0, w: 3, h: 1 },
    },
    {
      id: tileId(),
      query: {
        source: 'reports', joins: [], dimensions: [],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'total' }],
        filters: [...baseFilters, { table: 'reports', field: 'main_category', operator: 'eq' as const, value: 'Compliment', conjunction: 'AND' as const }],
        sorts: [], limit: 1,
      },
      visualization: { chartType: 'kpi', title: 'Compliment Report', yAxis: ['total'], showLegend: false, showLabels: false },
      layout: { x: 9, y: 0, w: 3, h: 1 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'category', alias: 'Report Category' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Record Count' }],
        filters: [...baseFilters],
        sorts: [{ field: 'Record Count', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'donut', title: 'Report by Case Category', xAxis: 'Report Category', yAxis: ['Record Count'], showLegend: true, showLabels: true, colors: ['#4caf50', '#00acc1', '#cddc39'] },
      layout: { x: 0, y: 1, w: 3, h: 2 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'branch', alias: 'Branch' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Record Count' }],
        filters: [...baseFilters],
        sorts: [{ field: 'Record Count', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'horizontal_bar', title: 'Branch Report', xAxis: 'Branch', yAxis: ['Record Count'], showLegend: false, showLabels: true, colors: ['#4caf50'] },
      layout: { x: 3, y: 1, w: 3, h: 2 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'airlines', alias: 'Airlines' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Record Count' }],
        filters: [...baseFilters],
        sorts: [{ field: 'Record Count', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'horizontal_bar', title: 'Airlines Report', xAxis: 'Airlines', yAxis: ['Record Count'], showLegend: false, showLabels: true, colors: ['#4caf50'] },
      layout: { x: 6, y: 1, w: 3, h: 2 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'date_of_event', alias: 'Date of Event', dateGranularity: 'month' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Report Count' }],
        filters: [...baseFilters],
        sorts: [{ field: 'Report Count', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'horizontal_bar', title: 'Monthly Report', xAxis: 'Date of Event', yAxis: ['Report Count'], showLegend: false, showLabels: true, displayLimit: 14, colors: ['#4caf50'] },
      layout: { x: 9, y: 1, w: 3, h: 2 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'area', alias: 'Area' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Record Count' }],
        filters: [...baseFilters, { table: 'reports', field: 'area', operator: 'is_not_null' as const, value: '', conjunction: 'AND' as const }],
        sorts: [{ field: 'Record Count', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'donut', title: 'Category by Area', xAxis: 'Area', yAxis: ['Record Count'], showLegend: true, showLabels: true, displayLimit: 5, colors: ['#4caf50', '#00acc1', '#cddc39'] },
      layout: { x: 0, y: 3, w: 3, h: 2 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [
          { table: 'reports', field: 'branch', alias: 'Branch' },
          { table: 'reports', field: 'category', alias: 'Report Category' },
        ],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Record Count' }],
        filters: [...baseFilters],
        sorts: [{ field: 'Record Count', direction: 'desc' }], limit: 200,
      },
      visualization: {
        chartType: 'pivot',
        title: 'Report Category by Branch',
        xAxis: 'Report Category',
        yAxis: ['Branch'],
        showLegend: false,
        showLabels: true,
      },
      layout: { x: 3, y: 3, w: 3, h: 2 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [
          { table: 'reports', field: 'airlines', alias: 'Airlines' },
          { table: 'reports', field: 'category', alias: 'Report Category' },
        ],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Record Count' }],
        filters: [...baseFilters],
        sorts: [{ field: 'Record Count', direction: 'desc' }], limit: 200,
      },
      visualization: {
        chartType: 'pivot',
        title: 'Report Category by Airlines',
        xAxis: 'Report Category',
        yAxis: ['Airlines'],
        showLegend: false,
        showLabels: true,
      },
      layout: { x: 6, y: 3, w: 3, h: 2 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'hub', alias: 'HUB' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Report Count' }],
        filters: [...baseFilters],
        sorts: [{ field: 'Report Count', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'horizontal_bar', title: 'HUB Report', xAxis: 'HUB', yAxis: ['Report Count'], showLegend: false, showLabels: true, colors: ['#81c784'], displayLimit: 10 },
      layout: { x: 9, y: 3, w: 3, h: 2 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'case_classification', alias: 'Case Classification' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Total' }],
        filters: [...baseFilters, { table: 'reports', field: 'case_classification', operator: 'is_not_null' as const, value: '', conjunction: 'AND' as const }],
        sorts: [{ field: 'Total', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'horizontal_bar', title: 'Identification of Root', xAxis: 'Case Classification', yAxis: ['Total'], showLegend: false, showLabels: true, colors: ['#66bb6a'], displayLimit: 10 },
      layout: { x: 0, y: 5, w: 3, h: 2 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'terminal_area_category', alias: 'Terminal Area' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Total' }],
        filters: [...baseFilters, { table: 'reports', field: 'terminal_area_category', operator: 'is_not_null' as const, value: '', conjunction: 'AND' as const }],
        sorts: [{ field: 'Total', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'horizontal_bar', title: 'Landside Area Category', xAxis: 'Terminal Area', yAxis: ['Total'], showLegend: false, showLabels: true, colors: ['#66bb6a'], displayLimit: 10 },
      layout: { x: 3, y: 5, w: 3, h: 2 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'apron_area_category', alias: 'Apron Area' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Total' }],
        filters: [...baseFilters, { table: 'reports', field: 'apron_area_category', operator: 'is_not_null' as const, value: '', conjunction: 'AND' as const }],
        sorts: [{ field: 'Total', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'horizontal_bar', title: 'Airside Area Category', xAxis: 'Apron Area', yAxis: ['Total'], showLegend: false, showLabels: true, colors: ['#66bb6a'], displayLimit: 10 },
      layout: { x: 6, y: 5, w: 3, h: 2 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'general_category', alias: 'General Service' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Total' }],
        filters: [...baseFilters,
          { table: 'reports', field: 'general_category', operator: 'is_not_null' as const, value: '', conjunction: 'AND' as const },
          { table: 'reports', field: 'general_category', operator: 'neq' as const, value: 'Others', conjunction: 'AND' as const },
          { table: 'reports', field: 'general_category', operator: 'neq' as const, value: 'others', conjunction: 'AND' as const },
        ],
        sorts: [{ field: 'Total', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'horizontal_bar', title: 'General Service Category', xAxis: 'General Service', yAxis: ['Total'], showLegend: false, showLabels: true, colors: ['#66bb6a'], displayLimit: 10 },
      layout: { x: 9, y: 5, w: 3, h: 2 },
    },
  ];

  const page2KPIs = page1Tiles.slice(0, 4).map(t => ({ ...t, id: tileId() }));

  const page2Tiles: DashboardTile[] = [
    ...page2KPIs,

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [
          { table: 'reports', field: 'branch', alias: 'Branch Report' },
          { table: 'reports', field: 'area', alias: 'Area' },
        ],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Total' }],
        filters: [...df, nonCargoFilter, ...hubFilters, ...branchFilters, ...airlineFilters, ...categoryFilters, ...divisionFilter],
        sorts: [{ field: 'Total', direction: 'desc' }], 
        limit: 1000,
      },
      visualization: { 
        chartType: 'branch_area_grid', 
        title: 'Case Report by Area',
        xAxis: 'Area',
        yAxis: ['Branch Report'],
        showLegend: true, 
        showLabels: true,
        colors: ['#4caf50', '#81c784', '#a5d6a7', '#c8e6c9', '#e8f5e9'],
      },
      layout: { x: 0, y: 7, w: 12, h: 4 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'terminal_area_category', alias: 'Category' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Total' }],
        filters: [...baseFilters, { table: 'reports', field: 'terminal_area_category', operator: 'is_not_null' as const, value: '', conjunction: 'AND' as const }],
        sorts: [{ field: 'Record Count', direction: 'desc' }], limit: 10000,
      },
      visualization: { 
        chartType: 'horizontal_bar', 
        title: 'Terminal Area Category', 
        xAxis: 'Category', 
        yAxis: ['Total'], 
        showLegend: false, 
        showLabels: true, 
        colors: ['#10b981'],
        crossFiltering: true,
        openLinkInNewTab: true,
        displayLimit: 10
      },
      layout: { x: 6, y: 1, w: 6, h: 2 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'apron_area_category', alias: 'Category' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Total' }],
        filters: [...baseFilters, { table: 'reports', field: 'apron_area_category', operator: 'is_not_null' as const, value: '', conjunction: 'AND' as const }],
        sorts: [{ field: 'count', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'horizontal_bar', title: 'Apron Area Category', xAxis: 'Category', yAxis: ['Total'], showLegend: false, showLabels: true, colors: ['#10b981'], displayLimit: 10 },
      layout: { x: 0, y: 3, w: 6, h: 2 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'general_category', alias: 'Category' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Total' }],
        filters: [...baseFilters, { table: 'reports', field: 'general_category', operator: 'is_not_null' as const, value: '', conjunction: 'AND' as const }],
        sorts: [{ field: 'Total', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'horizontal_bar', title: 'General Category', xAxis: 'Category', yAxis: ['Total'], showLegend: false, showLabels: true, colors: ['#10b981'], displayLimit: 10 },
      layout: { x: 6, y: 3, w: 6, h: 2 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'hub', alias: 'hub' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'count' }],
        filters: [...baseFilters],
        sorts: [{ field: 'count', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'horizontal_bar', title: 'HUB Report', xAxis: 'hub', yAxis: ['count'], showLegend: false, showLabels: true, colors: ['#81c784'], displayLimit: 10 },
      layout: { x: 0, y: 5, w: 6, h: 2 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
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
        filters: [...baseFilters],
        sorts: [{ field: 'Date', direction: 'asc' }], limit: 10000,
      },
      visualization: { chartType: 'table', title: 'Report Landside & Airside', yAxis: [], showLegend: false, showLabels: false },
      layout: { x: 0, y: 11, w: 12, h: 4 },
    },
  ];

  const page3KPIs = page1Tiles.slice(0, 4).map(t => ({ ...t, id: tileId() }));
  const page3Tiles: DashboardTile[] = [
    ...page3KPIs,
    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [
          { table: 'reports', field: 'branch', alias: 'Branch' },
          { table: 'reports', field: 'airline', alias: 'Airlines' },
          { table: 'reports', field: 'status', alias: 'Status' },
        ],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Total' }],
        filters: [...baseFilters],
        sorts: [{ field: 'Total', direction: 'desc' }], 
        limit: 10000,
      },
      visualization: { 
        chartType: 'pivot', 
        title: 'Detail Report Status',
        xAxis: 'Status',
        yAxis: ['Branch', 'Airlines'],
        showLegend: false,
        showLabels: true 
      },
      layout: { x: 0, y: 1, w: 4, h: 2 },
    },
    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [
          { table: 'reports', field: 'branch', alias: 'Branch' },
          { table: 'reports', field: 'status', alias: 'Status' },
        ],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Total' }],
        filters: [...baseFilters],
        sorts: [{ field: 'Total', direction: 'desc' }], 
        limit: 10000,
      },
      visualization: { 
        chartType: 'pivot', 
        title: 'Report Status by Branch',
        xAxis: 'Status',
        yAxis: ['Branch'],
        showLegend: false,
        showLabels: true 
      },
      layout: { x: 4, y: 1, w: 4, h: 2 },
    },
    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [
          { table: 'reports', field: 'airline', alias: 'Airlines' },
          { table: 'reports', field: 'status', alias: 'Status' },
        ],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Total' }],
        filters: [...baseFilters],
        sorts: [{ field: 'Total', direction: 'desc' }], 
        limit: 10000,
      },
      visualization: { 
        chartType: 'pivot', 
        title: 'Report Status by Airlines',
        xAxis: 'Status',
        yAxis: ['Airlines'],
        showLegend: false,
        showLabels: true 
      },
      layout: { x: 8, y: 1, w: 4, h: 2 },
    },
    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'terminal_area_category', alias: 'Terminal Area' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Total' }],
        filters: [...baseFilters, { table: 'reports', field: 'terminal_area_category', operator: 'is_not_null' as const, value: '', conjunction: 'AND' as const }],
        sorts: [{ field: 'Total', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'horizontal_bar', title: 'Landside Area Category', xAxis: 'Terminal Area', yAxis: ['Total'], showLegend: false, showLabels: true, colors: ['#66bb6a'], displayLimit: 10 },
      layout: { x: 0, y: 3, w: 3, h: 2 },
    },
    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'apron_area_category', alias: 'Apron Area' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Total' }],
        filters: [...baseFilters, { table: 'reports', field: 'apron_area_category', operator: 'is_not_null' as const, value: '', conjunction: 'AND' as const }],
        sorts: [{ field: 'Total', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'horizontal_bar', title: 'Airside Area Category', xAxis: 'Apron Area', yAxis: ['Total'], showLegend: false, showLabels: true, colors: ['#66bb6a'], displayLimit: 10 },
      layout: { x: 3, y: 3, w: 3, h: 2 },
    },
    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'general_category', alias: 'General Service' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Total' }],
        filters: [...baseFilters, { table: 'reports', field: 'general_category', operator: 'is_not_null' as const, value: '', conjunction: 'AND' as const }],
        sorts: [{ field: 'Total', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'horizontal_bar', title: 'General Service Category', xAxis: 'General Service', yAxis: ['Total'], showLegend: false, showLabels: true, colors: ['#66bb6a'], displayLimit: 10 },
      layout: { x: 6, y: 3, w: 3, h: 2 },
    },
    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [
          { table: 'reports', field: 'branch', alias: 'Branch' },
          { table: 'reports', field: 'airline', alias: 'Airlines' },
          { table: 'reports', field: 'area', alias: 'Area' },
          { table: 'reports', field: 'main_category', alias: 'Category' },
          { table: 'reports', field: 'root_caused', alias: 'Root' },
        ],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Total' }],
        filters: [...baseFilters, { table: 'reports', field: 'root_caused', operator: 'is_not_null' as const, value: '', conjunction: 'AND' as const }],
        sorts: [{ field: 'Total', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'table', title: 'Root Cause Identification', yAxis: [], showLegend: false, showLabels: false },
      layout: { x: 9, y: 3, w: 3, h: 2 },
    },
    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [
          { table: 'reports', field: 'date_of_event', alias: 'Date' },
          { table: 'reports', field: 'main_category', alias: 'Category' },
          { table: 'reports', field: 'branch', alias: 'Branch' },
          { table: 'reports', field: 'airline', alias: 'Airlines' },
          { table: 'reports', field: 'flight_number', alias: 'Flight' },
          { table: 'reports', field: 'description', alias: 'Report' },
          { table: 'reports', field: 'root_caused', alias: 'Root Caused' },
          { table: 'reports', field: 'preventive_action', alias: 'Final Remarks' },
          { table: 'reports', field: 'status', alias: 'Status' },
        ],
        measures: [],
        filters: [...baseFilters],
        sorts: [{ field: 'Date', direction: 'asc' }], limit: 10000,
      },
      visualization: { chartType: 'table', title: 'Detail Report Landside & Airside', yAxis: [], showLegend: false, showLabels: false },
      layout: { x: 0, y: 5, w: 12, h: 4 },
    },
  ];

  const page4Tiles: DashboardTile[] = [

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [], dimensions: [],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'total' }],
        filters: [...df, cgoFilter, ...hubFilters, ...branchFilters, ...airlineFilters, ...categoryFilters, ...divisionFilter],
        sorts: [], limit: 1,
      },
      visualization: { chartType: 'kpi', title: 'Total Report', yAxis: ['total'], showLegend: false, showLabels: false },
      layout: { x: 0, y: 0, w: 2, h: 1 },
    },
    {
      id: tileId(),
      query: {
        source: 'reports', joins: [], dimensions: [],
        measures: [{ table: 'reports', field: 'branch', function: 'COUNT_DISTINCT', alias: 'total' }],
        filters: [...df, cgoFilter, ...hubFilters, ...branchFilters, ...airlineFilters, ...categoryFilters, ...divisionFilter],
        sorts: [], limit: 1,
      },
      visualization: { chartType: 'kpi', title: 'Branch', yAxis: ['total'], showLegend: false, showLabels: false },
      layout: { x: 2, y: 0, w: 2, h: 1 },
    },
    {
      id: tileId(),
      query: {
        source: 'reports', joins: [], dimensions: [],
        measures: [{ table: 'reports', field: 'airline', function: 'COUNT_DISTINCT', alias: 'total' }],
        filters: [...df, cgoFilter, ...hubFilters, ...branchFilters, ...airlineFilters, ...categoryFilters, ...divisionFilter],
        sorts: [], limit: 1,
      },
      visualization: { chartType: 'kpi', title: 'Airlines', yAxis: ['total'], showLegend: false, showLabels: false },
      layout: { x: 4, y: 0, w: 2, h: 1 },
    },
    {
      id: tileId(),
      query: {
        source: 'reports', joins: [], dimensions: [],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'total' }],
        filters: [...cgoBaseFilters, { table: 'reports', field: 'main_category', operator: 'eq' as const, value: 'Compliment', conjunction: 'AND' as const }],
        sorts: [], limit: 1,
      },
      visualization: { chartType: 'kpi', title: 'Compliment Report', yAxis: ['total'], showLegend: false, showLabels: false },
      layout: { x: 6, y: 0, w: 2, h: 1 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'main_category', alias: 'Category' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Total' }],
        filters: [...df, cgoFilter, ...hubFilters, ...branchFilters, ...airlineFilters, ...categoryFilters, ...divisionFilter],
        sorts: [{ field: 'Total', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'horizontal_bar', title: 'Report by Case Category', xAxis: 'Category', yAxis: ['Total'], showLegend: false, showLabels: true, colors: ['#00acc1', '#81c784', '#ffd54f'], displayLimit: 10 },
      layout: { x: 0, y: 1, w: 4, h: 2 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'branch', alias: 'Branch' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Total' }],
        filters: [...df, cgoFilter, ...hubFilters, ...branchFilters, ...airlineFilters, ...categoryFilters, ...divisionFilter],
        sorts: [{ field: 'Total', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'horizontal_bar', title: 'Report by Branch (Top 10)', xAxis: 'Branch', yAxis: ['Total'], showLegend: false, showLabels: true, colors: ['#81c784'], displayLimit: 10 },
      layout: { x: 4, y: 1, w: 4, h: 2 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'airline', alias: 'Airline' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Total' }],
        filters: [...df, cgoFilter, ...hubFilters, ...branchFilters, ...airlineFilters, ...categoryFilters, ...divisionFilter],
        sorts: [{ field: 'Total', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'horizontal_bar', title: 'Airlines Report', xAxis: 'Airline', yAxis: ['Total'], showLegend: false, showLabels: true, colors: ['#81c784'], displayLimit: 10 },
      layout: { x: 0, y: 3, w: 4, h: 2 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'date_of_event', alias: 'Month', dateGranularity: 'month' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Total' }],
        filters: [...df, cgoFilter, ...hubFilters, ...branchFilters, ...airlineFilters, ...categoryFilters, ...divisionFilter],
        sorts: [{ field: 'Month', direction: 'asc' }], limit: 10000,
      },
      visualization: { chartType: 'horizontal_bar', title: 'Monthly Report', xAxis: 'Month', yAxis: ['Total'], showLegend: false, showLabels: true, colors: ['#81c784'], displayLimit: 14 },
      layout: { x: 4, y: 3, w: 4, h: 2 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'area', alias: 'Area' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Total' }],
        filters: [...df, cgoFilter, ...hubFilters, ...branchFilters, ...airlineFilters, ...categoryFilters, ...divisionFilter],
        sorts: [{ field: 'Total', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'horizontal_bar', title: 'Category by Area', xAxis: 'Area', yAxis: ['Total'], showLegend: true, showLabels: true, colors: ['#00acc1', '#81c784', '#ffd54f'], displayLimit: 5 },
      layout: { x: 0, y: 5, w: 4, h: 2 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [
          { table: 'reports', field: 'branch', alias: 'Reporting Branch' },
          { table: 'reports', field: 'main_category', alias: 'Report Category' },
        ],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Grand total' }],
        filters: [...df, cgoFilter, ...hubFilters, ...branchFilters, ...airlineFilters, ...categoryFilters, ...divisionFilter],
        sorts: [{ field: 'Grand total', direction: 'desc' }], limit: 10000,
      },
      visualization: { 
        chartType: 'pivot', 
        title: 'Case Category by Branch', 
        xAxis: 'Report Category', 
        yAxis: ['Reporting Branch'], 
        showLegend: false, 
        showLabels: true 
      },
      layout: { x: 4, y: 5, w: 4, h: 2 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [
          { table: 'reports', field: 'airline', alias: 'Airlines' },
          { table: 'reports', field: 'main_category', alias: 'Report Category' },
        ],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Grand total' }],
        filters: [...df, cgoFilter, ...hubFilters, ...branchFilters, ...airlineFilters, ...categoryFilters, ...divisionFilter],
        sorts: [{ field: 'Grand total', direction: 'desc' }], limit: 10000,
      },
      visualization: { 
        chartType: 'pivot', 
        title: 'Case Category by Airlines', 
        xAxis: 'Report Category', 
        yAxis: ['Airlines'], 
        showLegend: false, 
        showLabels: true 
      },
      layout: { x: 0, y: 7, w: 8, h: 2 },
    },
  ];

  const page5Tiles: DashboardTile[] = [

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [], dimensions: [],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'total' }],
        filters: [...cgoBaseFilters],
        sorts: [], limit: 1,
      },
      visualization: { chartType: 'kpi', title: 'Total Report', yAxis: ['total'], showLegend: false, showLabels: false },
      layout: { x: 0, y: 0, w: 2, h: 1 },
    },
    {
      id: tileId(),
      query: {
        source: 'reports', joins: [], dimensions: [],
        measures: [{ table: 'reports', field: 'branch', function: 'COUNT_DISTINCT', alias: 'total' }],
        filters: [...cgoBaseFilters],
        sorts: [], limit: 1,
      },
      visualization: { chartType: 'kpi', title: 'Branch', yAxis: ['total'], showLegend: false, showLabels: false },
      layout: { x: 2, y: 0, w: 2, h: 1 },
    },
    {
      id: tileId(),
      query: {
        source: 'reports', joins: [], dimensions: [],
        measures: [{ table: 'reports', field: 'airline', function: 'COUNT_DISTINCT', alias: 'total' }],
        filters: [...cgoBaseFilters],
        sorts: [], limit: 1,
      },
      visualization: { chartType: 'kpi', title: 'Airlines', yAxis: ['total'], showLegend: false, showLabels: false },
      layout: { x: 4, y: 0, w: 2, h: 1 },
    },
    {
      id: tileId(),
      query: {
        source: 'reports', joins: [], dimensions: [],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'total' }],
        filters: [...cgoBaseFilters, { table: 'reports', field: 'main_category', operator: 'eq' as const, value: 'Compliment', conjunction: 'AND' as const }],
        sorts: [], limit: 1,
      },
      visualization: { chartType: 'kpi', title: 'Compliment Report', yAxis: ['total'], showLegend: false, showLabels: false },
      layout: { x: 6, y: 0, w: 2, h: 1 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [
          { table: 'reports', field: 'branch', alias: 'Branch Report' },
          { table: 'reports', field: 'airline', alias: 'Airlines' },
          { table: 'reports', field: 'area', alias: 'Area' },
        ],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Grand total' }],
        filters: [...cgoBaseFilters],
        sorts: [{ field: 'Grand total', direction: 'desc' }],
        limit: 10000,
      },
      visualization: {
        chartType: 'branch_area_grid',
        title: 'Case Report by Area',
        xAxis: 'Area',
        yAxis: ['Branch Report', 'Airlines'],
        showLegend: true,
        showLabels: true,
        colors: ['#4caf50', '#81c784', '#a5d6a7', '#c8e6c9', '#e8f5e9'],
      },
      layout: { x: 0, y: 1, w: 8, h: 4 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'terminal_area_category', alias: 'Category' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Total' }],
        filters: [...cgoBaseFilters, { table: 'reports', field: 'area', operator: 'eq' as const, value: 'Terminal Area', conjunction: 'AND' as const }],
        sorts: [{ field: 'Total', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'horizontal_bar', title: 'Terminal Area Category', xAxis: 'Category', yAxis: ['Total'], showLegend: false, showLabels: true, colors: ['#66bb6a'], displayLimit: 10 },
      layout: { x: 0, y: 5, w: 4, h: 4 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'apron_area_category', alias: 'Category' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Total' }],
        filters: [...cgoBaseFilters, { table: 'reports', field: 'area', operator: 'eq' as const, value: 'Apron Area', conjunction: 'AND' as const }],
        sorts: [{ field: 'Total', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'horizontal_bar', title: 'Apron Area Category', xAxis: 'Category', yAxis: ['Total'], showLegend: false, showLabels: true, colors: ['#66bb6a'], displayLimit: 10 },
      layout: { x: 4, y: 5, w: 4, h: 4 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'general_category', alias: 'Category' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'Total' }],
        filters: [...cgoBaseFilters, { table: 'reports', field: 'area', operator: 'eq' as const, value: 'General', conjunction: 'AND' as const }],
        sorts: [{ field: 'Total', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'horizontal_bar', title: 'General Category', xAxis: 'Category', yAxis: ['Total'], showLegend: false, showLabels: true, colors: ['#66bb6a'], displayLimit: 10 },
      layout: { x: 0, y: 9, w: 8, h: 4 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [{ table: 'reports', field: 'hub', alias: 'hub' }],
        measures: [{ table: 'reports', field: 'id', function: 'COUNT', alias: 'count' }],
        filters: [...cgoBaseFilters],
        sorts: [{ field: 'count', direction: 'desc' }], limit: 10000,
      },
      visualization: { chartType: 'horizontal_bar', title: 'HUB Report', xAxis: 'hub', yAxis: ['count'], showLegend: false, showLabels: true, colors: ['#81c784'], displayLimit: 10 },
      layout: { x: 0, y: 13, w: 8, h: 4 },
    },

    {
      id: tileId(),
      query: {
        source: 'reports', joins: [],
        dimensions: [
          { table: 'reports', field: 'date_of_event', alias: 'Date' },
          { table: 'reports', field: 'main_category', alias: 'Category' },
          { table: 'reports', field: 'branch', alias: 'Branch Report' },
          { table: 'reports', field: 'airline', alias: 'Airlines' },
          { table: 'reports', field: 'flight_number', alias: 'Flight' },
          { table: 'reports', field: 'report', alias: 'Report' },
          { table: 'reports', field: 'root_caused', alias: 'Root Caused' }, 
          { table: 'reports', field: 'action_taken', alias: 'Action Taken' },

        ],
        measures: [],
        filters: [...cgoBaseFilters],
        sorts: [{ field: 'Date', direction: 'asc' }], limit: 5000,
      },
      visualization: { chartType: 'table', title: 'Detail Report Landside & Airside', yAxis: [], showLegend: false, showLabels: false },
      layout: { x: 0, y: 17, w: 8, h: 6 },
    },
  ];

  const pages: DashboardPage[] = [
    { name: 'Report Category', tiles: page1Tiles },
    { name: 'Detail Category', tiles: page2Tiles },
    { name: 'Status Analytics', tiles: page3Tiles },
    { name: 'CGO - Report Category', tiles: page4Tiles },
    { name: 'CGO - Detail Report', tiles: page5Tiles },
  ];

  const allTiles = pages.flatMap(p => p.tiles);

  return {
    name: displayTitle,
    description: displayDescription,
    tiles: allTiles,
    pages,
    globalFilters: [],
    refreshInterval: 300,
  };
}
