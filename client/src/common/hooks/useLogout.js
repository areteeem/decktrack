import { useNavigate } from "react-router";
import { useAuth } from "../../contexts/AuthContext";

export const useLogout = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const logout = async () => {
    await signOut();
    navigate("/", { replace: true });
  };
  return logout;
};
