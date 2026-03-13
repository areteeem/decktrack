import { useState } from "react";
import { toast } from "react-toastify";
import Badge from "../../common/components/Badge";
import Button from "../../common/components/Button";
import Modal from "../../common/components/Modal";
import TextInput from "../../common/components/TextInput";
import { useUpdateAssignment, useUnassignDeck } from "../../hooks/useSupabaseData";
import styles from "./Teacher.module.css";

const AssignmentSettingsModal = ({ open, setOpen, assignment, onUpdated }) => {
  const { update, loading: updating } = useUpdateAssignment();
  const { unassign, loading: unassigning } = useUnassignDeck();

  const [syncEnabled, setSyncEnabled] = useState(assignment?.sync_enabled ?? true);
  const [customName, setCustomName] = useState(assignment?.custom_name || "");
  const [studyGoalDaily, setStudyGoalDaily] = useState(String(assignment?.study_goal_daily || 0));
  const [allowStudentCards, setAllowStudentCards] = useState(assignment?.allow_student_cards ?? true);
  const [allowStudentEdit, setAllowStudentEdit] = useState(assignment?.allow_student_edit ?? true);
  const [deadline, setDeadline] = useState(assignment?.deadline || "");
  const [requiredPool, setRequiredPool] = useState(assignment?.required_pool || "any");

  const handleSave = async () => {
    try {
      await update(assignment.id, {
        sync_enabled: syncEnabled,
        custom_name: customName.trim() || null,
        study_goal_daily: parseInt(studyGoalDaily) || 0,
        allow_student_cards: allowStudentCards,
        allow_student_edit: allowStudentEdit,
        deadline: deadline || null,
        required_pool: requiredPool,
      });
      toast.success("Assignment settings updated.");
      onUpdated?.();
      setOpen(false);
    } catch (err) {
      toast.error(err.message || "Failed to update");
    }
  };

  const handleUnassign = async () => {
    if (!window.confirm("Archive this assignment? The student will no longer see it.")) return;
    try {
      await unassign(assignment.id);
      toast.success("Assignment archived.");
      onUpdated?.();
      setOpen(false);
    } catch (err) {
      toast.error(err.message || "Failed to archive");
    }
  };

  if (!assignment) return null;

  const deckName =
    assignment.flashy_decks?.name || assignment.custom_name || "Unnamed Deck";

  return (
    <Modal open={open} setOpen={setOpen}>
      <h3>Assignment Settings</h3>
      <p className={styles.helperText}>
        <strong>{deckName}</strong> — assigned{" "}
        {new Date(assignment.assigned_at).toLocaleDateString()}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", margin: "0.75rem 0" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
          <input type="checkbox" checked={syncEnabled} onChange={(e) => setSyncEnabled(e.target.checked)} />
          <div>
            <strong>Sync mode</strong>
            <p className={styles.helperText} style={{ margin: 0 }}>
              {syncEnabled
                ? "Cards stay synced with your master deck."
                : "Snapshot mode — no future sync."}
            </p>
          </div>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
          <input type="checkbox" checked={allowStudentCards} onChange={(e) => setAllowStudentCards(e.target.checked)} />
          <strong>Allow student to add cards</strong>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
          <input type="checkbox" checked={allowStudentEdit} onChange={(e) => setAllowStudentEdit(e.target.checked)} />
          <strong>Allow student to edit cards</strong>
        </label>

        <TextInput
          label="Custom deck name"
          placeholder="e.g. Vocab Week 3"
          state={customName}
          setState={setCustomName}
        />

        <TextInput
          label="Daily study goal (cards)"
          placeholder="0 = no goal"
          state={studyGoalDaily}
          setState={setStudyGoalDaily}
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
          <p style={{ fontSize: "0.75rem", color: "var(--fg-muted)", margin: "0.2rem 0 0" }}>
            {requiredPool === "any" && "Auto-done fires on any study session for this deck."}
            {requiredPool === "new" && "Auto-done fires only when a 'Learn new' session is completed."}
            {requiredPool === "due" && "Auto-done fires only when a 'Review due' session is completed."}
            {requiredPool === "mixed" && "Auto-done fires only when a mixed (new+due) session is completed."}
          </p>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.2rem" }}>
            Deadline
          </label>
          <input
            type="date"
            value={deadline ? deadline.slice(0, 10) : ""}
            onChange={(e) => setDeadline(e.target.value || null)}
            style={{
              width: "100%",
              padding: "0.45rem",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius)",
              background: "var(--bg-secondary)",
              color: "var(--fg)",
              fontSize: "0.85rem",
            }}
          />
        </div>
      </div>

      <div className={styles.assignmentMeta} style={{ marginBottom: "0.5rem" }}>
        <Badge>{syncEnabled ? "Sync ON" : "Sync OFF"}</Badge>
        {allowStudentCards && <Badge>+ Cards</Badge>}
        {allowStudentEdit && <Badge>✏ Edit</Badge>}
      </div>

      <div className={styles.modalActions} style={{ gap: "0.5rem" }}>
        <Button callback={handleUnassign} disabled={unassigning} bgcolor="transparent" color="var(--danger, #dc2626)">
          {unassigning ? "Archiving..." : "Archive assignment"}
        </Button>
        <div style={{ flex: 1 }} />
        <Button callback={() => setOpen(false)} bgcolor="transparent" color="var(--fg-muted)">
          Cancel
        </Button>
        <Button callback={handleSave} disabled={updating}>
          {updating ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </Modal>
  );
};

export default AssignmentSettingsModal;
