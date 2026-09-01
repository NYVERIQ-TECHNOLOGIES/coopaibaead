import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Maximize, Pause, Play, Volume2, VolumeX, Gauge } from "lucide-react";

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];

function fmt(t: number) {
  if (!isFinite(t) || t < 0) t = 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

interface Props {
  src: string;
  /** Chave usada para retomar de onde parou */
  resumeKey?: string;
  poster?: string;
  captionsSrc?: string;
  onProgress?: (percent: number) => void;
  onEnded?: () => void;
}

export default function VideoPlayer({ src, resumeKey, poster, captionsSrc, onProgress, onEnded }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);

  const storageKey = resumeKey ? `live-player:${resumeKey}` : null;

  useEffect(() => {
    const v = ref.current;
    if (!v || !storageKey) return;
    const saved = Number(localStorage.getItem(storageKey) ?? "0");
    const onMeta = () => {
      if (saved > 5 && saved < v.duration - 10) v.currentTime = saved;
      setDuration(v.duration || 0);
    };
    v.addEventListener("loadedmetadata", onMeta);
    return () => v.removeEventListener("loadedmetadata", onMeta);
  }, [storageKey, src]);

  function onTimeUpdate() {
    const v = ref.current;
    if (!v) return;
    setCurrent(v.currentTime);
    if (storageKey) localStorage.setItem(storageKey, String(v.currentTime));
    if (v.duration > 0) onProgress?.((v.currentTime / v.duration) * 100);
  }

  function toggle() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) { void v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  }

  function seek(pct: number) {
    const v = ref.current;
    if (!v || !v.duration) return;
    v.currentTime = (pct / 100) * v.duration;
    setCurrent(v.currentTime);
  }

  function changeRate(r: number) {
    const v = ref.current;
    if (!v) return;
    v.playbackRate = r;
    setRate(r);
  }

  function fullscreen() {
    void wrapRef.current?.requestFullscreen?.();
  }

  return (
    <div ref={wrapRef} className="rounded-2xl overflow-hidden bg-black">
      <video
        ref={ref}
        src={src}
        poster={poster}
        className="w-full aspect-video bg-black"
        onTimeUpdate={onTimeUpdate}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); onEnded?.(); }}
        onClick={toggle}
        playsInline
      >
        {captionsSrc && <track kind="captions" src={captionsSrc} srcLang="pt" label="Português" default />}
      </video>

      <div className="p-3 bg-black/90 space-y-2">
        <Slider
          value={[duration ? (current / duration) * 100 : 0]}
          onValueChange={(v) => seek(v[0])}
          max={100}
          step={0.1}
          aria-label="Progresso do vídeo"
        />
        <div className="flex items-center gap-2 text-white">
          <Button size="icon" variant="ghost" className="text-white hover:bg-white/10 h-8 w-8" onClick={toggle}
            aria-label={playing ? "Pausar" : "Reproduzir"}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <span className="text-xs tabular-nums">{fmt(current)} / {fmt(duration)}</span>

          <div className="ml-auto flex items-center gap-1">
            <Button size="icon" variant="ghost" className="text-white hover:bg-white/10 h-8 w-8"
              onClick={() => { const v = ref.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted); }}
              aria-label={muted ? "Ativar som" : "Silenciar"}>
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <div className="hidden sm:block w-20">
              <Slider
                value={[volume * 100]}
                onValueChange={(val) => {
                  const v = ref.current; if (!v) return;
                  v.volume = val[0] / 100; setVolume(val[0] / 100);
                }}
                max={100}
                aria-label="Volume"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 h-8 gap-1">
                  <Gauge className="h-4 w-4" /> {rate}x
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {SPEEDS.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => changeRate(s)}>{s}x</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="icon" variant="ghost" className="text-white hover:bg-white/10 h-8 w-8"
              onClick={fullscreen} aria-label="Tela cheia">
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
