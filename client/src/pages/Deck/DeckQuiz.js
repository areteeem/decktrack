import { useParams } from "react-router";
import LoadingScreen from "../../common/components/LoadingScreen";
import FillBlank from "../../modules/FillBlank";
import { useDeck } from "../../hooks/useSupabaseData";

const DeckQuiz = () => {
  const params = useParams();
  const { data: deck, loading } = useDeck(params.id);
  if (loading) return <LoadingScreen />;
  return <FillBlank flashcards={deck?.flashcards || []} />;
};

export default DeckQuiz;
