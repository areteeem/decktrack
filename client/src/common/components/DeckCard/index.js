import { Link } from "react-router-dom";
import styles from "./DeckCard.module.css";
import { getSessionProgress } from "../../../lib/studySession";

const DeckCard = (props) => {
  const progress = getSessionProgress(props.deck.id);

  return (
    <Link to={`/deck/${props.deck.id}`}>
      <div className={styles.card}>
        <h2 className={styles.title}>{props.deck.name}</h2>
        <h3>
          {props.deck.flashcards.length}{" "}
          {props.deck.flashcards.length === 1 ? "card" : "cards"}
        </h3>
        {progress !== null && progress < 100 && (
          <div className={styles.sessionIndicator}>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
            <span className={styles.continueLabel}>{progress}% — Continue</span>
          </div>
        )}
      </div>
    </Link>
  );
};

export default DeckCard;
