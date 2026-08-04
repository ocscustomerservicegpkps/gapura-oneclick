
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getPublicDashboardPageData } from '@/lib/public-dashboard-data';
import type { DashboardScopeFilters } from '@/lib/dashboard-query-scope';

const PUBLIC_DASHBOARD_CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=300',
  'CDN-Cache-Control': 'public, s-maxage=180, stale-while-revalidate=300',
} as const;

const PRIVATE_DASHBOARD_CACHE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
} as const;

interface DashboardConfig {

  dateRange?: string;

  autoRefresh?: boolean;

  theme?: 'dark' | 'light';

  dateFrom?: string;

  dateTo?: string;

  subtitle?: string;

  filters?: string[];

  pages?: string[];
}

interface ChartConfig {

  title: string;

  chartType: string;

  dataField: string;

  width: 'full' | 'half' | 'third';

  position: number;

  query_config?: Record<string, unknown>;

  visualization_config?: Record<string, unknown>;

  layout?: Record<string, unknown>;

  page_name?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const includeData = searchParams.get('includeData') === '1';
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value || null;
    const payload = token ? await verifySession(token) : null;
    const role = String(payload?.role || '').trim().toUpperCase();
    const allowCF = role === 'ANALYST' || role === 'SUPER_ADMIN' || (role === 'DIVISI_OS' || role === 'DIVISI_OCS');

    if (slug) {
      if (includeData) {
        const filters: DashboardScopeFilters = {
          hub: searchParams.get('hub') || undefined,
          branch: searchParams.get('branch') || undefined,
          maskapai: searchParams.get('maskapai') || undefined,
          airline: searchParams.get('airline') || undefined,
          main_category: searchParams.get('main_category') || undefined,
          area: searchParams.get('area') || undefined,
          severity: searchParams.get('severity') || undefined,
          status: searchParams.get('status') || undefined,
        };
        const pageIndex = Math.max(parseInt(searchParams.get('pageIndex') || '0', 10), 0);
        const range = searchParams.get('range') || '7d';
        const payload = await getPublicDashboardPageData({
          slug,
          pageIndex,
          range,
          filters,
          dateFrom: searchParams.get('dateFrom') || undefined,
          dateTo: searchParams.get('dateTo') || undefined,
        });

        return NextResponse.json(payload, { headers: PUBLIC_DASHBOARD_CACHE_HEADERS });
      }

      const { data: dashboard, error } = await supabaseAdmin
        .from('custom_dashboards')
        .select(`
          id,
          name,
          description,
          slug,
          config,
          created_at,
          dashboard_charts (
            id,
            title,
            chart_type,
            data_field,
            position,
            width,
            config,
            query_config,
            visualization_config,
            layout,
            page_name
          )
        `)
        .eq('slug', slug)
        .eq('is_public', true)
        .single();

      if (error || !dashboard) {
        return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
      }

      return NextResponse.json(dashboard, { headers: PUBLIC_DASHBOARD_CACHE_HEADERS });
    }

    const tileId = searchParams.get('tileId');
    if (tileId) {
        const { data: chart, error } = await supabaseAdmin
            .from('dashboard_charts')
            .select(`
                id,
                title,
                chart_type,
                data_field,
                position,
                width,
                config,
                query_config,
                visualization_config,
                layout,
                page_name,
                custom_dashboards (
                    id,
                    slug,
                    is_public
                )
            `)
            .eq('id', tileId)
            .single();

        if (error || !chart) {
          return NextResponse.json({ error: 'Tile not found' }, { status: 404 });
        }

        const chartDashboard = (chart as {
          custom_dashboards?: { is_public?: boolean; slug?: string };
        } | null)?.custom_dashboards;
        const isPublic = chartDashboard?.is_public;
        if (!isPublic) {
          return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
        }

        return NextResponse.json(chart, { headers: PUBLIC_DASHBOARD_CACHE_HEADERS });
    }

    const { data: dashboards, error } = await supabaseAdmin
      .from('custom_dashboards')
      .select('id, name, description, slug, folder, created_at')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const filtered = allowCF ? dashboards : (dashboards || []).filter(d => !String(d.slug || '').toLowerCase().includes('customer-feedback'));

