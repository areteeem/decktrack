import { useParams, Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { useGroups, useGroupLeaderboard } from "../../hooks/useSupabaseData";
import LoadingScreen from "../../common/components/LoadingScreen";
import Badge from "../../common/components/Badge";

const MEDAL = ["🥇", "🥈", "🥉"];

const formatTime = (sec) => {
  if (!sec) return "0m";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const SORT_OPTIONS = [
  { key: "score", label: "Score" },
  { key: "masteryPct", label: "Mastery %" },
  { key: "cardsStudied", label: "Cards studied" },
  { key: "accuracy", label: "Accuracy" },
  { key: "sessions", label: "Sessions" },
  { key: "studyTimeSec", label: "Study time" },
];

const GroupDetailPage = () => {
  const { id: groupId } = useParams();
  const { data: groups, loading: groupsLoading } = useGroups();
  const { data: leaderboard, loading: lbLoading } = useGroupLeaderboard(groupId);
  const [sortBy, setSortBy] = useState("score");

  const group = useMemo(() => (groups || []).find((g) => g.id === groupId), [groups, groupId]);

  const sorted = useMemo(() => {
    if (!leaderboard) return [];
    return [...leaderboard].sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));
  }, [leaderboard, sortBy]);

  if (groupsLoading || lbLoading) return <LoadingScreen />;
  if (!group) return <h2>Group not found</h2>;

  return (
    <div>
      <Link to="/groups" style={{ fontSize: "0.8rem", marginBottom: "0.25rem", display: "inline-block", color: "var(--primary)" }}>
        ← Back to Groups
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <span
          style={{
            width: 14, height: 14, borderRadius: "50%",
            background: group.color || "#6366f1", display: "inline-block",
          }}
        />
        <h1 style={{ margin: 0 }}>{group.name}</h1>
        <Badge>{group.memberCount} students</Badge>
      </div>

      {group.description && (
        <p style={{ color: "var(--fg-muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
          {group.description}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Sort by:</span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{
            padding: "0.35rem 0.6rem",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius)",
            background: "var(--bg-secondary)",
            color: "var(--fg)",
            fontSize: "0.82rem",
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>

      {sorted.length === 0 ? (
        <p style={{ color: "var(--fg-muted)" }}>No members in this group yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {sorted.map((entry, idx) => (
            <div
              key={entry.studentId}
              style={{
                display: "grid",
                gridTemplateColumns: "2rem 1fr auto",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.65rem 0.85rem",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border-color)",
                background: idx < 3 ? "var(--card-hover)" : "var(--card-bg)",
              }}
            >
              <span style={{ fontSize: "1.1rem", textAlign: "center", fontWeight: 700 }}>
                {idx < 3 ? MEDAL[idx] : idx + 1}
              </span>
              <div>
                <Link
                  to={`/students/${entry.studentId}`}
                  style={{ fontWeight: 600, color: "var(--fg)", textDecoration: "none" }}
                >
                  {entry.displayName}
                </Link>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.2rem" }}>
                  <Badge>{entry.masteryPct}% mastery</Badge>
                  <Badge>{entry.cardsStudied} studied</Badge>
                  <Badge>{entry.accuracy}% accuracy</Badge>
                  <Badge>{entry.sessions} sessions</Badge>
                  <Badge>{formatTime(entry.studyTimeSec)}</Badge>
                </div>
              </div>
              <span style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)", whiteSpace: "nowrap" }}>
                {entry.score} pts
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GroupDetailPage;
