import { useParams } from "react-router";
import { Link } from "react-router-dom";
import styles from "./Teacher.module.css";
import { useStudentStats } from "../../hooks/useSupabaseData";
import { useAuth } from "../../contexts/AuthContext";
import LoadingScreen from "../../common/components/LoadingScreen";
import Badge from "../../common/components/Badge";
import Button from "../../common/components/Button";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import AssignmentSettingsModal from "./AssignmentSettingsModal";

const StudentDetailPage = () => {
  const { studentId } = useParams();
  const { user } = useAuth();
  const { data: stats, loading: statsLoading } = useStudentStats(studentId);
  const [student, setStudent] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settingsModal, setSettingsModal] = useState({ open: false, assignment: null });
  const [expandedCards, setExpandedCards] = useState({}); // { assignmentId: [cards] | 'loading' }

  const fetchCards = useCallback(async (assignmentId) => {
    if (expandedCards[assignmentId] && expandedCards[assignmentId] !== 'loading') {
      // Collapse
      setExpandedCards((prev) => { const next = { ...prev }; delete next[assignmentId]; return next; });
      return;
    }
    setExpandedCards((prev) => ({ ...prev, [assignmentId]: 'loading' }));
    const { data, error } = await supabase
      .from('flashy_student_cards')
      .select('*')
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: true });
    if (error) {
      setExpandedCards((prev) => { const next = { ...prev }; delete next[assignmentId]; return next; });
      return;
    }
    setExpandedCards((prev) => ({ ...prev, [assignmentId]: data || [] }));
  }, [expandedCards]);

  const fetchData = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);

    const [profileRes, assignRes] = await Promise.all([
      supabase
        .from("flashy_profiles")
        .select("*")
        .eq("id", studentId)
        .single(),
      supabase
        .from("flashy_deck_assignments")
        .select("*, flashy_decks(name, description)")
        .eq("student_id", studentId)
        .eq("teacher_id", user.id)
        .order("assigned_at", { ascending: false }),
    ]);

    if (profileRes.data) setStudent(profileRes.data);
    if (assignRes.data) setAssignments(assignRes.data);
    setLoading(false);
  }, [studentId, user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading || statsLoading) return <LoadingScreen />;
  if (!student) return <h2>Student not found</h2>;

  return (
    <div>
      <Link to="/students" className={styles.backLink}>
        ← Back to Students
      </Link>

      <div className={styles.header}>
        <h1>{student.display_name || student.email || "Student"}</h1>
        <p className={styles.email}>{student.email}</p>
      </div>

      {/* Stats overview */}
      {stats && (
        <>
          <div className={styles.statsGrid}>
            <div className={styles.statBox}>
              <span className={styles.statNumber}>{stats.totalCards}</span>
              <span className={styles.statLabel}>Total Cards</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statNumber}>{stats.masteredCards}</span>
              <span className={styles.statLabel}>Mastered</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statNumber}>{stats.dueCards}</span>
              <span className={styles.statLabel}>Due Now</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statNumber}>{stats.newCards}</span>
              <span className={styles.statLabel}>New</span>
            </div>
          </div>
          {stats.totalCards > 0 && (
            <div className={styles.masteryBar}>
              <div className={styles.masteryTrack}>
                <div
                  className={styles.masteryFill}
                  style={{ width: `${Math.round((stats.masteredCards / stats.totalCards) * 100)}%` }}
                />
              </div>
              <span className={styles.masteryPct}>
                {Math.round((stats.masteredCards / stats.totalCards) * 100)}% mastered
              </span>
            </div>
          )}
        </>
      )}

      {/* Assigned Decks */}
      <h2>Assigned Decks</h2>
      {assignments.length === 0 ? (
        <p>No decks assigned yet.</p>
      ) : (
        <div className={styles.grid}>
          {assignments.filter(a => !a.is_archived).map((a) => (
            <div key={a.id} className={styles.assignmentCard}>
              <h3>{a.flashy_decks?.name || a.custom_name || "Unnamed Deck"}</h3>
              <p>{a.flashy_decks?.description || ""}</p>
              <div className={styles.assignmentMeta}>
                <Badge>
                  {a.sync_enabled ? "Sync ON" : "Sync OFF"}
                </Badge>
                {a.allow_student_cards && (
                  <Badge>+ Cards</Badge>
                )}
                {a.allow_student_edit && (
                  <Badge>✏ Edit</Badge>
                )}
                {a.deadline && (
                  <Badge>
                    Due: {new Date(a.deadline).toLocaleDateString()}
                  </Badge>
                )}
                <span>
                  Assigned: {new Date(a.assigned_at).toLocaleDateString()}
                </span>
              </div>
              <div style={{ marginTop: "0.35rem", display: "flex", gap: "0.35rem" }}>
                <Button
                  callback={() => setSettingsModal({ open: true, assignment: a })}
                  bgcolor="transparent"
                  color="var(--fg)"
                >
                  ⚙ Settings
                </Button>
                <Button
                  callback={() => fetchCards(a.id)}
                  bgcolor="transparent"
                  color="var(--fg)"
                >
                  {expandedCards[a.id] ? "▲ Hide Cards" : "▼ View Cards"}
                </Button>
              </div>

              {/* Expanded card list */}
              {expandedCards[a.id] === 'loading' && (
                <p style={{ fontSize: "0.8rem", color: "var(--fg-muted)", marginTop: "0.5rem" }}>Loading cards...</p>
              )}
              {Array.isArray(expandedCards[a.id]) && (
                <div style={{ marginTop: "0.5rem" }}>
                  {expandedCards[a.id].length === 0 ? (
                    <p style={{ fontSize: "0.8rem", color: "var(--fg-muted)" }}>No cards.</p>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.4rem" }}>
                      {expandedCards[a.id].map((card) => (
                        <div
                          key={card.id}
                          style={{
                            border: "1px solid var(--border-color)",
                            borderRadius: "var(--radius)",
                            padding: "0.5rem",
                            fontSize: "0.78rem",
                          }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{card.front}</div>
                          <div
                            style={{ color: "var(--fg-muted)" }}
                            dangerouslySetInnerHTML={{ __html: card.back }}
                          />
                          <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                            {card.is_custom && <Badge style={{ fontSize: "0.6rem" }}>Custom</Badge>}
                            {card.mastered && <Badge style={{ fontSize: "0.6rem" }}>Mastered</Badge>}
                            {card.is_new && <Badge style={{ fontSize: "0.6rem" }}>New</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AssignmentSettingsModal
        open={settingsModal.open}
        setOpen={(v) => setSettingsModal((s) => ({ ...s, open: v }))}
        assignment={settingsModal.assignment}
        onUpdated={fetchData}
      />

      {/* Recent Study Sessions */}
      {stats?.recentSessions?.length > 0 && (
        <>
          <h2>Recent Study Sessions</h2>
          <div className={styles.sessionsList}>
            {stats.recentSessions.map((s) => (
              <div key={s.id} className={styles.sessionRow}>
                <span>{new Date(s.started_at).toLocaleDateString()}</span>
                <span>{s.mode}</span>
                <span>
                  {s.cards_studied} cards ·{" "}
                  {s.correct_count}/{s.cards_studied} correct
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default StudentDetailPage;
