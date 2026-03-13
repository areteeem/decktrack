import { useState, useMemo } from "react";
import { toast } from "react-toastify";
import Badge from "../../common/components/Badge";
import Button from "../../common/components/Button";
import Modal from "../../common/components/Modal";
import TextInput from "../../common/components/TextInput";
import {
  useDecks,
  useGroups,
  useBulkAssignDeck,
} from "../../hooks/useSupabaseData";
import styles from "./Teacher.module.css";

// ─────────────────────────────────────────────────
// Bulk Assign Modal
// Assign a deck to multiple students / entire groups
// ─────────────────────────────────────────────────
const BulkAssignModal = ({ open, setOpen, students, onAssigned }) => {
  const { data: decks, loading: decksLoading } = useDecks();
  const { data: groups } = useGroups();
  const { bulkAssign, loading: assigning } = useBulkAssignDeck();

  const [step, setStep] = useState(1); // 1 = pick deck, 2 = pick students, 3 = settings
  const [selectedDeckId, setSelectedDeckId] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [customName, setCustomName] = useState("");
  const [studyGoalDaily, setStudyGoalDaily] = useState(0);
  const [allowStudentCards, setAllowStudentCards] = useState(true);
  const [allowStudentEdit, setAllowStudentEdit] = useState(true);
  const [requiredPool, setRequiredPool] = useState("any");
  const [deckSearch, setDeckSearch] = useState("");

  const selectedDeck = useMemo(
    () => (decks || []).find((d) => d.id === selectedDeckId),
    [decks, selectedDeckId]
  );

  const filteredDecks = useMemo(() => {
    const q = deckSearch.toLowerCase().trim();
    if (!q) return decks || [];
    return (decks || []).filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.category?.toLowerCase().includes(q)
    );
  }, [decks, deckSearch]);

  const reset = () => {
    setStep(1);
    setSelectedDeckId(null);
    setSelectedStudents(new Set());
    setSyncEnabled(true);
    setCustomName("");
    setStudyGoalDaily(0);
    setAllowStudentCards(true);
    setAllowStudentEdit(true);
    setRequiredPool("any");
    setDeckSearch("");
  };

  const handleClose = (v) => {
    if (!v) reset();
    setOpen(v);
  };

  const toggleStudent = (sid) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedStudents(new Set((students || []).map((s) => s.id)));
  };

  const selectGroup = (group) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      (group.memberIds || []).forEach((sid) => next.add(sid));
      return next;
    });
  };

  const deselectAll = () => setSelectedStudents(new Set());

  const handleAssign = async () => {
    if (!selectedDeckId || selectedStudents.size === 0) return;
    try {
      const results = await bulkAssign(selectedDeckId, [...selectedStudents], {
        syncEnabled,
        customName: customName.trim(),
        studyGoalDaily: parseInt(studyGoalDaily) || 0,
        allowStudentCards,
        allowStudentEdit,
        requiredPool,
      });
      const count = results?.length ?? 0;
      if (count > 0) {
        const totalCards = results.reduce((sum, r) => sum + (r.cards_copied || 0), 0);
        toast.success(`Deck assigned to ${count} student${count > 1 ? "s" : ""} (${totalCards} cards copied)`);
      } else {
        toast.info("All selected students already have this deck.");
      }
      handleClose(false);
      onAssigned?.();
    } catch (err) {
      toast.error(err.message || "Failed to assign deck");
    }
  };

  return (
    <Modal open={open} setOpen={handleClose}>
      {/* Step 1: Pick Deck */}
      {step === 1 && (
        <>
          <h3>Assign Deck</h3>
          <p className={styles.helperText}>Choose a deck to assign.</p>
          <TextInput
            placeholder="Search decks..."
            state={deckSearch}
            setState={setDeckSearch}
          />
          {decksLoading ? (
            <p>Loading decks...</p>
          ) : (
            <div className={styles.deckList} style={{ marginTop: "0.5rem" }}>
              {filteredDecks.map((deck) => (
                <label
                  key={deck.id}
                  className={styles.assignRow}
                  style={{
                    cursor: "pointer",
                    background: selectedDeckId === deck.id ? "var(--bg-secondary)" : undefined,
                    borderColor: selectedDeckId === deck.id ? "var(--fg-muted)" : undefined,
                  }}
                  onClick={() => setSelectedDeckId(deck.id)}
                >
                  <input
                    type="radio"
                    name="deckSelect"
                    checked={selectedDeckId === deck.id}
                    onChange={() => setSelectedDeckId(deck.id)}
                    style={{ marginRight: "0.5rem" }}
                  />
                  <span style={{ flex: 1 }}>{deck.name}</span>
                  <Badge>{deck.cardCount} cards</Badge>
                </label>
              ))}
              {filteredDecks.length === 0 && <p className={styles.helperText}>No decks found.</p>}
            </div>
          )}
          <div className={styles.modalActions} style={{ gap: "0.5rem" }}>
            <Button callback={() => handleClose(false)} bgcolor="transparent" color="var(--fg-muted)">
              Cancel
            </Button>
            <Button
              callback={() => setStep(2)}
              disabled={!selectedDeckId}
            >
              Next →
            </Button>
          </div>
        </>
      )}

      {/* Step 2: Pick Students */}
      {step === 2 && (
        <>
          <h3>Select Students</h3>
          <p className={styles.helperText}>
            Assigning <strong>{selectedDeck?.name}</strong> ({selectedDeck?.cardCount} cards).
            {selectedStudents.size > 0 && ` ${selectedStudents.size} selected.`}
          </p>

          {/* Group quick-select */}
          {groups?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.5rem" }}>
              {groups.map((g) => (
                <Button
                  key={g.id}
                  callback={() => selectGroup(g)}
                  bgcolor="transparent"
                  color="var(--fg)"
                  style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem", borderLeft: `3px solid ${g.color || 'var(--border-color)'}` }}
                >
                  + {g.name} ({g.memberCount})
                </Button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <Button callback={selectAll} style={{ fontSize: "0.75rem" }}>
              Select all
            </Button>
            <Button callback={deselectAll} style={{ fontSize: "0.75rem" }}>
              Clear
            </Button>
          </div>

          <div className={styles.deckList}>
            {(students || []).map((s) => (
              <label key={s.id} className={styles.assignRow} style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedStudents.has(s.id)}
                  onChange={() => toggleStudent(s.id)}
                  style={{ marginRight: "0.5rem" }}
                />
                <span style={{ flex: 1 }}>{s.display_name || s.email || "Student"}</span>
              </label>
            ))}
            {(!students || students.length === 0) && (
              <p className={styles.helperText}>No students linked yet.</p>
            )}
          </div>

          <div className={styles.modalActions} style={{ gap: "0.5rem" }}>
            <Button callback={() => setStep(1)} bgcolor="transparent" color="var(--fg-muted)">
              ← Back
            </Button>
            <Button
              callback={() => setStep(3)}
              disabled={selectedStudents.size === 0}
            >
              Next: Settings →
            </Button>
          </div>
        </>
      )}

      {/* Step 3: Assignment Settings + Confirm */}
      {step === 3 && (
        <>
          <h3>Assignment Settings</h3>
          <p className={styles.helperText}>
            <strong>{selectedDeck?.name}</strong> → {selectedStudents.size} student
            {selectedStudents.size !== 1 ? "s" : ""}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", margin: "0.75rem 0" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
              <input type="checkbox" checked={syncEnabled} onChange={(e) => setSyncEnabled(e.target.checked)} />
              <div>
                <strong>Sync mode</strong>
                <p className={styles.helperText} style={{ margin: 0 }}>
                  {syncEnabled
                    ? "Cards stay in sync with your master deck. Edits you make automatically reach students."
                    : "One-time snapshot. Students get the cards as they are now. Future changes won't sync."}
                </p>
              </div>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
              <input type="checkbox" checked={allowStudentCards} onChange={(e) => setAllowStudentCards(e.target.checked)} />
              <div>
                <strong>Allow students to add cards</strong>
                <p className={styles.helperText} style={{ margin: 0 }}>
                  Students can add their own custom cards to this deck.
                </p>
              </div>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
              <input type="checkbox" checked={allowStudentEdit} onChange={(e) => setAllowStudentEdit(e.target.checked)} />
              <div>
                <strong>Allow students to edit cards</strong>
                <p className={styles.helperText} style={{ margin: 0 }}>
                  Students can customize synced card content (their edits stay private).
                </p>
              </div>
            </label>

            <TextInput
              label="Custom deck name (optional)"
              placeholder="e.g. Vocabulary Week 3"
              state={customName}
              setState={setCustomName}
            />

            <TextInput
              label="Daily study goal (cards)"
              placeholder="0 = no goal"
              state={String(studyGoalDaily)}
              setState={(v) => setStudyGoalDaily(parseInt(v) || 0)}
              type="number"
            />

            <div>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.2rem" }}>
                Required study type
              </label>
              <select
                value={requiredPool}
                onChange={(e) => setRequiredPool(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.45rem",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius)",
                  background: "var(--bg-secondary)",
                  color: "var(--fg)",
                  fontSize: "0.85rem",
                }}
              >
                <option value="any">Any completion (student chooses)</option>
                <option value="new">Learn new words only</option>
                <option value="due">Review due cards only</option>
                <option value="mixed">Mixed session (new + due)</option>
              </select>
            </div>
          </div>

          <div className={styles.modalActions} style={{ gap: "0.5rem" }}>
            <Button callback={() => setStep(2)} bgcolor="transparent" color="var(--fg-muted)">
              ← Back
            </Button>
            <Button
              callback={handleAssign}
              disabled={assigning}
            >
              {assigning
                ? "Assigning..."
                : `Assign to ${selectedStudents.size} student${selectedStudents.size !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
};

export default BulkAssignModal;
