/**
 * components/ChannelStrip.jsx
 *
 * Canal individual del mixer: nombre, ícono de instrumento,
 * VU meter animado, slider de volumen, botones MUTE y SOLO.
 */
import { getStemUrl } from '../api/client'

const STEM_META = {
  vocals: { label: 'Voces',    icon: '🎤', color: '#ff6b9d' },
  drums:  { label: 'Batería',  icon: '🥁', color: '#ff9a3c' },
  bass:   { label: 'Bajo',     icon: '🎸', color: '#4ade80' },
  guitar: { label: 'Guitarra', icon: '🎵', color: '#60a5fa' },
  piano:  { label: 'Piano',    icon: '🎹', color: '#c084fc' },
  other:  { label: 'Otros',    icon: '🎼', color: '#94a3b8' },
}

export default function ChannelStrip({
  stemName,
  songId,
  volume,
  muted,
  solo,
  onVolumeChange,
  onMuteToggle,
  onSoloToggle,
  isPlaying,
}) {
  const meta = STEM_META[stemName] || { label: stemName, icon: '🎵', color: '#94a3b8' }
  const isActive = !muted && (!solo || solo)
  const volumePct = Math.round(volume * 100)

  return (
    <div
      className={`channel-strip ${muted ? 'channel-muted' : ''} ${solo ? 'channel-solo' : ''}`}
      id={`channel-${stemName}`}
      style={{ '--stem-color': meta.color }}
    >
      {/* Header del canal */}
      <div className="channel-header">
        <span className="channel-icon">{meta.icon}</span>
        <span className="channel-label">{meta.label}</span>
      </div>

      {/* VU Meter animado */}
      <div className="vu-meter" aria-label={`VU meter ${meta.label}`}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className={`vu-bar ${isPlaying && isActive && !muted ? 'vu-active' : ''}`}
            style={{
              '--bar-index': i,
              '--bar-delay': `${(i * 0.05) + Math.random() * 0.1}s`,
              background: i < 8
                ? `hsl(${120 - i * 8}, 70%, 50%)`
                : i < 10
                  ? '#f59e0b'
                  : '#ef4444',
            }}
          />
        ))}
      </div>

      {/* Slider de volumen (vertical via rotate) */}
      <div className="volume-wrapper">
        <div className="volume-label">
          <span title="Volumen">🔊</span>
          <span className="volume-value" style={{ color: meta.color }}>
            {volumePct}%
          </span>
        </div>
        <div className="slider-track">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolumeChange?.(stemName, parseFloat(e.target.value))}
            className="volume-slider"
            id={`slider-${stemName}`}
            aria-label={`Volumen ${meta.label}`}
            style={{ '--stem-color': meta.color }}
          />
        </div>
      </div>

      {/* Controles MUTE / SOLO */}
      <div className="channel-controls">
        <button
          className={`ctrl-btn mute-btn ${muted ? 'active' : ''}`}
          onClick={() => onMuteToggle?.(stemName)}
          id={`mute-${stemName}`}
          title={muted ? 'Activar' : 'Silenciar'}
          aria-pressed={muted}
        >
          {muted ? '🔇' : 'M'}
        </button>
        <button
          className={`ctrl-btn solo-btn ${solo ? 'active' : ''}`}
          onClick={() => onSoloToggle?.(stemName)}
          id={`solo-${stemName}`}
          title={solo ? 'Quitar solo' : 'Solo'}
          aria-pressed={solo}
        >
          S
        </button>
      </div>

      {/* Download Button */}
      {songId && (
        <a
          href={getStemUrl(songId, stemName)}
          download={`${stemName}.wav`}
          className="download-stem-btn"
          title={`Descargar ${meta.label}`}
        >
          ⬇️ WAV
        </a>
      )}

      <style>{`
        .channel-strip {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 16px 12px 20px;
          background: var(--clr-bg-elevated);
          border: 1px solid var(--clr-border);
          border-radius: var(--radius-lg);
          border-top: 3px solid var(--stem-color);
          transition: all var(--transition-normal);
          min-width: 90px;
          flex: 1;
          max-width: 130px;
        }
        .channel-strip:hover {
          border-color: var(--stem-color);
          box-shadow: 0 0 20px color-mix(in srgb, var(--stem-color) 20%, transparent);
        }
        .channel-muted {
          opacity: 0.45;
          border-top-color: var(--clr-mute) !important;
        }
        .channel-solo {
          border-color: var(--clr-solo) !important;
          box-shadow: 0 0 20px rgba(245,158,11,0.25) !important;
        }

        .channel-header {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
        }
        .channel-icon  { font-size: 22px; }
        .channel-label { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--clr-text-secondary); }

        /* VU Meter */
        .vu-meter {
          display: flex; align-items: flex-end; gap: 2px; height: 60px; width: 100%;
          justify-content: center; padding: 0 4px;
        }
        .vu-bar {
          flex: 1; border-radius: 2px 2px 0 0;
          min-height: 4px; max-height: 100%;
          opacity: 0.25;
          transition: height 0.1s ease, opacity 0.15s ease;
        }
        .vu-active {
          opacity: 1 !important;
          animation: vu-bounce var(--bar-delay, 0s) infinite alternate ease-in-out;
          animation-duration: calc(0.3s + var(--bar-index, 0) * 0.04s);
        }
        @keyframes vu-bounce {
          from { height: 8px;  opacity: 0.6; }
          to   { height: 48px; opacity: 1;   }
        }

        /* Volume */
        .volume-wrapper {
          width: 100%; display: flex; flex-direction: column; align-items: center; gap: 6px;
        }
        .volume-label {
          display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 0 4px;
        }
        .volume-value {
          font-family: var(--font-mono); font-size: 12px; font-weight: 600;
        }
        .slider-track { width: 100%; }

        /* Override global slider with stem color */
        .volume-slider::-webkit-slider-thumb {
          background: var(--stem-color) !important;
          box-shadow: 0 0 8px color-mix(in srgb, var(--stem-color) 50%, transparent) !important;
        }

        /* MUTE / SOLO buttons */
        .channel-controls {
          display: flex; gap: 6px; width: 100%; justify-content: center;
        }
        .ctrl-btn {
          width: 36px; height: 28px;
          border: 1px solid var(--clr-border);
          border-radius: var(--radius-sm);
          background: var(--clr-bg-surface);
          color: var(--clr-text-secondary);
          font-size: 12px; font-weight: 800; letter-spacing: 0.04em;
          transition: all var(--transition-fast);
        }
        .ctrl-btn:hover { transform: scale(1.08); }

        .mute-btn.active {
          background: rgba(239,68,68,0.2);
          border-color: var(--clr-mute);
          color: var(--clr-mute);
          box-shadow: 0 0 10px rgba(239,68,68,0.3);
        }
        .solo-btn.active {
          background: rgba(245,158,11,0.2);
          border-color: var(--clr-solo);
          color: var(--clr-solo);
          box-shadow: 0 0 10px rgba(245,158,11,0.3);
        }

        /* Download Button */
        .download-stem-btn {
          margin-top: 4px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.05);
          color: var(--clr-text-secondary);
          text-decoration: none;
          transition: all var(--transition-fast);
          border: 1px solid var(--clr-border);
        }
        .download-stem-btn:hover {
          background: rgba(108, 99, 255, 0.15);
          color: var(--clr-primary-light);
          border-color: var(--clr-primary-glow);
        }
      `}</style>
    </div>
  )
}
