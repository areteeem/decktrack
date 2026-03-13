import { useEffect, useMemo, useState } from "react";
import Badge from "../Badge";
import Button from "../Button";
import Modal from "../Modal";

const normalize = (value) => String(value || "").trim().toLowerCase();

const ManageDeckCoursesModal = ({
  open,
  setOpen,
  deck,
  courses,
  onAdd,
  onRemove,
  onOpenDashboard,
}) => {
  const [search, setSearch] = useState("");
  const [busyCourseId, setBusyCourseId] = useState("");

  useEffect(() => {
    if (!open) {
      setSearch("");
      setBusyCourseId("");
    }
  }, [open]);

  const courseRows = useMemo(() => {
    const deckId = String(deck?.id || "").trim();
    const query = normalize(search);
    return (courses || [])
      .map((course) => {
        const hasDeck = (course.flashy_course_decks || []).some(
          (entry) => String(entry.deck_id) === deckId
        );
        return { ...course, hasDeck };
      })
      .filter((course) => {
        if (!query) return true;
        return normalize(course.name).includes(query)
          || normalize(course.description).includes(query);
      })
      .sort((left, right) => {
        if (left.hasDeck !== right.hasDeck) return Number(right.hasDeck) - Number(left.hasDeck);
        return String(left.name || "").localeCompare(String(right.name || ""));
      });
  }, [courses, deck?.id, search]);

  const membershipCount = courseRows.filter((course) => course.hasDeck).length;

  const handleToggle = async (course) => {
    const courseId = String(course.id || "");
    if (!courseId) return;
    setBusyCourseId(courseId);
    try {
      if (course.hasDeck) {
        await onRemove?.(course);
      } else {
        await onAdd?.(course);
      }
    } finally {
      setBusyCourseId("");
    }
  };

  return (
    <Modal open={open} setOpen={setOpen}>
      <h3 style={{ marginTop: 0 }}>Manage courses</h3>
      <p style={{ color: "var(--fg-muted)", fontSize: "0.9rem", marginBottom: "0.75rem" }}>
        {deck ? `Add or remove "${deck.name}" from your courses.` : "Choose course membership."}
      </p>

      {Array.isArray(courses) && courses.length > 0 ? (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ color: "var(--fg-muted)", fontSize: "0.85rem" }}>
              In {membershipCount} course{membershipCount !== 1 ? "s" : ""}
            </div>
            {courses.length > 4 && (
              <input
                type="text"
                placeholder="Search courses..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={{
                  minWidth: "14rem",
                  flex: 1,
                  maxWidth: "20rem",
                  padding: "0.5rem 0.7rem",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-secondary)",
                  color: "var(--fg)",
                  fontSize: "0.85rem",
                }}
              />
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "22rem", overflowY: "auto" }}>
            {courseRows.map((course) => {
              const isBusy = busyCourseId === String(course.id);
              const deckCount = (course.flashy_course_decks || []).length;
              return (
                <div
                  key={course.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius)",
                    padding: "0.75rem 0.85rem",
                    background: "var(--bg-secondary)",
                  }}
                >
                  <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <div style={{ fontWeight: 600 }}>{course.name}</div>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      <Badge>{deckCount} deck{deckCount !== 1 ? "s" : ""}</Badge>
                      <Badge>{course.hasDeck ? "In course" : "Available"}</Badge>
                    </div>
                  </div>
                  <Button
                    callback={() => handleToggle(course)}
                    disabled={isBusy}
                    bgcolor={course.hasDeck ? "transparent" : undefined}
                    color={course.hasDeck ? "var(--fg)" : undefined}
                  >
                    {isBusy ? "Saving..." : course.hasDeck ? "Remove to main" : "Add"}
                  </Button>
                </div>
              );
            })}
            {courseRows.length === 0 && (
              <p style={{ color: "var(--fg-muted)", fontSize: "0.85rem", margin: 0 }}>
                No courses match your search.
              </p>
            )}
          </div>
        </>
      ) : (
        <div style={{ border: "1px dashed var(--border-color)", borderRadius: "var(--radius)", padding: "1rem", color: "var(--fg-muted)", fontSize: "0.9rem" }}>
          <p style={{ margin: 0 }}>No courses yet. Create one on the dashboard, then come back to organize this deck.</p>
          {onOpenDashboard && (
            <div style={{ marginTop: "0.75rem" }}>
              <Button callback={onOpenDashboard}>Open dashboard</Button>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
        <Button callback={() => setOpen(false)} bgcolor="transparent" color="var(--fg-muted)">
          Close
        </Button>
      </div>
    </Modal>
  );
};

export default ManageDeckCoursesModal;