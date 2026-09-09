'use client'

/**
 * Boundary de error global. Sustituye a la página interna que Next.js
 * autogenera, cuya prerenderización falla en algunas versiones de Next 16.
 * Debe renderizar sus propias etiquetas <html>/<body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0F172A',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '1.5rem',
        }}
      >
        <div style={{ maxWidth: 360 }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem' }}>
            Something unexpected happened. Try again.
          </p>
          {error.digest && (
            <p
              style={{
                color: 'rgba(255,255,255,0.35)',
                fontSize: '0.75rem',
                marginBottom: '1.5rem',
              }}
            >
              Code: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              cursor: 'pointer',
              borderRadius: 12,
              border: 'none',
              padding: '0.75rem 1.5rem',
              fontWeight: 700,
              color: '#3b1d00',
              backgroundImage:
                'linear-gradient(180deg, #fbbf24 0%, #d97706 55%, #b45309 100%)',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
