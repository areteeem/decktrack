import styles from "../SignIn/SignIn.module.css";
import { useState } from "react";
import TextInput from "../../common/components/TextInput";
import Button from "../../common/components/Button";
import { useSignUp } from "../../common/hooks/useSignUp";

const SignUp = () => {
  const signup = useSignUp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const accountOrigin = String(import.meta.env.VITE_TUTPRO_ACCOUNT_ORIGIN || "https://www.tutpro.org").replace(/\/$/, "");
  const returnTo = typeof window === "undefined" ? "" : window.location.href;
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
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          signup({ email, password });
        }}
      >
        <div className={styles.brand}><span className={styles.brandMark}>T</span><span>TutPro account</span><span className={styles.product}>/ Decks</span></div>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.intro}>Create one TutPro account to use Decks and connected learning products.</p>
        <a className={styles.primaryLink} href={`${accountOrigin}/register?returnTo=${encodeURIComponent(returnTo)}`}>Create a TutPro account</a>
        <div className={styles.divider}>or create a Decks account</div>
        <TextInput placeholder="Email" state={email} setState={setEmail} />
        <TextInput
          placeholder="Password"
          state={password}
          setState={setPassword}
          type="password"
        />
        <Button
          callback={(event) => {
            event.preventDefault();
            signup({ email, password });
            setEmail("");
            setPassword("");
          }}
        >
          Sign Up
        </Button>
      </form>
    </div>
  );
};

export default SignUp;
