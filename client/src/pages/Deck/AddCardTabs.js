import { useState } from "react";
import { useSettings } from "../../contexts/SettingsContext";
import QuickAddCards from "./QuickAddCards";
import InlineCardEditor from "./InlineCardEditor";
import InlineBulkImport from "./InlineBulkImport";
import styles from "./AddCardTabs.module.css";

const TABS = [
  { id: "quick", tKey: "quickAdd" },
  { id: "editor", tKey: "cardEditor" },
  { id: "import", tKey: "importCards" },
];

const AddCardTabs = ({ deckId, onChanged, startSortOrder = 0, show = true }) => {
  const { t } = useSettings();
  const [activeTab, setActiveTab] = useState("quick");

  if (!show) return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab(tab.id)}
          >
            {t(tab.tKey)}
          </button>
        ))}
      </div>
      <div className={styles.body}>
        {activeTab === "quick" && (
          <QuickAddCards deckId={deckId} onAdded={onChanged} embedded />
        )}
        {activeTab === "editor" && (
          <InlineCardEditor deckId={deckId} onSaved={onChanged} />
        )}
        {activeTab === "import" && (
          <InlineBulkImport
            deckId={deckId}
            startSortOrder={startSortOrder}
            onImported={onChanged}
          />
        )}
      </div>
    </div>
  );
};

export default AddCardTabs;
