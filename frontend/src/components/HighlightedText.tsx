import type { Mark } from "../logic/highlight";
import { segmentText } from "../logic/highlight";

function markClass({ mark, selected }: { mark: Mark; selected: number | null }): string {
  const base = `hl hl-${mark.outcome}`;
  return mark.eventIndex === selected ? `${base} hl-selected` : base;
}

export function MarkedSpan({
  text,
  mark,
  selected,
  onSelect,
}: {
  text: string;
  mark: Mark | null;
  selected: number | null;
  onSelect?: (eventIndex: number) => void;
}) {
  if (mark === null) {
    return <>{text}</>;
  }
  const className = markClass({ mark, selected });
  if (onSelect === undefined) {
    return <span className={className}>{text}</span>;
  }
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        onSelect(mark.eventIndex);
      }}
    >
      {text}
    </button>
  );
}

export function HighlightedText({
  text,
  marks,
  selected,
  onSelect,
}: {
  text: string;
  marks: readonly Mark[];
  selected: number | null;
  onSelect?: (eventIndex: number) => void;
}) {
  return (
    <>
      {segmentText({ text, marks }).map((segment, index) => (
        <MarkedSpan
          key={index}
          text={segment.text}
          mark={segment.mark}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}
