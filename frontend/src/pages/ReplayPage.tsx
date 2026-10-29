import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Signal } from "../api/signals";
import { useSignals } from "../api/signals";
import type { TraceEvent } from "../api/trace";
import { useTrace } from "../api/trace";
import { Layout } from "../components/Layout";
import { RepositoryPanel } from "../components/RepositoryPanel";
import { ReplayControls } from "../components/ReplayControls";
import { SignalList } from "../components/SignalList";
import { StatusMessage } from "../components/StatusMessage";
import { TracePanel } from "../components/TracePanel";
import { entityChanges, eventsBySignal, reconstructRepository } from "../logic/repository";
import { defaultEventIndex } from "../logic/selection";

const BASE_DELAY_MS = 1500;
const NO_EVENTS: TraceEvent[] = [];

interface Selection {
  signalId: string;
  eventIndex: number;
}

function Replay({ signals, trace }: { signals: Signal[]; trace: TraceEvent[] }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selection, setSelection] = useState<Selection | null>(null);
  const requested = signals.findIndex((signal) => signal.id === searchParams.get("s"));
  const index = requested === -1 ? 0 : requested;
  const last = signals.length - 1;
  const signalIds = useMemo(() => signals.map((signal) => signal.id), [signals]);
  const grouped = useMemo(() => eventsBySignal(trace), [trace]);
  const entries = useMemo(
    () => reconstructRepository({ trace, signalIds, upTo: index }),
    [trace, signalIds, index],
  );
  const lookup = useMemo(
    () => new Map(entries.map((entry) => [entry.entity.id, entry.entity])),
    [entries],
  );
  const signal = signals[index];
  const events = (signal === undefined ? undefined : grouped.get(signal.id)) ?? NO_EVENTS;
  const changes = useMemo(() => entityChanges(events), [events]);
  const pendingReviews = useMemo(() => {
    const visible = new Set(signalIds.slice(0, index + 1));
    return trace.filter((event) => event.outcome === "review" && visible.has(event.signal_id))
      .length;
  }, [trace, signalIds, index]);

  function goTo(target: number) {
    const next = signals[Math.min(Math.max(target, 0), last)];
    if (next !== undefined) {
      setSearchParams({ s: next.id }, { replace: true });
    }
  }

  useEffect(() => {
    if (!playing || index >= last) {
      return;
    }
    const timer = window.setTimeout(() => {
      const next = signals[index + 1];
      if (next !== undefined) {
        setSearchParams({ s: next.id }, { replace: true });
      }
      if (index + 1 >= last) {
        setPlaying(false);
      }
    }, BASE_DELAY_MS / speed);
    return () => {
      window.clearTimeout(timer);
    };
  }, [playing, index, last, speed, signals, setSearchParams]);

  if (signal === undefined) {
    return (
      <Layout>
        <p className="status">Nenhum sinal na última execução.</p>
      </Layout>
    );
  }

  const selected =
    selection !== null && selection.signalId === signal.id
      ? selection.eventIndex
      : defaultEventIndex(events);

  function selectEvent(eventIndex: number) {
    if (signal !== undefined) {
      setSelection({ signalId: signal.id, eventIndex });
    }
  }

  function toggle() {
    if (!playing && index >= last) {
      goTo(0);
    }
    setPlaying(!playing);
  }

  return (
    <Layout
      actions={
        <ReplayControls
          signal={signal}
          index={index}
          total={signals.length}
          playing={playing}
          speed={speed}
          onPrevious={() => {
            goTo(index - 1);
          }}
          onNext={() => {
            goTo(index + 1);
          }}
          onToggle={toggle}
          onSpeed={setSpeed}
        />
      }
    >
      <main className="main">
        <SignalList
          signals={signals}
          index={index}
          eventsOf={(signalId) => grouped.get(signalId) ?? NO_EVENTS}
          selected={selected}
          onSelect={selectEvent}
        />
        <TracePanel
          signal={signal}
          events={events}
          selected={selected}
          onSelect={selectEvent}
          lookup={lookup}
        />
        <RepositoryPanel
          signalId={signal.id}
          entries={entries}
          changes={changes}
          lookup={lookup}
          pendingReviews={pendingReviews}
        />
      </main>
    </Layout>
  );
}

export function ReplayPage() {
  const signals = useSignals();
  const trace = useTrace();
  if (signals.data === undefined || trace.data === undefined) {
    return (
      <Layout>
        <StatusMessage error={signals.isError || trace.isError} />
      </Layout>
    );
  }
  return <Replay signals={signals.data} trace={trace.data} />;
}
