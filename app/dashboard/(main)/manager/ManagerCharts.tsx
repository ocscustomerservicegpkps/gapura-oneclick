'use client';

import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, PieChart, Pie, Cell,
    Area, ComposedChart, Line,
} from 'recharts';
import { Activity } from 'lucide-react';

const C = {
    primary: '#0072B2',
    secondary: '#E69300',
    tertiary: '#009E9D',
    accent: '#D55E00',
    purple: '#792F8E',
    yellow: '#F0E442',
    steel: '#6B7FAF',
    dark: '#0F4C5A',
};

const CATEGORY_COLORS: Record<string, string> = {
    Irregularity: C.secondary,
    Complaint: C.accent,
    Compliment: C.tertiary,
};

const SEVERITY_COLORS: Record<string, string> = {
    'TOP RISK': C.accent,
    'HIGH RISK': C.secondary,
    MEDIUM: '#c9b82d',
    LOW: C.tertiary,
};

const STATUS_COLORS: Record<string, string> = {
    Open: C.secondary,
    Closed: C.tertiary,
};

const SERIES = [C.primary, C.secondary, C.tertiary, C.accent, C.purple, C.steel, C.dark, C.yellow];

export interface ReportRow {
    id: string;
    status: string | null;
    severity: string | null;
    main_category: string | null;
    category: string | null;
    airline: string | null;
    airlines: string | null;
    area: string | null;
    date_of_event: string | null;
    created_at: string;
    source_sheet: string | null;
}

export interface DashboardData {
    station: { code: string; name: string };
    summary: { total: number; open: number; closed: number; resolutionRate: number };
    categoryDistribution: { name: string; value: number }[];
    severityDistribution: { name: string; value: number }[];
    areaDistribution: { name: string; value: number }[];
    topAirlines: { name: string; value: number }[];
    monthlyTrend: { month: string; rawMonth: string; total: number; Irregularity: number; Complaint: number; Compliment: number }[];
    statusDistribution: { name: string; value: number }[];
    rows: ReportRow[];
}

const RADIAN = Math.PI / 180;

interface PieLabelProps {
    cx?: number;
    cy?: number;
    midAngle?: number;
    outerRadius?: number;
    name?: string;
    value: number;
    payload?: { total?: number };
}

interface BarLabelProps {
    x: number;
    y: number;
    width: number;
    height: number;
    value: number;
}

interface PointLabelProps {
    x?: number;
    y?: number;
    value?: number | string;
}

function renderPieLabel({ cx = 0, cy = 0, midAngle = 0, outerRadius = 0, name = '', value = 0, payload }: PieLabelProps) {
    const total = payload?.total || 0;
    const pctValue = total > 0 ? (value / total) * 100 : 0;
    // Slices this thin sit close enough to their neighbors that fixed-angle
    // outside labels collide and render illegibly on top of each other.
    // The value is still visible via tooltip/legend, so just skip the label.
    if (pctValue < 4) return null;
    const pct = pctValue.toFixed(0);
    const radius = outerRadius + 18;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const anchor = x > cx ? 'start' : 'end';
    return (
        <g>
            <line
                x1={cx + (outerRadius + 2) * Math.cos(-midAngle * RADIAN)}
                y1={cy + (outerRadius + 2) * Math.sin(-midAngle * RADIAN)}
                x2={cx + (outerRadius + 12) * Math.cos(-midAngle * RADIAN)}
                y2={cy + (outerRadius + 12) * Math.sin(-midAngle * RADIAN)}
                stroke="#9CA3AF"
                strokeWidth={1}
            />
            <text x={x} y={y - 6} textAnchor={anchor} fill="#1f2937" fontSize={11} fontWeight={700}>
                {name}
            </text>
            <text x={x} y={y + 8} textAnchor={anchor} fill="#6b7280" fontSize={10} fontWeight={500}>
                {value} ({pct}%)
            </text>
        </g>
    );
}

