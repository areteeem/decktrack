import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Badge from "../../common/components/Badge";
import Button from "../../common/components/Button";
import LoadingScreen from "../../common/components/LoadingScreen";
import Modal from "../../common/components/Modal";
import TextInput from "../../common/components/TextInput";
import { useAuth } from "../../contexts/AuthContext";
import { useAssignDeck, useDecks, useStudents, useTutproRoster } from "../../hooks/useSupabaseData";
import { supabase } from "../../lib/supabaseClient";
import { buildStudentAppLaunchUrl, getProfileTutproStudentId, normalizeStudentName } from "../../lib/tutproRoster";
import BulkAssignModal from "./BulkAssignModal";
import styles from "./Teacher.module.css";

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const getStudentLoginUrl = (profile, teacherId) => {
  const resolvedTeacherId = String(profile?.teacher_id || teacherId || "").trim();
  const studentId = getProfileTutproStudentId(profile);
  const studentName = String(profile?.display_name || profile?.email || "").trim();

  if (!resolvedTeacherId || !studentId || !studentName) return null;

  return buildStudentAppLaunchUrl({
    baseUrl: window.location.origin,
    teacherId: resolvedTeacherId,
    studentId,
    studentName,
  });
};

const CopyLoginLink = ({ profile, teacherId }) => {
  const url = getStudentLoginUrl(profile, teacherId);
  const [copied, setCopied] = useState(false);

  if (!url) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Login link copied!");
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Button callback={handleCopy} bgcolor="#f0f4ff" color="#2f4bb8">
      {copied ? "Copied ✓" : "Copy login link"}
    </Button>
  );
};

const AddStudentModal = ({ open, setOpen, onAdded }) => {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async (event) => {
    event.preventDefault();
    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { error } = await supabase.rpc("flashy_claim_student", {
        student_email: normalizedEmail,
        student_display_name: displayName.trim() || null,
      });

      if (error) throw error;

      toast.success(`Student ${normalizedEmail} linked to your profile.`);
      setEmail("");
      setDisplayName("");
      setOpen(false);
      onAdded?.();
    } catch (err) {
      toast.error(err.message || "Failed to link student");
    }
    setLoading(false);
  };

  return (
    <Modal open={open} setOpen={setOpen}>
      <h3>Link existing student account</h3>
      <p className={styles.helperText}>
        TutPro students sync automatically from your latest backup. Use this only if a student already created a Flashy account manually and you want to link it by email.
      </p>
      <TextInput label="Student email" placeholder="student@example.com" state={email} setState={setEmail} />
      <TextInput
        label="Display name"
        placeholder="Optional override"
        state={displayName}
        setState={setDisplayName}
      />
      <div className={styles.modalActions}>
        <Button callback={handleAdd} disabled={loading}>
          {loading ? "Linking..." : "Link student"}
        </Button>
      </div>
    </Modal>
  );
};

const AssignDeckModal = ({ open, setOpen, studentId, studentName, onAssigned }) => {
  const { data: decks, loading } = useDecks();
  const { assignDeck } = useAssignDeck();
  const [assigning, setAssigning] = useState(null);

  const handleAssign = async (deckId) => {
    setAssigning(deckId);
    try {
      await assignDeck(deckId, studentId);
      toast.success("Deck assigned!");
      onAssigned?.();
      setOpen(false);
    } catch (err) {
      if (err.message?.includes("duplicate")) {
        toast.error("Deck already assigned to this student");
      } else {
        toast.error(err.message || "Failed to assign deck");
      }
    }
    setAssigning(null);
  };

  return (
    <Modal open={open} setOpen={setOpen}>
      <h3>Assign deck to {studentName}</h3>
      {loading ? (
        <p>Loading decks...</p>
      ) : (
        <div className={styles.deckList}>
          {(decks || []).map((deck) => (
            <div key={deck.id} className={styles.assignRow}>
              <span>{deck.name}</span>
              <Badge>{deck.cardCount} cards</Badge>
              <Button
                callback={() => handleAssign(deck.id)}
                disabled={assigning === deck.id}
              >
                {assigning === deck.id ? "Assigning..." : "Assign"}
              </Button>
            </div>
          ))}
          {(!decks || decks.length === 0) && (
            <p>No decks yet. Create some first!</p>
          )}
        </div>
      )}
    </Modal>
  );
};

