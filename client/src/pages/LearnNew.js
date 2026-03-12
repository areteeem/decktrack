import { useNavigate } from "react-router";
import LoadingScreen from "../common/components/LoadingScreen";
import Learn from "../modules/Learn";
import { useNewCards } from "../hooks/useSupabaseData";

const LearnNew = () => {
  const navigate = useNavigate();
  const { data: cards, loading } = useNewCards();
  if (loading) return <LoadingScreen />;
  return <Learn flashcards={cards || []} onQuit={() => navigate(-1)} />;
};

export default LearnNew;
