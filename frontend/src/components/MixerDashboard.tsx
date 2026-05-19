import { useCallback, useEffect, useState } from "react";
import type { AudioEngine } from "../hooks/useAudioEngine";
import type { SongResponse, StemName } from "../types";
import { STEM_NAMES, formatTime } from "../types";
import { getExportAllUrl } from "../api/client";
import ChannelStrip from "./ChannelStrip";
import styles from "./MixerDashboard.module.css";

interface Props {
  song: SongResponse;
  engine: AudioEngine;
  onClose: () => void;
}

export default function MixerDashboard({ song, engine, onClose }: Props) {
  const [reaperMsg, setReaperMsg] = useState<{
    type: string;
    text: string;
  } | null>(null);

  useEffect(() => {
    if (song && !engine.loaded && !engine.loading) {
      engine.loadBuffers();
    }
  }, [song, engine]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        ["INPUT", "TEXTAREA"].includes(
          (e.target as HTMLElement).tagName,
        )
      )
        return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          if (engine.playing) engine.pause();
          else engine.play();
          break;
        case "ArrowLeft":
          e.preventDefault();
          engine.seek(Math.max(0, engine.currentTime - 5));
          break;
        case "ArrowRight":
          e.preventDefault();
          engine.seek(
            Math.min(engine.duration, engine.currentTime + 5),
          );
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [engine, onClose]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = x / rect.width;
      engine.seek(ratio * engine.duration);
    },
    [engine],
  );

  const progressPct =
    engine.duration > 0
      ? (engine.currentTime / engine.duration) * 100
      : 0;

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.songInfo}>
            <button
              className={`btn btn-ghost btn-sm ${styles.backBtn}`}
              onClick={onClose}
            >
              ← Catálogo
            </button>
            <div>
              <h2 className={styles.songTitle}>
                {song.original_name}
              </h2>
              <div className={styles.songMeta}>
                {song.bpm && (
                  <span className={styles.metaPill}>
                    🥁 {song.bpm.toFixed(1)} BPM
                  </span>
                )}
                {song.key && (
                  <span className={styles.metaPill}>
                    🎵 {song.key}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={styles.headerActions}>
            <a
              href={getExportAllUrl(song.id, "wav")}
              className={`btn btn-ghost btn-sm ${styles.exportBtn}`}
              title="Descargar todas las pistas en WAV"
            >
              📦 WAV
            </a>
            <a
              href={getExportAllUrl(song.id, "mp3")}
              className={`btn btn-ghost btn-sm ${styles.exportBtn}`}
              title="Descargar todas las pistas en MP3"
            >
              📦 MP3
            </a>
          </div>
        </div>

        {reaperMsg && (
          <div
            className={`${styles.reaperMsg} ${reaperMsg.type === "success" ? styles.reaperSuccess : styles.reaperInfo}`}
          >
            {reaperMsg.text}
          </div>
        )}

        {engine.loading && (
          <div className={styles.loading}>
            <div className="spinner" />
            <p>Cargando 6 stems en memoria...</p>
            <p className={styles.loadingHint}>
              Los archivos WAV se descargan del servidor
            </p>
          </div>
        )}

        {engine.loadError && (
          <div className={styles.error}>
            <p>⚠️ Error cargando audio: {engine.loadError}</p>
            <button
              className="btn btn-ghost btn-sm"
              onClick={engine.loadBuffers}
            >
              Reintentar
            </button>
          </div>
        )}

        {engine.loaded && (
          <>
            <div className={styles.channels}>
              {STEM_NAMES.map((stemName) => (
                <ChannelStrip
                  key={stemName}
                  stemName={stemName as StemName}
                  songId={song.id}
                  volume={engine.channels[stemName as StemName].volume}
                  muted={
                    engine.channels[stemName as StemName].muted
                  }
                  solo={
                    engine.channels[stemName as StemName].solo
                  }
                  isPlaying={engine.playing}
                  level={engine.levels[stemName] ?? 0}
                  analyser={engine.analyserNodes[stemName]}
                  onVolumeChange={engine.setVolume}
                  onMuteToggle={engine.toggleMute}
                  onSoloToggle={engine.toggleSolo}
                />
              ))}
            </div>

            <div className={styles.transport}>
              <div
                className="progress-bar-track"
                onClick={handleSeek}
                title="Haz clic para saltar"
              >
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <div className={styles.time}>
                <span>{formatTime(engine.currentTime)}</span>
                <span className={styles.timeSep}>/</span>
                <span>{formatTime(engine.duration)}</span>
              </div>

              <div className="keyboard-hints">
                <span className="hint">
                  <code>Espacio</code> Play/Pause
                </span>
                <span className="hint">
                  <code>← / →</code> Buscar
                </span>
                <span className="hint">
                  <code>Esc</code> Cerrar
                </span>
              </div>

              <div className={styles.buttons}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => engine.seek(0)}
                  title="Ir al inicio"
                >
                  ⏮
                </button>

                <button
                  className={styles.playBtn}
                  onClick={
                    engine.playing ? engine.pause : engine.play
                  }
                  aria-label={
                    engine.playing ? "Pausar" : "Reproducir"
                  }
                >
                  {engine.playing ? "⏸" : "▶"}
                </button>

                <div className={styles.masterControls}>
                  <div className={styles.masterGroup}>
                    <span className={styles.controlLabel}>
                      TONO
                    </span>
                    <div className={styles.pitchSelector}>
                      <button
                        className={styles.pitchBtn}
                        onClick={() =>
                          engine.updatePitch(engine.pitch - 1)
                        }
                      >
                        -
                      </button>
                      <span className={styles.pitchValue}>
                        {engine.pitch > 0
                          ? `+${engine.pitch}`
                          : engine.pitch}
                      </span>
                      <button
                        className={styles.pitchBtn}
                        onClick={() =>
                          engine.updatePitch(engine.pitch + 1)
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className={styles.masterGroup}>
                    <span className={styles.controlLabel}>
                      VELOCIDAD
                    </span>
                    <div className={styles.speedSelector}>
                      <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.1"
                        value={engine.speed}
                        onChange={(e) =>
                          engine.updateSpeed(
                            parseFloat(e.target.value),
                          )
                        }
                      />
                      <span className={styles.speedValue}>
                        {engine.speed.toFixed(1)}x
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  className="btn btn-ghost btn-sm"
                  onClick={engine.resetMix}
                  title="Restablecer niveles"
                >
                  🔄 Reset Mix
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
