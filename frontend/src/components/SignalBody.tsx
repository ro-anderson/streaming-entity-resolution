import type { Signal } from "../api/signals";
import type { TraceEvent } from "../api/trace";
import { markForName, marksFor, relevantUtterances } from "../logic/highlight";
import { HighlightedText, MarkedSpan } from "./HighlightedText";

function formatOffset(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function SignalBody({
  signal,
  events,
  utteranceEvents,
  selected,
  onSelect,
  compact = false,
}: {
  signal: Signal;
  events: readonly TraceEvent[];
  utteranceEvents?: readonly TraceEvent[];
  selected: number | null;
  onSelect?: (eventIndex: number) => void;
  compact?: boolean;
}) {
  const textMarks = marksFor({ events, source: "text" });
  if (signal.source === "slack") {
    const authorMarks = marksFor({ events, source: "author" });
    return (
      <div className="signal-text">
        {signal.author !== null && signal.author !== undefined && (
          <>
            <MarkedSpan
              text={signal.author.name}
              mark={markForName({ name: signal.author.name, marks: authorMarks })}
              selected={selected}
              onSelect={onSelect}
            />
            {": "}
          </>
        )}
        <HighlightedText
          text={signal.text ?? ""}
          marks={textMarks}
          selected={selected}
          onSelect={onSelect}
        />
      </div>
    );
  }
  const participantMarks = marksFor({ events, source: "participant" });
  const speakerMarks = marksFor({ events, source: "speaker" });
  const utterances = compact
    ? []
    : relevantUtterances({ signal, events: utteranceEvents ?? events });
  return (
    <>
      <div className="signal-title">
        <HighlightedText
          text={signal.title ?? "meeting"}
          marks={textMarks}
          selected={selected}
          onSelect={onSelect}
        />
      </div>
      <div className="signal-sub">
        Participantes:{" "}
        {signal.participants.map((participant, index) => (
          <span key={participant.name}>
            {index > 0 && ", "}
            <MarkedSpan
              text={participant.name}
              mark={markForName({ name: participant.name, marks: participantMarks })}
              selected={selected}
              onSelect={onSelect}
            />
          </span>
        ))}{" "}
        · {signal.utterances.length} falas
      </div>
      {utterances.length > 0 && (
        <div className="utterances">
          {utterances.map((utterance) => (
            <div className="utterance" key={utterance.t_ms}>
              <span className="mono utterance-time">{formatOffset(utterance.t_ms)}</span>
              <MarkedSpan
                text={utterance.speaker}
                mark={markForName({ name: utterance.speaker, marks: speakerMarks })}
                selected={selected}
                onSelect={onSelect}
              />
              {": "}
              <HighlightedText
                text={utterance.text}
                marks={textMarks}
                selected={selected}
                onSelect={onSelect}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
