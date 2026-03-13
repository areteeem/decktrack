import { useParams, useNavigate } from "react-router";
import LoadingScreen from "../../common/components/LoadingScreen";
import Learn from "../../modules/Learn";
import Practice from "../../modules/Practice";
import { useStudentDeckCards, useRecordSession, useAssignments } from "../../hooks/useSupabaseData";

/** Show new cards for a given assignment */
export const StudentLearnNew = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { data: cards, loading } = useStudentDeckCards(assignmentId);
  const { data: assignments } = useAssignments();
  const { recordSession } = useRecordSession();

  const assignment = (assignments || []).find((item) => String(item?.id) === String(assignmentId));
  const deckName = assignment?.flashy_decks?.name || 'Assigned Deck';

  const handleSessionComplete = async (summary) => {
    await recordSession({
      ...summary,
      assignment_id: assignmentId,
      deck_name: deckName,
      pool: 'new',
    });
  };

  if (loading) return <LoadingScreen />;
  const newCards = (cards || [])
    .filter((c) => c.is_new === true)
    .map((c) => ({ ...c, new: c.is_new, nextReview: c.next_review_days }));
  return <Learn flashcards={newCards} onQuit={() => navigate(-1)} onSessionComplete={handleSessionComplete} />;
};

/** Show due cards for a given assignment */
export const StudentPracticeDue = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { data: cards, loading } = useStudentDeckCards(assignmentId);
  const { data: assignments } = useAssignments();
  const { recordSession } = useRecordSession();

  const assignment = (assignments || []).find((item) => String(item?.id) === String(assignmentId));
  const deckName = assignment?.flashy_decks?.name || 'Assigned Deck';

  const handleSessionComplete = async (summary) => {
    await recordSession({
      ...summary,
      assignment_id: assignmentId,
      deck_name: deckName,
      pool: 'due',
    });
  };

  if (loading) return <LoadingScreen />;
  const dueCards = (cards || [])
    .filter(
      (c) =>
        c.is_new === false &&
        c.mastered === false &&
        new Date(c.due) < new Date()
    )
    .map((c) => ({ ...c, new: c.is_new, nextReview: c.next_review_days }));
  return <Practice flashcards={dueCards} onQuit={() => navigate(-1)} onSessionComplete={handleSessionComplete} />;
};

/** Show new + due cards combined for a given assignment (mixed session) */
export const StudentStudyMixed = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { data: cards, loading } = useStudentDeckCards(assignmentId);
  const { data: assignments } = useAssignments();
  const { recordSession } = useRecordSession();

  const assignment = (assignments || []).find((item) => String(item?.id) === String(assignmentId));
  const deckName = assignment?.flashy_decks?.name || 'Assigned Deck';

  const handleSessionComplete = async (summary) => {
    await recordSession({
      ...summary,
      assignment_id: assignmentId,
      deck_name: deckName,
      pool: 'mixed',
    });
  };

  if (loading) return <LoadingScreen />;
  const now = new Date();
  const mixedCards = (cards || [])
    .filter((c) =>
      c.is_new === true ||
      (c.is_new === false && c.mastered === false && new Date(c.due) < now)
    )
    .map((c) => ({ ...c, new: c.is_new, nextReview: c.next_review_days }));
  return <Learn flashcards={mixedCards} onQuit={() => navigate(-1)} onSessionComplete={handleSessionComplete} />;
};
