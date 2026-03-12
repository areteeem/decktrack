import { useNavigate } from "react-router";
import LoadingScreen from "../common/components/LoadingScreen";
import Practice from "../modules/Practice";
import { useDueCards } from "../hooks/useSupabaseData";

const PracticeDue = () => {
  const navigate = useNavigate();
  const { data: cards, loading } = useDueCards();
  if (loading) return <LoadingScreen />;
  return <Practice flashcards={cards || []} onQuit={() => navigate(-1)} />;
};

export default PracticeDue;
