import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import styles from "./Teacher.module.css";
import deckStyles from "../Deck/Deck.module.css";
import LoadingScreen from "../../common/components/LoadingScreen";
import Badge from "../../common/components/Badge";
import Button from "../../common/components/Button";
import Modal from "../../common/components/Modal";
import ConfirmModal from "../../common/components/ConfirmModal";
import RichTextInput from "../../common/components/RichTextInput";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import {
  useTeacherUpdateStudentCard,
  useTeacherDeleteStudentCard,
  useTeacherResetStudentCard,
  useTeacherCreateStudentCard,
  useTeacherBulkDeleteStudentCards,
} from "../../hooks/useSupabaseData";

/* ── SVG Icons ── */
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
);
const ResetIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
);
const CheckboxIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
);
const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
);
const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
);
const ExportIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);
const SwapIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
);

/* ───── Helpers ───── */
const FILTERS = ["all", "new", "learning", "mastered", "due", "custom", "favorite"];

const getCardStatus = (card) => {
  if (card.mastered) return "mastered";
  if (card.is_new) return "new";
  if (new Date(card.due) < new Date()) return "due";
  return "learning";
};

const stripHtml = (html) => (html || "").replace(/<[^>]*>/g, "").trim();

const exportCsv = (deckName, cards) => {
  const esc = (v) => {
    const s = stripHtml(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [
    "Term,Definition,Example,Notes",
    ...cards.map((c) => `${esc(c.front)},${esc(c.back)},${esc(c.example_sentence)},${esc(c.notes)}`),
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${stripHtml(deckName) || "student-deck"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

/* Inline icon button used in card grid & table */
const IconBtn = ({ onClick, title, danger, children, style: extraStyle }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(e); }}
    title={title}
    style={{
      background: "transparent",
      border: "1px solid var(--border-color)",
      cursor: "pointer",
      opacity: 0.35,
      padding: "0.2rem",
      borderRadius: "var(--radius)",
      lineHeight: 0,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color: danger ? "var(--danger, #c00)" : "var(--fg-muted)",
      transition: "opacity 0.15s",
      ...extraStyle,
    }}
    onMouseOver={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.borderColor = "var(--fg)"; }}
    onMouseOut={(e) => { e.currentTarget.style.opacity = 0.35; e.currentTarget.style.borderColor = "var(--border-color)"; }}
  >
    {children}
  </button>
);

/* ───── Edit Modal ───── */
const EditCardModal = ({ open, setOpen, card, onSave, onDelete, onReset, saving }) => {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [example, setExample] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && card) {
      setFront(card.front || "");
      setBack(card.back || "");
      setExample(card.example_sentence || "");
      setNotes(card.notes || "");
    }
  }, [open, card]);

  return (
    <Modal open={open} setOpen={setOpen}>
      <h3>Edit Student Card</h3>
      <p className={styles.helperText}>Changes apply only to this student's copy.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", margin: "0.75rem 0" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.2rem" }}>Front (term)</label>
          <textarea
            value={front}
            onChange={(e) => setFront(e.target.value)}
            rows={2}
            style={{ width: "100%", padding: "0.45rem", border: "1px solid var(--border-color)", borderRadius: "var(--radius)", background: "var(--bg-secondary)", color: "var(--fg)", fontSize: "0.85rem", resize: "vertical", fontFamily: "inherit" }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button callback={() => { setFront(back); setBack(front); }} bgcolor="transparent" color="var(--fg-muted)">
            <SwapIcon /> Swap sides
          </Button>
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.2rem" }}>Back (definition)</label>
          <RichTextInput value={back} onChange={setBack} multiline rows={4} placeholder="Definition..." />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.2rem" }}>Example sentence</label>
          <RichTextInput value={example} onChange={setExample} multiline rows={2} placeholder="Example sentence..." />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.2rem" }}>Notes</label>
          <RichTextInput value={notes} onChange={setNotes} multiline rows={2} placeholder="Teacher notes..." />
        </div>
      </div>
      <div className={styles.modalActions} style={{ gap: "0.5rem", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "0.35rem" }}>
          {onDelete && (
            <Button callback={() => onDelete(card)} bgcolor="transparent" color="var(--danger, #c00)">
              <TrashIcon /> Delete
            </Button>
          )}
          {onReset && (
            <Button callback={() => onReset(card)} bgcolor="transparent" color="var(--fg-muted)">
              <ResetIcon /> Reset
            </Button>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.35rem" }}>
          <Button callback={() => setOpen(false)} bgcolor="transparent" color="var(--fg-muted)">Cancel</Button>
          <Button
            callback={() => onSave({ front: front.trim(), back: back.trim(), example_sentence: example.trim(), notes: notes.trim() })}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

/* ───── Add Card Modal ───── */
const AddCardModal = ({ open, setOpen, onAdd, adding }) => {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [example, setExample] = useState("");
  const [notes, setNotes] = useState("");
  const reset = () => { setFront(""); setBack(""); setExample(""); setNotes(""); };

  return (
    <Modal open={open} setOpen={setOpen}>
      <h3>Add Card to Assignment</h3>
      <p className={styles.helperText}>This card will be added directly to the student's deck.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", margin: "0.75rem 0" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.2rem" }}>Front (term)</label>
          <textarea
            value={front}
            onChange={(e) => setFront(e.target.value)}
            rows={2}
            style={{ width: "100%", padding: "0.45rem", border: "1px solid var(--border-color)", borderRadius: "var(--radius)", background: "var(--bg-secondary)", color: "var(--fg)", fontSize: "0.85rem", resize: "vertical", fontFamily: "inherit" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.2rem" }}>Back (definition)</label>
          <RichTextInput value={back} onChange={setBack} multiline rows={3} placeholder="Definition..." />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.2rem" }}>Example sentence</label>
          <RichTextInput value={example} onChange={setExample} multiline rows={2} placeholder="Optional..." />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.2rem" }}>Notes</label>
          <RichTextInput value={notes} onChange={setNotes} multiline rows={2} placeholder="Optional..." />
        </div>
      </div>
      <div className={styles.modalActions} style={{ gap: "0.5rem" }}>
        <Button callback={() => setOpen(false)} bgcolor="transparent" color="var(--fg-muted)">Cancel</Button>
        <Button
          callback={() => {
            onAdd({ front: front.trim(), back: back.trim(), example_sentence: example.trim(), notes: notes.trim() });
            reset();
          }}
          disabled={adding || !front.trim() || !back.trim()}
        >
          {adding ? "Adding..." : "Add card"}
        </Button>
      </div>
    </Modal>
  );
};

/* ───── Main Component ───── */
const TeacherCardBrowser = () => {
  const { studentId, assignmentId } = useParams();
  const { user } = useAuth();
  const { updateCard } = useTeacherUpdateStudentCard();
  const { teacherDeleteStudentCard } = useTeacherDeleteStudentCard();
  const { resetCard } = useTeacherResetStudentCard();
  const { createStudentCard } = useTeacherCreateStudentCard();
  const { bulkDelete } = useTeacherBulkDeleteStudentCards();

  const [assignment, setAssignment] = useState(null);
  const [student, setStudent] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid");

  const [editModal, setEditModal] = useState({ open: false, card: null });
  const [editSaving, setEditSaving] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [adding, setAdding] = useState(false);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCards, setSelectedCards] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!studentId || !assignmentId || !user) return;
    setLoading(true);

    const [profileRes, assignRes, cardsRes] = await Promise.all([
      supabase.from("flashy_profiles").select("*").eq("id", studentId).single(),
      supabase
        .from("flashy_deck_assignments")
        .select("*, flashy_decks(name, description)")
        .eq("id", assignmentId)
        .eq("teacher_id", user.id)
        .single(),
      supabase
        .from("flashy_student_cards")
        .select("*")
        .eq("assignment_id", assignmentId)
        .order("created_at", { ascending: true }),
    ]);

    if (profileRes.data) setStudent(profileRes.data);
    if (assignRes.data) setAssignment(assignRes.data);
    if (cardsRes.data) setCards(cardsRes.data);
    setLoading(false);
  }, [studentId, assignmentId, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* Filtered cards */
  const filtered = useMemo(() => {
    let result = cards;
    if (filter !== "all") {
      result = result.filter((c) => {
        if (filter === "custom") return c.is_custom;
        if (filter === "favorite") return c.is_favorite;
        return getCardStatus(c) === filter;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          (c.front || "").toLowerCase().includes(q) ||
          (c.back || "").replace(/<[^>]*>/g, "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [cards, filter, search]);

  /* Card counts */
  const counts = useMemo(() => {
    const c = { all: cards.length, new: 0, learning: 0, mastered: 0, due: 0, custom: 0, favorite: 0 };
    cards.forEach((card) => {
      const s = getCardStatus(card);
      c[s] = (c[s] || 0) + 1;
      if (card.is_custom) c.custom++;
      if (card.is_favorite) c.favorite++;
    });
    return c;
  }, [cards]);

  /* ── Handlers ── */
  const handleEditSave = async (fields) => {
    if (!editModal.card) return;
    setEditSaving(true);
    try {
      const updated = await updateCard(editModal.card.id, fields);
      setCards((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
      toast.success("Card updated");
      setEditModal({ open: false, card: null });
    } catch (err) {
      toast.error(err.message || "Failed to update card");
    } finally {
      setEditSaving(false);
    }
  };

  const [confirmState, setConfirmState] = useState({ open: false, message: '', action: null });

  const handleDelete = (card) => {
    setConfirmState({
      open: true,
      message: 'Delete this student card? This cannot be undone.',
      action: async () => {
        try {
          await teacherDeleteStudentCard(card.id);
          setCards((prev) => prev.filter((c) => c.id !== card.id));
          toast.success("Card deleted");
          setEditModal({ open: false, card: null });
        } catch (err) {
          toast.error(err.message || "Failed to delete");
        }
      },
    });
  };

  const handleReset = async (card) => {
    try {
      const updated = await resetCard(card.id);
      setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, ...updated } : c)));
      toast.success("Card progress reset");
      setEditModal({ open: false, card: null });
    } catch (err) {
      toast.error(err.message || "Failed to reset");
    }
  };

  const handleAddCard = async (fields) => {
    if (!fields.front || !fields.back) return;
    setAdding(true);
    try {
      const created = await createStudentCard(assignmentId, studentId, fields);
      setCards((prev) => [...prev, created]);
      toast.success("Card added");
      setAddModal(false);
    } catch (err) {
      toast.error(err.message || "Failed to add card");
    } finally {
      setAdding(false);
    }
  };

  /* ── Selection mode ── */
  const toggleCard = (cardId) => {
    setSelectedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const selectAll = () => setSelectedCards(new Set(filtered.map((c) => c.id)));
  const deselectAll = () => setSelectedCards(new Set());

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) setSelectedCards(new Set());
      return !prev;
    });
  }, []);

  const handleBulkDelete = async () => {
    if (selectedCards.size === 0) return;
    setConfirmState({
      open: true,
      message: `Delete ${selectedCards.size} card(s)? This cannot be undone.`,
      action: async () => {
        setBulkDeleting(true);
        try {
          await bulkDelete([...selectedCards]);
          setCards((prev) => prev.filter((c) => !selectedCards.has(c.id)));
          toast.success(`Deleted ${selectedCards.size} card(s)`);
          setSelectedCards(new Set());
          setSelectionMode(false);
        } catch (err) {
          toast.error(err.message || "Failed to delete some cards");
        } finally {
          setBulkDeleting(false);
        }
      },
    });
  };

  /* ── Keyboard shortcuts ── */
  const handleKeyboard = useCallback(
    (e) => {
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case "v":
          e.preventDefault();
          setViewMode((m) => (m === "grid" ? "table" : "grid"));
          break;
        case "escape":
          if (selectionMode) { e.preventDefault(); toggleSelectionMode(); }
          break;
        default: break;
      }
    },
    [selectionMode, toggleSelectionMode]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyboard);
    return () => document.removeEventListener("keydown", handleKeyboard);
  }, [handleKeyboard]);

  if (loading) return <LoadingScreen />;

  const deckName = assignment?.flashy_decks?.name || assignment?.custom_name || "Unnamed Deck";
  const studentName = student?.display_name || student?.email || "Student";

  return (
    <div>
      <Link to={`/students/${studentId}`} className={styles.backLink}>
        ← Back to {studentName}
      </Link>

      <div className={styles.header}>
        <div>
          <h1 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.35em", flexWrap: "wrap" }}>
            {deckName}
            <Badge>{cards.length} cards</Badge>
          </h1>
          <p className={styles.helperText} style={{ margin: "0.2rem 0 0" }}>
            {studentName}'s cards
          </p>
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
          <button className={deckStyles.addToggle} onClick={() => setAddModal(true)} title="Add card">
            <PlusIcon />
          </button>
          <button
            className={`${deckStyles.viewToggle} ${selectionMode ? deckStyles.viewToggleActive : ""}`}
            onClick={toggleSelectionMode}
            title={selectionMode ? "Exit selection" : "Select cards"}
          >
            <CheckboxIcon />
          </button>
          <button
            className={deckStyles.viewToggle}
            onClick={() => setViewMode(viewMode === "grid" ? "table" : "grid")}
            title={viewMode === "grid" ? "Switch to table (V)" : "Switch to grid (V)"}
          >
            {viewMode === "grid" ? <ListIcon /> : <GridIcon />}
          </button>
          <button className={deckStyles.viewToggle} onClick={() => exportCsv(deckName, cards)} title="Export CSV">
            <ExportIcon />
          </button>
        </div>
      </div>

      {/* Search + filter bar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
        <input
          type="text"
          placeholder="Search cards..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "0.45rem 0.65rem",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius)",
            background: "var(--bg-secondary)",
            color: "var(--fg)",
            fontSize: "0.8rem",
            flex: "1 1 200px",
            minWidth: 0,
          }}
        />
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.75rem" }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "0.3rem 0.65rem",
              borderRadius: "9999px",
              border: "1px solid var(--border-color)",
              background: filter === f ? "var(--fg)" : "transparent",
              color: filter === f ? "var(--bg)" : "var(--fg-muted)",
              fontSize: "0.72rem",
              cursor: "pointer",
              textTransform: "capitalize",
              transition: "all 0.15s",
            }}
          >
            {f} ({counts[f] || 0})
          </button>
        ))}
      </div>

      {/* Bulk selection bar */}
      {selectionMode && (
        <div className={deckStyles.bulkBar}>
          <span className={deckStyles.bulkCount}>{selectedCards.size} selected</span>
          <button className={deckStyles.bulkBtn} onClick={selectedCards.size === filtered.length ? deselectAll : selectAll}>
            {selectedCards.size === filtered.length ? "Deselect all" : "Select all"}
          </button>
          {selectedCards.size > 0 && (
            <button className={`${deckStyles.bulkBtn} ${deckStyles.bulkBtnDanger}`} onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? "Deleting…" : `Delete ${selectedCards.size}`}
            </button>
          )}
          <button className={deckStyles.bulkBtn} onClick={toggleSelectionMode}>✕</button>
        </div>
      )}

      {/* Cards - Grid or Table view */}
      {filtered.length === 0 ? (
        <p className={styles.helperText}>No cards match the current filter.</p>
      ) : viewMode === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.65rem" }}>
          {filtered.map((card) => (
            <div
              key={card.id}
              onClick={() => { if (selectionMode) toggleCard(card.id); else setEditModal({ open: true, card }); }}
              style={{
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius)",
                padding: "0.65rem",
                fontSize: "0.82rem",
                position: "relative",
                transition: "box-shadow 0.15s",
                display: "flex",
                flexDirection: "column",
                minHeight: "7rem",
                cursor: "pointer",
                outline: selectionMode && selectedCards.has(card.id) ? "2px solid var(--fg)" : "none",
                background: "var(--card-bg)",
              }}
            >
              {selectionMode && (
                <input
                  type="checkbox"
                  checked={selectedCards.has(card.id)}
                  onChange={() => toggleCard(card.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ position: "absolute", top: "0.4rem", left: "0.4rem", width: "1rem", height: "1rem", accentColor: "var(--fg)", cursor: "pointer" }}
                />
              )}
              {!selectionMode && (
                <div style={{ position: "absolute", top: "0.35rem", right: "0.35rem", display: "flex", gap: "0.15rem" }}>
                  <IconBtn onClick={() => setEditModal({ open: true, card })} title="Edit card"><EditIcon /></IconBtn>
                  <IconBtn onClick={() => handleReset(card)} title="Reset progress"><ResetIcon /></IconBtn>
                  <IconBtn onClick={() => handleDelete(card)} title="Delete card" danger><TrashIcon /></IconBtn>
                </div>
              )}
              <div style={{ fontWeight: 600, marginBottom: "0.3rem", paddingRight: selectionMode ? "0.5rem" : "4.5rem", paddingLeft: selectionMode ? "1.5rem" : 0 }}>
                {card.front}
              </div>
              <div style={{ color: "var(--fg-muted)", fontSize: "0.78rem" }} dangerouslySetInnerHTML={{ __html: card.back }} />
              {(card.example_sentence || card.notes) && (
                <div style={{ fontSize: "0.7rem", color: "var(--fg-faint)", marginTop: "0.25rem", fontStyle: "italic" }}>
                  {stripHtml(card.example_sentence || card.notes).slice(0, 60)}
                  {stripHtml(card.example_sentence || card.notes).length > 60 && "..."}
                </div>
              )}
              <div style={{ display: "flex", gap: "0.25rem", marginTop: "auto", paddingTop: "0.35rem", flexWrap: "wrap" }}>
                {card.is_custom && <Badge style={{ fontSize: "0.6rem" }}>Custom</Badge>}
                {card.mastered && <Badge style={{ fontSize: "0.6rem" }}>Mastered</Badge>}
                {card.is_new && <Badge style={{ fontSize: "0.6rem" }}>New</Badge>}
                {card.is_favorite && <Badge style={{ fontSize: "0.6rem" }}>★ Fav</Badge>}
                {!card.is_new && !card.mastered && new Date(card.due) < new Date() && (
                  <Badge style={{ fontSize: "0.6rem" }}>Due</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table view */
        <div className={deckStyles.tableView}>
          <div className={deckStyles.tableHeader}>
            {selectionMode && <span className={deckStyles.tableCheckCol} />}
            <span className={deckStyles.tableRowTerm}>Term</span>
            <span className={deckStyles.tableRowDef}>Definition</span>
            <span style={{ width: "5rem", flexShrink: 0, textAlign: "center", fontSize: "0.75rem" }}>Status</span>
            <span style={{ width: "5.5rem", flexShrink: 0, textAlign: "right", fontSize: "0.75rem" }}>Actions</span>
          </div>
          {filtered.map((card) => (
            <div
              key={card.id}
              className={`${deckStyles.tableRow} ${selectionMode && selectedCards.has(card.id) ? deckStyles.tableRowSelected : ""}`}
              onClick={() => { if (selectionMode) toggleCard(card.id); else setEditModal({ open: true, card }); }}
            >
              {selectionMode && (
                <input
                  type="checkbox"
                  className={deckStyles.tableCheckbox}
                  checked={selectedCards.has(card.id)}
                  onChange={() => toggleCard(card.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <span className={deckStyles.tableRowTerm}>{card.front}</span>
              <span className={deckStyles.tableRowDef}>{stripHtml(card.back)}</span>
              <span style={{ width: "5rem", flexShrink: 0, textAlign: "center" }}>
                {card.mastered ? <Badge style={{ fontSize: "0.6rem" }}>Mastered</Badge>
                  : card.is_new ? <Badge style={{ fontSize: "0.6rem" }}>New</Badge>
                  : new Date(card.due) < new Date() ? <Badge style={{ fontSize: "0.6rem" }}>Due</Badge>
                  : <Badge style={{ fontSize: "0.6rem" }}>Learning</Badge>}
              </span>
              <span style={{ width: "5.5rem", flexShrink: 0, display: "flex", justifyContent: "flex-end", gap: "0.15rem" }}>
                {!selectionMode && (
                  <>
                    <IconBtn onClick={() => setEditModal({ open: true, card })} title="Edit"><EditIcon /></IconBtn>
                    <IconBtn onClick={() => handleReset(card)} title="Reset"><ResetIcon /></IconBtn>
                    <IconBtn onClick={() => handleDelete(card)} title="Delete" danger><TrashIcon /></IconBtn>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <EditCardModal
        open={editModal.open}
        setOpen={(v) => setEditModal((s) => ({ ...s, open: v }))}
        card={editModal.card}
        onSave={handleEditSave}
        onDelete={handleDelete}
        onReset={handleReset}
        saving={editSaving}
      />

      <AddCardModal
        open={addModal}
        setOpen={setAddModal}
        onAdd={handleAddCard}
        adding={adding}
      />
      <ConfirmModal
        open={confirmState.open}
        title="Confirm"
        message={confirmState.message}
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          setConfirmState(s => ({ ...s, open: false }));
          await confirmState.action?.();
        }}
        onCancel={() => setConfirmState(s => ({ ...s, open: false }))}
      />
    </div>
  );
};

export default TeacherCardBrowser;
