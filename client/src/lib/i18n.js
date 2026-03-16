/**
 * Minimal i18n – English / Ukrainian.
 * Usage:
 *   const { t } = useI18n();
 *   t("dashboard")          → "Dashboard" | "Головна"
 *   t("cardsCount", { n: 5 }) → "5 cards" | "5 карток"
 */

const en = {
  // ── Sidebar / nav ──
  dashboard: "dashboard",
  progress: "progress",
  dueToday: "due today",
  learnNew: "learn new",
  students: "students",
  decks: "decks",
  settings: "settings",
  logOut: "log out",

  // ── Deck page ──
  addCard: "+ Add card",
  importCards: "Import cards",
  study: "Study",
  learnNewBtn: "Learn new",
  studyDue: "Study due",
  hard: "Hard",
  quiz: "Quiz",
  continueStudy: "Continue",
  cards: "cards",
  retention: "retention",

  // ── Study setup ──
  studySession: "Study session",
  newCards: "New cards",
  dueCards: "Due cards",
  hardCards: "Hard cards",
  allCards: "All cards",
  mixedPool: "New + Due",
  nMixed: "mixed",
  cardPool: "Card pool",
  studyMode: "Study mode",
  flashcards: "Flashcards",
  multipleChoice: "Multiple choice",
  fillBlank: "Fill in the blank",
  mixedMode: "Mixed",
  matching: "Matching",
  spinWheel: "Spin Wheel",
  trueFalse: "True / False",
  sideOrder: "Side order",
  termToDef: "Term → Def",
  defToTerm: "Def → Term",
  mixed: "Mixed",
  shuffleCards: "Shuffle cards",
  startN: "Start ({n} card{n, plural})",
  noCardsAvailable: "No cards available",
  nNew: "new",
  nDue: "due",
  nHard: "hard",
  nTotal: "total",

  // ── Learn / Practice ──
  again: "Again",
  hardGrade: "Hard",
  good: "Good",
  easy: "Easy",
  know: "Know",
  learnProgress: "Learn",
  practiceProgress: "Practice",
  sessionComplete: "Learning session complete!",
  practiceComplete: "Practice complete!",
  reviewsLabel: "Reviews",
  accuracy: "Accuracy",
  noNewCards: "You don't have any new cards to learn right now!",
  noPracticeCards: "You don't have any cards to practice right now!",

  // ── Card ──
  term: "Term",
  definition: "Definition",
  example: "Example",
  newBadge: "New",
  overdue: "overdue",

  // ── Card editor ──
  cardEditor: "Card editor",
  editFlashcard: "Edit flashcard",
  createFlashcard: "Create a new flashcard",
  editorDesc: "Use a short, clear term on the front and a helpful definition on the back. Changes sync to assigned student copies automatically.",
  termPlaceholder: "Example: resilient",
  termHelper: "Keep it short so students can recognize the prompt quickly.",
  swapSides: "Swap sides",
  definitionPlaceholder: "Example: able to recover quickly after something difficult",
  definitionHelper: "Add the main meaning or translation students should remember.",
  exampleSentence: "Example sentence",
  examplePlaceholder: "Example: She was resilient after the setback and kept practicing.",
  exampleHelper: "Optional, but great for context and memory cues.",
  teacherNotes: "Teacher notes",
  notesPlaceholder: "Optional pronunciation tip, mnemonic, or reminder",
  notesHelper: "Private notes help you keep cards consistent across the deck.",
  tipBulkImport: "Tip: You can also bulk import cards from XLSX, CSV, or pasted text right from the deck page.",
  deleteCard: "Delete card",
  deleting: "Deleting...",
  saveCard: "Save card",
  saving: "Saving...",

  // ── Bulk import ──
  bulkImport: "Bulk import cards",
  bulkImportDesc: "Upload XLSX or CSV files, or paste rows separated by tabs, commas, or another delimiter. The first column becomes the term and the second becomes the definition.",
  uploadFile: "Upload file",
  pasteText: "Paste text",
  source: "Source",
  separator: "Separator",
  autoDetect: "Auto detect",
  tab: "Tab",
  comma: "Comma",
  semicolon: "Semicolon",
  pipe: "Pipe |",
  dash: "Dash -",
  colon: "Colon :",
  everyTwoLines: "Every two lines",
  supportedFormats: "Supported formats: XLSX, XLS, CSV, and TXT. Header names like Term and Definition are detected automatically.",
  pasteCards: "Paste cards",
  pasteHelper: "Example: copy two spreadsheet columns and paste them directly.",
  preparePreview: "Prepare preview",
  preview: "Preview",
  readyToImport: "ready to import",
  prepareFirst: "Prepare a file or pasted text to preview the cards.",
  readingFile: "Reading file...",
  cancel: "Cancel",
  importing: "Importing...",
  importN: "Import",

  // ── Quick add ──
  quickAdd: "Quick add",
  termInput: "Term",
  definitionInput: "Definition",
  add: "Add",
  pressEnter: "Press Enter to add and continue",
  nCardsAdded: "card{n, plural} added",

  // ── Settings ──
  settingsTitle: "Settings",
  profile: "Profile",
  name: "Name",
  email: "Email",
  role: "Role",
  appearance: "Appearance",
  light: "☀ Light",
  dark: "● Dark",
  gradingMode: "Grading mode",
  againKnow: "Again / Know",
  fullGrading: "Again / Hard / Good / Easy",
  gradingSimpleDesc: "Two buttons: Again re-queues the card, Know marks it learned.",
  gradingFullDesc: "Four-button SRS grading with separate intervals for each grade.",
  language: "Language",

  // ── SRS intervals ──
  lessThan1m: "<1m",
  minutes: "{n}m",
  hours: "{n}h",
  days: "{n}d",
  months: "{n}mo",

  // ── Table view ──
  dueColumn: "Due",
  neverStudied: "—",
  switchToTable: "Switch to table view",
  switchToGrid: "Switch to grid view",
  exportDeck: "Export",

  // ── Misc ──
  loadingDecks: "Loading decks...",
  couldntLoadDecks: "Couldn't load decks :(",
  deckNotFound: "Deck not found",
  error: "Error :(",
  bothRequired: "Both the term and definition are required.",
  failedSave: "Failed to save card",
  failedDelete: "Failed to delete card",
  failedAdd: "Failed to add card",
  nCardsReady: "cards ready to import.",
  couldntRead: "Could not read the selected file.",
  couldntParse: "Could not parse the pasted text.",
  prepareBeforeImport: "Prepare a preview before importing.",
  failedImport: "Failed to import cards.",
  nCardsImported: "cards imported.",
};

