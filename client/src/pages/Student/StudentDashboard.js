import { useState, useMemo } from "react";
import styles from "./Student.module.css";
import { useAssignments, useStudentStats, usePerDeckStats, useDecks, useAllOwnDeckCards } from "../../hooks/useSupabaseData";
import { useAuth } from "../../contexts/AuthContext";
import LoadingScreen from "../../common/components/LoadingScreen";
import Badge from "../../common/components/Badge";
import Button from "../../common/components/Button";
import { Link } from "react-router-dom";
import NewDeckModal from "../../modules/Sidebar/NewDeckModal";
import DeckCard from "../../common/components/DeckCard";

const StudentDashboard = () => {
  const { profile, user } = useAuth();
  const { data: assignments, loading } = useAssignments();
  const { data: stats } = useStudentStats(user?.id);
  const { data: deckStats } = usePerDeckStats(user?.id);
  const { data: ownDecks, loading: ownDecksLoading, refetch: refetchOwn } = useDecks();
  const { data: personalCards } = useAllOwnDeckCards();
  const [showNewDeckModal, setShowNewDeckModal] = useState(false);

  // Personal deck card stats
  const personalStats = useMemo(() => {
    const cards = personalCards || [];
    const now = new Date();
    return {
      total: cards.length,
      mastered: cards.filter(c => c.mastered).length,
      due: cards.filter(c => !c.is_new && !c.mastered && new Date(c.due) < now).length,
      new: cards.filter(c => c.is_new).length,
    };
  }, [personalCards]);

  if (loading) return <LoadingScreen />;

  const activeAssignments = (assignments || []).filter((a) => !a.is_archived);

  // Combined stats (assigned + personal)
  const combinedTotal = (stats?.totalCards || 0) + personalStats.total;
  const combinedMastered = (stats?.masteredCards || 0) + personalStats.mastered;
  const combinedDue = (stats?.dueCards || 0) + personalStats.due;
  const combinedNew = (stats?.newCards || 0) + personalStats.new;

  const masteryPct = combinedTotal > 0
    ? Math.round((combinedMastered / combinedTotal) * 100)
    : null;

  return (
    <div>
      <h1>My Flashcards</h1>
      <p className={styles.subtitle}>
        Welcome back{profile?.display_name ? `, ${profile.display_name}` : ""}!
      </p>

      {combinedTotal > 0 && (
        <div className={styles.statsSection}>
          <div className={styles.statsGrid}>
            <div className={styles.statBox}>
              <span className={styles.statNumber}>{combinedTotal}</span>
              <span className={styles.statLabel}>Total Cards</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statNumber}>{combinedMastered}</span>
              <span className={styles.statLabel}>Mastered</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statNumber}>{combinedDue}</span>
              <span className={styles.statLabel}>Due Now</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statNumber}>{combinedNew}</span>
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

      {/* Cross-deck quick actions — covers both assigned + personal */}
      {(combinedDue > 0 || combinedNew > 0) && (
        <div className={styles.deckActions} style={{ marginBottom: "1rem" }}>
          {combinedNew > 0 && (
            <Link to="/study/all/new">
              <Button>Learn All New ({combinedNew})</Button>
            </Link>
          )}
          {combinedDue > 0 && (
            <Link to="/study/all/due">
              <Button>Study All Due ({combinedDue})</Button>
            </Link>
          )}
        </div>
      )}

      {/* ── My Decks (student-created) ─────────── */}
      <NewDeckModal
        open={showNewDeckModal}
        setOpen={setShowNewDeckModal}
        onCreated={refetchOwn}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <h2 style={{ margin: 0 }}>My Decks</h2>
        <Button callback={() => setShowNewDeckModal(true)}>+ New deck</Button>
      </div>
      {ownDecksLoading ? (
        <p style={{ color: "var(--fg-muted)", fontSize: "0.85rem" }}>Loading...</p>
      ) : (!ownDecks || ownDecks.length === 0) ? (
        <div className={styles.empty} style={{ marginBottom: "1.5rem" }}>
          <h2>No decks yet</h2>
          <p>Create your own flashcard deck to start studying.</p>
          <Button callback={() => setShowNewDeckModal(true)}>Create first deck</Button>
        </div>
      ) : (
        <div className={styles.deckGrid} style={{ marginBottom: "1.5rem" }}>
          {ownDecks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} />
          ))}
        </div>
      )}

      {/* ── Assigned Decks ─────────────────────── */}
      {(!activeAssignments || activeAssignments.length === 0) ? (
        <div className={styles.empty}>
          <p style={{ color: "var(--fg-muted)", fontSize: "0.85rem" }}>No decks assigned by your teacher yet.</p>
        </div>
      ) : (
        <>
          <h2 style={{ marginBottom: "0.5rem" }}>Assigned Decks</h2>
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
