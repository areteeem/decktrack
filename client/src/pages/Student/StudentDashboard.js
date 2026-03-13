import { useState, useMemo, useEffect, useCallback } from "react";
import styles from "./Student.module.css";
import { useAssignments, useStudentStats, usePerDeckStats, useDecks, useAllOwnDeckCards } from "../../hooks/useSupabaseData";
import { useAuth } from "../../contexts/AuthContext";
import LoadingScreen from "../../common/components/LoadingScreen";
import Badge from "../../common/components/Badge";
import Button from "../../common/components/Button";
import { Link } from "react-router-dom";
import NewDeckModal from "../../modules/Sidebar/NewDeckModal";
import DeckCard from "../../common/components/DeckCard";

const requiredPoolLabel = (pool) => {
  const normalizedPool = String(pool || 'any').trim().toLowerCase();
  if (normalizedPool === 'new') return 'Required: Learn new';
  if (normalizedPool === 'due') return 'Required: Review due';
  if (normalizedPool === 'mixed') return 'Required: Mixed';
  return 'Required: Any study';
};

const requiredPoolHint = (pool) => {
  const normalizedPool = String(pool || 'any').trim().toLowerCase();
  if (normalizedPool === 'new') return 'Complete a Learn New session to finish this assignment.';
  if (normalizedPool === 'due') return 'Complete a Study Due session to finish this assignment.';
  if (normalizedPool === 'mixed') return 'Complete a Mixed session (new + due cards) to finish this assignment.';
  return 'Any completed study session for this deck will count.';
};

const requiredModeLabel = (mode) => {
  const m = String(mode || 'any').trim().toLowerCase();
  if (m === 'flashcards') return 'Mode: Flashcards';
  if (m === 'quiz') return 'Mode: Fill-in-the-blank';
  if (m === 'mcq') return 'Mode: Multiple choice';
  if (m === 'match') return 'Mode: Match game';
  if (m === 'wheel') return 'Mode: Spin wheel';
  return null; // don't show badge for 'any'
};

