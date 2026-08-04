import { NextResponse } from 'next/server';
import { canManagePerformanceLinks, getWorkspaceUser } from '@/lib/server/workspace-auth';
import { uploadPerformanceLinkThumbnailToDrive } from '@/lib/google-drive';
import { compressMedia, validateMedia } from '@/lib/media-compression';
import { validateImageFile } from '@/lib/security/file-validation';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    try {
        const user = await getWorkspaceUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!canManagePerformanceLinks(user.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const form = await request.formData();
        const file = form.get('file');
        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'File is required' }, { status: 400 });
        }
        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
        }

        const validation = validateMedia(file, { maxImageSizeMB: 10 });
        if (!validation.valid) {
            return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const contentValidation = validateImageFile(buffer, file.type);
        if (!contentValidation.valid) {
            return NextResponse.json({ error: 'Invalid image file' }, { status: 400 });
        }

        const compressed = await compressMedia(buffer, file.type, {
            maxSizeKB: 400,
            quality: 80,
        });

        const uploaded = await uploadPerformanceLinkThumbnailToDrive({
            buffer: compressed.buffer,
            mimeType: compressed.mimeType,
            originalName: file.name,
            userId: user.id,
        });

        return NextResponse.json({
            url: uploaded.webViewLink,
            storage_path: uploaded.fileId,
        }, { status: 201 });
    } catch (error) {
        console.error('[Performance Link Thumbnail Upload] Failed:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to upload thumbnail' },
            { status: 500 }
        );
    }
}
