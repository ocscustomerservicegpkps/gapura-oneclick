import { notFound } from 'next/navigation';
import { getPublicShareData } from '@/lib/share/public-data';
import { PublicShareView } from './PublicShareView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let data;
  try {
    data = await getPublicShareData(slug);
  } catch (error) {
    if (error instanceof Error && error.message === 'SHARE_NOT_FOUND') {
      notFound();
    }
    throw error;
  }
  return <PublicShareView data={data} />;
}
