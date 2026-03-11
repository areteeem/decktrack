import { useNavigate } from "react-router";
import { toast } from "react-toastify";
import { useAuth } from "../../contexts/AuthContext";
import { applyPendingStudentAppBridge } from "../../lib/studentAppBridge";

export const useLogin = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const login = async ({ email, password }) => {
    try {
      await signIn(email, password);
      await applyPendingStudentAppBridge();
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err.message || "Invalid email or password");
    }
  };
  return login;
};
