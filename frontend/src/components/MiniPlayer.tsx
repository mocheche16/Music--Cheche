import type { AudioEngine } from "../hooks/useAudioEngine";
import type { SongResponse } from "../types";
import styles from "./MiniPlayer.module.css";

interface Props {
  song: SongResponse;
  engine: AudioEngine;
  onExpand: () => void;
}

export default function MiniPlayer({ song, engine, onExpand }: Props) {
  const progressPct =
    engine.duration > 0 ? (engine.currentTime / engine.duration) * 100 : 0;

  return (
    <div className={styles.bar}>
      <div className={styles.progressBg}>
        <div
          className={styles.progressFill}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className={styles.inner}>
        <div className={styles.info}>
          <div className={styles.iconBox}>🎶</div>
          <div className={styles.text}>
            <span className={styles.title}>{song.original_name}</span>
            <span className={styles.status}>
              {engine.loading
                ? "Cargando..."
                : engine.playing
                  ? "Reproduciendo"
                  : "Pausado"}
            </span>
          </div>
        </div>

        <div className={styles.controls}>
          <button
            className={styles.btn}
            onClick={() =>
              engine.playing ? engine.pause() : engine.play()
            }
            title={engine.playing ? "Pausar" : "Reproducir"}
          >
            {engine.playing ? "⏸️" : "▶️"}
          </button>

          <button
            className={`${styles.btn} ${styles.expandBtn}`}
            onClick={onExpand}
            title="Expandir Mixer"
          >
            ↗️{" "}
            <span className={styles.expandLabel}>Mixer</span>
          </button>
        </div>
      </div>
    </div>
  );
}
