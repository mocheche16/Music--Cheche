/**
 * App.jsx — Componente raíz de Music Hub
 *
 * Gestiona la navegación entre el Catálogo y el Mixer.
 */
import { useState, useCallback } from 'react'
import Catalog from './components/Catalog'
import MixerDashboard from './components/MixerDashboard'
import UploadZone from './components/UploadZone'
import MiniPlayer from './components/MiniPlayer'
import { fetchTrack } from './api/client'
import { useAudioEngine } from './hooks/useAudioEngine'

export default function App() {
  const [selectedSong, setSelectedSong]     = useState(null)
  const [mixerVisible, setMixerVisible]     = useState(false)
  const [catalogRefresh, setCatalogRefresh] = useState(0)
  const [showUpload, setShowUpload]         = useState(false)

  const engine = useAudioEngine(selectedSong)

  // Al seleccionar una canción del catálogo, obtener detalles completos
  const handleSelectSong = useCallback(async (song) => {
    try {
      // Si es la misma canción, solo mostramos el mixer
      if (selectedSong?.id === song.id) {
        setMixerVisible(true)
        return
      }

      const { data } = await fetchTrack(song.id)
      setSelectedSong(data)
      setMixerVisible(true)
    } catch (err) {
      console.error('[App] Error cargando detalle de canción:', err)
    }
  }, [selectedSong])

  const handleUploadComplete = useCallback(() => {
    setCatalogRefresh((n) => n + 1)
    setShowUpload(false)
  }, [])

  return (
    <>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">🎛️</span>
            Music Hub
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: 'var(--clr-text-muted)' }}>
              Separación de Stems con IA
            </span>
            <button
              className="btn btn-primary"
              onClick={() => setShowUpload((v) => !v)}
              id="btn-toggle-upload"
            >
              {showUpload ? '✕ Cerrar' : '+ Subir Canción'}
            </button>
          </div>
        </div>
      </header>

      {/* ── Contenido principal ───────────────────────────────────────────── */}
      <main style={{ padding: '32px 0 64px' }}>
        <div className="app-container">

          {/* Upload Zone (toggle) */}
          {showUpload && (
            <UploadZone onUploadComplete={handleUploadComplete} />
          )}

          {/* Hero si no hay canciones */}
          <div className="page-header">
            <h1 className="page-title">
              Tu Estudio de <span className="gradient-text">Separación Musical</span>
            </h1>
            <p className="page-subtitle">
              Sube una canción, espera el procesamiento con IA y practica con el mixer multicanal
            </p>
          </div>

          {/* Catálogo */}
          <Catalog
            onSelectSong={handleSelectSong}
            refreshTrigger={catalogRefresh}
          />
        </div>
      </main>

      {/* ── Mixer (overlay modal) ────────────────────────────────────────── */}
      {selectedSong && mixerVisible && (
        <MixerDashboard
          song={selectedSong}
          engine={engine}
          onClose={() => setMixerVisible(false)}
        />
      )}

      {/* ── Mini Reproductor Persistente ─────────────────────────────────── */}
      {selectedSong && !mixerVisible && (
        <MiniPlayer
          song={selectedSong}
          engine={engine}
          onExpand={() => setMixerVisible(true)}
        />
      )}

      {/* ── Estilos de la página ──────────────────────────────────────────── */}
      <style>{`
        .page-header {
          text-align: center;
          padding: 0 0 40px;
        }
        .page-title {
          font-size: clamp(28px, 4vw, 48px);
          font-weight: 900;
          letter-spacing: -0.03em;
          line-height: 1.1;
          margin-bottom: 12px;
        }
        .gradient-text {
          background: var(--grad-primary);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .page-subtitle {
          color: var(--clr-text-secondary);
          font-size: 16px;
          max-width: 520px;
          margin: 0 auto;
        }
      `}</style>
    </>
  )
}
