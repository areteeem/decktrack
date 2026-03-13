import { useMemo } from "react";
import LoadingScreen from "../../common/components/LoadingScreen";
import Badge from "../../common/components/Badge";
import Button from "../../common/components/Button";
import { useStudySessions } from "../../hooks/useSupabaseData";
import { useAuth } from "../../contexts/AuthContext";

const csvEscape = (value) => {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
};

const downloadSessionsCsv = (sessions, baseName) => {
  const rows = [
    [
      "started_at",
      "finished_at",
      "session_type",
      "mode",
      "deck_name",
      "assignment_id",
      "cards_studied",
      "cards_correct",
      "cards_incorrect",
      "duration_seconds",
      "days_until_deletion",
      "deletion_at",
    ].join(","),
  ];

  (sessions || []).forEach((session) => {
    rows.push([
      csvEscape(session.started_at),
      csvEscape(session.finished_at),
      csvEscape(session.session_type),
      csvEscape(session.mode),
      csvEscape(session.deck_name),
      csvEscape(session.assignment_id),
      csvEscape(session.cards_studied),
      csvEscape(session.cards_correct ?? session.correct_count ?? 0),
      csvEscape(session.cards_incorrect ?? session.incorrect_count ?? 0),
      csvEscape(session.duration_seconds),
      csvEscape(session.days_until_deletion),
      csvEscape(session.deletion_at),
    ].join(","));
  });

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${baseName || "study-sessions"}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const dayLabel = (session) => {
  const days = Number(session?.days_until_deletion);
  if (!Number.isFinite(days)) return "No expiry info";
  if (days <= 0) return "Deletes today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
};

const ProgressPage = () => {
  const { user, isTeacher, profile } = useAuth();
  const { data: sessions, loading, retentionDays } = useStudySessions({
    studentId: user?.id,
    limit: 300,
  });

  const totals = useMemo(() => {
    const list = sessions || [];
    const totalSessions = list.length;
    const totalCards = list.reduce((sum, item) => sum + Number(item.cards_studied || 0), 0);
    const totalCorrect = list.reduce((sum, item) => sum + Number(item.cards_correct ?? item.correct_count ?? 0), 0);
    const accuracy = totalCards > 0 ? Math.round((totalCorrect / totalCards) * 100) : 0;
    return { totalSessions, totalCards, totalCorrect, accuracy };
  }, [sessions]);

  const byDay = useMemo(() => {
    const map = new Map();

    (sessions || []).forEach((session) => {
      const startedAt = session?.started_at;
      if (!startedAt) return;
      const dayKey = new Date(startedAt).toISOString().slice(0, 10);
      const existing = map.get(dayKey) || {
        dayKey,
        sessions: 0,
        cards: 0,
        correct: 0,
      };

      existing.sessions += 1;
      existing.cards += Number(session.cards_studied || 0);
      existing.correct += Number(session.cards_correct ?? session.correct_count ?? 0);
      map.set(dayKey, existing);
    });

    return Array.from(map.values()).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  }, [sessions]);

  const maxCardsPerDay = useMemo(() => {
    if (!byDay.length) return 1;
    return Math.max(...byDay.map((item) => item.cards || 0), 1);
  }, [byDay]);

  if (loading) return <LoadingScreen />;

  const displayName = profile?.display_name || user?.email || (isTeacher ? "teacher" : "student");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
        <div>
          <h1>Progress over time</h1>
          <p style={{ color: "var(--fg-muted)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
            Study history is retained for {retentionDays} days.
          </p>
        </div>
        {sessions.length > 0 && (
          <Button
            callback={() => downloadSessionsCsv(sessions, `${String(displayName).replace(/[^a-z0-9-_]+/gi, "-").toLowerCase()}-study-sessions`)}
            bgcolor="transparent"
            color="var(--fg)"
          >
            Export CSV
          </Button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.65rem", marginBottom: "1rem" }}>
        <div style={{ border: "var(--border)", borderRadius: "var(--radius)", padding: "0.65rem" }}>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{totals.totalSessions}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--fg-faint)" }}>Sessions (30d)</div>
        </div>
        <div style={{ border: "var(--border)", borderRadius: "var(--radius)", padding: "0.65rem" }}>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{totals.totalCards}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--fg-faint)" }}>Cards studied</div>
        </div>
        <div style={{ border: "var(--border)", borderRadius: "var(--radius)", padding: "0.65rem" }}>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{totals.accuracy}%</div>
          <div style={{ fontSize: "0.75rem", color: "var(--fg-faint)" }}>Accuracy</div>
        </div>
      </div>

      <h2 style={{ marginBottom: "0.5rem" }}>Daily trend</h2>
      {byDay.length === 0 ? (
        <p style={{ color: "var(--fg-muted)", fontSize: "0.85rem" }}>No sessions yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "1rem" }}>
          {byDay.map((day) => {
            const width = Math.max(6, Math.round((day.cards / maxCardsPerDay) * 100));
            const accuracy = day.cards > 0 ? Math.round((day.correct / day.cards) * 100) : 0;
            return (
              <div key={day.dayKey} style={{ border: "1px solid var(--border-color)", borderRadius: "var(--radius)", padding: "0.45rem 0.6rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.3rem" }}>
                  <strong style={{ fontSize: "0.82rem" }}>{new Date(day.dayKey).toLocaleDateString()}</strong>
                  <span style={{ fontSize: "0.75rem", color: "var(--fg-muted)" }}>{day.sessions} sessions · {accuracy}% accuracy</span>
                </div>
                <div style={{ height: "6px", background: "var(--border-light)", borderRadius: "999px", overflow: "hidden" }}>
                  <div style={{ width: `${width}%`, height: "100%", background: "var(--fg)", borderRadius: "999px" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2 style={{ marginBottom: "0.5rem" }}>Recent sessions</h2>
      {sessions.length === 0 ? (
        <p style={{ color: "var(--fg-muted)", fontSize: "0.85rem" }}>No recorded sessions in the last {retentionDays} days.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {sessions.slice(0, 120).map((session) => {
            const correct = Number(session.cards_correct ?? session.correct_count ?? 0);
            const studied = Number(session.cards_studied || 0);
            return (
              <div
                key={session.id}
                style={{
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius)",
                  padding: "0.5rem 0.65rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.6rem",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                  <strong style={{ fontSize: "0.82rem" }}>
                    {new Date(session.started_at).toLocaleDateString()} {new Date(session.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </strong>
                  <span style={{ fontSize: "0.75rem", color: "var(--fg-muted)" }}>
                    {(session.deck_name || "Deck") + " · " + (session.session_type || session.mode || "study")}
                  </span>
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--fg-muted)" }}>
                  {studied} cards · {correct}/{studied} correct
                </span>
                <Badge style={{ fontSize: "0.65rem" }}>{dayLabel(session)}</Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProgressPage;
