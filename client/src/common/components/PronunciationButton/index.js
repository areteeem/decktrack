import PropTypes from "prop-types";
import styles from "./PronunciationButton.module.css";

const SpeakerIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M11 5 6.8 9H4.2A1.2 1.2 0 0 0 3 10.2v3.6A1.2 1.2 0 0 0 4.2 15h2.6L11 19V5Z" />
    <path d="M15.4 8.6a4.2 4.2 0 0 1 0 6.8" />
    <path d="M18 6.2a7.4 7.4 0 0 1 0 11.6" />
  </svg>
);

const stopClickEvent = (event) => {
  event.preventDefault();
  event.stopPropagation();
};

const stopBubble = (event) => {
  event.stopPropagation();
};

const PronunciationButton = ({ active, loading, compact, onClick, title }) => {
  const className = [
    styles.button,
    compact ? styles.buttonCompact : "",
    active ? styles.buttonActive : "",
    loading ? styles.buttonLoading : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className}
      aria-label={title}
      aria-pressed={active || loading}
      title={title}
      onClick={(event) => {
        stopClickEvent(event);
        onClick?.();
      }}
      onMouseDown={stopBubble}
      onTouchStart={stopBubble}
    >
      <SpeakerIcon />
    </button>
  );
};

PronunciationButton.propTypes = {
  active: PropTypes.bool,
  compact: PropTypes.bool,
  loading: PropTypes.bool,
  onClick: PropTypes.func,
  title: PropTypes.string,
};

PronunciationButton.defaultProps = {
  active: false,
  compact: false,
  loading: false,
  onClick: undefined,
  title: "Pronounce text",
};

export default PronunciationButton;