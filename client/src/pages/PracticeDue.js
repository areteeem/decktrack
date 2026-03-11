import LoadingScreen from "../common/components/LoadingScreen";
import Practice from "../modules/Practice";
import { useDueCards } from "../hooks/useSupabaseData";

const PracticeDue = () => {
  const { data: cards, loading } = useDueCards();
  if (loading) return <LoadingScreen />;
  return <Practice flashcards={cards || []} />;
};

export default PracticeDue;
