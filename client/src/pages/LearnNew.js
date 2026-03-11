import LoadingScreen from "../common/components/LoadingScreen";
import Learn from "../modules/Learn";
import { useNewCards } from "../hooks/useSupabaseData";

const LearnNew = () => {
  const { data: cards, loading } = useNewCards();
  if (loading) return <LoadingScreen />;
  return <Learn flashcards={cards || []} />;
};

export default LearnNew;
