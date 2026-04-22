/**
 * components/Catalog.jsx
 *
 * Tabla del catálogo de canciones procesadas.
 * Muestra Nombre, BPM, Tonalidad, Estado, Fecha y acciones.
 * Soporta polling automático para canciones en procesamiento.
 */
import { useState, useEffect, useCallback } from 'react'
import { fetchTracks, deleteTrack } from '../api/client'

const STATUS_META = {
  pending:    { label: 'En espera',     cls: 'badge-pending',    dot: false },
  processing: { label: 'Procesando',    cls: 'badge-processing', dot: true  },
  done:       { label: 'Listo',         cls: 'badge-done',       dot: false },
  error:      { label: 'Error',         cls: 'badge-error',      dot: false },
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function StatusBadge({ status, progress }) {
  const meta = STATUS_META[status] || STATUS_META.pending
  return (
    <div className="status-badge-container">
      <span className={`badge ${meta.cls}`}>
        {meta.dot && <span className="pulse-dot" />}
        {meta.label} {status === 'processing' && progress > 0 ? `${progress}%` : ''}
      </span>
      {status === 'processing' && (
        <div className="progress-mini-bar">
          <div className="progress-mini-fill" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}

export default function Catalog({ onSelectSong, refreshTrigger }) {
  const [tracks, setTracks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const loadTracks = useCallback(async () => {
    try {
      const { data } = await fetchTracks()
      setTracks(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDelete = async (trackId, e) => {
    e.stopPropagation()
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta canción y sus archivos?')) return
    
    try {
      await deleteTrack(trackId)
      setTracks(prev => prev.filter(t => t.id !== trackId))
      if (refreshTrigger) refreshTrigger(Date.now()) // Optional: trigger any parent refresh if needed
    } catch (err) {
      alert(`Error al eliminar: ${err.message}`)
    }
  }

  // Carga inicial y cuando se sube una canción nueva
  useEffect(() => { loadTracks() }, [loadTracks, refreshTrigger])

  // Auto-refresh si hay canciones procesando
  useEffect(() => {
    const hasProcessing = tracks.some(
      (t) => t.status === 'pending' || t.status === 'processing'
    )
    if (!hasProcessing) return

    const interval = setInterval(loadTracks, 2000) // Polling cada 2s para fluidez
    return () => clearInterval(interval)
  }, [tracks, loadTracks])

  if (loading) return (
    <div className="catalog-empty">
      <div className="spinner" />
      <p>Cargando catálogo...</p>
    </div>
  )

  if (error) return (
    <div className="catalog-empty catalog-error">
      <span style={{ fontSize: 32 }}>⚠️</span>
      <p>Error al cargar el catálogo</p>
      <p style={{ fontSize: 12, color: 'var(--clr-text-muted)' }}>{error}</p>
      <button className="btn btn-ghost btn-sm" onClick={loadTracks}>Reintentar</button>
    </div>
  )

  if (tracks.length === 0) return (
    <div className="catalog-empty">
      <span style={{ fontSize: 48 }}>🎼</span>
      <h3>Catálogo vacío</h3>
      <p>Sube tu primera canción para comenzar</p>
    </div>
  )

  return (
    <div className="catalog-container glass-card animate-fade-in">
      <div className="catalog-header">
        <h2 className="catalog-title">
          <span className="catalog-title-icon">🎵</span>
          Catálogo Musical
          <span className="catalog-count">{tracks.length} canción{tracks.length !== 1 ? 'es' : ''}</span>
        </h2>
        <button className="btn btn-ghost btn-sm" onClick={loadTracks} title="Refrescar">
          🔄 Refrescar
        </button>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nombre</th>
              <th>BPM</th>
              <th>Tonalidad</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((track, idx) => (
              <tr
                key={track.id}
                onClick={() => track.status === 'done' && onSelectSong?.(track)}
                className={track.status !== 'done' ? 'row-disabled' : ''}
                title={track.status !== 'done' ? 'Esperando procesamiento...' : 'Abrir mixer'}
                id={`track-row-${track.id}`}
              >
                <td className="col-id">{idx + 1}</td>
                <td className="col-name">
                  <div className="track-name">
                    <span className="track-icon">🎸</span>
                    <span className="track-filename">{track.original_name}</span>
                  </div>
                </td>
                <td className="col-bpm">
                  {track.bpm != null
                    ? <span className="bpm-badge">{track.bpm.toFixed(1)} <small>BPM</small></span>
                    : <span className="col-empty">—</span>
                  }
                </td>
                <td className="col-key">
                  {track.key
                    ? <span className="key-badge">{track.key}</span>
                    : <span className="col-empty">—</span>
                  }
                </td>
                <td className="col-status">
                  <StatusBadge status={track.status} progress={track.progress} />
                </td>
                <td className="col-date">{formatDate(track.created_at)}</td>
                <td className="col-action">
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {track.status === 'done' ? (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={(e) => { e.stopPropagation(); onSelectSong?.(track) }}
                        id={`btn-open-mixer-${track.id}`}
                      >
                        🎛️ Mixer
                      </button>
                    ) : (
                      <span className="col-empty" style={{ flex: 1 }}>—</span>
                    )}
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={(e) => handleDelete(track.id, e)}
                      title="Eliminar canción"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .catalog-container { overflow: hidden; }

        .catalog-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 24px 16px;
          border-bottom: 1px solid var(--clr-border);
        }
        .catalog-title {
          display: flex; align-items: center; gap: 10px;
          font-size: 18px; font-weight: 700;
        }
        .catalog-title-icon { font-size: 20px; }
        .catalog-count {
          font-size: 12px; font-weight: 500;
          color: var(--clr-text-muted);
          background: var(--clr-bg-elevated);
          padding: 2px 10px; border-radius: var(--radius-full);
        }

        .table-wrapper { overflow-x: auto; }

        .col-id    { color: var(--clr-text-muted); font-size: 12px; width: 40px; }
        .col-empty { color: var(--clr-text-muted); }
        .col-date  { color: var(--clr-text-muted); font-size: 12px; white-space: nowrap; }

        .track-name  { display: flex; align-items: center; gap: 8px; }
        .track-icon  { font-size: 16px; }
        .track-filename { font-weight: 500; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .bpm-badge {
          font-family: var(--font-mono);
          font-size: 14px; font-weight: 600;
          color: var(--clr-accent);
        }
        .bpm-badge small { font-size: 10px; color: var(--clr-text-muted); margin-left: 2px; }

        .key-badge {
          font-size: 13px; font-weight: 600;
          color: var(--clr-primary-light);
          background: rgba(108,99,255,0.12);
          padding: 2px 10px; border-radius: var(--radius-full);
        }

        .row-disabled { opacity: 0.6; cursor: default !important; }
        .row-disabled:hover { background: transparent !important; }

        .catalog-empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 12px;
          padding: 60px; text-align: center;
          color: var(--clr-text-secondary);
        }
        .catalog-empty h3 { font-size: 18px; font-weight: 700; color: var(--clr-text-primary); }
        .catalog-error { color: var(--clr-error); }
        
        .status-badge-container {
          display: flex; flex-direction: column; gap: 6px; min-width: 100px;
        }
        .progress-mini-bar {
          height: 4px; width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 2px; overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .progress-mini-fill {
          height: 100%; background: var(--clr-primary-glow);
          box-shadow: 0 0 8px var(--clr-primary-glow);
          transition: width 0.4s ease;
        }
      `}</style>
    </div>
  )
}