function makeBarLabelVertical(grandTotal: number) {
    return function BarLabelVertical({ x, y, width, value }: BarLabelProps) {
        const pct = grandTotal > 0 ? ((value / grandTotal) * 100).toFixed(0) : '0';
        return (
            <g>
                <text x={x + width / 2} y={y - 14} textAnchor="middle" fill="#1f2937" fontSize={11} fontWeight={700}>
                    {value}
                </text>
                <text x={x + width / 2} y={y - 2} textAnchor="middle" fill="#9CA3AF" fontSize={9} fontWeight={500}>
                    {pct}%
                </text>
            </g>
        );
    };
}

function makeBarLabelHorizontal(grandTotal: number) {
    return function BarLabelHorizontal({ x, y, width, height, value }: BarLabelProps) {
        const pct = grandTotal > 0 ? ((value / grandTotal) * 100).toFixed(0) : '0';
        const labelX = x + width + 6;
        const labelY = y + height / 2;
        return (
            <g>
                <text x={labelX} y={labelY - 4} textAnchor="start" fill="#1f2937" fontSize={10} fontWeight={700}>
                    {value}
                </text>
                <text x={labelX} y={labelY + 9} textAnchor="start" fill="#9CA3AF" fontSize={9} fontWeight={500}>
                    {pct}%
                </text>
            </g>
        );
    };
}

function ChartCard({ title, subtitle, hint, children }: { title: string; subtitle?: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-[1.5rem] p-5 md:p-6 border border-gray-100 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-2">
                <div>
                    <h3 className="text-sm font-display font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                        {title}
                    </h3>
                    {subtitle && (
                        <p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
                    )}
                </div>
                {hint && (
                    <span className="shrink-0 text-[10px] font-medium text-gray-400 mt-0.5">{hint}</span>
                )}
            </div>
            {children}
        </div>
    );
}

