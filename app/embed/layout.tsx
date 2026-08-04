import './embed.css';
import '../auth/auth-theme.css';

export const metadata = {
  title: 'Gapura OneClick - Dashboard Detail',
  description: 'Interactive report detail view'
};

export default function EmbedLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="embed-body">
        <div className="noise-overlay" />
        <div className="aurora-glow" />
        <main className="embed-container">
          {children}
        </main>
      </div>
    </>
  );
}
