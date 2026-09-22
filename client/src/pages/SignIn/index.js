import { useEffect } from "react";
import styles from "./SignIn.module.css";

export const centralAccountUrl = (mode = "signin") => {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("redirect");
  const path = requested?.startsWith("/") && !requested.startsWith("//")
    ? requested
    : window.location.pathname === "/signin" || window.location.pathname === "/signup"
      ? "/"
      : `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const accountOrigin = String(import.meta.env.VITE_TUTPRO_ACCOUNT_ORIGIN || "https://www.tutpro.org").replace(/\/$/, "");
  return `${accountOrigin}/${mode}?returnTo=${encodeURIComponent(new URL(path, window.location.origin).toString())}`;
};

const SignIn = () => {
  useEffect(() => { window.location.replace(centralAccountUrl("signin")); }, []);
  return <div className={styles.layout}><div className={styles.form}>
    <h1 className={styles.title}>Continuing to TutPro</h1>
    <p className={styles.intro}>All Decks sign-in happens securely at TutPro.</p>
    <a className={styles.primaryLink} href={centralAccountUrl("signin")}>Continue with TutPro</a>
  </div></div>;
};

export default SignIn;