const StudentDashboard = () => {
  const { profile, user } = useAuth();
  const { data: assignments, loading, refetch: refetchAssignments } = useAssignments();
  const { data: stats } = useStudentStats(user?.id);
  const { data: deckStats, refetch: refetchDeckStats } = usePerDeckStats(user?.id);
  const { data: ownDecks, loading: ownDecksLoading, refetch: refetchOwn } = useDecks();
  const { data: personalCards } = useAllOwnDeckCards();
  const [showNewDeckModal, setShowNewDeckModal] = useState(false);
  const [deckSearch, setDeckSearch] = useState("");

  // Refresh assignment stats when returning from a study session (page visibility change)
  const refreshAllStats = useCallback(() => {
    refetchDeckStats?.();
    refetchAssignments?.({ background: true });
  }, [refetchDeckStats, refetchAssignments]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshAllStats();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', refreshAllStats);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', refreshAllStats);
    };
  }, [refreshAllStats]);

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

  const activeAssignments = (assignments || []).filter((a) => !a.is_archived);

  const searchLower = deckSearch.trim().toLowerCase();
  const filteredOwnDecks = useMemo(() => {
    if (!ownDecks || !searchLower) return ownDecks || [];
    return ownDecks.filter(d => (d.name || '').toLowerCase().includes(searchLower));
  }, [ownDecks, searchLower]);

  const filteredAssignments = useMemo(() => {
    if (!searchLower) return activeAssignments;
    return activeAssignments.filter(a => {
      const name = (a.custom_name || a.flashy_decks?.name || '').toLowerCase();
      return name.includes(searchLower);
    });
  }, [activeAssignments, searchLower]);

  if (loading) return <LoadingScreen />;

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

      {/* ── Search ── */}
      {((ownDecks && ownDecks.length > 0) || activeAssignments.length > 0) && (
        <input
          type="text"
          placeholder="Search decks..."
          value={deckSearch}
          onChange={(e) => setDeckSearch(e.target.value)}
          style={{
            width: "100%",
            maxWidth: "24rem",
            padding: "0.5rem 0.75rem",
            marginBottom: "1rem",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius)",
            background: "var(--bg-secondary)",
            color: "var(--fg)",
            fontSize: "0.88rem",
          }}
        />
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
      ) : (!filteredOwnDecks || filteredOwnDecks.length === 0) ? (
        <div className={styles.empty} style={{ marginBottom: "1.5rem" }}>
          <h2>No decks yet</h2>
          <p>Create your own flashcard deck to start studying.</p>
          <Button callback={() => setShowNewDeckModal(true)}>Create first deck</Button>
        </div>
      ) : (
        <div className={styles.deckGrid} style={{ marginBottom: "1.5rem" }}>
          {filteredOwnDecks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} />
          ))}
        </div>
      )}

      {/* ── Assigned Studies ───────────────────── */}
      {(!filteredAssignments || filteredAssignments.length === 0) ? (
        <div className={styles.empty}>
          <p style={{ color: "var(--fg-muted)", fontSize: "0.85rem" }}>No assigned studies yet.</p>
        </div>
      ) : (
        <>
          <h2 style={{ marginBottom: "0.5rem" }}>Assigned Studies</h2>
          <div className={styles.deckGrid}>
            {filteredAssignments.map((a) => (
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
  const studied = total - newCount;
  const masteryPct = total > 0 ? Math.round((mastered / total) * 100) : 0;
  const studiedPct = total > 0 ? Math.round((studied / total) * 100) : 0;
  // Use assignment.completed from DB if available, else derive from card stats
  const isCompleted = assignment.completed === true || (total > 0 && studied >= total);
  const progressPercent = assignment.progress_percent ?? studiedPct;
  const requiredPool = String(assignment?.required_pool || 'any').trim().toLowerCase();
  const requiredMode = String(assignment?.required_mode || 'any').trim().toLowerCase();

  const primaryRoute = (() => {
    // If a specific quiz/game mode is required, route directly to that mode
    if (['quiz', 'mcq', 'match', 'wheel'].includes(requiredMode)) {
      return `/study/${assignment.id}/mode/${requiredMode}`;
    }
    // Otherwise use pool-based SRS routing
    if (requiredPool === 'new') return `/study/${assignment.id}/new`;
    if (requiredPool === 'due') return `/study/${assignment.id}/due`;
    if (requiredPool === 'mixed') return `/study/${assignment.id}/mixed`;
    if (newCount > 0) return `/study/${assignment.id}/new`;
    if (due > 0) return `/study/${assignment.id}/due`;
    return `/deck/${assignment.id}/browse`;
  })();

  const primaryLabel = isCompleted
    ? 'Review again'
    : (requiredPool !== 'any' || requiredMode !== 'any')
      ? 'Start required study'
      : 'Start study';

  const modeLabel = requiredModeLabel(requiredMode);

  return (
    <div className={styles.deckCard} style={isCompleted ? { borderColor: 'var(--accent)', borderWidth: '2px' } : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{deckName}</h2>
        {isCompleted && <Badge style={{ background: 'var(--accent)', color: '#fff' }}>✓ Completed</Badge>}
      </div>
      {deckDesc && <p className={styles.deckDesc}>{deckDesc}</p>}
      <p className={styles.deckDesc} style={{ marginTop: "0.1rem" }}>Assigned by teacher</p>
      <div className={styles.deckMeta}>
        <Badge>{requiredPoolLabel(requiredPool)}</Badge>
        {modeLabel && <Badge>{modeLabel}</Badge>}
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
      <p className={styles.deckDesc}>{requiredPoolHint(requiredPool)}</p>

      {/* Per-deck progress */}
      {total > 0 && (
        <>
          <div className={styles.deckProgress}>
            <div className={styles.deckProgressTrack}>
              <div
                className={styles.deckProgressFill}
                style={{
                  width: `${progressPercent}%`,
                  background: isCompleted ? 'var(--accent)' : 'var(--fg)',
                }}
              />
            </div>
            <span className={styles.deckProgressLabel}>{progressPercent}% studied</span>
          </div>
          <div className={styles.deckStatsRow}>
            <span>{total} cards</span>
            {newCount > 0 && <span>{newCount} new</span>}
            {due > 0 && <span style={{ fontWeight: 600 }}>{due} due</span>}
            <span>{mastered} mastered ({masteryPct}%)</span>
          </div>
        </>
      )}

      <div className={styles.deckActions}>
        <Link to={primaryRoute}>
          <Button>{primaryLabel}</Button>
        </Link>
        {requiredPool === 'any' && requiredMode === 'any' && (
          <>
            <Link to={`/study/${assignment.id}/new`}>
              <Button bgcolor="transparent" color="var(--fg)">Learn New</Button>
            </Link>
            <Link to={`/study/${assignment.id}/due`}>
              <Button bgcolor="transparent" color="var(--fg)">Study Due</Button>
            </Link>
            <Link to={`/study/${assignment.id}/mode/mcq`}>
              <Button bgcolor="transparent" color="var(--fg)">Quiz</Button>
            </Link>
            <Link to={`/study/${assignment.id}/mode/match`}>
              <Button bgcolor="transparent" color="var(--fg)">Match</Button>
            </Link>
            <Link to={`/study/${assignment.id}/mode/wheel`}>
              <Button bgcolor="transparent" color="var(--fg)">🎡 Wheel</Button>
            </Link>
          </>
        )}
        <Link to={`/deck/${assignment.id}/browse`}>
          <Button bgcolor="transparent" color="var(--fg)">Browse</Button>
        </Link>
      </div>
    </div>
  );
};

export default StudentDashboard;
