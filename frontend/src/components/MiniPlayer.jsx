/**
 * components/MiniPlayer.jsx
 *
 * Barra persistente en la parte inferior cuando el mixer está minimizado.
 */
import React from 'react'

export default function MiniPlayer({ song, engine, onExpand }) {
  const progressPct = engine.duration > 0 
    ? (engine.currentTime / engine.duration) * 100 
    : 0

  return (
    <div className="mini-player-bar animate-slide-up">
      {/* Progress background bar */}
      <div className="mini-progress-bg">
        <div 
          className="mini-progress-fill" 
          style={{ width: `${progressPct}%` }} 
        />
      </div>

      <div className="mini-player-inner">
        <div className="mini-info">
          <div className="mini-icon">🎶</div>
          <div className="mini-text">
            <span className="mini-title">{song.original_name}</span>
            <span className="mini-status">
              {engine.loading ? 'Cargando...' : engine.playing ? 'Reproduciendo' : 'Pausado'}
            </span>
          </div>
        </div>

        <div className="mini-controls">
          <button 
            className="mini-btn" 
            onClick={() => engine.playing ? engine.pause() : engine.play()}
            title={engine.playing ? 'Pausar' : 'Reproducir'}
          >
            {engine.playing ? '⏸️' : '▶️'}
          </button>
          
          <button 
            className="mini-btn expand-btn" 
            onClick={onExpand}
            title="Expandir Mixer"
          >
            ↗️ <span className="expand-label">Mixer</span>
          </button>
        </div>
      </div>

      <style>{`
        .mini-player-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(18, 18, 23, 0.9);
          backdrop-filter: blur(20px);
          border-top: 1px solid var(--clr-border-bright);
          z-index: 1000;
          height: 72px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 -10px 30px rgba(0,0,0,0.5);
        }

        .mini-progress-bg {
          height: 3px;
          background: rgba(255,255,255,0.05);
          width: 100%;
        }
        .mini-progress-fill {
          height: 100%;
          background: var(--grad-primary);
          box-shadow: 0 0 10px var(--clr-primary-glow);
          transition: width 0.3s linear;
        }

        .mini-player-inner {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }

        .mini-info {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .mini-icon {
          font-size: 20px;
          background: var(--clr-bg-elevated);
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-md);
          border: 1px solid var(--clr-border);
        }
        .mini-text {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .mini-title {
          font-weight: 700;
          font-size: 14px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mini-status {
          font-size: 11px;
          color: var(--clr-text-muted);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .mini-controls {
          display: flex;
          gap: 12px;
        }
        .mini-btn {
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--clr-border);
          color: white;
          padding: 8px 12px;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          font-weight: 600;
        }
        .mini-btn:hover {
          background: rgba(255,255,255,0.1);
          border-color: var(--clr-border-bright);
          transform: translateY(-2px);
        }
        
        .expand-btn {
          background: var(--clr-primary);
          border-color: var(--clr-primary-light);
        }
        .expand-btn:hover {
          background: var(--clr-primary-light);
          box-shadow: 0 0 15px var(--clr-primary-glow);
        }

        @media (max-width: 600px) {
          .expand-label { display: none; }
          .mini-player-inner { padding: 0 16px; }
        }

        .animate-slide-up {
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
