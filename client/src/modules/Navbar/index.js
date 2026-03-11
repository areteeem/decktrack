import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import logo from "../../common/logo.svg";
import styles from "./Navbar.module.css";
import { getTotalSeconds, formatStudyTime } from "../../lib/studyTimer";

const Navbar = ({ setIsOpen, isOpen }) => {
  const [studyTime, setStudyTime] = useState(() => formatStudyTime(getTotalSeconds()));

  // Refresh every 5s
  useEffect(() => {
    const id = setInterval(() => setStudyTime(formatStudyTime(getTotalSeconds())), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <nav className={styles.navbar}>
      <Link to="/" className="navbar-brand">
        <img src={logo} className={styles.logo} alt="logo" />
      </Link>
      <div className={styles.right}>
        {getTotalSeconds() > 0 && (
          <span className={styles.studyTime} title="Total study time">
            ⏱ {studyTime}
          </span>
        )}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={styles.sidebarToggle}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          onClick={() => setIsOpen(!isOpen)}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </div>
    </nav>
  );
};

export default Navbar;
