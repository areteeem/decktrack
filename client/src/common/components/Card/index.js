import styles from "./Card.module.css";
import PropTypes from "prop-types";
import RetentionBadge from "../../../pages/Deck/RetentionBadge";
import Badge from "../Badge";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import calendar from "dayjs/plugin/calendar";
import { useSettings } from "../../../contexts/SettingsContext";
dayjs.extend(relativeTime);
dayjs.extend(calendar);

const Card = (props) => {
  const { t } = useSettings();
  const retention = props.flashcard.reviews > 0
    ? Math.round((props.flashcard.retention / props.flashcard.reviews) * 100)
    : 0;

  const againCount = props.flashcard.again_count || 0;

  // Parse due as ISO string (not as integer timestamp)
  const dueDate = props.flashcard.due ? dayjs(props.flashcard.due) : null;
  const isOverdue = dueDate ? dueDate.isBefore(dayjs()) : false;

  const hasHtml = (str) => /<[a-z][\s\S]*>/i.test(str || "");

  return (
    <div className={styles.card} onClick={props.onClick}>
      <div className={styles.body}>
        <div className={styles.section}>
          <span className={styles.label}>{t("term")}</span>
          {hasHtml(props.flashcard.front)
            ? <h2 className={styles.title} dangerouslySetInnerHTML={{ __html: props.flashcard.front }} />
            : <h2 className={styles.title}>{props.flashcard.front}</h2>
          }
        </div>
        <div className={styles.section}>
          <span className={styles.label}>{t("definition")}</span>
          {hasHtml(props.flashcard.back)
            ? <h3 className={styles.definition} dangerouslySetInnerHTML={{ __html: props.flashcard.back }} />
            : <h3 className={styles.definition}>{props.flashcard.back}</h3>
          }
        </div>
        {props.flashcard.example_sentence && (
          <div className={styles.section}>
            <span className={styles.label}>{t("example")}</span>
            {/<[a-z][\s\S]*>/i.test(props.flashcard.example_sentence || "")
              ? <p className={styles.example} dangerouslySetInnerHTML={{ __html: props.flashcard.example_sentence }} />
              : <p className={styles.example}>{props.flashcard.example_sentence}</p>
            }
          </div>
        )}
      </div>
      <div className={styles.meta}>
        {props.flashcard.card_type === 'fill_blank' && (
          <Badge fontSize="0.55em" style={{ color: 'var(--accent, #6366f1)', borderColor: 'var(--accent, #6366f1)' }}>
            Fill-blank
          </Badge>
        )}
        {props.flashcard.is_new !== true && !props.flashcard.new ? (
          <>
            <RetentionBadge fontSize="0.55em" retention={retention} />
            {againCount >= 3 && (
              <Badge fontSize="0.55em" style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>
                🔥 {againCount}
              </Badge>
            )}
            {dueDate && (
              <Badge
                fontSize="0.55em"
                style={isOverdue ? { color: "var(--danger)", borderColor: "var(--danger)" } : { marginLeft: "0.5em" }}
              >
                {isOverdue ? `⚠ ${t("overdue")}` : dueDate.fromNow()}
              </Badge>
            )}
          </>
        ) : (
          <Badge fontSize="0.55em">
            {t("newBadge")}
          </Badge>
        )}
      </div>
    </div>
  );
};

Card.propTypes = {
  flashcard: PropTypes.object,
};

export default Card;
