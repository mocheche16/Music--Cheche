/**
 * components/MixerDashboard.jsx
 *
 * Dashboard principal de práctica: 6 canales sincronizados,
 * controles globales de reproducción y botón "Enviar a REAPER".
 */
import { useEffect, useState } from 'react'
import { useAudioEngine } from '../hooks/useAudioEngine'
import ChannelStrip from './ChannelStrip'
import api from '../api/client'

const STEMS_ORDER = ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other']

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function MixerDashboard({ song, onClose }) {
  const engine = useAudioEngine(song)
  const [reaperLoading, setReaperLoading] = useState(false)
  const [reaperMsg, setReaperMsg]         = useState(null)

  // Cargar buffers cuando se monta el componente
  useEffect(() => {
    if (song?.status === 'done') engine.loadBuffers()
    return () => {
      // Detener reproducción al desmontar
      if (engine.playing) engine.pause()
    }
  }, [song?.id])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = x / rect.width
    engine.seek(ratio * engine.duration)
  }

  const handleSendToReaper = async () => {
    setReaperLoading(true)
    setReaperMsg(null)
    try {
      // El endpoint simplemente existe como trigger; el ReaScript consulta la DB
      await api.post(`/tracks/${song.id}/export-reaper`)
      setReaperMsg({ type: 'success', text: '✅ Señal enviada a REAPER. Ejecuta el script en REAPER.' })
    } catch {
      // El endpoint puede no existir aún; mostramos instrucciones
      setReaperMsg({
        type: 'info',
        text: `ℹ️ Ejecuta manualmente el ReaScript con Song ID = ${song.id} en REAPER.`,
      })
    } finally {
      setReaperLoading(false)
    }
  }

  const progressPct = engine.duration > 0
    ? (engine.currentTime / engine.duration) * 100
    : 0

  return (
    <div className="mixer-overlay animate-fade-in" id="mixer-dashboard">
      <div className="mixer-panel glass-card">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mixer-header">
          <div className="mixer-song-info">
            <button className="btn btn-ghost btn-sm back-btn" onClick={onClose} id="btn-back-catalog">
              ← Catálogo
            </button>
            <div>
              <h2 className="mixer-song-title">{song.original_name}</h2>
              <div className="mixer-song-meta">
                {song.bpm && <span className="meta-pill">🥁 {song.bpm.toFixed(1)} BPM</span>}
                {song.key  && <span className="meta-pill">🎵 {song.key}</span>}
              </div>
            </div>
          </div>
          <button
            className="btn btn-reaper"
            onClick={handleSendToReaper}
            disabled={reaperLoading}
            id="btn-send-to-reaper"
          >
            {reaperLoading ? <span className="spinner" /> : '🎛️'}
            Enviar a REAPER
          </button>
        </div>

        {reaperMsg && (
          <div className={`reaper-msg reaper-msg-${reaperMsg.type}`}>
            {reaperMsg.text}
          </div>
        )}

        {/* ── Estado de carga ─────────────────────────────────────────────── */}
        {engine.loading && (
          <div className="mixer-loading">
            <div className="spinner" />
            <p>Cargando 6 stems en memoria...</p>
            <p className="loading-hint">Los archivos WAV se descargan del servidor</p>
          </div>
        )}

        {engine.loadError && (
          <div className="mixer-error">
            <p>⚠️ Error cargando audio: {engine.loadError}</p>
            <button className="btn btn-ghost btn-sm" onClick={engine.loadBuffers}>
              Reintentar
            </button>
          </div>
        )}

        {/* ── Canales del mixer ────────────────────────────────────────────── */}
        {engine.loaded && (
          <>
            <div className="channels-container">
              {STEMS_ORDER.map((stemName) => (
                <ChannelStrip
                  key={stemName}
                  stemName={stemName}
                  volume={engine.channels[stemName].volume}
                  muted={engine.channels[stemName].muted}
                  solo={engine.channels[stemName].solo}
                  isPlaying={engine.playing}
                  onVolumeChange={engine.setVolume}
                  onMuteToggle={engine.toggleMute}
                  onSoloToggle={engine.toggleSolo}
                />
              ))}
            </div>

            {/* ── Controles globales de transporte ─────────────────────── */}
            <div className="transport-controls">
              {/* Barra de progreso */}
              <div
                className="progress-bar-track"
                onClick={handleSeek}
                title="Haz clic para saltar a esa posición"
                id="progress-bar"
                role="slider"
                aria-label="Progreso de reproducción"
                aria-valuenow={engine.currentTime}
                aria-valuemax={engine.duration}
              >
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Tiempo */}
              <div className="transport-time">
                <span id="time-current">{formatTime(engine.currentTime)}</span>
                <span className="time-sep">/</span>
                <span id="time-total">{formatTime(engine.duration)}</span>
              </div>

              {/* Play / Pause */}
              <div className="transport-buttons">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => engine.seek(0)}
                  title="Ir al inicio"
                  id="btn-rewind"
                >
                  ⏮
                </button>
                <button
                  className="play-pause-btn"
                  onClick={engine.playing ? engine.pause : engine.play}
                  id="btn-play-pause"
                  aria-label={engine.playing ? 'Pausar' : 'Reproducir'}
                >
                  {engine.playing ? '⏸' : '▶'}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    // Mutear todos / Desmutar todos
                    STEMS_ORDER.forEach((s) => {
                      if (engine.channels[s].muted) engine.toggleMute(s)
                    })
                  }}
                  title="Activar todos los canales"
                  id="btn-unmute-all"
                >
                  🔊 All
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        .mixer-overlay {
          position: fixed; inset: 0;
          background: rgba(8,11,20,0.92);
          backdrop-filter: blur(12px);
          display: flex; align-items: center; justify-content: center;
          z-index: 200; padding: 24px;
        }

        .mixer-panel {
          width: 100%; max-width: 1100px;
          max-height: 90vh; overflow-y: auto;
          padding: 0;
          border: 1px solid var(--clr-border-bright);
          box-shadow: var(--shadow-lg), var(--shadow-glow);
        }

        .mixer-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 28px;
          border-bottom: 1px solid var(--clr-border);
          gap: 16px;
          flex-wrap: wrap;
        }

        .mixer-song-info {
          display: flex; align-items: center; gap: 16px;
        }
        .back-btn { white-space: nowrap; }

        .mixer-song-title {
          font-size: 20px; font-weight: 800; letter-spacing: -0.02em;
          max-width: 500px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .mixer-song-meta { display: flex; gap: 8px; margin-top: 4px; flex-wrap: wrap; }
        .meta-pill {
          background: var(--clr-bg-elevated);
          border: 1px solid var(--clr-border);
          border-radius: var(--radius-full);
          padding: 2px 12px;
          font-size: 13px; font-weight: 600;
          color: var(--clr-text-secondary);
        }

        .reaper-msg {
          padding: 10px 28px;
          font-size: 13px; font-weight: 500;
          border-top: 1px solid var(--clr-border);
        }
        .reaper-msg-success { color: var(--clr-success); background: rgba(34,197,94,0.06); }
        .reaper-msg-info    { color: var(--clr-accent);  background: rgba(0,212,255,0.06); }

        .mixer-loading, .mixer-error {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 10px;
          padding: 48px; text-align: center;
          color: var(--clr-text-secondary);
        }
        .loading-hint { font-size: 12px; color: var(--clr-text-muted); }
        .mixer-error  { color: var(--clr-error); }

        /* Channels */
        .channels-container {
          display: flex; gap: 12px; padding: 24px;
          overflow-x: auto;
          justify-content: center;
        }
        @media (max-width: 700px) { .channels-container { flex-wrap: wrap; } }

        /* Transport */
        .transport-controls {
          padding: 16px 28px 24px;
          border-top: 1px solid var(--clr-border);
          display: flex; flex-direction: column; gap: 12px;
        }
        .transport-time {
          display: flex; align-items: center; gap: 6px;
          font-family: var(--font-mono); font-size: 14px;
          justify-content: center; color: var(--clr-text-secondary);
        }
        .time-sep { color: var(--clr-text-muted); }

        .transport-buttons {
          display: flex; align-items: center; justify-content: center; gap: 12px;
        }
        .play-pause-btn {
          width: 52px; height: 52px;
          border-radius: 50%; border: none;
          background: var(--grad-primary);
          font-size: 20px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 20px var(--clr-primary-glow);
          transition: all var(--transition-fast);
        }
        .play-pause-btn:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 28px var(--clr-primary-glow);
        }
        .play-pause-btn:active { transform: scale(0.96); }
      `}</style>
    </div>
  )
}
