import { useEffect } from "react";
import styles from "../SignIn/SignIn.module.css";
import { centralAccountUrl } from "../SignIn";

const SignUp = () => {
  useEffect(() => { window.location.replace(centralAccountUrl("signin") + "&mode=signup"); }, []);
  return <div className={styles.layout}><div className={styles.form}>
    <h1 className={styles.title}>Continuing to TutPro</h1>
    <p className={styles.intro}>Create your TutPro account to use Decks.</p>
    <a className={styles.primaryLink} href={centralAccountUrl("signin") + "&mode=signup"}>Create TutPro account</a>
  </div></div>;
};

export default SignUp;
