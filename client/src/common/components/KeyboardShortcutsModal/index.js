import Modal from "../Modal";
import styles from "./KeyboardShortcutsModal.module.css";

const S = (props) => <section className={styles.section} {...props} />;
const R = ({ label, keys }) => (
  <div className={styles.row}>
    <span className={styles.label}>{label}</span>
    <span className={styles.keys}>
      {keys.map((k, i) => (
        <span key={i}>
          {i > 0 && <span className={styles.or}>/</span>}
          <kbd className={styles.kbd}>{k}</kbd>
        </span>
      ))}
    </span>
  </div>
);

const SECTIONS = [
  {
    title: "Global",
    rows: [
      { label: "Focus deck search", keys: ["/", "Ctrl+K"] },
      { label: "Open shortcuts", keys: ["?"] },
    ],
  },
  {
    title: "Deck page",
    rows: [
      { label: "Study", keys: ["S"] },
      { label: "New card", keys: ["N"] },
      { label: "Due cards", keys: ["D"] },
      { label: "Toggle grid / table", keys: ["V"] },
      { label: "Exit selection", keys: ["Esc"] },
    ],
  },
  {
    title: "Flashcards / Learn / Practice",
    rows: [
      { label: "Flip card", keys: ["Space", "Enter"] },
      { label: "Again", keys: ["1"] },
      { label: "Hard", keys: ["2"] },
      { label: "Good", keys: ["3"] },
      { label: "Easy", keys: ["4"] },
      { label: "Quit", keys: ["Esc"] },
    ],
  },
  {
    title: "Multiple choice",
    rows: [
      { label: "Select option", keys: ["1", "2", "3", "4"] },
      { label: "Next", keys: ["Enter", "Space"] },
      { label: "Quit", keys: ["Esc"] },
    ],
  },
  {
    title: "True / False",
    rows: [
      { label: "True", keys: ["1", "T"] },
      { label: "False", keys: ["2", "F"] },
      { label: "Next", keys: ["Enter", "Space"] },
      { label: "Quit", keys: ["Esc"] },
    ],
  },
  {
    title: "Writing / Fill blank",
    rows: [
      { label: "Check / Next", keys: ["Enter"] },
      { label: "Quit", keys: ["Esc"] },
    ],
  },
  {
    title: "Spin Wheel",
    rows: [
      { label: "Spin", keys: ["Space"] },
      { label: "Flip card", keys: ["Enter"] },
      { label: "Quit", keys: ["Esc"] },
    ],
  },
  {
    title: "Rich text",
    rows: [
      { label: "Bold", keys: ["Ctrl+B"] },
      { label: "Italic", keys: ["Ctrl+I"] },
      { label: "Underline", keys: ["Ctrl+U"] },
      { label: "Link", keys: ["Ctrl+K"] },
    ],
  },
];

const KeyboardShortcutsModal = ({ open, setOpen }) => {
  return (
    <Modal open={open} setOpen={setOpen}>
      <div className={styles.wrap}>
        <h2 className={styles.title}>Keyboard shortcuts</h2>
        {SECTIONS.map((s) => (
          <S key={s.title}>
            <h3 className={styles.sectionTitle}>{s.title}</h3>
            {s.rows.map((r) => (
              <R key={r.label} label={r.label} keys={r.keys} />
            ))}
          </S>
        ))}
      </div>
    </Modal>
  );
};

export default KeyboardShortcutsModal;
