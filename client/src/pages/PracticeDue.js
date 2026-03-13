import { useNavigate } from "react-router";
import LoadingScreen from "../common/components/LoadingScreen";
import Practice from "../modules/Practice";
import { useDueCards, useRecordSession } from "../hooks/useSupabaseData";

const PracticeDue = () => {
  const navigate = useNavigate();
  const { data: cards, loading } = useDueCards();
  const { recordSession } = useRecordSession();

  const handleSessionComplete = async (summary) => {
    await recordSession({
      ...summary,
      assignment_id: null,
      deck_name: 'All Decks',
    });
  };

  if (loading) return <LoadingScreen />;
  return <Practice flashcards={cards || []} onQuit={() => navigate(-1)} onSessionComplete={handleSessionComplete} />;
};

export default PracticeDue;
