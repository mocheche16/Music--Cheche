import { useCallback, useState } from "react";
import Catalog from "./components/Catalog";
import MixerDashboard from "./components/MixerDashboard";
import MiniPlayer from "./components/MiniPlayer";
import UploadZone from "./components/UploadZone";
import { fetchTrack } from "./api/client";
import { useAudioEngine } from "./hooks/useAudioEngine";
import type { SongListItem, SongResponse } from "./types";

export default function App() {
  const [selectedSong, setSelectedSong] = useState<SongResponse | null>(null);
  const [mixerVisible, setMixerVisible] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const engine = useAudioEngine(selectedSong);

  const handleSelectSong = useCallback(
    async (song: SongListItem) => {
      try {
        if (selectedSong?.id === song.id) {
          setMixerVisible(true);
          return;
        }

        const { data } = await fetchTrack(song.id);
        setSelectedSong(data);
        setMixerVisible(true);
      } catch (err) {
        console.error("[App] Error cargando detalle de canción:", err);
      }
    },
    [selectedSong],
  );

  const handleUploadComplete = useCallback(() => {
    setShowUpload(false);
  }, []);

  return (
    <>
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">🎛️</span>
            Music Hub
          </div>
          <div className="header-actions">
            <span className="header-tagline">
              Separación de Stems con IA
            </span>
            <button
              className="btn btn-primary"
              onClick={() => setShowUpload((v) => !v)}
            >
              {showUpload ? "✕ Cerrar" : "+ Subir Canción"}
            </button>
          </div>
        </div>
      </header>

      <main style={{ padding: "32px 0 64px" }}>
        <div className="app-container">
          {showUpload && (
            <UploadZone onUploadComplete={handleUploadComplete} />
          )}

          <div className="page-header">
            <h1 className="page-title">
              Tu Estudio de{" "}
              <span className="gradient-text">Separación Musical</span>
            </h1>
            <p className="page-subtitle">
              Sube una canción, espera el procesamiento con IA y practica
              con el mixer multicanal
            </p>
          </div>

          <Catalog onSelectSong={handleSelectSong} />
        </div>
      </main>

      {selectedSong && mixerVisible && (
        <MixerDashboard
          song={selectedSong}
          engine={engine}
          onClose={() => setMixerVisible(false)}
        />
      )}

      {selectedSong && !mixerVisible && (
        <MiniPlayer
          song={selectedSong}
          engine={engine}
          onExpand={() => setMixerVisible(true)}
        />
      )}

      <style>{`
        .header-actions {
          display: flex; align-items: center; gap: 12px;
        }
        .header-tagline {
          font-size: 13px; color: var(--clr-text-muted);
        }
        .page-header {
          text-align: center; padding: 0 0 40px;
        }
        .page-title {
          font-family: var(--font-display);
          font-size: clamp(32px, 5vw, 64px);
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1.05;
          margin-bottom: 16px;
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
        @media (max-width: 768px) {
          .header-actions { flex-direction: column; align-items: flex-start; }
          .header-tagline { display: none; }
        }
      `}</style>
    </>
  );
}
