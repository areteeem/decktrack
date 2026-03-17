import { Link, useLocation } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import logo from "../../common/logo1.svg";
import styles from "./Navbar.module.css";
import { getTotalSeconds, formatStudyTime } from "../../lib/studyTimer";
import { useDecks } from "../../hooks/useSupabaseData";

/** Build breadcrumb segments from current route */
const useBreadcrumbs = () => {
  const location = useLocation();
  const { data: decks } = useDecks();

  return useMemo(() => {
    const path = location.pathname;
    const crumbs = [];

    // Deck routes: /deck/:id, /deck/:id/study, /deck/:id/new, etc.
    const deckMatch = path.match(/^\/deck\/([^/]+)(\/(.+))?$/);
    if (deckMatch) {
      const deckId = deckMatch[1];
      const sub = deckMatch[3];
      const deck = (decks || []).find(d => d.id === deckId);
      const deckName = deck?.name || 'Deck';
      crumbs.push({ label: deckName, to: `/deck/${deckId}` });
      if (sub === 'study') crumbs.push({ label: 'Study' });
      else if (sub === 'new') crumbs.push({ label: 'Learn New' });
      else if (sub === 'due') crumbs.push({ label: 'Practice Due' });
      else if (sub === 'quiz') crumbs.push({ label: 'Quiz' });
      else if (sub === 'browse') crumbs.push({ label: 'Browse' });
      return crumbs;
    }

    // Student routes
    const studentCardMatch = path.match(/^\/students\/([^/]+)\/cards\/([^/]+)$/);
    if (studentCardMatch) {
      crumbs.push({ label: 'Students', to: '/students' });
      crumbs.push({ label: 'Student', to: `/students/${studentCardMatch[1]}` });
      crumbs.push({ label: 'Cards' });
      return crumbs;
    }

    const studentMatch = path.match(/^\/students\/([^/]+)$/);
    if (studentMatch) {
      crumbs.push({ label: 'Students', to: '/students' });
      crumbs.push({ label: 'Student' });
      return crumbs;
    }

    if (path === '/students') return [{ label: 'Students' }];
    if (path === '/groups') return [{ label: 'Groups' }];
    if (path === '/settings') return [{ label: 'Settings' }];
    if (path === '/new') return [{ label: 'Learn New' }];
    if (path === '/due') return [{ label: 'Due Today' }];

    // Student study routes
    const studyMatch = path.match(/^\/study\/([^/]+)\/(.+)$/);
    if (studyMatch) {
      const mode = studyMatch[2];
      crumbs.push({ label: mode === 'new' ? 'Learn New' : 'Practice Due' });
      return crumbs;
    }

    return crumbs;
  }, [location.pathname, decks]);
};

const Navbar = ({ setIsOpen, isOpen }) => {
  const [studyTime, setStudyTime] = useState(() => formatStudyTime(getTotalSeconds()));
  const breadcrumbs = useBreadcrumbs();
  const [isScrolled, setIsScrolled] = useState(false);

  // Refresh every 5s
  useEffect(() => {
    const id = setInterval(() => setStudyTime(formatStudyTime(getTotalSeconds())), 5000);
    return () => clearInterval(id);
  }, []);

  // Scroll-aware gradient blur — hidden when at top of page
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => { setIsScrolled(window.scrollY > 50); ticking = false; });
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <nav className={styles.navbar}>
        <div className={styles.left}>
          <Link to="/" className="navbar-brand">
            <img src={logo} className={styles.logo} alt="logo" />
          </Link>
          {breadcrumbs.length > 0 && (
            <div className={styles.breadcrumbs}>
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className={styles.crumbItem}>
                  <span className={styles.crumbSep}>/</span>
                  {crumb.to ? (
                    <Link to={crumb.to} className={styles.crumbLink}>{crumb.label}</Link>
                  ) : (
                    <span className={styles.crumbCurrent}>{crumb.label}</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
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
      <div className={`${styles.gradientBlur}${isScrolled ? ` ${styles.isScrolled}` : ''}`} aria-hidden="true" />
    </>
  );
};

export default Navbar;
