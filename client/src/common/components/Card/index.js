import styles from "./Card.module.css";
import PropTypes from "prop-types";
import RetentionBadge from "../../../pages/Deck/RetentionBadge";
import Badge from "../Badge";
import PronunciationButton from "../PronunciationButton";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import calendar from "dayjs/plugin/calendar";
import { useSettings } from "../../../contexts/SettingsContext";
import { resolvePronunciationLocale, usePronunciation } from "../../../lib/pronunciation";
dayjs.extend(relativeTime);
dayjs.extend(calendar);

const Card = (props) => {
  const { locale, pronunciationEnabled, t } = useSettings();
  const retention = props.flashcard.reviews > 0
    ? Math.round((props.flashcard.retention / props.flashcard.reviews) * 100)
    : 0;

  const againCount = props.flashcard.again_count || 0;

  // Parse due as ISO string (not as integer timestamp)
  const dueDate = props.flashcard.due ? dayjs(props.flashcard.due) : null;
  const isOverdue = dueDate ? dueDate.isBefore(dayjs()) : false;

  const hasHtml = (str) => /<[a-z][\s\S]*>/i.test(str || "");
  const frontPronunciation = usePronunciation({
    enabled: pronunciationEnabled,
    sourceKey: `deck-card:${props.flashcard.id || props.flashcard.front}:term`,
    text: props.flashcard.front,
    locale: resolvePronunciationLocale({
      flashcard: props.flashcard,
      side: "term",
      text: props.flashcard.front,
      fallbackLocale: locale,
    }),
  });
  const backPronunciation = usePronunciation({
    enabled: pronunciationEnabled,
    sourceKey: `deck-card:${props.flashcard.id || props.flashcard.back}:definition`,
    text: props.flashcard.back,
    locale: resolvePronunciationLocale({
      flashcard: props.flashcard,
      side: "definition",
      text: props.flashcard.back,
      fallbackLocale: locale,
    }),
  });

  const togglePronunciation = (pronunciation) => {
    if (pronunciation.isLoading || pronunciation.isPlaying) {
      pronunciation.stop();
      return;
    }

    pronunciation.play();
  };

  const renderLabelRow = (label, pronunciation) => (
    <div className={styles.labelRow}>
      <span className={styles.label}>{label}</span>
      {pronunciationEnabled && pronunciation.canPronounce && (
        <PronunciationButton
          compact
          active={pronunciation.isPlaying}
          loading={pronunciation.isLoading}
          onClick={() => togglePronunciation(pronunciation)}
          title={pronunciation.isPlaying || pronunciation.isLoading ? t("stopPronunciation") : t("playPronunciation")}
        />
      )}
    </div>
  );

  return (
    <div className={styles.card} onClick={props.onClick}>
      <div className={styles.body}>
        <div className={styles.section}>
          {renderLabelRow(t("term"), frontPronunciation)}
          {hasHtml(props.flashcard.front)
            ? <h2 className={styles.title} dangerouslySetInnerHTML={{ __html: props.flashcard.front }} />
            : <h2 className={styles.title}>{props.flashcard.front}</h2>
          }
        </div>
        <div className={styles.section}>
          {renderLabelRow(t("definition"), backPronunciation)}
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
                {againCount}x
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
