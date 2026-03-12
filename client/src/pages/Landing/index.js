import styles from "./Landing.module.css";
import logo from "../../common/logo1.svg";
import { Link } from "react-router-dom";

const Landing = () => {
  return (
    <div className={styles.layout}>
      <div className={styles.center}>
        <img src={logo} className={styles.logo} alt="TutPro logo" />
        <p className={styles.tagline}>
          Spaced repetition flashcards — study smarter, not harder.
        </p>
        <div className={styles.actions}>
          <Link to="/signin" className={styles.btnPrimary}>
            Sign in
          </Link>
          <Link to="/signup" className={styles.btnSecondary}>
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Landing;
