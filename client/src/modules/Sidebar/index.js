/* eslint-disable jsx-a11y/anchor-is-valid */
import "./Sidebar.css";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import logo from "../../common/logo1.svg";
import { Link } from "react-router-dom";
import { useLogout } from "../../common/hooks/useLogout";
import NewDeckModal from "./NewDeckModal";
import DeckLink from "./DeckLink";
import KeyboardShortcutsModal from "../../common/components/KeyboardShortcutsModal";
import { toast } from "react-toastify";
import { useDecks, useStudentStats, useAssignments, usePerDeckStats, useUnassignDeck } from "../../hooks/useSupabaseData";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import { getSessionProgress, getActiveSessionDeckIds } from "../../lib/studySession";
import { getTotalSeconds, formatStudyTime } from "../../lib/studyTimer";

const SORT_OPTIONS = [
  { id: "alpha", label: "A\u2013Z" },
  { id: "alpha-desc", label: "Z\u2013A" },
  { id: "cards", label: "# Cards" },
  { id: "recent", label: "Recent" },
];

const SIDEBAR_WIDTH_KEY = "decktrack_sidebar_width";
const PINNED_DECKS_KEY = "decktrack_pinned_decks";
const DEFAULT_WIDTH = 208; // ~13rem
const MIN_WIDTH = 160;
const MAX_WIDTH = 380;

