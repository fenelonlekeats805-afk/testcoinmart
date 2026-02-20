import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="page">
      <section className="panel" style={{ padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>Page Not Found</h2>
        <p style={{ color: 'var(--muted)' }}>
          The page you are looking for does not exist.
        </p>
        <Link className="btn btn-primary" href="/">Back to Home</Link>
      </section>
    </main>
  );
}

