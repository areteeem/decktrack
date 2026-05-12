import { useEffect, useRef, useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const retention = props.flashcard.reviews > 0
    ? Math.round((props.flashcard.retention / props.flashcard.reviews) * 100)
    : 0;

  const againCount = props.flashcard.again_count || 0;
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

  const menuOptions = [
    {
      key: "term",
      label: t("term"),
      pronunciation: frontPronunciation,
    },
    {
      key: "definition",
      label: t("definition"),
      pronunciation: backPronunciation,
    },
  ].filter((option) => option.pronunciation.canPronounce);

  const togglePronunciation = (pronunciation) => {
    if (pronunciation.isLoading || pronunciation.isPlaying) {
      pronunciation.stop();
      return;
    }

    pronunciation.play();
  };

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!pronunciationEnabled) {
      setMenuOpen(false);
    }
  }, [pronunciationEnabled]);

  const menuIsActive = menuOptions.some((option) => option.pronunciation.isPlaying);
  const menuIsLoading = menuOptions.some((option) => option.pronunciation.isLoading);

  return (
    <div className={styles.card} onClick={props.onClick}>
      {pronunciationEnabled && menuOptions.length > 0 && (
        <div className={styles.pronunciationMenuWrap} ref={menuRef}>
          <PronunciationButton
            compact
            square
            active={menuIsActive}
            loading={menuIsLoading}
            onClick={() => setMenuOpen((open) => !open)}
            title={t("choosePronunciationSide")}
          />
          {menuOpen && (
            <div className={styles.pronunciationMenu}>
              {menuOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={option.pronunciation.isPlaying || option.pronunciation.isLoading ? `${styles.pronunciationMenuItem} ${styles.pronunciationMenuItemActive}` : styles.pronunciationMenuItem}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    togglePronunciation(option.pronunciation);
                    setMenuOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
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
        {props.flashcard.card_type === "fill_blank" && (
          <Badge fontSize="0.55em" style={{ color: "var(--accent, #6366f1)", borderColor: "var(--accent, #6366f1)" }}>
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
