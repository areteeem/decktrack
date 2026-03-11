import { useState, useMemo } from "react";
import { toast } from "react-toastify";
import Badge from "../../common/components/Badge";
import Button from "../../common/components/Button";
import LoadingScreen from "../../common/components/LoadingScreen";
import Modal from "../../common/components/Modal";
import TextInput from "../../common/components/TextInput";
import {
  useGroups,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useGroupMembers,
  useStudents,
} from "../../hooks/useSupabaseData";
import styles from "./Teacher.module.css";

const GROUP_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
];

// ── Create / Edit Group Modal ──────────────────────
const GroupFormModal = ({ open, setOpen, group, onSaved }) => {
  const [name, setName] = useState(group?.name || "");
  const [description, setDescription] = useState(group?.description || "");
  const [color, setColor] = useState(group?.color || GROUP_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const { createGroup } = useCreateGroup();
  const { updateGroup } = useUpdateGroup();

  const isEdit = Boolean(group?.id);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Group name is required"); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await updateGroup(group.id, { name: name.trim(), description: description.trim(), color });
        toast.success("Group updated");
      } else {
        await createGroup({ name: name.trim(), description: description.trim(), color });
        toast.success("Group created");
      }
      setName(""); setDescription(""); setColor(GROUP_COLORS[0]);
      setOpen(false);
      onSaved?.();
    } catch (err) {
      toast.error(err.message || "Failed to save group");
    }
    setSaving(false);
  };

  return (
    <Modal open={open} setOpen={setOpen}>
      <h3>{isEdit ? "Edit Group" : "Create Group"}</h3>
      <form onSubmit={handleSave}>
        <TextInput label="Group name" placeholder="e.g. A1 Beginners" state={name} setState={setName} />
        <TextInput label="Description" placeholder="Optional description" state={description} setState={setDescription} />
        <div style={{ margin: "0.5rem 0" }}>
          <span className={styles.detailLabel}>Color</span>
          <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.25rem" }}>
            {GROUP_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: c, border: color === c ? "2px solid var(--fg)" : "2px solid transparent",
                  cursor: "pointer",
                }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
        <div className={styles.modalActions}>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save changes" : "Create group"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ── Manage Members Modal ──────────────────────────
const ManageMembersModal = ({ open, setOpen, group, students, onUpdated }) => {
  const { addMembers, removeMembers } = useGroupMembers();
  const [saving, setSaving] = useState(false);
  const currentMemberIds = new Set(group?.memberIds || []);

  const [selected, setSelected] = useState(new Set(currentMemberIds));

  const toggle = (sid) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid); else next.add(sid);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const toAdd = [...selected].filter((s) => !currentMemberIds.has(s));
      const toRemove = [...currentMemberIds].filter((s) => !selected.has(s));
      if (toAdd.length) await addMembers(group.id, toAdd);
      if (toRemove.length) await removeMembers(group.id, toRemove);
      toast.success("Members updated");
      setOpen(false);
      onUpdated?.();
    } catch (err) {
      toast.error(err.message || "Failed to update members");
    }
    setSaving(false);
  };

  if (!group) return null;

  return (
    <Modal open={open} setOpen={setOpen}>
      <h3>Manage Members — {group.name}</h3>
      <p className={styles.helperText}>
        Select students to include in this group. ({selected.size} selected)
      </p>
      <div className={styles.deckList}>
        {(students || []).map((s) => (
          <label key={s.id} className={styles.assignRow} style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={selected.has(s.id)}
              onChange={() => toggle(s.id)}
              style={{ marginRight: "0.5rem" }}
            />
            <span style={{ flex: 1 }}>{s.display_name || s.email || "Student"}</span>
          </label>
        ))}
        {(!students || students.length === 0) && (
          <p className={styles.helperText}>No students linked yet.</p>
        )}
      </div>
      <div className={styles.modalActions}>
        <Button callback={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save members"}
        </Button>
      </div>
    </Modal>
  );
};

// ── Main Groups Page ──────────────────────────────
const GroupsPage = () => {
  const { data: groups, loading, refetch } = useGroups();
  const { data: students } = useStudents();
  const { deleteGroup } = useDeleteGroup();

  const [formModal, setFormModal] = useState({ open: false, group: null });
  const [membersModal, setMembersModal] = useState({ open: false, group: null });

  const studentMap = useMemo(() => {
    const map = new Map();
    (students || []).forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  const handleDelete = async (group) => {
    if (!window.confirm(`Delete group "${group.name}"? Students will NOT be deleted.`)) return;
    try {
      await deleteGroup(group.id);
      toast.success("Group deleted");
      refetch();
    } catch (err) {
      toast.error(err.message || "Failed to delete group");
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      <GroupFormModal
        open={formModal.open}
        setOpen={(v) => setFormModal((s) => ({ ...s, open: v }))}
        group={formModal.group}
        onSaved={refetch}
      />
      <ManageMembersModal
        open={membersModal.open}
        setOpen={(v) => setMembersModal((s) => ({ ...s, open: v }))}
        group={membersModal.group}
        students={students}
        onUpdated={refetch}
      />

      <div className={styles.header}>
        <div>
          <h1>Groups</h1>
          <p className={styles.helperText}>
            Organize students into groups for easier deck assignment and tracking.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button
            callback={() => setFormModal({ open: true, group: null })}
          >
            + New Group
          </Button>
        </div>
      </div>

      {(!groups || groups.length === 0) ? (
        <div className={styles.empty}>
          <h2>No groups yet</h2>
          <p>Create a group to organize your students by class, level, or schedule.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {groups.map((g) => (
            <div key={g.id} className={styles.studentCard}>
              <div className={styles.studentCardTop}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: "50%",
                    background: g.color || "#6366f1", flexShrink: 0,
                  }} />
                  <h3 style={{ margin: 0, fontSize: "1rem" }}>{g.name}</h3>
                </div>
                <Badge>{g.memberCount} student{g.memberCount !== 1 ? "s" : ""}</Badge>
              </div>

              {g.description && (
                <p className={styles.helperText} style={{ margin: 0 }}>{g.description}</p>
              )}

              {/* Member preview */}
              {g.memberIds?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                  {g.memberIds.slice(0, 6).map((sid) => {
                    const s = studentMap.get(sid);
                    return (
                      <Badge key={sid} style={{ fontSize: "0.7rem" }}>
                        {s?.display_name || "Student"}
                      </Badge>
                    );
                  })}
                  {g.memberIds.length > 6 && (
                    <Badge style={{ fontSize: "0.7rem" }}>
                      +{g.memberIds.length - 6} more
                    </Badge>
                  )}
                </div>
              )}

              <div className={styles.studentActions}>
                <Button
                  callback={() => setMembersModal({ open: true, group: g })}
                  bgcolor="transparent"
                  color="var(--fg)"
                >
                  Manage members
                </Button>
                <Button
                  callback={() => setFormModal({ open: true, group: g })}
                >
                  Edit
                </Button>
                <Button
                  callback={() => handleDelete(g)}
                  bgcolor="transparent"
                  color="var(--danger, #dc2626)"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default GroupsPage;
