import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DeckCard from "../../common/components/DeckCard";
import LoadingScreen from "../../common/components/LoadingScreen";
import Button from "../../common/components/Button";
import Badge from "../../common/components/Badge";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./Dashboard.module.css";
import { useDecks, useArchivedDecks, useDeleteDeck, useUpdateDeck, useCourses, useCourseActions } from "../../hooks/useSupabaseData";
import NewDeckModal from "../../modules/Sidebar/NewDeckModal";
import { toast } from "react-toastify";

const Dashboard = () => {
  const [showNewDeckModal, setShowNewDeckModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [expandedCourses, setExpandedCourses] = useState(() => new Set());
  const [newCourseName, setNewCourseName] = useState("");
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [deckSearch, setDeckSearch] = useState("");
  const navigate = useNavigate();
  const { isTeacher } = useAuth();
  const { data: decks, loading, error, refetch } = useDecks();
  const { data: archivedDecks, refetch: refetchArchived } = useArchivedDecks();
  const { deleteDeck } = useDeleteDeck();
  const { updateDeck } = useUpdateDeck();
  const { courses, refetch: refetchCourses } = useCourses();
  const { createCourse, deleteCourse, addDeckToCourse, removeDeckFromCourse } = useCourseActions();

  // Build set of deck IDs that belong to any course
  const deckIdsInCourses = useMemo(() => {
    const ids = new Set();
    (courses || []).forEach((c) => (c.flashy_course_decks || []).forEach((cd) => ids.add(cd.deck_id)));
    return ids;
  }, [courses]);

  // Decks not in any course ("Uncategorized")
  const uncategorizedDecks = useMemo(() =>
    (decks || []).filter((d) => !deckIdsInCourses.has(d.id)),
    [decks, deckIdsInCourses]
  );

  // Search filter
  const searchFilter = (deck) => {
    if (!deckSearch.trim()) return true;
    const q = deckSearch.toLowerCase();
    return (deck.name || '').toLowerCase().includes(q)
      || (deck.category || '').toLowerCase().includes(q)
      || (deck.tags || []).some((t) => t.toLowerCase().includes(q));
  };

  const toggleCourse = (courseId) => {
    setExpandedCourses((prev) => {
      const next = new Set(prev);
      next.has(courseId) ? next.delete(courseId) : next.add(courseId);
      return next;
    });
  };

  const handleCreateCourse = async () => {
    const name = newCourseName.trim();
    if (!name) return;
    try {
      await createCourse({ name });
      setNewCourseName("");
      setShowNewCourse(false);
      toast.success("Course created");
      refetchCourses();
    } catch (e) {
      toast.error(e.message || "Failed to create course");
    }
  };

  if (error) return <p>Error :(</p>;
  if (loading) return <LoadingScreen />;

  return (
    <>
      <NewDeckModal
        open={showNewDeckModal}
        setOpen={setShowNewDeckModal}
        onCreated={refetch}
      />

      <div className={styles.header}>
        <div>
          <h1>Your decks</h1>
          {isTeacher && (
            <p className={styles.subtitle}>
              Create decks, add cards, and assign them to your students.
            </p>
          )}
        </div>

        {isTeacher && (
          <div className={styles.actions}>
            <Button callback={() => setShowNewDeckModal(true)}>+ New deck</Button>
            <Button callback={() => setShowNewCourse(true)}>+ New course</Button>
            <Button callback={() => navigate("/students")}>My students</Button>
          </div>
        )}
      </div>

      {/* Deck search */}
      {(decks?.length > 0) && (
        <div style={{ marginBottom: "1rem" }}>
          <input
            type="text"
            placeholder="Search decks…"
            value={deckSearch}
            onChange={(e) => setDeckSearch(e.target.value)}
            style={{
              width: "100%",
              maxWidth: "24rem",
              padding: "0.5rem 0.75rem",
              borderRadius: "var(--radius, 8px)",
              border: "1px solid var(--border-color, #ddd)",
              fontSize: "0.9rem",
              background: "var(--bg-secondary, #f9f9f9)",
              color: "var(--fg, #333)",
            }}
          />
        </div>
      )}

      {/* New course inline form */}
      {showNewCourse && (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}>
          <input
            type="text"
            placeholder="Course name…"
            value={newCourseName}
            onChange={(e) => setNewCourseName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCourse(); if (e.key === 'Escape') setShowNewCourse(false); }}
            autoFocus
            style={{
              padding: "0.45rem 0.7rem",
              borderRadius: "var(--radius, 8px)",
              border: "1px solid var(--border-color, #ddd)",
              fontSize: "0.9rem",
              flex: 1,
              maxWidth: "20rem",
            }}
          />
          <Button callback={handleCreateCourse}>Create</Button>
          <Button callback={() => setShowNewCourse(false)} bgcolor="transparent" color="var(--fg-muted)">Cancel</Button>
        </div>
      )}

      {isTeacher && (!decks || decks.length === 0) ? (
        <div className={styles.emptyState}>
          <h2>No decks yet</h2>
          <p>Start by creating your first deck, then open it to add flashcards.</p>
          <div className={styles.actions}>
            <Button callback={() => setShowNewDeckModal(true)}>Create first deck</Button>
            <Button callback={() => navigate("/students")}>Open students</Button>
          </div>
        </div>
      ) : null}

      <div className={styles.deckContainer}>
        {/* Course sections */}
        {(courses || []).map((course) => {
          const courseDecks = (course.flashy_course_decks || [])
            .map((cd) => (decks || []).find((d) => d.id === cd.deck_id))
            .filter(Boolean)
            .filter(searchFilter);
          const isExpanded = expandedCourses.has(course.id);
          return (
            <div key={course.id} style={{ gridColumn: "1 / -1", marginBottom: "0.5rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  cursor: "pointer",
                  userSelect: "none",
                  padding: "0.4rem 0",
                }}
                onClick={() => toggleCourse(course.id)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span style={{ fontWeight: 600, fontSize: "1rem" }}>{course.name}</span>
                <span style={{ fontSize: "0.8rem", color: "var(--fg-muted)" }}>({courseDecks.length} deck{courseDecks.length !== 1 ? "s" : ""})</span>
                <button
                  onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete course "${course.name}"? Decks inside will NOT be deleted.`)) { deleteCourse(course.id).then(() => { toast.success("Course deleted"); refetchCourses(); }).catch((err) => toast.error(err.message)); } }}
                  style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--danger, #c00)", cursor: "pointer", fontSize: "0.8rem" }}
                >
                  Delete
                </button>
              </div>
              {isExpanded && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))", gap: "0.75rem", marginTop: "0.25rem", paddingLeft: "1.2rem" }}>
                  {courseDecks.map((deck) => (
                    <DeckCard key={deck.id} deck={deck} />
                  ))}
                  {courseDecks.length === 0 && <p style={{ color: "var(--fg-muted)", fontSize: "0.85rem" }}>No matching decks</p>}
                </div>
              )}
            </div>
          );
        })}

        {/* Uncategorized decks */}
        {uncategorizedDecks.filter(searchFilter).map((deck) => (
          <DeckCard key={deck.id} deck={deck} />
        ))}
      </div>

      {/* Archived decks */}
      {archivedDecks?.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <button
            onClick={() => setShowArchived(!showArchived)}
            style={{
              background: "none",
              border: "none",
              color: "var(--fg-muted)",
              cursor: "pointer",
              fontSize: "0.85rem",
              padding: "0.35rem 0",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: showArchived ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            Archived decks ({archivedDecks.length})
          </button>
          {showArchived && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))",
                gap: "0.75rem",
                marginTop: "0.5rem",
              }}
            >
              {archivedDecks.map((deck) => (
                <div
                  key={deck.id}
                  style={{
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius)",
                    padding: "0.75rem",
                    opacity: 0.7,
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "0.95rem" }}>{deck.name}</h3>
                  <p style={{ margin: "0.25rem 0", fontSize: "0.8rem", color: "var(--fg-muted)" }}>
                    {deck.cardCount} cards
                  </p>
                  <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                    <Button
                      callback={async () => {
                        try {
                          await updateDeck(deck.id, { is_archived: false });
                          toast.success("Deck restored");
                          refetch();
                          refetchArchived();
                        } catch (e) {
                          toast.error(e.message || "Failed to restore");
                        }
                      }}
                      bgcolor="transparent"
                      color="var(--fg)"
                    >
                      Restore
                    </Button>
                    <Button
                      callback={async () => {
                        if (!window.confirm(`Permanently delete "${deck.name}" and all its cards? This cannot be undone.`)) return;
                        try {
                          await deleteDeck(deck.id);
                          toast.success("Deck deleted permanently");
                          refetchArchived();
                        } catch (e) {
                          toast.error(e.message || "Failed to delete");
                        }
                      }}
                      bgcolor="transparent"
                      color="var(--danger, #c00)"
                    >
                      Delete permanently
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default Dashboard;
