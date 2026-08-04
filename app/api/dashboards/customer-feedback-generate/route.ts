import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { generateCustomerFeedbackDashboard } from '@/lib/builder/customer-feedback-template';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { reportsService } from '@/lib/services/reports-service';

export async function POST(request: NextRequest) {
  try {

    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifySession(session);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = String(payload.role).trim().toUpperCase();
    if (role !== 'ANALYST' && role !== 'SUPER_ADMIN' && role !== 'DIVISI_OS' && role !== 'DIVISI_OCS') {
      return NextResponse.json({ error: 'Forbidden: Akses tidak diizinkan' }, { status: 403 });
    }

    const { dateFrom, dateTo, filters, title, folder } = await request.json();

    await reportsService.getReports({ refresh: true });

    const effectiveDateFrom = dateFrom || '1900-01-01';
    const effectiveDateTo = dateTo || '2099-12-31';
    const isDefaultRange = !dateFrom && !dateTo && (!filters || (
      (!filters.hubs || filters.hubs.length === 0) &&
      (!filters.branches || filters.branches.length === 0) &&
      (!filters.airlines || filters.airlines.length === 0) &&
      (!filters.categories || filters.categories.length === 0)
    ));

    const generationOptions = { ...filters };
    const dashboard = generateCustomerFeedbackDashboard(effectiveDateFrom, effectiveDateTo, { filters: generationOptions });

    const isFilteredDashboard = !isDefaultRange || !!title;

    const dashboardConfig = {
      pages: dashboard.pages?.map(p => p.name) || ['Case Category', 'Detail Category', 'Detail Report'],
      hideControls: isFilteredDashboard,
      dateFrom: effectiveDateFrom,
      dateTo: effectiveDateTo,
      filters: isFilteredDashboard ? {
        hubs: filters?.hubs || [],
        branches: filters?.branches || [],
        airlines: filters?.airlines || [],
        categories: filters?.categories || [],
      } : undefined,
      sourceDashboardId: isFilteredDashboard ? 'customer-feedback-main' : undefined,
    };

    let slug: string;
    let dashboardId: string;

    if (isDefaultRange && !title) {
        slug = 'customer-feedback-main';

        const { data: existingDashboard } = await supabaseAdmin
            .from('custom_dashboards')
            .select('id, slug')
            .eq('slug', slug)
            .single();

        if (existingDashboard) {
            dashboardId = existingDashboard.id;

            const { error: updateError } = await supabaseAdmin
                .from('custom_dashboards')
                .update({
                    name: dashboard.name || 'Customer Feedback Dashboard',
                    description: dashboard.description || 'Customer Feedback Analysis Dashboard',
                    folder: folder || null,
                    is_public: true,
                    config: dashboardConfig,
                    updated_at: new Date().toISOString()
                })
                .eq('id', dashboardId);

            if (updateError) {
                console.error('Failed to update dashboard:', updateError);
                return NextResponse.json({ error: 'Gagal memperbarui dashboard' }, { status: 500 });
            }

            const { error: deleteError } = await supabaseAdmin
                .from('dashboard_charts')
                .delete()
                .eq('dashboard_id', dashboardId);

            if (deleteError) {
                console.error('Failed to delete old charts:', deleteError);
                return NextResponse.json({ error: 'Gagal memperbarui chart' }, { status: 500 });
            }
        } else {

            const { data: dbDashboard, error: insertError } = await supabaseAdmin
                .from('custom_dashboards')
                .insert({
                    name: dashboard.name || 'Customer Feedback Dashboard',
                    description: dashboard.description || 'Customer Feedback Analysis Dashboard',
                    folder: folder || null,
                    slug: slug,
                    is_public: true,
                    config: dashboardConfig,
                })
                .select()
                .single();

            if (insertError || !dbDashboard) {
                console.error('Failed to insert dashboard:', insertError);
                return NextResponse.json({ error: 'Gagal menyimpan dashboard' }, { status: 500 });
            }
            dashboardId = dbDashboard.id;
        }
    } else {

        const baseSlug = 'customer-feedback';
        slug = `${baseSlug}-${Date.now().toString(36)}`;

        const finalName = title || dashboard.name || 'Customer Feedback Dashboard';
        const finalDesc = title ? `Custom Analysis: ${title}` : (dashboard.description || 'Customer Feedback Analysis Dashboard');

        const { data: dbDashboard, error: insertError } = await supabaseAdmin
            .from('custom_dashboards')
            .insert({
                name: finalName,
                description: finalDesc,
                folder: folder || null,
                slug: slug,
                is_public: true,
                config: dashboardConfig,
            })
            .select()
            .single();

        if (insertError || !dbDashboard) {
            console.error('Failed to insert dashboard:', insertError);
            return NextResponse.json({ error: 'Gagal menyimpan dashboard' }, { status: 500 });
        }
        dashboardId = dbDashboard.id;
    }

    const allTiles = (dashboard.pages || []).flatMap((page) => 
      (page.tiles || []).map((tile, tidx) => ({
        dashboard_id: dashboardId,
        title: tile.visualization?.title || 'Untitled Chart',
        chart_type: tile.visualization?.chartType || 'bar',
        data_field: 'customer_feedback',
        query_config: tile.query,
        visualization_config: tile.visualization,
        layout: tile.layout,
        position: tidx,
        page_name: page.name
      }))
    );

    if (allTiles.length > 0) {
      const { error: tileError } = await supabaseAdmin
        .from('dashboard_charts')
        .insert(allTiles);

      if (tileError) {
        console.error('Failed to insert tiles:', tileError);
      }
    }

    return NextResponse.json({ 
      dashboard: {
        ...dashboard,
        id: dashboardId,
        slug: slug
      } 
    });
  } catch (err) {
    console.error('Customer feedback generate error:', err);
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
