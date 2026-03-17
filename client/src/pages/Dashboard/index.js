import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DeckCard from "../../common/components/DeckCard";
import LoadingScreen from "../../common/components/LoadingScreen";
import Button from "../../common/components/Button";
import Badge from "../../common/components/Badge";
import Modal from "../../common/components/Modal";
import ConfirmModal from "../../common/components/ConfirmModal";
import ContextMenu from "../../common/components/ContextMenu";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./Dashboard.module.css";
import { useDecks, useArchivedDecks, useDeleteDeck, useUpdateDeck, useCourses, useCourseActions, useStudents } from "../../hooks/useSupabaseData";
import NewDeckModal from "../../modules/Sidebar/NewDeckModal";
import { toast } from "react-toastify";

const BulkAddDecksToCourseModal = ({ open, setOpen, course, decks, onSubmit }) => {
  const [search, setSearch] = useState("");
  const [selectedDeckIds, setSelectedDeckIds] = useState(() => new Set());

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedDeckIds(new Set());
    }
  }, [open, course]);

  const filteredDecks = useMemo(() => {
    const query = String(search || "").trim().toLowerCase();
    return (decks || []).filter((deck) => {
      if (!query) return true;
      return String(deck.name || "").toLowerCase().includes(query)
        || String(deck.category || "").toLowerCase().includes(query)
        || (deck.tags || []).some((tag) => String(tag || "").toLowerCase().includes(query));
    });
  }, [decks, search]);

  const toggleDeck = (deckId) => {
    setSelectedDeckIds((prev) => {
      const next = new Set(prev);
      if (next.has(deckId)) next.delete(deckId);
      else next.add(deckId);
      return next;
    });
  };

  const selectFiltered = () => {
    setSelectedDeckIds(new Set(filteredDecks.map((deck) => deck.id)));
  };

  const clearSelection = () => setSelectedDeckIds(new Set());

  const handleSubmit = async () => {
    if (!selectedDeckIds.size) return;
    await onSubmit?.([...selectedDeckIds]);
  };

  return (
    <Modal open={open} setOpen={setOpen}>
      <h3 style={{ marginTop: 0 }}>Add decks to course</h3>
      <p style={{ color: "var(--fg-muted)", fontSize: "0.9rem" }}>
        {course ? `Select decks to add into "${course.name}".` : "Select decks to add."}
      </p>

      <div className={styles.bulkCourseToolbar}>
        <input
          type="text"
          placeholder="Search decks..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={styles.bulkCourseSearch}
        />
        <Button callback={selectFiltered} bgcolor="transparent" color="var(--fg)">Select filtered</Button>
        <Button callback={clearSelection} bgcolor="transparent" color="var(--fg-muted)">Clear</Button>
      </div>

      <div className={styles.bulkCourseList}>
        {filteredDecks.map((deck) => (
          <label key={deck.id} className={styles.bulkCourseRow}>
            <input
              type="checkbox"
              checked={selectedDeckIds.has(deck.id)}
              onChange={() => toggleDeck(deck.id)}
            />
            <div className={styles.bulkCourseRowBody}>
              <span style={{ fontWeight: 600 }}>{deck.name}</span>
              <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                <Badge>{deck.cardCount} cards</Badge>
                {deck.category && <Badge>{deck.category}</Badge>}
              </div>
            </div>
          </label>
        ))}
        {filteredDecks.length === 0 && (
          <p style={{ color: "var(--fg-muted)", fontSize: "0.85rem", margin: 0 }}>
            No eligible decks found.
          </p>
        )}
      </div>

      <div className={styles.bulkCourseActions}>
        <div style={{ color: "var(--fg-muted)", fontSize: "0.85rem" }}>
          {selectedDeckIds.size} selected
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Button callback={() => setOpen(false)} bgcolor="transparent" color="var(--fg-muted)">Cancel</Button>
          <Button callback={handleSubmit} disabled={selectedDeckIds.size === 0}>
            Add {selectedDeckIds.size > 0 ? selectedDeckIds.size : ""} deck{selectedDeckIds.size === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const CourseStudentsModal = ({ open, setOpen, course, students, onSubmit, onOpenStudents }) => {
  const [search, setSearch] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState(() => new Set());

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedStudentIds(new Set());
      return;
    }

    const initialIds = (course?.flashy_course_members || [])
      .map((entry) => String(entry.student_id || '').trim())
      .filter(Boolean);
    setSelectedStudentIds(new Set(initialIds));
  }, [open, course?.id, course?.flashy_course_members]);

  const filteredStudents = useMemo(() => {
    const query = String(search || "").trim().toLowerCase();
    return (students || []).filter((student) => {
      if (!query) return true;
      return String(student.display_name || '').toLowerCase().includes(query)
        || String(student.email || '').toLowerCase().includes(query);
    });
  }, [students, search]);

  const toggleStudent = (studentId) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const selectFiltered = () => {
    setSelectedStudentIds(new Set(filteredStudents.map((student) => String(student.id))));
  };

  const clearSelection = () => setSelectedStudentIds(new Set());

  const handleSubmit = async () => {
    await onSubmit?.([...selectedStudentIds]);
  };

  return (
    <Modal open={open} setOpen={setOpen}>
      <h3 style={{ marginTop: 0 }}>Assign students to course</h3>
      <p style={{ color: "var(--fg-muted)", fontSize: "0.9rem" }}>
        {course ? `Choose who can access "${course.name}".` : "Choose students for this course."}
      </p>

      <div className={styles.bulkCourseToolbar}>
        <input
          type="text"
          placeholder="Search students..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={styles.bulkCourseSearch}
        />
        <Button callback={selectFiltered} bgcolor="transparent" color="var(--fg)">Select filtered</Button>
        <Button callback={clearSelection} bgcolor="transparent" color="var(--fg-muted)">Clear</Button>
      </div>

      {(students || []).length === 0 ? (
        <div className={styles.bulkCourseEmptyState}>
          <p style={{ color: "var(--fg-muted)", fontSize: "0.85rem", margin: 0 }}>
            No linked students yet.
          </p>
          <Button callback={onOpenStudents}>Open My students</Button>
        </div>
      ) : (
        <div className={styles.bulkCourseList}>
          {filteredStudents.map((student) => (
            <label key={student.id} className={styles.bulkCourseRow}>
              <input
                type="checkbox"
                checked={selectedStudentIds.has(String(student.id))}
                onChange={() => toggleStudent(String(student.id))}
              />
              <div className={styles.bulkCourseRowBody}>
                <span style={{ fontWeight: 600 }}>
                  {student.display_name || student.email || "Student"}
                </span>
                {student.email && (
                  <span style={{ color: "var(--fg-muted)", fontSize: "0.78rem" }}>
                    {student.email}
                  </span>
                )}
              </div>
            </label>
          ))}
          {filteredStudents.length === 0 && (
            <p style={{ color: "var(--fg-muted)", fontSize: "0.85rem", margin: 0 }}>
              No matching students.
            </p>
          )}
        </div>
      )}

      <div className={styles.bulkCourseActions}>
        <div style={{ color: "var(--fg-muted)", fontSize: "0.85rem" }}>
          {selectedStudentIds.size} student{selectedStudentIds.size === 1 ? "" : "s"} selected
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Button callback={() => setOpen(false)} bgcolor="transparent" color="var(--fg-muted)">Cancel</Button>
          <Button callback={handleSubmit}>Save</Button>
        </div>
      </div>
    </Modal>
  );
};