const buildStudentRows = (rosterStudents = [], linkedStudents = []) => {
  const claimedLinkedIds = new Set();
  const tutproIdMap = new Map();
  const emailMap = new Map();
  const nameMap = new Map();

  linkedStudents.forEach((student) => {
    const tutproStudentId = getProfileTutproStudentId(student);
    if (tutproStudentId) {
      tutproIdMap.set(tutproStudentId, student);
    }

    const emailKey = normalizeEmail(student.email);
    if (emailKey) {
      emailMap.set(emailKey, [...(emailMap.get(emailKey) || []), student]);
    }

    const nameKey = normalizeStudentName(student.display_name || student.email);
    if (nameKey) {
      nameMap.set(nameKey, [...(nameMap.get(nameKey) || []), student]);
    }
  });

  const tutproRows = rosterStudents.map((student) => {
    let linkedProfile = null;

    if (student.tutproStudentId && tutproIdMap.has(student.tutproStudentId)) {
      const match = tutproIdMap.get(student.tutproStudentId);
      if (!claimedLinkedIds.has(match.id)) {
        linkedProfile = match;
      }
    }

    if (!linkedProfile && student.email) {
      const matches = (emailMap.get(normalizeEmail(student.email)) || [])
        .filter((candidate) => !claimedLinkedIds.has(candidate.id));
      if (matches.length === 1) {
        linkedProfile = matches[0];
      }
    }

    if (!linkedProfile && student.name) {
      const matches = (nameMap.get(normalizeStudentName(student.name)) || [])
        .filter((candidate) => !claimedLinkedIds.has(candidate.id));
      if (matches.length === 1) {
        linkedProfile = matches[0];
      }
    }

    if (linkedProfile) {
      claimedLinkedIds.add(linkedProfile.id);
    }

    return {
      key: `tutpro-${student.tutproStudentId || student.email || student.name}`,
      source: "tutpro",
      status: linkedProfile ? "linked" : "needs-launch",
      rosterStudent: student,
      linkedProfile,
      displayName: student.name || linkedProfile?.display_name || linkedProfile?.email || "Student",
      email: student.email || linkedProfile?.email || "",
    };
  });

  const flashyOnlyRows = linkedStudents
    .filter((student) => !claimedLinkedIds.has(student.id))
    .map((student) => ({
      key: `flashy-${student.id}`,
      source: "flashy",
      status: "linked",
      rosterStudent: null,
      linkedProfile: student,
      displayName: student.display_name || student.email || "Student",
      email: student.email || "",
    }));

  return [...tutproRows, ...flashyOnlyRows].sort((left, right) => (
    left.displayName.localeCompare(right.displayName)
  ));
};