function monthKey(r: ReportRow) {
    const d = new Date(r.date_of_event || r.created_at);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface ManagerChartsProps {
    data: DashboardData;
    openDrilldown: (rows: ReportRow[], title: string) => void;
}

export function ManagerCharts({ data, openDrilldown }: ManagerChartsProps) {
    const { summary, categoryDistribution, severityDistribution, areaDistribution, topAirlines, monthlyTrend, statusDistribution, rows } = data;
    const total = summary.total;
    const stationCode = data.station.code;

    const catWithTotal = categoryDistribution.map(d => ({ ...d, total }));
    const statusWithTotal = statusDistribution.map(d => ({ ...d, total }));
    const sevWithTotal = severityDistribution.map(d => ({ ...d, total }));
    const areaWithTotal = areaDistribution.map(d => ({ ...d, total }));
    const airlineWithTotal = topAirlines.map(d => ({ ...d, total }));

    return (
        <>
            {}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ChartCard title="Category Distribution" subtitle={`${total} total reports`} hint="Click segment for detail">
                    <div style={{ height: 320, width: '100%' }}>
                        {catWithTotal.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
                                    <Pie
                                      isAnimationActive={false}
                                        data={catWithTotal}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={3}
                                        dataKey="value"
                                        nameKey="name"
                                        labelLine={false}
                                        label={renderPieLabel}
                                        style={{ cursor: 'pointer' }}
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        onClick={(entry: any) => {
                                            const cat = entry.name as string;
                                            openDrilldown(rows.filter(r => (r.main_category || r.category || 'Other') === cat), `Category: ${cat}`);
                                        }}
                                    >
                                        {catWithTotal.map((entry, i) => (
                                            <Cell key={i} fill={CATEGORY_COLORS[entry.name] || SERIES[i % SERIES.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(val: number, name: string) => [`${val} (${((val / total) * 100).toFixed(1)}%)`, name]} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ height: 320 }} className="flex items-center justify-center text-xs text-gray-400">No data available</div>
                        )}
                    </div>
                </ChartCard>

                <ChartCard title="Severity Distribution" subtitle={`${total} total reports`} hint="Click bar for detail">
                    <div style={{ height: 320, width: '100%' }}>
                        {sevWithTotal.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={sevWithTotal} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} />
                                    <YAxis tick={{ fontSize: 11 }} width={40} />
                                    <Tooltip formatter={(val: number) => [`${val} (${((val / total) * 100).toFixed(1)}%)`, 'Count']} />
                                    <Bar
                                        dataKey="value"
                                        name="Count"
                                        radius={[8, 8, 0, 0]}
                                        barSize={48}
                                        label={makeBarLabelVertical(total)}
                                        style={{ cursor: 'pointer' }}
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        onClick={(data: any) => {
                                            openDrilldown(rows.filter(r => (r.severity || 'UNKNOWN') === data.name), `Severity: ${data.name}`);
                                        }}
                                    >
                                        {sevWithTotal.map((entry, i) => (
                                            <Cell key={i} fill={SEVERITY_COLORS[entry.name] || SERIES[i]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ height: 320 }} className="flex items-center justify-center text-xs text-gray-400">No data available</div>
                        )}
                    </div>
                </ChartCard>
            </div>

            {}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ChartCard title="Report Status" subtitle="Open vs Closed" hint="Click segment for detail">
                    <div style={{ height: 300, width: '100%' }}>
                        {statusWithTotal.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
                                    <Pie
                                      isAnimationActive={false}
                                        data={statusWithTotal}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={4}
                                        dataKey="value"
                                        nameKey="name"
                                        labelLine={false}
                                        label={renderPieLabel}
                                        style={{ cursor: 'pointer' }}
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        onClick={(entry: any) => {
                                            const statusVal = entry.name === 'Open' ? 'OPEN' : 'CLOSED';
                                            openDrilldown(rows.filter(r => r.status === statusVal), `Status: ${entry.name}`);
                                        }}
                                    >
                                        {statusWithTotal.map((entry, i) => (
                                            <Cell key={i} fill={STATUS_COLORS[entry.name] || SERIES[i]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(val: number, name: string) => [`${val} (${((val / total) * 100).toFixed(1)}%)`, name]} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ height: 300 }} className="flex items-center justify-center text-xs text-gray-400">No data available</div>
                        )}
                    </div>
                </ChartCard>

                <ChartCard title="Area Distribution" subtitle="Terminal / Apron / General" hint="Click bar for detail">
                    <div style={{ height: 300, width: '100%' }}>
                        {areaWithTotal.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={areaWithTotal} layout="vertical" margin={{ top: 8, right: 60, left: 8, bottom: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 11 }} />
                                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fontWeight: 500 }} />
                                    <Tooltip formatter={(val: number) => [`${val} (${((val / total) * 100).toFixed(1)}%)`, 'Count']} />
                                    <Bar
                                        dataKey="value"
                                        name="Count"
                                        radius={[0, 8, 8, 0]}
                                        barSize={28}
                                        label={makeBarLabelHorizontal(total)}
                                        style={{ cursor: 'pointer' }}
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        onClick={(data: any) => {
                                            openDrilldown(rows.filter(r => (r.area || 'Unknown') === data.name), `Area: ${data.name}`);
                                        }}
                                    >
                                        {areaWithTotal.map((_, i) => (
                                            <Cell key={i} fill={SERIES[i % SERIES.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ height: 300 }} className="flex items-center justify-center text-xs text-gray-400">No data available</div>
                        )}
                    </div>
                </ChartCard>
            </div>

            {}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ChartCard title="Monthly Trend" subtitle="Last 12 months" hint="Click point/area for detail">
                    <div style={{ height: 380, width: '100%' }}>
                        {monthlyTrend.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart
                                    data={monthlyTrend}
                                    margin={{ top: 20, right: 16, left: 0, bottom: 64 }}
                                    style={{ cursor: 'pointer' }}
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    onClick={(chartData: any) => {
                                        const p = chartData?.activePayload?.[0]?.payload;
                                        if (!p) return;
                                        openDrilldown(rows.filter(r => monthKey(r) === p.rawMonth), `Month: ${p.month}`);
                                    }}
                                >
                                    <defs>
                                        <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={C.primary} stopOpacity={0.12} />
                                            <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                                    <XAxis dataKey="month" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={78} tickMargin={14} interval={0} />
                                    <YAxis tick={{ fontSize: 11 }} width={40} />
                                    <Tooltip />
                                    <Legend verticalAlign="top" height={28} />
                                    <Area type="monotone" dataKey="total" stroke="none" fill="url(#gradArea)" legendType="none" tooltipType="none" activeDot={false} />
                                    <Line type="monotone" dataKey="total" name="Total" stroke={C.primary} strokeWidth={2.5} dot={{ r: 4, fill: C.primary, stroke: '#fff', strokeWidth: 2 }}
                                        label={({ x, y, value }: PointLabelProps) => {
                                            if (typeof x !== 'number' || typeof y !== 'number') return null;
                                            return (
                                                <text x={x} y={y - 10} textAnchor="middle" fill={C.primary} fontSize={10} fontWeight={700}>{value}</text>
                                            );
                                        }}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ height: 380 }} className="flex items-center justify-center text-xs text-gray-400">No data available</div>
                        )}
                    </div>
                </ChartCard>

                <ChartCard title="Monthly Trend by Category" subtitle="Stacked by Irregularity / Complaint / Compliment" hint="Click bar for detail">
                    <div style={{ height: 380, width: '100%' }}>
                        {monthlyTrend.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={monthlyTrend}
                                    margin={{ top: 20, right: 16, left: 0, bottom: 64 }}
                                    style={{ cursor: 'pointer' }}
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    onClick={(chartData: any) => {
                                        const p = chartData?.activePayload?.[0]?.payload;
                                        const cat = chartData?.activePayload?.[0]?.name as string | undefined;
                                        if (!p || !cat) return;
                                        openDrilldown(rows.filter(r => monthKey(r) === p.rawMonth && (r.main_category || r.category) === cat), `${cat} – ${p.month}`);
                                    }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                                    <XAxis dataKey="month" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={78} tickMargin={14} interval={0} />
                                    <YAxis tick={{ fontSize: 11 }} width={40} />
                                    <Tooltip />
                                    <Legend verticalAlign="top" height={28} />
                                    <Bar dataKey="Irregularity" name="Irregularity" fill={C.secondary} radius={[0, 0, 0, 0]} stackId="a" />
                                    <Bar dataKey="Complaint" name="Complaint" fill={C.accent} radius={[0, 0, 0, 0]} stackId="a" />
                                    <Bar dataKey="Compliment" name="Compliment" fill={C.tertiary} radius={[4, 4, 0, 0]} stackId="a"
                                        label={{ position: 'top', fill: '#374151', fontSize: 10, fontWeight: 700, formatter: (val: number) => val > 0 ? val : '' }}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ height: 380 }} className="flex items-center justify-center text-xs text-gray-400">No data available</div>
                        )}
                    </div>
                </ChartCard>
            </div>

            {}
            <ChartCard title="Top 10 Airlines" subtitle="Based on number of reports" hint="Click bar for detail">
                <div style={{ height: topAirlines.length * 36 + 40, width: '100%' }}>
                    {airlineWithTotal.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={airlineWithTotal} layout="vertical" margin={{ top: 8, right: 70, left: 8, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 10, fontWeight: 500 }} />
                                <Tooltip formatter={(val: number) => [`${val} (${((val / total) * 100).toFixed(1)}%)`, 'Reports']} />
                                <Bar
                                    dataKey="value"
                                    name="Reports"
                                    radius={[0, 6, 6, 0]}
                                    barSize={20}
                                    label={makeBarLabelHorizontal(total)}
                                    style={{ cursor: 'pointer' }}
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    onClick={(data: any) => {
                                        openDrilldown(rows.filter(r => (r.airline || r.airlines || 'Unknown') === data.name), `Airline: ${data.name}`);
                                    }}
                                >
                                    {airlineWithTotal.map((_, i) => (
                                        <Cell key={i} fill={SERIES[i % SERIES.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ height: 200 }} className="flex items-center justify-center text-xs text-gray-400">No data available</div>
                    )}
                </div>
            </ChartCard>

            <div className="flex items-center gap-2 pt-2">
                <Activity size={12} style={{ color: 'var(--text-muted)' }} />
                <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                    Data from reports_sync &bull; Scope: station {stationCode}
                </p>
            </div>
        </>
    );
}
