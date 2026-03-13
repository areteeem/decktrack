import { useParams, useNavigate } from "react-router";
import LoadingScreen from "../../common/components/LoadingScreen";
import Learn from "../../modules/Learn";
import Practice from "../../modules/Practice";
import FillBlank from "../../modules/FillBlank";
import MultipleChoice from "../../modules/MultipleChoice";
import MatchGame from "../../modules/MatchGame";
import SpinWheel from "../../modules/SpinWheel";
import { useStudentDeckCards, useRecordSession, useAssignments, useNotifyStudyCompletion } from "../../hooks/useSupabaseData";

/** Show new cards for a given assignment */
export const StudentLearnNew = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { data: cards, loading } = useStudentDeckCards(assignmentId);
  const { data: assignments } = useAssignments();
  const { recordSession } = useRecordSession();
  const { notifyCompletion } = useNotifyStudyCompletion();

  const assignment = (assignments || []).find((item) => String(item?.id) === String(assignmentId));
  const deckName = assignment?.flashy_decks?.name || 'Assigned Deck';

  const handleSessionComplete = async (summary) => {
    await recordSession({
      ...summary,
      assignment_id: assignmentId,
      deck_name: deckName,
      pool: 'new',
    });
    // Signal completion to teacher app (auto-mark homework done)
    await notifyCompletion(assignment, 'new');
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
  const { notifyCompletion } = useNotifyStudyCompletion();

  const assignment = (assignments || []).find((item) => String(item?.id) === String(assignmentId));
  const deckName = assignment?.flashy_decks?.name || 'Assigned Deck';

  const handleSessionComplete = async (summary) => {
    await recordSession({
      ...summary,
      assignment_id: assignmentId,
      deck_name: deckName,
      pool: 'due',
    });
    await notifyCompletion(assignment, 'due');
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
  const { notifyCompletion } = useNotifyStudyCompletion();

  const assignment = (assignments || []).find((item) => String(item?.id) === String(assignmentId));
  const deckName = assignment?.flashy_decks?.name || 'Assigned Deck';

  const handleSessionComplete = async (summary) => {
    await recordSession({
      ...summary,
      assignment_id: assignmentId,
      deck_name: deckName,
      pool: 'mixed',
    });
    await notifyCompletion(assignment, 'mixed');
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

/** Mode-specific study for a given assignment (mcq, quiz/fillblank, match) */
export const StudentStudyMode = () => {
  const { assignmentId, mode } = useParams();
  const navigate = useNavigate();
  const { data: cards, loading } = useStudentDeckCards(assignmentId);
  const { data: assignments } = useAssignments();
  const { recordSession } = useRecordSession();
  const { notifyCompletion } = useNotifyStudyCompletion();

  const assignment = (assignments || []).find((item) => String(item?.id) === String(assignmentId));
  const deckName = assignment?.flashy_decks?.name || 'Assigned Deck';

  const handleSessionComplete = async (summary) => {
    await recordSession({
      ...summary,
      assignment_id: assignmentId,
      deck_name: deckName,
      pool: 'all',
    });
    await notifyCompletion(assignment, 'all');
  };

  if (loading) return <LoadingScreen />;

  const allCards = (cards || []).map((c) => ({ ...c, new: c.is_new, nextReview: c.next_review_days }));
  const onQuit = () => navigate(-1);

  switch (mode) {
    case 'mcq':
      return <MultipleChoice flashcards={allCards} onQuit={onQuit} onSessionComplete={handleSessionComplete} />;
    case 'match':
      return <MatchGame flashcards={allCards} onQuit={onQuit} onSessionComplete={handleSessionComplete} />;
    case 'wheel':
      return <SpinWheel flashcards={allCards} onQuit={onQuit} onSessionComplete={handleSessionComplete} />;
    case 'quiz':
    case 'fillblank':
      return <FillBlank flashcards={allCards} onQuit={onQuit} onSessionComplete={handleSessionComplete} />;
    default:
      navigate(-1);
      return null;
  }
};
