export type ProcessingStatus = "pending" | "processing" | "done" | "error";

export type StemName = "vocals" | "drums" | "bass" | "guitar" | "piano" | "other";

export const STEM_NAMES: StemName[] = [
  "vocals",
  "drums",
  "bass",
  "guitar",
  "piano",
  "other",
];

export interface StemsResponse {
  vocals: string | null;
  drums: string | null;
  bass: string | null;
  guitar: string | null;
  piano: string | null;
  other: string | null;
  tempo?: string | null;
}

export interface SongListItem {
  id: number;
  original_name: string;
  bpm: number | null;
  key: string | null;
  status: ProcessingStatus;
  progress: number;
  processing_time: number | null;
  created_at: string;
}

export interface SongResponse {
  id: number;
  original_name: string;
  bpm: number | null;
  key: string | null;
  status: ProcessingStatus;
  progress: number;
  error_msg: string | null;
  processing_time: number | null;
  created_at: string;
  updated_at: string;
  stems: StemsResponse | null;
}

export interface SongStatusResponse {
  id: number;
  status: ProcessingStatus;
  progress: number;
  processing_time: number | null;
  error_msg: string | null;
}

export interface UploadResponse {
  song_id: number;
  message: string;
  status: ProcessingStatus;
}

export interface PaginatedResponse {
  items: SongListItem[];
  total: number;
  skip: number;
  limit: number;
}

export interface ChannelState {
  volume: number;
  muted: boolean;
  solo: boolean;
}

export type ChannelsState = Record<StemName, ChannelState>;

export function defaultChannelsState(): ChannelsState {
  return Object.fromEntries(
    STEM_NAMES.map((s) => [s, { volume: 0.8, muted: false, solo: false }]),
  ) as ChannelsState;
}

export const STEM_META: Record<
  StemName,
  { label: string; icon: string; color: string }
> = {
  vocals: { label: "Voces", icon: "🎤", color: "#ff6b9d" },
  drums: { label: "Batería", icon: "🥁", color: "#ff9a3c" },
  bass: { label: "Bajo", icon: "🎸", color: "#4ade80" },
  guitar: { label: "Guitarra", icon: "🎵", color: "#60a5fa" },
  piano: { label: "Piano", icon: "🎹", color: "#c084fc" },
  other: { label: "Otros", icon: "🎼", color: "#94a3b8" },
};

export function formatTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return "0:00";
  const abs = Math.abs(Math.floor(seconds));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
