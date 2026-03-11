import { useNavigate } from "react-router";
import { toast } from "react-toastify";
import { useAuth } from "../../contexts/AuthContext";
import { applyPendingStudentAppBridge } from "../../lib/studentAppBridge";

export const useSignUp = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const signup = async ({ email, password }) => {
    try {
      await signUp(email, password);
      await applyPendingStudentAppBridge();
      toast.success("Account created!");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err.message || "Something went wrong :(");
    }
  };
  return signup;
};