const StudentsPage = () => {
  const { user } = useAuth();
  const {
    data: linkedStudents,
    loading: linkedLoading,
    refetch: refetchLinkedStudents,
  } = useStudents();
  const {
    data: rosterStudents,
    loading: rosterLoading,
    lastUpdatedAt,
    error: rosterError,
    refetch: refetchRoster,
  } = useTutproRoster();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [assignModal, setAssignModal] = useState({
    open: false,
    studentId: null,
    studentName: "",
  });

  const loading = linkedLoading || rosterLoading;

  const studentRows = useMemo(
    () => buildStudentRows(rosterStudents || [], linkedStudents || []),
    [linkedStudents, rosterStudents]
  );

  const linkedCount = studentRows.filter((student) => student.linkedProfile).length;
  const needsLaunchCount = studentRows.filter((student) => student.status === "needs-launch").length;

  const refreshAll = async () => {
    await Promise.all([refetchLinkedStudents(), refetchRoster()]);
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      <AddStudentModal
        open={showAddModal}
        setOpen={setShowAddModal}
        onAdded={refreshAll}
      />
      <AssignDeckModal
        open={assignModal.open}
        setOpen={(value) => setAssignModal((state) => ({ ...state, open: value }))}
        studentId={assignModal.studentId}
        studentName={assignModal.studentName}
        onAssigned={refreshAll}
      />
      <BulkAssignModal
        open={showBulkAssign}
        setOpen={setShowBulkAssign}
        students={(linkedStudents || []).map((s) => ({
          id: s.id,
          display_name: s.display_name || s.email || "Student",
          email: s.email,
        }))}
        onAssigned={refreshAll}
      />

      <div className={styles.header}>
        <div>
          <h1>My Students</h1>
          <p className={styles.helperText}>
            TutPro students sync from your latest backup automatically. Students become assignable in Flashy after they open the flashcards link in the student app once.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button callback={refreshAll}>Refresh roster</Button>
          <Button callback={() => setShowBulkAssign(true)} bgcolor="#6366f1" color="#fff">
            Bulk assign deck
          </Button>
          <Button callback={() => setShowAddModal(true)} bgcolor="#eef2ff" color="#2f4bb8">
            Link existing account
          </Button>
        </div>
      </div>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>TutPro roster</span>
          <strong className={styles.summaryValue}>{rosterStudents?.length || 0}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Ready in Flashy</span>
          <strong className={styles.summaryValue}>{linkedCount}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Waiting for first launch</span>
          <strong className={styles.summaryValue}>{needsLaunchCount}</strong>
        </div>
      </div>

      <div className={styles.syncBanner}>
        <div>
          <strong>Roster sync</strong>
          <p>
            {lastUpdatedAt
              ? `Latest TutPro backup: ${new Date(lastUpdatedAt).toLocaleString()}`
              : "No TutPro backup was found yet. Open the teacher app and sync once to populate this list."}
          </p>
        </div>
        {rosterError && (
          <Badge style={{ backgroundColor: "#fff4e5", color: "#9a5b00" }}>
            {rosterError.message || "Could not read TutPro roster"}
          </Badge>
        )}
      </div>

      {studentRows.length === 0 ? (
        <div className={styles.empty}>
          <h2>No students yet</h2>
          <p>Sync your TutPro backup or link an existing Flashy student account to get started.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {studentRows.map((student) => {
            const linkedProfile = student.linkedProfile;
            const rosterStudent = student.rosterStudent;
            const isReady = Boolean(linkedProfile);
            const displayName = student.displayName;
            const displayEmail = student.email;

            return (
              <div key={student.key} className={styles.studentCard}>
                <div className={styles.studentCardTop}>
                  <div className={styles.studentInfo}>
                    <h3>{displayName}</h3>
                    {displayEmail && <p className={styles.email}>{displayEmail}</p>}
                  </div>
                  <div className={styles.badgeRow}>
                    {student.source === "tutpro" && <Badge>TutPro</Badge>}
                    {linkedProfile && <Badge style={{ backgroundColor: "#e9f8ef", color: "#1d7a47" }}>Ready in Flashy</Badge>}
                    {!linkedProfile && <Badge style={{ backgroundColor: "#fff4e5", color: "#9a5b00" }}>Needs first student-app launch</Badge>}
                  </div>
                </div>

                <div className={styles.detailsGrid}>
                  {rosterStudent?.tutproStudentId && (
                    <div>
                      <span className={styles.detailLabel}>TutPro ID</span>
                      <span className={styles.detailValue}>{rosterStudent.tutproStudentId}</span>
                    </div>
                  )}
                  {rosterStudent?.level && (
                    <div>
                      <span className={styles.detailLabel}>Level</span>
                      <span className={styles.detailValue}>{rosterStudent.level}</span>
                    </div>
                  )}
                  {rosterStudent?.phone && (
                    <div>
                      <span className={styles.detailLabel}>Phone</span>
                      <span className={styles.detailValue}>{rosterStudent.phone}</span>
                    </div>
                  )}
                  {linkedProfile?.last_active_at && (
                    <div>
                      <span className={styles.detailLabel}>Last active</span>
                      <span className={styles.detailValue}>
                        {new Date(linkedProfile.last_active_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {rosterStudent?.notes && (
                  <p className={styles.cardNote}>{rosterStudent.notes}</p>
                )}

                <div className={styles.studentActions}>
                  {isReady && <CopyLoginLink profile={linkedProfile} teacherId={user?.id} />}
                  <Button
                    callback={() => setAssignModal({
                      open: true,
                      studentId: linkedProfile.id,
                      studentName: displayName,
                    })}
                    disabled={!isReady}
                  >
                    Assign deck
                  </Button>
                  {isReady ? (
                    <Link className={styles.actionLink} to={`/students/${linkedProfile.id}`}>
                      View progress
                    </Link>
                  ) : (
                    <span className={styles.pendingHint}>
                      Ask the student to open Flashcards in the student app once.
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default StudentsPage;
