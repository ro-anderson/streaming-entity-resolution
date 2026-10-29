import type { Signal } from "../api/signals";
import { formatDateTime } from "../logic/format";
import { NextIcon, PauseIcon, PlayIcon, PreviousIcon } from "./Icons";

const SPEEDS = [0.5, 1, 2];

export function ReplayControls({
  signal,
  index,
  total,
  playing,
  speed,
  onPrevious,
  onNext,
  onToggle,
  onSpeed,
}: {
  signal: Signal;
  index: number;
  total: number;
  playing: boolean;
  speed: number;
  onPrevious: () => void;
  onNext: () => void;
  onToggle: () => void;
  onSpeed: (speed: number) => void;
}) {
  const position = index + 1;
  return (
    <div className="controls">
      <button
        type="button"
        className="icon-button"
        aria-label="Sinal anterior"
        onClick={onPrevious}
        disabled={index === 0}
      >
        <PreviousIcon />
      </button>
      <button
        type="button"
        className="icon-button icon-button-primary"
        aria-label={playing ? "Pausar" : "Reproduzir"}
        onClick={onToggle}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label="Próximo sinal"
        onClick={onNext}
        disabled={position === total}
      >
        <NextIcon />
      </button>
      <div className="progress">
        <div className="mono progress-label">
          <span>
            {signal.id} · {formatDateTime(signal.occurred_at)}
          </span>
          <span>
            {position} / {total}
          </span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${String((position / total) * 100)}%` }}
          />
        </div>
      </div>
      <div className="segmented" role="group" aria-label="Velocidade">
        {SPEEDS.map((option) => (
          <button
            key={option}
            type="button"
            className={option === speed ? "segmented-button mono active" : "segmented-button mono"}
            aria-pressed={option === speed}
            onClick={() => {
              onSpeed(option);
            }}
          >
            {option}x
          </button>
        ))}
      </div>
    </div>
  );
}
