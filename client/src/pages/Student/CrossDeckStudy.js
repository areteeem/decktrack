import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import LoadingScreen from "../../common/components/LoadingScreen";
import Learn from "../../modules/Learn";
import Practice from "../../modules/Practice";
import { useAssignments, useStudentDeckCards } from "../../hooks/useSupabaseData";

/**
 * Aggregates cards across all assignments and passes them to Learn / Practice.
 * Uses a small wrapper that fetches each assignment's cards individually then merges.
 */

const useAllStudentCards = () => {
  const { data: assignments, loading: aLoading } = useAssignments();

  // We can't call hooks in a loop, so we'll use a different approach:
  // Fetch all student_cards for the user (no assignment filter)
  // by querying each active assignment
  const activeAssignments = useMemo(
    () => (assignments || []).filter((a) => !a.is_archived),
    [assignments]
  );

  // For cross-deck, we just render a multi-fetcher component
  return { assignments: activeAssignments, loading: aLoading };
};

/** Collects cards from a single assignment hook call */
const AssignmentCards = ({ assignmentId, onCards }) => {
  const { data: cards, loading } = useStudentDeckCards(assignmentId);

  // Push cards up once loaded
  useMemo(() => {
    if (!loading && cards) {
      onCards(assignmentId, cards);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, cards, assignmentId]);

  return null; // invisible
};

/**
 * Cross-deck wrapper component.
 * Renders invisible <AssignmentCards> fetchers, then merges results.
 */

const CrossDeckStudy = ({ mode }) => {
  const { assignments, loading } = useAllStudentCards();
  const [cardMap, setCardMap] = useState({});
  const readyRef = useRef(new Set());
  const [allReady, setAllReady] = useState(false);

  const handleCards = useCallback((assignmentId, cards) => {
    setCardMap((prev) => ({ ...prev, [assignmentId]: cards }));
    readyRef.current.add(assignmentId);
  }, []);

  useEffect(() => {
    if (!loading && assignments.length > 0 && readyRef.current.size >= assignments.length) {
      setAllReady(true);
    }
  }, [loading, assignments, cardMap]);

  if (loading) return <LoadingScreen />;
  if (assignments.length === 0) return <p>No decks assigned yet.</p>;

  const allCards = Object.values(cardMap)
    .flat()
    .map((c) => ({ ...c, new: c.is_new, nextReview: c.next_review_days }));

  if (!allReady) {
    return (
      <>
        {assignments.map((a) => (
          <AssignmentCards key={a.id} assignmentId={a.id} onCards={handleCards} />
        ))}
        <LoadingScreen />
      </>
    );
  }

  if (mode === "new") {
    const newCards = allCards.filter((c) => c.is_new === true);
    return (
      <>
        {assignments.map((a) => (
          <AssignmentCards key={a.id} assignmentId={a.id} onCards={handleCards} />
        ))}
        <Learn flashcards={newCards} />
      </>
    );
  }

  // mode === "due"
  const dueCards = allCards.filter(
    (c) => c.is_new === false && c.mastered === false && new Date(c.due) < new Date()
  );
  return (
    <>
      {assignments.map((a) => (
        <AssignmentCards key={a.id} assignmentId={a.id} onCards={handleCards} />
      ))}
      <Practice flashcards={dueCards} />
    </>
  );
};

export const CrossDeckLearnNew = () => <CrossDeckStudy mode="new" />;
export const CrossDeckPracticeDue = () => <CrossDeckStudy mode="due" />;
