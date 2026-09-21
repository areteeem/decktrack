import styles from "./SignIn.module.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TextInput from "../../common/components/TextInput";
import Button from "../../common/components/Button";
import { useLogin } from "../../common/hooks/useLogin";
import { useAuth } from "../../contexts/AuthContext";

const SignIn = () => {
  const login = useLogin();
  const navigate = useNavigate();
  const { signInStudent } = useAuth();
  const accountOrigin = String(import.meta.env.VITE_TUTPRO_ACCOUNT_ORIGIN || "https://tutpro.org").replace(/\/$/, "");
  const returnTo = typeof window === "undefined" ? "" : window.location.href;
  const centralSignInUrl = `${accountOrigin}/signin?returnTo=${encodeURIComponent(returnTo)}`;

  const [tab, setTab] = useState("teacher"); // "teacher" | "student"

  // Teacher fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Student fields
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentError, setStudentError] = useState("");
  const [studentLoading, setStudentLoading] = useState(false);

  const handleStudentSignIn = async (e) => {
    e.preventDefault();
    const name = studentName.trim();
    const id = studentId.trim();
    if (!name) { setStudentError("Please enter your name."); return; }
    if (!id) { setStudentError("Please enter your student ID."); return; }

    setStudentError("");
    setStudentLoading(true);
    try {
      await signInStudent(name, id);
      navigate("/");
    } catch (err) {
      setStudentError(err?.message || "Sign-in failed. Please try again.");
    } finally {
      setStudentLoading(false);
    }
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.visual} aria-hidden="true">
        <div className={styles.visualOrb} />
        <div className={styles.visualGlow} />
        <div className={styles.visualCopy}>
          <span className={styles.visualEyebrow}>TutPro / Decks</span>
          <strong>Make every idea<br />stick.</strong>
          <span>Study with a calmer rhythm and see your progress grow.</span>
        </div>
      </aside>
      <div className={styles.form}>
        <div className={styles.brand}><span className={styles.brandMark}>T</span><span>TutPro account</span><span className={styles.product}>/ Decks</span></div>
        <h1 className={styles.title}>Continue to Decks</h1>
        <p className={styles.intro}>Use your TutPro account and return straight to the deck you opened.</p>
        <a className={styles.primaryLink} href={centralSignInUrl}>Continue with TutPro</a>
        <div className={styles.divider}>or use Decks directly</div>

        {/* Tab switcher */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === "teacher" ? styles.tabActive : ""}`}
            onClick={() => setTab("teacher")}
            type="button"
          >
            Teacher account
          </button>
          <button
            className={`${styles.tab} ${tab === "student" ? styles.tabActive : ""}`}
            onClick={() => setTab("student")}
            type="button"
          >
            Student access
          </button>
        </div>

        {tab === "teacher" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              login({ email, password });
            }}
          >
            <div className={styles.fields}>
              <TextInput placeholder="Email" state={email} setState={setEmail} />
              <TextInput
                placeholder="Password"
                state={password}
                setState={setPassword}
                type="password"
              />
            </div>
            <Button
              callback={(e) => {
                e.preventDefault();
                login({ email, password });
                setEmail("");
                setPassword("");
              }}
            >
              Sign In
            </Button>
          </form>
        )}

        {tab === "student" && (
          <form onSubmit={handleStudentSignIn}>
            <div className={styles.fields}>
              <TextInput
                placeholder="Name and Surname"
                state={studentName}
                setState={setStudentName}
              />
              <TextInput
                placeholder="Student ID"
                state={studentId}
                setState={setStudentId}
              />
            </div>
            {studentError && (
              <p className={styles.errorMsg}>{studentError}</p>
            )}
            <Button type="submit" disabled={studentLoading}>
              {studentLoading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default SignIn;
