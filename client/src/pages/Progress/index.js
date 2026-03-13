import { useMemo, useState, useEffect, useCallback } from "react";
import LoadingScreen from "../../common/components/LoadingScreen";
import Badge from "../../common/components/Badge";
import Button from "../../common/components/Button";
import { useStudySessions, useAssignments, usePerDeckStats } from "../../hooks/useSupabaseData";
import { useAuth } from "../../contexts/AuthContext";
import { Link } from "react-router-dom";

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
  const { data: assignments, refetch: refetchAssignments } = useAssignments();
  const { data: deckStats, refetch: refetchDeckStats } = usePerDeckStats(user?.id);
  const [collapsedSections, setCollapsedSections] = useState({});

  // Refresh stats on visibility change
  const refreshAll = useCallback(() => {
    refetchDeckStats?.();
    refetchAssignments?.({ background: true });
  }, [refetchDeckStats, refetchAssignments]);

  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') refreshAll(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', refreshAll);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', refreshAll);
    };
  }, [refreshAll]);

  const toggleSection = (key) => setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const activeAssignments = useMemo(() =>
    (assignments || []).filter(a => !a.is_archived),
  [assignments]);

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
      const existing = map.get(dayKey) || { dayKey, sessions: 0, cards: 0, correct: 0 };
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

  // ── Mobile-first styles ──
  const pageStyle = {
    padding: '0.5rem',
    maxWidth: '900px',
    margin: '0 auto',
  };

  const stickyHeader = {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    background: 'var(--bg)',
    padding: '0.75rem 0',
    borderBottom: '1px solid var(--border-color)',
    marginBottom: '0.75rem',
  };

  const kpiGrid = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.5rem',
    marginBottom: '0.5rem',
  };

  const kpiCard = {
    border: 'var(--border)',
    borderRadius: 'var(--radius)',
    padding: '0.6rem 0.5rem',
    textAlign: 'center',
  };

  const sectionHeader = (key) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.5rem 0',
    cursor: 'pointer',
    userSelect: 'none',
  });

  const cardStyle = {
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius)',
    padding: '0.65rem',
    marginBottom: '0.4rem',
  };

  const progressBarTrack = {
    height: '8px',
    background: 'var(--border-light)',
    borderRadius: '999px',
    overflow: 'hidden',
    marginTop: '0.35rem',
  };

  return (
    <div style={pageStyle}>
      {/* ── Sticky Progress Summary ── */}
      <div style={stickyHeader}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.2rem' }}>Progress</h1>
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
        <div style={kpiGrid}>
          <div style={kpiCard}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{totals.totalSessions}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--fg-faint)' }}>Sessions</div>
          </div>
          <div style={kpiCard}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{totals.totalCards}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--fg-faint)' }}>Cards</div>
          </div>
          <div style={kpiCard}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{totals.accuracy}%</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--fg-faint)' }}>Accuracy</div>
          </div>
        </div>
        <p style={{ color: 'var(--fg-muted)', fontSize: '0.75rem', margin: 0 }}>
          Last {retentionDays} days
        </p>
      </div>

      {/* ── Assigned Studies Section ── */}
      {!isTeacher && activeAssignments.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={sectionHeader('assigned')} onClick={() => toggleSection('assigned')}>
            <h2 style={{ margin: 0, fontSize: '1rem' }}>Assigned Studies</h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--fg-muted)' }}>
              {collapsedSections.assigned ? '▸' : '▾'}
            </span>
          </div>
          {!collapsedSections.assigned && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {activeAssignments.map((a) => {
                const deckName = a.custom_name || a.flashy_decks?.name || 'Unnamed Deck';
                const ds = (deckStats?.[a.id] || deckStats?.[String(a.id)] || {});
                const total = ds.total || 0;
                const mastered = ds.mastered || 0;
                const newCards = ds.newCards || 0;
                const due = ds.due || 0;
                const studied = total - newCards;
                const studiedPct = total > 0 ? Math.round((studied / total) * 100) : 0;
                const progressPct = a.progress_percent ?? studiedPct;
                const isCompleted = a.completed === true || (total > 0 && studied >= total);
                const requiredPool = String(a.required_pool || 'any').trim().toLowerCase();

                const primaryRoute = (() => {
                  const rm = String(a.required_mode || 'any').trim().toLowerCase();
                  if (['quiz', 'mcq', 'match'].includes(rm)) return `/study/${a.id}/mode/${rm}`;
                  if (requiredPool === 'new') return `/study/${a.id}/new`;
                  if (requiredPool === 'due') return `/study/${a.id}/due`;
                  if (requiredPool === 'mixed') return `/study/${a.id}/mixed`;
                  if (newCards > 0) return `/study/${a.id}/new`;
                  if (due > 0) return `/study/${a.id}/due`;
                  return `/deck/${a.id}/browse`;
                })();

                return (
                  <div key={a.id} style={{
                    ...cardStyle,
                    borderColor: isCompleted ? 'var(--accent)' : undefined,
                    borderWidth: isCompleted ? '2px' : undefined,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '0.9rem' }}>{deckName}</strong>
                      {isCompleted && <Badge style={{ background: 'var(--accent)', color: '#fff', fontSize: '0.7rem' }}>✓ Done</Badge>}
                    </div>
                    {total > 0 && (
                      <>
                        <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginTop: '0.2rem' }}>
                          {studied}/{total} studied · {mastered} mastered · {due} due
                        </div>
                        <div style={progressBarTrack}>
                          <div style={{
                            width: `${Math.max(2, progressPct)}%`,
                            height: '100%',
                            background: isCompleted ? 'var(--accent)' : 'var(--fg)',
                            borderRadius: '999px',
                            transition: 'width 0.3s ease',
                          }} />
                        </div>
                      </>
                    )}
                    <div style={{ marginTop: '0.5rem' }}>
                      <Link to={primaryRoute}>
                        <Button style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem' }}>
                          {isCompleted ? 'Review Again' : 'Start / Continue'}
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Daily Trend Section ── */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={sectionHeader('trend')} onClick={() => toggleSection('trend')}>
          <h2 style={{ margin: 0, fontSize: '1rem' }}>Daily Trend</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--fg-muted)' }}>
            {collapsedSections.trend ? '▸' : '▾'}
          </span>
        </div>
        {!collapsedSections.trend && (
          byDay.length === 0 ? (
            <p style={{ color: 'var(--fg-muted)', fontSize: '0.85rem' }}>No sessions yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {byDay.map((day) => {
                const width = Math.max(6, Math.round((day.cards / maxCardsPerDay) * 100));
                const accuracy = day.cards > 0 ? Math.round((day.correct / day.cards) * 100) : 0;
                return (
                  <div key={day.dayKey} style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '0.82rem' }}>{new Date(day.dayKey).toLocaleDateString()}</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>
                        {day.sessions} sess · {day.cards} cards · {accuracy}%
                      </span>
                    </div>
                    <div style={progressBarTrack}>
                      <div style={{ width: `${width}%`, height: '100%', background: 'var(--fg)', borderRadius: '999px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* ── Recent Sessions Section ── */}
      <div>
        <div style={sectionHeader('sessions')} onClick={() => toggleSection('sessions')}>
          <h2 style={{ margin: 0, fontSize: '1rem' }}>Recent Sessions</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--fg-muted)' }}>
            {collapsedSections.sessions ? '▸' : '▾'}
          </span>
        </div>
        {!collapsedSections.sessions && (
          sessions.length === 0 ? (
            <p style={{ color: 'var(--fg-muted)', fontSize: '0.85rem' }}>No sessions in the last {retentionDays} days.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {sessions.slice(0, 120).map((session) => {
                const correct = Number(session.cards_correct ?? session.correct_count ?? 0);
                const studied = Number(session.cards_studied || 0);
                return (
                  <div key={session.id} style={cardStyle}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.82rem' }}>
                          {new Date(session.started_at).toLocaleDateString()} {new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </strong>
                        <Badge style={{ fontSize: '0.6rem' }}>{dayLabel(session)}</Badge>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
                          {session.deck_name || 'Deck'} · {session.session_type || session.mode || 'study'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
                          {studied} cards · {correct}/{studied}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default ProgressPage;