const uk = {
  // ── Sidebar / nav ──
  dashboard: "головна",
  progress: "прогрес",
  dueToday: "на сьогодні",
  learnNew: "вивчити нові",
  students: "учні",
  decks: "колоди",
  settings: "налаштування",
  logOut: "вийти",

  // ── Deck page ──
  addCard: "+ Додати картку",
  importCards: "Імпортувати",
  study: "Навчання",
  learnNewBtn: "Вивчити нові",
  studyDue: "Повторити",
  hard: "Складні",
  quiz: "Тест",
  continueStudy: "Продовжити",
  cards: "карток",
  retention: "запам'ятовування",

  // ── Study setup ──
  studySession: "Сесія навчання",
  newCards: "Нові картки",
  dueCards: "Картки на повторення",
  hardCards: "Складні картки",
  allCards: "Усі картки",
  mixedPool: "Нові + На повт.",
  nMixed: "змішані",
  cardPool: "Набір карток",
  studyMode: "Режим навчання",
  flashcards: "Картки",
  multipleChoice: "Вибір зі списку",
  fillBlank: "Заповнити пропуск",
  mixedMode: "Змішаний",
  matching: "Зіставлення",
  spinWheel: "Колесо фортуни",
  trueFalse: "Правда / Неправда",
  sideOrder: "Порядок сторін",
  termToDef: "Термін → Визн.",
  defToTerm: "Визн. → Термін",
  mixed: "Змішано",
  shuffleCards: "Перемішати картки",
  startN: "Почати ({n} карт.)",
  noCardsAvailable: "Немає доступних карток",
  nNew: "нових",
  nDue: "на повт.",
  nHard: "складних",
  nTotal: "всього",

  // ── Learn / Practice ──
  again: "Знову",
  hardGrade: "Складно",
  good: "Добре",
  easy: "Легко",
  know: "Знаю",
  learnProgress: "Вивчення",
  practiceProgress: "Повторення",
  sessionComplete: "Сесію вивчення завершено!",
  practiceComplete: "Повторення завершено!",
  reviewsLabel: "Повторень",
  accuracy: "Точність",
  noNewCards: "Зараз немає нових карток для вивчення!",
  noPracticeCards: "Зараз немає карток для повторення!",

  // ── Card ──
  term: "Термін",
  definition: "Визначення",
  example: "Приклад",
  newBadge: "Нова",
  overdue: "прострочено",

  // ── Card editor ──
  cardEditor: "Редактор карток",
  editFlashcard: "Редагувати картку",
  createFlashcard: "Створити нову картку",
  editorDesc: "Використовуйте короткий і зрозумілий термін на лицьовій стороні та корисне визначення на зворотній.",
  termPlaceholder: "Приклад: resilient",
  termHelper: "Тримайте його коротким, щоб учні могли швидко впізнати.",
  swapSides: "Поміняти сторони",
  definitionPlaceholder: "Приклад: здатний швидко відновитися після труднощів",
  definitionHelper: "Додайте основне значення або переклад.",
  exampleSentence: "Приклад речення",
  examplePlaceholder: "Приклад: She was resilient after the setback.",
  exampleHelper: "Необов'язково, але допомагає для контексту та запам'ятовування.",
  teacherNotes: "Нотатки вчителя",
  notesPlaceholder: "Необов'язкова підказка з вимовою або мнемонікою",
  notesHelper: "Приватні нотатки для збереження послідовності в колоді.",
  tipBulkImport: "Порада: Ви також можете імпортувати картки масово з XLSX, CSV або вставленого тексту.",
  deleteCard: "Видалити картку",
  deleting: "Видалення...",
  saveCard: "Зберегти картку",
  saving: "Збереження...",

  // ── Bulk import ──
  bulkImport: "Масовий імпорт карток",
  bulkImportDesc: "Завантажте файли XLSX чи CSV або вставте рядки, розділені табуляцією, комою чи іншим роздільником.",
  uploadFile: "Завантажити файл",
  pasteText: "Вставити текст",
  source: "Джерело",
  separator: "Роздільник",
  autoDetect: "Автовизначення",
  tab: "Табуляція",
  comma: "Кома",
  semicolon: "Крапка з комою",
  pipe: "Вертикальна |",
  dash: "Тире -",
  colon: "Двокрапка :",
  everyTwoLines: "Кожні два рядки",
  supportedFormats: "Підтримувані формати: XLSX, XLS, CSV та TXT.",
  pasteCards: "Вставте картки",
  pasteHelper: "Приклад: скопіюйте два стовпці та вставте їх безпосередньо.",
  preparePreview: "Підготувати попередній перегляд",
  preview: "Попер. перегляд",
  readyToImport: "готові до імпорту",
  prepareFirst: "Підготуйте файл або вставлений текст для перегляду карток.",
  readingFile: "Читання файлу...",
  cancel: "Скасувати",
  importing: "Імпорт...",
  importN: "Імпортувати",

  // ── Quick add ──
  quickAdd: "Швидке додавання",
  termInput: "Термін",
  definitionInput: "Визначення",
  add: "Додати",
  pressEnter: "Натисніть Enter, щоб додати та продовжити",
  nCardsAdded: "карт. додано",

  // ── Settings ──
  settingsTitle: "Налаштування",
  profile: "Профіль",
  name: "Ім'я",
  email: "Ел. пошта",
  role: "Роль",
  appearance: "Вигляд",
  light: "☀ Світла",
  dark: "● Темна",
  gradingMode: "Режим оцінювання",
  againKnow: "Знову / Знаю",
  fullGrading: "Знову / Складно / Добре / Легко",
  gradingSimpleDesc: "Дві кнопки: Знову повертає картку, Знаю позначає як вивчену.",
  gradingFullDesc: "Чотири кнопки SRS з окремими інтервалами для кожної оцінки.",
  language: "Мова",

  // ── SRS intervals ──
  lessThan1m: "<1хв",
  minutes: "{n}хв",
  hours: "{n}год",
  days: "{n}д",
  months: "{n}міс",

  // ── Table view ──
  dueColumn: "Наступне",
  neverStudied: "—",
  switchToTable: "Табличний вигляд",
  switchToGrid: "Сітковий вигляд",
  exportDeck: "Експорт",

  // ── Misc ──
  loadingDecks: "Завантаження колод...",
  couldntLoadDecks: "Не вдалося завантажити колоди :(",
  deckNotFound: "Колоду не знайдено",
  error: "Помилка :(",
  bothRequired: "Потрібно заповнити і термін, і визначення.",
  failedSave: "Не вдалося зберегти картку",
  failedDelete: "Не вдалося видалити картку",
  failedAdd: "Не вдалося додати картку",
  nCardsReady: "карток готові до імпорту.",
  couldntRead: "Не вдалося прочитати вибраний файл.",
  couldntParse: "Не вдалося обробити вставлений текст.",
  prepareBeforeImport: "Спочатку підготуйте попередній перегляд.",
  failedImport: "Не вдалося імпортувати картки.",
  nCardsImported: "карток імпортовано.",
};

const dictionaries = { en, uk };

/**
 * Get the translation function for a given locale.
 * @param {string} locale - "en" or "uk"
 * @returns {{ t: (key: string, vars?: object) => string, locale: string }}
 */
export const getTranslations = (locale = "en") => {
  const dict = dictionaries[locale] || dictionaries.en;

  const t = (key, vars) => {
    let str = dict[key] ?? dictionaries.en[key] ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), v);
        // Handle simple plural: {n, plural} → "s" if n !== 1
        str = str.replace(new RegExp(`\\{${k}, plural\\}`, "g"), v !== 1 ? "s" : "");
      });
    }
    return str;
  };

  return { t, locale };
};

export default dictionaries;
