import { markForName, marksFor, relevantUtterances, segmentText } from "./highlight";
import { fixtureMarks, signal, traceEvent } from "./fixtures";

describe("segmentText", () => {
  it("marks the longest surface first when one contains another", () => {
    const marks = fixtureMarks([
      { surface: "Pedro", eventIndex: 0 },
      { surface: "Pedro Nogueira", eventIndex: 1 },
    ]);
    const segments = segmentText({ text: "Falei com Pedro Nogueira hoje", marks });
    expect(segments.map((segment) => [segment.text, segment.mark?.eventIndex ?? null])).toEqual([
      ["Falei com ", null],
      ["Pedro Nogueira", 1],
      [" hoje", null],
    ]);
  });

  it("never overlaps marks and still marks later standalone occurrences", () => {
    const marks = fixtureMarks([
      { surface: "Pedro", eventIndex: 0 },
      { surface: "o Pedro Nogueira", eventIndex: 1 },
      { surface: "Nogueira e", eventIndex: 2 },
    ]);
    const segments = segmentText({ text: "Vi o Pedro Nogueira e depois Pedro", marks });
    expect(segments.map((segment) => [segment.text, segment.mark?.eventIndex ?? null])).toEqual([
      ["Vi ", null],
      ["o Pedro Nogueira", 1],
      [" e depois ", null],
      ["Pedro", 0],
    ]);
  });

  it("returns the whole text when nothing matches", () => {
    const segments = segmentText({
      text: "nada aqui",
      marks: fixtureMarks([{ surface: "X", eventIndex: 0 }]),
    });
    expect(segments).toEqual([{ text: "nada aqui", mark: null }]);
  });
});

describe("marksFor", () => {
  const events = [
    traceEvent({
      signal_id: "s_001",
      outcome: "created",
      surfaces: [
        { surface: "Pedro Nogueira", source: "author" },
        { surface: "Pedro", source: "text" },
      ],
    }),
    traceEvent({
      signal_id: "s_001",
      outcome: "review",
      surfaces: [{ surface: "Speaker 4", source: "speaker" }],
    }),
  ];

  it("keeps only text surfaces for text searching", () => {
    expect(marksFor({ events, source: "text" })).toEqual([
      { surface: "Pedro", outcome: "created", eventIndex: 0 },
    ]);
  });

  it("finds name marks only in their own source", () => {
    const authorMarks = marksFor({ events, source: "author" });
    expect(markForName({ name: "Pedro Nogueira", marks: authorMarks })?.eventIndex).toBe(0);
    expect(markForName({ name: "Speaker 4", marks: authorMarks })).toBeNull();
    const speakerMarks = marksFor({ events, source: "speaker" });
    expect(markForName({ name: "Speaker 4", marks: speakerMarks })?.outcome).toBe("review");
  });

  it("does not search author surfaces inside the text", () => {
    const segments = segmentText({
      text: "Pedro Nogueira disse oi",
      marks: marksFor({ events: events.slice(0, 1), source: "text" }),
    });
    expect(segments.map((segment) => segment.text)).toEqual(["Pedro", " Nogueira disse oi"]);
  });
});

describe("relevantUtterances", () => {
  it("keeps utterances with text surfaces and the first line of each surfaced speaker", () => {
    const meeting = signal({
      id: "s_005",
      source: "meeting",
      utterances: [
        { speaker: "Speaker 4", t_ms: 1, text: "bom dia" },
        { speaker: "Ana", t_ms: 2, text: "nada" },
        { speaker: "Speaker 4", t_ms: 3, text: "de novo" },
        { speaker: "Ana", t_ms: 4, text: "falei com a translog" },
      ],
    });
    const events = [
      traceEvent({ signal_id: "s_005", surfaces: [{ surface: "Speaker 4", source: "speaker" }] }),
      traceEvent({ signal_id: "s_005", surfaces: [{ surface: "translog", source: "text" }] }),
    ];
    expect(relevantUtterances({ signal: meeting, events }).map((item) => item.t_ms)).toEqual([
      1, 4,
    ]);
  });
});
