import { useParams, useNavigate } from "react-router";
import LoadingScreen from "../../common/components/LoadingScreen";
import Learn from "../../modules/Learn";
import { useNewCards, useRecordSession, useDeck } from "../../hooks/useSupabaseData";

const DeckLearnNew = () => {
  const params = useParams();
  const navigate = useNavigate();
  const { data: cards, loading } = useNewCards(params.id);
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
  return <Learn flashcards={cards || []} onQuit={() => navigate(`/deck/${params.id}`)} onSessionComplete={handleSessionComplete} />;
};

export default DeckLearnNew;
