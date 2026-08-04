
export type DateGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

export type AggregateFunction = 'COUNT' | 'COUNT_DISTINCT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';

export type FilterOperator =
  | 'eq' | 'neq'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'in' | 'not_in'
  | 'like'
  | 'between'
  | 'is_null' | 'is_not_null';

export type FilterConjunction = 'AND' | 'OR';

export interface QueryDimension {

  table: string;

  field: string;

  alias?: string;

  dateGranularity?: DateGranularity;
}

export interface QueryMeasure {

  table: string;

  field: string;

  function: AggregateFunction;

  alias?: string;
}

export interface QueryFilter {

  table: string;

  field: string;

  operator: FilterOperator;

  value: string | number | boolean | string[] | number[] | null;

  conjunction: FilterConjunction;

  _tag?: string;
}

export interface QuerySort {

  field: string;

  direction: 'asc' | 'desc';

  alias?: string;
}

export interface QueryJoin {

  from: string;

  to: string;

  joinKey: string;
}

export interface QueryDefinition {

  source: string;

  joins: QueryJoin[];

  dimensions: QueryDimension[];

  measures: QueryMeasure[];

  filters: QueryFilter[];

  sorts: QuerySort[];

  limit?: number;
}

export type ChartType =
  | 'bar'
  | 'horizontal_bar'
  | 'stacked_bar'
  | 'grouped_bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'heatmap'
  | 'table'
  | 'pivot'
  | 'kpi'
  | 'branch_area_grid'
  | 'combo';

export interface ChartVisualization {

  chartType: ChartType;

  xAxis?: string;

  yAxis: string[];

  colorField?: string;

  title?: string;

  showLegend: boolean;

  showLabels?: boolean;

  displayLimit?: number;

  colors?: string[];

  crossFiltering?: boolean;

  openLinkInNewTab?: boolean;
}

export interface TileLayout {

  x: number;

  y: number;

  w: number;

  h: number;
}

export interface DashboardTile {

  id: string;

  query: QueryDefinition;

  visualization: ChartVisualization;

  layout: TileLayout;
}

export interface GlobalFilter {

  field: string;

  table: string;

  operator: FilterOperator;

  value: string | number | boolean | string[] | null;
}

export interface DashboardPage {

  name: string;

  tiles: DashboardTile[];
}

export interface DashboardDefinition {

  name: string;

  description?: string;

  folder?: string;

  tiles: DashboardTile[];

  pages?: DashboardPage[];

  globalFilters?: GlobalFilter[];

  refreshInterval?: number;
}

export interface QueryResult {

  columns: string[];

  rows: Record<string, unknown>[];

  rowCount: number;

  executionTimeMs: number;
}

export type FieldType = 'string' | 'number' | 'date' | 'datetime' | 'boolean' | 'uuid';

export interface FieldDef {

  name: string;

  label: string;

  type: FieldType;

  enumValues?: string[];
}

export interface TableDef {

  name: string;

  label: string;

  fields: FieldDef[];
}

export interface JoinDef {

  key: string;

  from: string;

  fromField: string;

  to: string;

  toField: string;

  label: string;
}