    return NextResponse.json({ dashboards: filtered }, {
      headers: allowCF
        ? PRIVATE_DASHBOARD_CACHE_HEADERS
        : PUBLIC_DASHBOARD_CACHE_HEADERS,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value ?? null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const session = await verifySession(token);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { name, description, charts, config, folder } = body as {
      name: string;
      description?: string;
      charts: ChartConfig[];
      config?: DashboardConfig;
      folder?: string;
    };

    if (!name || !charts || charts.length === 0) {
      return NextResponse.json({ error: 'Name and at least one chart required' }, { status: 400 });
    }

    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    const slug = `${baseSlug}-${Date.now().toString(36)}`;

    const { data: dashboard, error: dashError } = await supabaseAdmin
      .from('custom_dashboards')
      .insert({
        name,
        description: description || null,
        slug,
        config: config || { dateRange: '7d', autoRefresh: true, theme: 'dark' },
        is_public: true,
        folder: folder || null
      })
      .select('id, slug')
      .single();

    if (dashError || !dashboard) {
      return NextResponse.json({ error: dashError?.message || 'Failed to create dashboard' }, { status: 500 });
    }

    const chartInserts = charts.map((c, i) => ({
      dashboard_id: dashboard.id,
      title: c.title,
      chart_type: c.chartType,
      data_field: c.dataField,
      width: c.width || 'half',
      position: c.position ?? i,
      config: {},
      query_config: c.query_config || null,
      visualization_config: c.visualization_config || null,
      layout: c.layout || null,
      page_name: c.page_name || 'Ringkasan Umum',
    }));

    const { error: chartsError } = await supabaseAdmin
      .from('dashboard_charts')
      .insert(chartInserts);

    if (chartsError) {

      await supabaseAdmin.from('custom_dashboards').delete().eq('id', dashboard.id);
      return NextResponse.json({ error: chartsError.message }, { status: 500 });
    }

    const embedUrl = `/embed/custom/${dashboard.slug}`;

    return NextResponse.json({
      success: true,
      dashboard: {
        id: dashboard.id,
        slug: dashboard.slug,
        embedUrl,
        fullUrl: `${process.env.NEXT_PUBLIC_BASE_URL || ''}${embedUrl}`
      }
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value ?? null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const session = await verifySession(token);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Dashboard ID required' }, { status: 400 });
    }

    const isAdmin = ['SUPER_ADMIN', 'ANALYST'].includes(session.role as string);

    if (isAdmin) {
      const { error } = await supabaseAdmin
        .from('custom_dashboards')
        .delete()
        .eq('id', id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await supabaseAdmin
        .from('custom_dashboards')
        .delete()
        .eq('id', id)
        .eq('created_by', session.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value ?? null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const session = await verifySession(token);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const isAdmin = ['SUPER_ADMIN', 'ANALYST'].includes(session.role as string);

    if (body.action === 'rename') {
      const { oldFolder: rawOld, newFolder: rawNew } = body as { action: string; oldFolder: string; newFolder: string };
      const oldFolder = typeof rawOld === 'string' ? rawOld.trim() : '';
      const newFolder = typeof rawNew === 'string' ? rawNew.trim() : '';
      if (!oldFolder || !newFolder) {
        return NextResponse.json({ error: 'oldFolder and newFolder required' }, { status: 400 });
      }
      if (oldFolder === newFolder) {
        return NextResponse.json({ success: true });
      }
      let query = supabaseAdmin
        .from('custom_dashboards')
        .update({ folder: newFolder || null })
        .eq('folder', oldFolder);
      if (!isAdmin) query = query.eq('created_by', session.id);
      const { error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (body.action === 'delete') {
      const rawFolder = body.folder;
      const folder = typeof rawFolder === 'string' ? rawFolder.trim() : '';
      if (!folder) {
        return NextResponse.json({ error: 'folder required' }, { status: 400 });
      }
      let query = supabaseAdmin
        .from('custom_dashboards')
        .update({ folder: null })
        .eq('folder', folder);
      if (!isAdmin) query = query.eq('created_by', session.id);
      const { error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (body.action !== undefined) {
      return NextResponse.json({ error: `Unknown action: ${String(body.action)}` }, { status: 400 });
    }

    const { id, folder } = body as { id: string; folder: string | null };
    if (!id) {
      return NextResponse.json({ error: 'Dashboard ID required' }, { status: 400 });
    }
    let query = supabaseAdmin
      .from('custom_dashboards')
      .update({ folder })
      .eq('id', id);
    if (!isAdmin) query = query.eq('created_by', session.id);
    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
