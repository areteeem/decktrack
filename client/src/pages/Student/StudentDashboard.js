import styles from "./Student.module.css";
import { useAssignments, useStudentStats, usePerDeckStats } from "../../hooks/useSupabaseData";
import { useAuth } from "../../contexts/AuthContext";
import LoadingScreen from "../../common/components/LoadingScreen";
import Badge from "../../common/components/Badge";
import Button from "../../common/components/Button";
import { Link } from "react-router-dom";

const StudentDashboard = () => {
  const { profile, user } = useAuth();
  const { data: assignments, loading } = useAssignments();
  const { data: stats } = useStudentStats(user?.id);
  const { data: deckStats } = usePerDeckStats(user?.id);

  if (loading) return <LoadingScreen />;

  const activeAssignments = (assignments || []).filter((a) => !a.is_archived);

  const masteryPct = stats?.totalCards > 0
    ? Math.round((stats.masteredCards / stats.totalCards) * 100)
    : null;

  // Global due / new totals
  const totalDue = stats?.dueCards || 0;
  const totalNew = stats?.newCards || 0;

  return (
    <div>
      <h1>My Flashcards</h1>
      <p className={styles.subtitle}>
        Welcome back{profile?.display_name ? `, ${profile.display_name}` : ""}!
      </p>

      {stats && stats.totalCards > 0 && (
        <div className={styles.statsSection}>
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
          {masteryPct !== null && (
            <div className={styles.masteryBar}>
              <div className={styles.masteryBarInner}>
                <div
                  className={styles.masteryBarFill}
                  style={{ width: `${masteryPct}%` }}
                />
              </div>
              <span className={styles.masteryLabel}>{masteryPct}% mastered</span>
            </div>
          )}
        </div>
      )}

      {(!activeAssignments || activeAssignments.length === 0) ? (
        <div className={styles.empty}>
          <h2>No decks assigned yet</h2>
          <p>Your teacher will assign flashcard decks for you to study.</p>
        </div>
      ) : (
        <>
          {/* Cross-deck quick actions */}
          {(totalDue > 0 || totalNew > 0) && (
            <div className={styles.deckActions} style={{ marginBottom: "0.75rem" }}>
              {totalNew > 0 && (
                <Link to="/study/all/new">
                  <Button>Learn All New ({totalNew})</Button>
                </Link>
              )}
              {totalDue > 0 && (
                <Link to="/study/all/due">
                  <Button>Study All Due ({totalDue})</Button>
                </Link>
              )}
            </div>
          )}

          <div className={styles.deckGrid}>
            {activeAssignments.map((a) => (
              <AssignedDeckCard key={a.id} assignment={a} deckStats={deckStats} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const AssignedDeckCard = ({ assignment, deckStats }) => {
  const deckName =
    assignment.custom_name ||
    assignment.flashy_decks?.name ||
    "Unnamed Deck";
  const deckDesc = assignment.flashy_decks?.description || "";

  // Per-deck stats from the aggregated hook (supports object-map or array shape)
  const ds = Array.isArray(deckStats)
    ? (deckStats.find((d) => d.assignment_id === assignment.id) || {})
    : (deckStats?.[assignment.id] || deckStats?.[String(assignment.id)] || {});
  const total = ds.total || 0;
  const mastered = ds.mastered || 0;
  const due = ds.due || 0;
  const newCount = ds.new_count ?? ds.newCards ?? 0;
  const masteryPct = total > 0 ? Math.round((mastered / total) * 100) : 0;

  return (
    <div className={styles.deckCard}>
      <h2>{deckName}</h2>
      {deckDesc && <p className={styles.deckDesc}>{deckDesc}</p>}
      <div className={styles.deckMeta}>
        {assignment.flashy_decks?.category && (
          <Badge>{assignment.flashy_decks.category}</Badge>
        )}
        {assignment.flashy_decks?.difficulty_level && (
          <Badge>{assignment.flashy_decks.difficulty_level}</Badge>
        )}
        {assignment.allow_student_cards && (
          <Badge>+ Cards</Badge>
        )}
      </div>

      {/* Per-deck progress */}
      {total > 0 && (
        <>
          <div className={styles.deckProgress}>
            <div className={styles.deckProgressTrack}>
              <div
                className={styles.deckProgressFill}
                style={{
                  width: `${masteryPct}%`,
                  background: "var(--accent)",
                }}
              />
            </div>
            <span className={styles.deckProgressLabel}>{masteryPct}%</span>
          </div>
          <div className={styles.deckStatsRow}>
            <span>{total} cards</span>
            {newCount > 0 && <span>{newCount} new</span>}
            {due > 0 && <span style={{ fontWeight: 600 }}>{due} due</span>}
            <span>{mastered} mastered</span>
          </div>
        </>
      )}

      <div className={styles.deckActions}>
        <Link to={`/study/${assignment.id}/new`}>
          <Button>Learn New</Button>
        </Link>
        <Link to={`/study/${assignment.id}/due`}>
          <Button>Study Due</Button>
        </Link>
        <Link to={`/deck/${assignment.id}/browse`}>
          <Button bgcolor="transparent" color="var(--fg)">Browse</Button>
        </Link>
      </div>
    </div>
  );
};

export default StudentDashboard;
