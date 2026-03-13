import { useParams, useNavigate } from "react-router";
import LoadingScreen from "../../common/components/LoadingScreen";
import Practice from "../../modules/Practice";
import { useDueCards, useRecordSession, useDeck } from "../../hooks/useSupabaseData";

const DeckPracticeDue = () => {
  const params = useParams();
  const navigate = useNavigate();
  const { data: cards, loading } = useDueCards(params.id);
  const { data: deck } = useDeck(params.id);
  const { recordSession } = useRecordSession();

  const handleSessionComplete = async (summary) => {
    await recordSession({
      ...summary,
      assignment_id: null,
      deck_name: deck?.name || 'Deck Study',
    });
  };

  if (loading) return <LoadingScreen />;
  return <Practice flashcards={cards || []} onQuit={() => navigate(`/deck/${params.id}`)} onSessionComplete={handleSessionComplete} />;
};

export default DeckPracticeDue;
