import { useParams } from "react-router";
import LoadingScreen from "../../common/components/LoadingScreen";
import Learn from "../../modules/Learn";
import Practice from "../../modules/Practice";
import { useStudentDeckCards } from "../../hooks/useSupabaseData";

/** Show new cards for a given assignment */
export const StudentLearnNew = () => {
  const { assignmentId } = useParams();
  const { data: cards, loading } = useStudentDeckCards(assignmentId);
  if (loading) return <LoadingScreen />;
  const newCards = (cards || [])
    .filter((c) => c.is_new === true)
    .map((c) => ({ ...c, new: c.is_new, nextReview: c.next_review_days }));
  return <Learn flashcards={newCards} />;
};

/** Show due cards for a given assignment */
export const StudentPracticeDue = () => {
  const { assignmentId } = useParams();
  const { data: cards, loading } = useStudentDeckCards(assignmentId);
  if (loading) return <LoadingScreen />;
  const dueCards = (cards || [])
    .filter(
      (c) =>
        c.is_new === false &&
        c.mastered === false &&
        new Date(c.due) < new Date()
    )
    .map((c) => ({ ...c, new: c.is_new, nextReview: c.next_review_days }));
  return <Practice flashcards={dueCards} />;
};