const Sidebar = ({ isOpen, setIsOpen }) => {
  const logout = useLogout();
  const { isTeacher, isStudent, user } = useAuth();
  const { t } = useSettings();
  const { data: decks, loading, error, refetch } = useDecks();
  const { data: studentStats } = useStudentStats(!isTeacher ? user?.id : null);
  const { data: assignments, refetch: refetchAssignments } = useAssignments();
  const { data: perDeckStats } = usePerDeckStats();
  const { unassign } = useUnassignDeck();

  const [showModal, setShowModal] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [studyTime, setStudyTime] = useState(() => formatStudyTime(getTotalSeconds()));
  const [removingAssignmentId, setRemovingAssignmentId] = useState(null);
  const [deckSearch, setDeckSearch] = useState("");
  const [deckSort, setDeckSort] = useState("alpha");
  const [decksCollapsed, setDecksCollapsed] = useState(false);
  const [assignedCollapsed, setAssignedCollapsed] = useState(false);
  const [pinnedIds, setPinnedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PINNED_DECKS_KEY)) || []; } catch { return []; }
  });
  const searchRef = useRef(null);
  const sidebarRef = useRef(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Number(saved))) : DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);

  const togglePin = useCallback((deckId) => {
    setPinnedIds((prev) => {
      const next = prev.includes(deckId) ? prev.filter((id) => id !== deckId) : [...prev, deckId];
      localStorage.setItem(PINNED_DECKS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => setStudyTime(formatStudyTime(getTotalSeconds())), 5000);
    return () => clearInterval(id);
  }, []);

  // Keyboard shortcut: "/" or Ctrl+K to focus deck search, "?" for shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }
      if (e.key === "/" || (e.ctrlKey && e.key === "k")) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Sidebar resize drag
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startW = sidebarRef.current?.offsetWidth || sidebarWidth;
    const onMove = (ev) => {
      const newW = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startW + (ev.clientX - startX)));
      setSidebarWidth(newW);
    };
    const onUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      const finalWidth = sidebarRef.current?.offsetWidth || sidebarWidth;
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(finalWidth));
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [sidebarWidth]);

  // Sync CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", `${sidebarWidth}px`);
  }, [sidebarWidth]);

  // Sorted + filtered decks
  const sortedFilteredDecks = useMemo(() => {
    if (!decks) return [];
    let list = [...decks];
    const q = deckSearch.trim().toLowerCase();
    if (q) list = list.filter((d) => (d.name || "").toLowerCase().includes(q));
    switch (deckSort) {
      case "alpha":
        list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        break;
      case "alpha-desc":
        list.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
        break;
      case "cards":
        list.sort((a, b) => (b.card_count ?? b.flashcards?.length ?? 0) - (a.card_count ?? a.flashcards?.length ?? 0));
        break;
      case "recent":
        list.sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
        break;
      default:
        break;
    }
    return list;
  }, [decks, deckSearch, deckSort]);

  // Split pinned vs unpinned
  const pinnedDecks = useMemo(() => sortedFilteredDecks.filter((d) => pinnedIds.includes(d.id)), [sortedFilteredDecks, pinnedIds]);
  const unpinnedDecks = useMemo(() => sortedFilteredDecks.filter((d) => !pinnedIds.includes(d.id)), [sortedFilteredDecks, pinnedIds]);

  // Active assigned studies
  const activeAssignments = useMemo(() => {
    if (!assignments) return [];
    return assignments.filter((a) => !a.is_archived);
  }, [assignments]);

  const handleRemoveAssignment = useCallback(async (assignmentId, assignmentName) => {
    if (!assignmentId) return;
    const confirmed = window.confirm(`Remove "${assignmentName || 'this study'}" from assigned studies?`);
    if (!confirmed) return;

    setRemovingAssignmentId(assignmentId);
    try {
      await unassign(assignmentId);
      await refetchAssignments?.({ background: true });
      toast.success("Study removed");
    } catch (removeError) {
      toast.error(removeError?.message || "Failed to remove study");
    } finally {
      setRemovingAssignmentId(null);
    }
  }, [refetchAssignments, unassign]);

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
    <div className={isOpen ? "sidebar" : "sidebar collapsed"} ref={sidebarRef}>
      <NewDeckModal open={showModal} setOpen={setShowModal} onCreated={refetch} />
      <KeyboardShortcutsModal open={showShortcuts} setOpen={setShowShortcuts} />
      <div className="sidebar-scrollable">
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
        <Link className="icon-link" to="/progress" onClick={() => setIsOpen(false)}>
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
              d="M3 17l6-6 4 4 7-8M14 7h6v6"
            />
          </svg>
          <p>{t("progress")}</p>
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
        {isStudent && (
          <>
            <Link className="icon-link" to="/study/all/due" onClick={() => setIsOpen(false)}>
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
              <p>{t("dueToday")} {studentStats?.dueCards ? `(${studentStats.dueCards})` : ""}</p>
            </Link>
            <Link className="icon-link" to="/study/all/new" onClick={() => setIsOpen(false)}>
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
              <p>{t("learnNew")} {studentStats?.newCards ? `(${studentStats.newCards})` : ""}</p>
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
        {/* Assigned studies (student) — collapsible */}
        {isStudent && activeAssignments.length > 0 && (
          <div className="sidebar-section">
            <button
              className="section-toggle"
              onClick={() => setAssignedCollapsed((c) => !c)}
            >
              <span className="section-toggle-label">
                {assignedCollapsed ? "▸" : "▾"} {t("assignedStudies") || "Assigned Studies"}
              </span>
              <span className="section-count">{activeAssignments.length}</span>
            </button>
            {!assignedCollapsed && activeAssignments.map((a) => {
              const name = String(a.custom_name || '').trim() || a.flashy_decks?.name || "Unnamed";
              const ds = perDeckStats?.[a.id] || perDeckStats?.[String(a.id)] || {};
              const total = ds.total || 0;
              const newCount = ds.new_count ?? ds.newCards ?? 0;
              const studied = total - newCount;
              const pct = total > 0 ? Math.round((studied / total) * 100) : 0;
              return (
                <div key={a.id} className="sidebar-assignment-row">
                  <Link
                    className="sidebar-deck-link sidebar-assignment-link"
                    to={`/deck/${a.id}/browse`}
                    onClick={() => setIsOpen(false)}
                  >
                    <span className="sidebar-deck-name">{name}</span>
                    {total > 0 && <span className="sidebar-deck-badge">{pct}%</span>}
                  </Link>
                  <button
                    type="button"
                    className="sidebar-assignment-delete"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleRemoveAssignment(a.id, name);
                    }}
                    disabled={removingAssignmentId === a.id}
                    title={t("delete") || "Remove from studies"}
                    aria-label={`Remove ${name}`}
                  >
                    {removingAssignmentId === a.id ? "..." : "×"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {/* Decks — with search, sort, collapsible */}
        <div className="sidebar-section">
          <button
            className="section-toggle"
            onClick={() => setDecksCollapsed((c) => !c)}
          >
            <span className="section-toggle-label">
              {decksCollapsed ? "▸" : "▾"} {t("decks")}
            </span>
            <span className="section-count-row">
              {decks ? <span className="section-count">{decks.length}</span> : null}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="new-deck-icon"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </span>
          </button>
          {!decksCollapsed && (
            <>
              {/* Search + sort strip */}
              {decks && decks.length > 3 && (
                <div className="sidebar-deck-toolbar">
                  <input
                    ref={searchRef}
                    type="text"
                    className="sidebar-deck-search"
                    placeholder="Filter decks… ( / )"
                    value={deckSearch}
                    onChange={(e) => setDeckSearch(e.target.value)}
                  />
                  <select
                    className="sidebar-deck-sort"
                    value={deckSort}
                    onChange={(e) => setDeckSort(e.target.value)}
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
              {loading ? (
                <p className="sidebar-deck-status">{t("loadingDecks")}</p>
              ) : error ? (
                <p className="sidebar-deck-status">{t("couldntLoadDecks")}</p>
              ) : sortedFilteredDecks.length === 0 ? (
                <p className="sidebar-deck-status">{deckSearch ? "No matches" : "No decks yet"}</p>
              ) : (
                <>
                  {pinnedDecks.map((deck) => (
                    <span key={deck.id} onClick={() => setIsOpen(false)}>
                      <DeckLink
                        id={deck.id}
                        name={deck.name}
                        cardCount={deck.card_count ?? deck.flashcards?.length}
                        onDeleted={refetch}
                        pinned
                        onTogglePin={() => togglePin(deck.id)}
                      />
                    </span>
                  ))}
                  {pinnedDecks.length > 0 && unpinnedDecks.length > 0 && (
                    <div className="sidebar-pin-divider" />
                  )}
                  {unpinnedDecks.map((deck) => (
                    <span key={deck.id} onClick={() => setIsOpen(false)}>
                      <DeckLink
                        id={deck.id}
                        name={deck.name}
                        cardCount={deck.card_count ?? deck.flashcards?.length}
                        onDeleted={refetch}
                        onTogglePin={() => togglePin(deck.id)}
                      />
                    </span>
                  ))}
                </>
              )}
            </>
          )}
        </div>
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
      <div
        className={`sidebar-resize-handle${isResizing ? " active" : ""}`}
        onMouseDown={handleResizeStart}
      />
    </div>
  );
};

export default Sidebar;