const CourseDeckVisibilityModal = ({ open, setOpen, course, students, decks, initialStudentId, onSubmit }) => {
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [visibleDeckIds, setVisibleDeckIds] = useState(() => new Set());

  const memberOptions = useMemo(() => {
    const memberIds = new Set((course?.flashy_course_members || []).map((entry) => String(entry.student_id || '').trim()).filter(Boolean));
    return (students || []).filter((student) => memberIds.has(String(student.id || '').trim()));
  }, [course?.flashy_course_members, students]);

  const courseDeckOptions = useMemo(() => {
    const deckIds = (course?.flashy_course_decks || []).map((entry) => String(entry.deck_id || '').trim()).filter(Boolean);
    return deckIds
      .map((deckId) => (decks || []).find((deck) => String(deck.id) === deckId))
      .filter(Boolean);
  }, [course?.flashy_course_decks, decks]);

  const hiddenByStudent = useMemo(() => {
    const map = new Map();
    (course?.flashy_course_student_deck_visibility || []).forEach((entry) => {
      const studentId = String(entry.student_id || '').trim();
      const deckId = String(entry.deck_id || '').trim();
      if (!studentId || !deckId || entry.is_hidden !== true) return;
      const current = map.get(studentId) || new Set();
      current.add(deckId);
      map.set(studentId, current);
    });
    return map;
  }, [course?.flashy_course_student_deck_visibility]);

  useEffect(() => {
    if (!open) {
      setSelectedStudentId("");
      setVisibleDeckIds(new Set());
      return;
    }

    const fallbackStudentId = String(initialStudentId || memberOptions[0]?.id || '').trim();
    setSelectedStudentId(fallbackStudentId);
  }, [open, initialStudentId, memberOptions]);

  useEffect(() => {
    if (!open) return;

    const allDeckIds = courseDeckOptions.map((deck) => String(deck.id || '').trim()).filter(Boolean);
    const hiddenDeckIds = hiddenByStudent.get(String(selectedStudentId || '').trim()) || new Set();
    setVisibleDeckIds(new Set(allDeckIds.filter((deckId) => !hiddenDeckIds.has(deckId))));
  }, [courseDeckOptions, hiddenByStudent, open, selectedStudentId]);

  const toggleDeckVisibility = (deckId) => {
    setVisibleDeckIds((prev) => {
      const next = new Set(prev);
      if (next.has(deckId)) next.delete(deckId);
      else next.add(deckId);
      return next;
    });
  };

  const showAllDecks = () => {
    setVisibleDeckIds(new Set(courseDeckOptions.map((deck) => String(deck.id || '').trim()).filter(Boolean)));
  };

  const hideAllDecks = () => setVisibleDeckIds(new Set());

  const handleSubmit = async () => {
    const allDeckIds = courseDeckOptions.map((deck) => String(deck.id || '').trim()).filter(Boolean);
    await onSubmit?.({
      courseId: course?.id,
      studentId: selectedStudentId,
      allDeckIds,
      visibleDeckIds: [...visibleDeckIds],
    });
  };

  return (
    <Modal open={open} setOpen={() => setOpen(null)}>
      <h3 style={{ marginTop: 0 }}>What decks to show?</h3>
      <p style={{ color: "var(--fg-muted)", fontSize: "0.9rem" }}>
        Choose which decks this student can see inside {course?.name ? `"${course.name}"` : 'the course'}.
      </p>

      {memberOptions.length === 0 ? (
        <p style={{ color: "var(--fg-muted)", fontSize: "0.85rem" }}>Add students to the course first.</p>
      ) : courseDeckOptions.length === 0 ? (
        <p style={{ color: "var(--fg-muted)", fontSize: "0.85rem" }}>Add decks to the course first.</p>
      ) : (
        <>
          <div className={styles.bulkCourseToolbar}>
            <select
              value={selectedStudentId}
              onChange={(event) => setSelectedStudentId(event.target.value)}
              className={styles.bulkCourseSearch}
            >
              {memberOptions.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.display_name || student.email || 'Student'}
                </option>
              ))}
            </select>
            <Button callback={showAllDecks} bgcolor="transparent" color="var(--fg)">Show all</Button>
            <Button callback={hideAllDecks} bgcolor="transparent" color="var(--fg-muted)">Hide all</Button>
          </div>

          <div className={styles.bulkCourseList}>
            {courseDeckOptions.map((deck) => {
              const deckId = String(deck.id || '').trim();
              const visible = visibleDeckIds.has(deckId);
              return (
                <label key={deckId} className={styles.bulkCourseRow}>
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={() => toggleDeckVisibility(deckId)}
                  />
                  <div className={styles.bulkCourseRowBody}>
                    <span style={{ fontWeight: 600 }}>{deck.name}</span>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      <Badge>{visible ? 'Visible' : 'Hidden'}</Badge>
                      {deck.category && <Badge>{deck.category}</Badge>}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </>
      )}

      <div className={styles.bulkCourseActions}>
        <div style={{ color: "var(--fg-muted)", fontSize: "0.85rem" }}>
          {visibleDeckIds.size} of {courseDeckOptions.length} visible
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Button callback={() => setOpen(null)} bgcolor="transparent" color="var(--fg-muted)">Cancel</Button>
          <Button callback={handleSubmit} disabled={!selectedStudentId || courseDeckOptions.length === 0}>Save</Button>
        </div>
      </div>
    </Modal>
  );
};

const Dashboard = () => {
  const [showNewDeckModal, setShowNewDeckModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [expandedCourses, setExpandedCourses] = useState(() => new Set());
  const [newCourseName, setNewCourseName] = useState("");
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [deckSearch, setDeckSearch] = useState("");
  const [bulkAddCourse, setBulkAddCourse] = useState(null);
  const [courseStudentsCourse, setCourseStudentsCourse] = useState(null);
  const [courseVisibilityState, setCourseVisibilityState] = useState(null);
  const [confirmDeleteCourse, setConfirmDeleteCourse] = useState(null);
  const [confirmDeleteArchivedDeck, setConfirmDeleteArchivedDeck] = useState(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [headerMenuPos, setHeaderMenuPos] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);
  const headerMenuRef = useRef(null);
  const headerMenuBtnRef = useRef(null);
  const navigate = useNavigate();
  const { isTeacher } = useAuth();
  const { data: decks, loading, error, refetch } = useDecks();
  const { data: archivedDecks, refetch: refetchArchived } = useArchivedDecks();
  const { deleteDeck } = useDeleteDeck();
  const { updateDeck } = useUpdateDeck();
  const { courses, refetch: refetchCourses } = useCourses();
  const { data: students } = useStudents();
  const {
    createCourse,
    deleteCourse,
    addDeckToCourse,
    removeDeckFromCourse,
    addStudentsToCourse,
    removeStudentsFromCourse,
    setStudentCourseDeckVisibility,
    clearStudentCourseDeckVisibility,
  } = useCourseActions();


  // Build set of deck IDs that belong to any course
  const deckIdsInCourses = useMemo(() => {
    const ids = new Set();
    (courses || []).forEach((c) => (c.flashy_course_decks || []).forEach((cd) => ids.add(cd.deck_id)));
    return ids;
  }, [courses]);

  // Decks not in any course ("Uncategorized")
  const uncategorizedDecks = useMemo(() =>
    (decks || []).filter((d) => !deckIdsInCourses.has(d.id)),
    [decks, deckIdsInCourses]
  );

  const eligibleDecksForBulkAdd = useMemo(() => {
    if (!bulkAddCourse?.id) return [];
    const existingDeckIds = new Set((bulkAddCourse.flashy_course_decks || []).map((entry) => entry.deck_id));
    return (decks || []).filter((deck) => !existingDeckIds.has(deck.id));
  }, [bulkAddCourse, decks]);

  // Search filter
  const searchFilter = (deck) => {
    if (!deckSearch.trim()) return true;
    const q = deckSearch.toLowerCase();
    return (deck.name || '').toLowerCase().includes(q)
      || (deck.category || '').toLowerCase().includes(q)
      || (deck.tags || []).some((t) => t.toLowerCase().includes(q));
  };

  const toggleCourse = (courseId) => {
    setExpandedCourses((prev) => {
      const next = new Set(prev);
      next.has(courseId) ? next.delete(courseId) : next.add(courseId);
      return next;
    });
  };

  const handleCreateCourse = async () => {
    const name = newCourseName.trim();
    if (!name) return;
    try {
      await createCourse({ name });
      setNewCourseName("");
      setShowNewCourse(false);
      toast.success("Course created");
      refetchCourses();
    } catch (e) {
      toast.error(e.message || "Failed to create course");
    }
  };

  const handleRemoveDeckFromCourse = async (course, deck) => {
    try {
      await removeDeckFromCourse(course.id, deck.id);
      toast.success(`"${deck.name}" removed from "${course.name}"`);
      refetchCourses();
    } catch (e) {
      toast.error(e.message || "Failed to remove deck from course");
    }
  };

  const handleDeleteCourse = async () => {
    if (!confirmDeleteCourse?.id) return;
    try {
      await deleteCourse(confirmDeleteCourse.id);
      toast.success("Course deleted");
      refetchCourses();
    } catch (err) {
      toast.error(err.message || "Failed to delete course");
    } finally {
      setConfirmDeleteCourse(null);
    }
  };

  const handleDeleteArchivedDeck = async () => {
    if (!confirmDeleteArchivedDeck?.id) return;
    try {
      await deleteDeck(confirmDeleteArchivedDeck.id);
      toast.success("Deck deleted permanently");
      refetchArchived();
    } catch (e) {
      toast.error(e.message || "Failed to delete");
    } finally {
      setConfirmDeleteArchivedDeck(null);
    }
  };

  const handleBulkAddDecks = async (deckIds) => {
    if (!bulkAddCourse?.id || deckIds.length === 0) return;
    const results = await Promise.allSettled(
      deckIds.map((deckId) => addDeckToCourse(bulkAddCourse.id, deckId))
    );
    const successCount = results.filter((result) => result.status === "fulfilled").length;
    const failedCount = results.length - successCount;
    if (successCount > 0) {
      toast.success(`${successCount} deck${successCount === 1 ? "" : "s"} added to "${bulkAddCourse.name}"`);
      refetchCourses();
      setBulkAddCourse(null);
    }
    if (failedCount > 0) {
      toast.error(`${failedCount} deck${failedCount === 1 ? "" : "s"} failed to add`);
    }
  };

  const handleUpdateCourseStudents = async (studentIds) => {
    if (!courseStudentsCourse?.id) return;

    const activeCourse = (courses || []).find(
      (course) => String(course.id) === String(courseStudentsCourse.id)
    ) || courseStudentsCourse;

    const currentIds = new Set(
      (activeCourse.flashy_course_members || [])
        .map((entry) => String(entry.student_id || '').trim())
        .filter(Boolean)
    );

    const nextIds = [...new Set(
      (studentIds || []).map((id) => String(id || '').trim()).filter(Boolean)
    )];
    const nextIdSet = new Set(nextIds);
    const toAdd = nextIds.filter((id) => !currentIds.has(id));
    const toRemove = [...currentIds].filter((id) => !nextIdSet.has(id));

    if (toAdd.length === 0 && toRemove.length === 0) {
      setCourseStudentsCourse(null);
      return;
    }

    try {
      await Promise.all([
        toAdd.length ? addStudentsToCourse(activeCourse.id, toAdd) : Promise.resolve(),
        toRemove.length ? removeStudentsFromCourse(activeCourse.id, toRemove) : Promise.resolve(),
      ]);
      toast.success(`Updated students for "${activeCourse.name || 'course'}"`);
      setCourseStudentsCourse(null);
      refetchCourses();
      if ((activeCourse.flashy_course_decks || []).length > 0 && nextIds.length > 0) {
        setCourseVisibilityState({ course: activeCourse, studentId: nextIds[0] });
      }
    } catch (err) {
      toast.error(err.message || "Failed to update course students");
    }
  };

  const handleSaveCourseVisibility = async ({ courseId, studentId, allDeckIds, visibleDeckIds }) => {
    const normalizedCourseId = String(courseId || '').trim();
    const normalizedStudentId = String(studentId || '').trim();
    const normalizedAllDeckIds = [...new Set((allDeckIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
    const normalizedVisibleDeckIds = new Set((visibleDeckIds || []).map((id) => String(id || '').trim()).filter(Boolean));

    if (!normalizedCourseId || !normalizedStudentId) return;

    const hiddenDeckIds = normalizedAllDeckIds.filter((deckId) => !normalizedVisibleDeckIds.has(deckId));

    try {
      if (normalizedAllDeckIds.length > 0) {
        await clearStudentCourseDeckVisibility({
          courseId: normalizedCourseId,
          studentId: normalizedStudentId,
          deckIds: normalizedAllDeckIds,
        });
      }

      if (hiddenDeckIds.length > 0) {
        await setStudentCourseDeckVisibility({
          courseId: normalizedCourseId,
          studentId: normalizedStudentId,
          deckIds: hiddenDeckIds,
          isHidden: true,
        });
      }

      toast.success('Updated visible decks');
      setCourseVisibilityState(null);
      refetchCourses();
    } catch (err) {
      toast.error(err.message || 'Failed to save visible decks');
    }
  };

  const handleDeckContextMenu = useCallback((e, deck) => {
    e.preventDefault();
    setCtxMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: "Open deck", onClick: () => navigate(`/deck/${deck.id}`) },
        { label: "Study deck", onClick: () => navigate(`/deck/${deck.id}/study`) },
        { separator: true },
        { label: "Archive deck", onClick: async () => { try { await updateDeck(deck.id, { is_archived: true }); toast.success("Deck archived"); refetch(); refetchArchived(); } catch (err) { toast.error(err.message); } } },
        { label: "Delete deck", danger: true, onClick: async () => { try { await deleteDeck(deck.id); toast.success("Deck deleted"); refetch(); } catch (err) { toast.error(err.message); } } },
      ],
    });
  }, [navigate, updateDeck, deleteDeck, refetch, refetchArchived]);

  // Close header overflow menu on outside click
  useEffect(() => {
    if (!showHeaderMenu) return undefined;
    const close = (e) => { if (!headerMenuRef.current?.contains(e.target)) setShowHeaderMenu(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showHeaderMenu]);

  if (error) return <p>Error :(</p>;
  if (loading) return <LoadingScreen />;

  return (
    <>
      <NewDeckModal
        open={showNewDeckModal}
        setOpen={setShowNewDeckModal}
        onCreated={refetch}
      />
      <BulkAddDecksToCourseModal
        open={Boolean(bulkAddCourse)}
        setOpen={() => setBulkAddCourse(null)}
        course={bulkAddCourse}
        decks={eligibleDecksForBulkAdd}
        onSubmit={handleBulkAddDecks}
      />
      <CourseStudentsModal
        open={Boolean(courseStudentsCourse)}
        setOpen={() => setCourseStudentsCourse(null)}
        course={courseStudentsCourse}
        students={students || []}
        onSubmit={handleUpdateCourseStudents}
        onOpenStudents={() => {
          setCourseStudentsCourse(null);
          navigate("/students");
        }}
      />
      <CourseDeckVisibilityModal
        open={Boolean(courseVisibilityState)}
        setOpen={setCourseVisibilityState}
        course={courseVisibilityState?.course || null}
        students={students || []}
        decks={decks || []}
        initialStudentId={courseVisibilityState?.studentId || ''}
        onSubmit={handleSaveCourseVisibility}
      />
      <ConfirmModal
        open={Boolean(confirmDeleteCourse)}
        title="Delete course"
        message={`Delete course "${confirmDeleteCourse?.name || ""}"? Decks inside will stay in your main deck list.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDeleteCourse}
        onCancel={() => setConfirmDeleteCourse(null)}
      />
      <ConfirmModal
        open={Boolean(confirmDeleteArchivedDeck)}
        title="Delete archived deck"
        message={`Permanently delete "${confirmDeleteArchivedDeck?.name || ""}" and all its cards? This cannot be undone.`}
        confirmLabel="Delete permanently"
        danger
        onConfirm={handleDeleteArchivedDeck}
        onCancel={() => setConfirmDeleteArchivedDeck(null)}
      />

      <div className={styles.header}>
        <div>
          <h1>Your decks</h1>
          {isTeacher && (
            <p className={styles.subtitle}>
              Create decks, add cards, and assign them to your students.
            </p>
          )}
        </div>

        {isTeacher && (
          <div className={styles.actions}>
            <div className={styles.actionsWide}>
              <Button callback={() => setShowNewDeckModal(true)}>+ New deck</Button>
              <Button callback={() => setShowNewCourse(true)}>+ New course</Button>
              <Button callback={() => navigate("/students")}>My students</Button>
            </div>
            <div className={styles.actionsNarrow} ref={headerMenuRef}>
              <Button callback={() => setShowNewDeckModal(true)}>+ New deck</Button>
              <button
                ref={headerMenuBtnRef}
                className={styles.overflowBtn}
                onClick={() => {
                  setShowHeaderMenu((p) => {
                    if (!p && headerMenuBtnRef.current) {
                      const rect = headerMenuBtnRef.current.getBoundingClientRect();
                      let top = rect.bottom + 6;
                      let right = window.innerWidth - rect.right;
                      if (right < 0) right = 4;
                      if (top + 120 > window.innerHeight) top = Math.max(4, rect.top - 120);
                      setHeaderMenuPos({ top, right });
                    }
                    return !p;
                  });
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
              </button>
              {showHeaderMenu && (
                <div className={styles.overflowMenu} style={headerMenuPos ? { top: headerMenuPos.top, right: headerMenuPos.right } : undefined}>
                  <button className={styles.overflowItem} onClick={() => { setShowHeaderMenu(false); setShowNewCourse(true); }}>New course</button>
                  <button className={styles.overflowItem} onClick={() => { setShowHeaderMenu(false); navigate("/students"); }}>My students</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Deck search */}
      {(decks?.length > 0) && (
        <div style={{ marginBottom: "1rem" }}>
          <input
            type="text"
            placeholder="Search decks…"
            value={deckSearch}
            onChange={(e) => setDeckSearch(e.target.value)}
            style={{
              width: "100%",
              maxWidth: "24rem",
              padding: "0.5rem 0.75rem",
              borderRadius: "var(--radius, 8px)",
              border: "1px solid var(--border-color, #ddd)",
              fontSize: "0.9rem",
              background: "var(--bg-secondary, #f9f9f9)",
              color: "var(--fg, #333)",
            }}
          />
        </div>
      )}

      {/* New course inline form */}
      {showNewCourse && (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}>
          <input
            type="text"
            placeholder="Course name…"
            value={newCourseName}
            onChange={(e) => setNewCourseName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCourse(); if (e.key === 'Escape') setShowNewCourse(false); }}
            autoFocus
            style={{
              padding: "0.45rem 0.7rem",
              borderRadius: "var(--radius, 8px)",
              border: "1px solid var(--border-color, #ddd)",
              fontSize: "0.9rem",
              flex: 1,
              maxWidth: "20rem",
            }}
          />
          <Button callback={handleCreateCourse}>Create</Button>
          <Button callback={() => setShowNewCourse(false)} bgcolor="transparent" color="var(--fg-muted)">Cancel</Button>
        </div>
      )}

      {isTeacher && (!decks || decks.length === 0) ? (
        <div className={styles.emptyState}>
          <h2>No decks yet</h2>
          <p>Start by creating your first deck, then open it to add flashcards.</p>
          <div className={styles.actions}>
            <Button callback={() => setShowNewDeckModal(true)}>Create first deck</Button>
            <Button callback={() => navigate("/students")}>Open students</Button>
          </div>
        </div>
      ) : null}

      <div className={styles.deckContainer}>
        {/* Course sections */}
        {(courses || []).map((course) => {
          const courseDecks = (course.flashy_course_decks || [])
            .map((cd) => (decks || []).find((d) => d.id === cd.deck_id))
            .filter(Boolean)
            .filter(searchFilter);
          const memberCount = (course.flashy_course_members || []).length;
          const isExpanded = expandedCourses.has(course.id);
          return (
            <div key={course.id} className={styles.courseSection}>
              <div
                className={styles.courseHeader}
                onClick={() => toggleCourse(course.id)}
              >
                <svg className={`${styles.courseChevron} ${isExpanded ? styles.courseChevronOpen : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span className={styles.courseName}>{course.name}</span>
                <Badge style={{ fontSize: "0.7em" }}>{courseDecks.length}</Badge>
                <Badge style={{ fontSize: "0.7em" }}>{memberCount} student{memberCount === 1 ? "" : "s"}</Badge>
                <button
                  onClick={(e) => { e.stopPropagation(); setBulkAddCourse(course); }}
                  className={styles.courseActionBtn}
                >
                  + Add decks
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setCourseStudentsCourse(course); }}
                  className={styles.courseActionBtn}
                >
                  Assign students
                </button>
                {memberCount > 0 && courseDecks.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCourseVisibilityState({
                        course,
                        studentId: String(course.flashy_course_members?.[0]?.student_id || ''),
                      });
                    }}
                    className={styles.courseActionBtn}
                  >
                    What decks to show?
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteCourse(course); }}
                  className={`${styles.courseActionBtn} ${styles.courseActionDanger}`}
                >
                  Delete
                </button>
              </div>
              {isExpanded && (
                <div className={styles.courseDecks}>
                  {courseDecks.map((deck) => (
                    <div key={deck.id} className={styles.deckTile} onContextMenu={(e) => handleDeckContextMenu(e, deck)}>
                      <DeckCard deck={deck} />
                      <div className={styles.deckTileActions}>
                        <button
                          className={styles.courseActionBtn}
                          onClick={() => handleRemoveDeckFromCourse(course, deck)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  {courseDecks.length === 0 && <p className={styles.courseEmpty}>No matching decks</p>}
                  {memberCount > 0 && (
                    <div className={styles.courseMemberSummary}>
                      <strong>Students</strong>
                      <div className={styles.courseMemberChips}>
                        {(course.flashy_course_members || []).map((member) => {
                          const student = (students || []).find((entry) => String(entry.id) === String(member.student_id));
                          const label = student?.display_name || student?.email || 'Student';
                          return (
                            <button
                              key={member.student_id}
                              type="button"
                              className={styles.courseMemberChip}
                              onClick={() => setCourseVisibilityState({ course, studentId: String(member.student_id || '') })}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Uncategorized decks */}
        {uncategorizedDecks.filter(searchFilter).map((deck) => (
          <div key={deck.id} onContextMenu={(e) => handleDeckContextMenu(e, deck)}>
            <DeckCard deck={deck} />
          </div>
        ))}
      </div>

      {/* Archived decks */}
      {archivedDecks?.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <button
            onClick={() => setShowArchived(!showArchived)}
            style={{
              background: "none",
              border: "none",
              color: "var(--fg-muted)",
              cursor: "pointer",
              fontSize: "0.85rem",
              padding: "0.35rem 0",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: showArchived ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            Archived decks ({archivedDecks.length})
          </button>
          {showArchived && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))",
                gap: "0.75rem",
                marginTop: "0.5rem",
              }}
            >
              {archivedDecks.map((deck) => (
                <div
                  key={deck.id}
                  style={{
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius)",
                    padding: "0.75rem",
                    opacity: 0.7,
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "0.95rem" }}>{deck.name}</h3>
                  <p style={{ margin: "0.25rem 0", fontSize: "0.8rem", color: "var(--fg-muted)" }}>
                    {deck.cardCount} cards
                  </p>
                  <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                    <Button
                      callback={async () => {
                        try {
                          await updateDeck(deck.id, { is_archived: false });
                          toast.success("Deck restored");
                          refetch();
                          refetchArchived();
                        } catch (e) {
                          toast.error(e.message || "Failed to restore");
                        }
                      }}
                      bgcolor="transparent"
                      color="var(--fg)"
                    >
                      Restore
                    </Button>
                    <Button
                      callback={async () => {
                        setConfirmDeleteArchivedDeck(deck);
                      }}
                      bgcolor="transparent"
                      color="var(--danger, #c00)"
                    >
                      Delete permanently
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />}
    </>
  );
};

export default Dashboard;
