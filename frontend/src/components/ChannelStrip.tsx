import { getStemUrl } from "../api/client";
import { STEM_META, type StemName } from "../types";
import WaveVisualizer from "./WaveVisualizer";
import styles from "./ChannelStrip.module.css";

interface Props {
  stemName: StemName;
  songId: number;
  volume: number;
  muted: boolean;
  solo: boolean;
  onVolumeChange: (stem: StemName, value: number) => void;
  onMuteToggle: (stem: StemName) => void;
  onSoloToggle: (stem: StemName) => void;
  isPlaying: boolean;
  level: number;
  analyser: AnalyserNode | undefined;
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
  level = 0,
  analyser,
}: Props) {
  const meta = STEM_META[stemName];
  const isActive = !muted && (!solo || solo);
  const volumePct = Math.round(volume * 100);

  return (
    <div
      className={`${styles.strip} ${muted ? styles.muted : ""} ${solo ? styles.solo : ""}`}
      style={{ "--stem-color": meta.color } as React.CSSProperties}
    >
      <div className={styles.header}>
        <span className={styles.icon}>{meta.icon}</span>
        <span className={styles.label}>{meta.label}</span>
      </div>

      <div className={styles.waveContainer}>
        <WaveVisualizer
          analyser={analyser}
          color={meta.color}
          isPlaying={isPlaying}
          isActive={isActive}
        />
        <div className={styles.vuMeter}>
          <div
            className={styles.vuFill}
            style={{
              height: `${level * 100}%`,
              background: meta.color,
              boxShadow: `0 0 10px ${meta.color}`,
            }}
          />
        </div>
      </div>

      <div className={styles.volumeWrap}>
        <div className={styles.volumeLabel}>
          <span title="Volumen">🔊</span>
          <span
            className={styles.volumeValue}
            style={{ color: meta.color }}
          >
            {volumePct}%
          </span>
        </div>
        <div className={styles.sliderTrack}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) =>
              onVolumeChange(stemName, parseFloat(e.target.value))
            }
            className="volume-slider"
            style={
              { "--stem-color": meta.color } as React.CSSProperties
            }
            aria-label={`Volumen ${meta.label}`}
          />
        </div>
      </div>

      <div className={styles.controls}>
        <button
          className={`${styles.ctrlBtn} ${muted ? styles.muteActive : ""}`}
          onClick={() => onMuteToggle(stemName)}
          title={muted ? "Activar" : "Silenciar"}
          aria-pressed={muted}
        >
          {muted ? "🔇" : "M"}
        </button>
        <button
          className={`${styles.ctrlBtn} ${solo ? styles.soloActive : ""}`}
          onClick={() => onSoloToggle(stemName)}
          title={solo ? "Quitar solo" : "Solo"}
          aria-pressed={solo}
        >
          S
        </button>
      </div>

      <a
        href={getStemUrl(songId, stemName)}
        download={`${stemName}.wav`}
        className={styles.downloadBtn}
        title={`Descargar ${meta.label}`}
      >
        ⬇️ WAV
      </a>
    </div>
  );
}
