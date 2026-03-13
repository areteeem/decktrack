import { useNavigate } from "react-router";
import LoadingScreen from "../common/components/LoadingScreen";
import Learn from "../modules/Learn";
import { useNewCards, useRecordSession } from "../hooks/useSupabaseData";

const LearnNew = () => {
  const navigate = useNavigate();
  const { data: cards, loading } = useNewCards();
  const { recordSession } = useRecordSession();

  const handleSessionComplete = async (summary) => {
    await recordSession({
      ...summary,
      assignment_id: null,
      deck_name: 'All Decks',
    });
  };

  if (loading) return <LoadingScreen />;
  return <Learn flashcards={cards || []} onQuit={() => navigate(-1)} onSessionComplete={handleSessionComplete} />;
};

export default LearnNew;
