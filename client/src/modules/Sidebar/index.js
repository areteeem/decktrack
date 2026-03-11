/* eslint-disable jsx-a11y/anchor-is-valid */
import "./Sidebar.css";
import { useState, useMemo, useEffect } from "react";
import logo from "../../common/logo.svg";
import { Link } from "react-router-dom";
import { useLogout } from "../../common/hooks/useLogout";
import NewDeckModal from "./NewDeckModal";
import DeckLink from "./DeckLink";
import { useDecks } from "../../hooks/useSupabaseData";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import { getSessionProgress, getActiveSessionDeckIds } from "../../lib/studySession";
import { getTotalSeconds, formatStudyTime } from "../../lib/studyTimer";

const Sidebar = ({ isOpen, setIsOpen }) => {
  const logout = useLogout();
  const { isTeacher } = useAuth();
  const { t } = useSettings();
  const { data: decks, loading, error, refetch } = useDecks();

  const [showModal, setShowModal] = useState(false);
  const [studyTime, setStudyTime] = useState(() => formatStudyTime(getTotalSeconds()));

  useEffect(() => {
    const id = setInterval(() => setStudyTime(formatStudyTime(getTotalSeconds())), 5000);
    return () => clearInterval(id);
  }, []);

  // Active study sessions for continue-study links
  const continueSessions = useMemo(() => {
    if (!decks || !decks.length) return [];
    const activeIds = getActiveSessionDeckIds();
    return activeIds
      .map((deckId) => {
        const deck = decks.find((d) => d.id === deckId);
        if (!deck) return null;
        const pct = getSessionProgress(deckId);
        if (pct == null || pct >= 100) return null;
        return { deckId, name: deck.name, pct };
      })
      .filter(Boolean);
  }, [decks]);

  return (
    <div className={isOpen ? "sidebar" : "sidebar collapsed"}>
      <NewDeckModal open={showModal} setOpen={setShowModal} onCreated={refetch} />
      <div>
        <Link to="/" onClick={() => setIsOpen(false)}>
          <img src={logo} className="logo" alt="logo" />
        </Link>
        <Link className="icon-link" to="/" onClick={() => setIsOpen(false)}>
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>
          <p>{t("dashboard")}</p>
        </Link>
        {isTeacher && (
          <>
            <Link className="icon-link" to="/due" onClick={() => setIsOpen(false)}>
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p>{t("dueToday")}</p>
            </Link>
            <Link className="icon-link" to="/new" onClick={() => setIsOpen(false)}>
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
              </svg>
              <p>{t("learnNew")}</p>
            </Link>
            <Link className="icon-link" to="/students" onClick={() => setIsOpen(false)}>
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <p>{t("students")}</p>
            </Link>
            <Link className="icon-link" to="/groups" onClick={() => setIsOpen(false)}>
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <p>{t("groups") || "Groups"}</p>
            </Link>
          </>
        )}
        <br></br>
        {/* Continue study sessions */}
        {continueSessions.length > 0 && (
          <div className="continue-study">
            <strong className="link" style={{ fontSize: "0.78em", color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {t("continueStudy")}
            </strong>
            {continueSessions.map((s) => (
              <Link
                key={s.deckId}
                className="continue-link"
                to={`/deck/${s.deckId}/study`}
                onClick={() => setIsOpen(false)}
              >
                <span className="continue-name">{s.name}</span>
                <span className="continue-pct">{s.pct}%</span>
              </Link>
            ))}
          </div>
        )}
        {isTeacher && (
          <div className="decks">
            <strong className="link new-deck">
              <strong>{t("decks")}</strong>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="new-deck-icon"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                onClick={() => setShowModal(true)}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </strong>
            {loading ? (
              <p>{t("loadingDecks")}</p>
            ) : error ? (
              <p>{t("couldntLoadDecks")}</p>
            ) : (
              (decks || []).map((deck) => (
                <span key={deck.id} onClick={() => setIsOpen(false)}>
                  <DeckLink id={deck.id} name={deck.name} onDeleted={refetch} />
                </span>
              ))
            )}
          </div>
        )}
      </div>
      <div className="sidebar-footer">
        {getTotalSeconds() > 0 && (
          <span className="study-time-sidebar">⏱ {studyTime}</span>
        )}
        <Link className="link" to="/settings" onClick={() => setIsOpen(false)}>
          {t("settings")}
        </Link>
        <a className="link" onClick={logout}>
          {t("logOut")}
        </a>
      </div>
    </div>
  );
};

export default Sidebar;
