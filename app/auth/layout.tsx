import './auth-theme.css';

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <div className="auth-route">{children}</div>;
}
