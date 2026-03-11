import { useParams } from "react-router";
import LoadingScreen from "../../common/components/LoadingScreen";
import Learn from "../../modules/Learn";
import { useNewCards } from "../../hooks/useSupabaseData";

const DeckLearnNew = () => {
  const params = useParams();
  const { data: cards, loading } = useNewCards(params.id);
  if (loading) return <LoadingScreen />;
  return <Learn flashcards={cards || []} />;
};

export default DeckLearnNew;
