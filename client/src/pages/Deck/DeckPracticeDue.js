import { useParams } from "react-router";
import LoadingScreen from "../../common/components/LoadingScreen";
import Practice from "../../modules/Practice";
import { useDueCards } from "../../hooks/useSupabaseData";

const DeckPracticeDue = () => {
  const params = useParams();
  const { data: cards, loading } = useDueCards(params.id);
  if (loading) return <LoadingScreen />;
  return <Practice flashcards={cards || []} />;
};

export default DeckPracticeDue;
