import { useParams, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import LoadingScreen from "../../common/components/LoadingScreen";
import { toast } from "react-toastify";
import { getSupabase } from "../../lib/supabaseClient";
import styles from "./SharedDeck.module.css";

/**
 * SharedDeckPage — renders when visiting /shared/:token.
 * Fetches the deck by share_token, shows a preview, and lets
 * authenticated users clone it into their own library.
 */
export default function SharedDeckPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, profile } = useAuth();

  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const sb = getSupabase();

        // Preferred path: SECURITY DEFINER RPC so shared links work across accounts
        // regardless of owner/student RLS conditions.
        const { data: sharedPayload, error: sharedErr } = await sb.rpc("flashy_get_shared_deck", {
          p_share_token: String(token || ""),
        });

        const rpcDeck = sharedPayload?.deck || null;
        const rpcCards = Array.isArray(sharedPayload?.cards) ? sharedPayload.cards : null;

        if (!sharedErr && rpcDeck) {
          if (!cancelled) {
            setDeck(rpcDeck);
            setCards(rpcCards || []);
          }
          return;
        }

        // Fallback path for environments that haven't applied the RPC migration yet.
        const { data: d, error: dErr } = await sb
          .from("flashy_decks")
          .select("id, name, description, category, difficulty_level, tags, language_pair, owner_id")
          .eq("share_token", token)
          .single();

        if (dErr || !d) {
          if (!cancelled) setError("Deck not found or the share link has expired.");
          return;
        }

        const { data: c } = await sb
          .from("flashy_cards")
          .select("front, back, example_sentence, card_type, sort_order")
          .eq("deck_id", d.id)
          .order("sort_order");

        if (!cancelled) {
          setDeck(d);
          setCards(c || []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [token]);

  const handleClone = async () => {
    if (!isAuthenticated || !profile?.id) {
      toast.info("Sign in to add this deck to your library");
      navigate(`/signin?redirect=/shared/${token}`);
      return;
    }

    setCloning(true);
    try {
      // Create a new deck for the user
      const { data: newDeck, error: deckErr } = await getSupabase()
        .from("flashy_decks")
        .insert({
          owner_id: profile.id,
          name: deck.name,
          description: deck.description || "",
          category: deck.category || "",
          tags: deck.tags || [],
          difficulty_level: deck.difficulty_level || null,
          language_pair: deck.language_pair || "en-native",
        })
        .select()
        .single();

      if (deckErr) throw deckErr;

      // Clone cards
      if (cards.length > 0) {
        const cardRows = cards.map((c, i) => ({
          deck_id: newDeck.id,
          front: c.front,
          back: c.back,
          example_sentence: c.example_sentence || "",
          sort_order: c.sort_order ?? i,
          ...(c.card_type ? { card_type: c.card_type } : {}),
        }));
        const { error: cardsErr } = await getSupabase()
          .from("flashy_cards")
          .insert(cardRows);
        if (cardsErr) throw cardsErr;
      }

      toast.success(`"${deck.name}" added to your library!`);
      navigate(`/deck/${newDeck.id}`);
    } catch (err) {
      toast.error(err.message || "Failed to clone deck");
    } finally {
      setCloning(false);
    }
  };

  if (loading) return <LoadingScreen />;

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorCard}>
          <h2>Link not available</h2>
          <p>{error}</p>
          <button className={styles.primaryBtn} onClick={() => navigate("/")}>Go Home</button>
        </div>
      </div>
    );
  }

  const stripHtml = (html) => (html || "").replace(/<[^>]*>/g, "").trim();

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.badge}>Shared Deck</div>
        <h1 className={styles.title}>{deck.name}</h1>
        {deck.description && <p className={styles.desc}>{deck.description}</p>}
        <div className={styles.meta}>
          {deck.category && <span className={styles.tag}>{deck.category}</span>}
          {deck.difficulty_level && <span className={styles.tag}>{deck.difficulty_level}</span>}
          <span className={styles.tag}>{cards.length} card{cards.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Card preview */}
        {cards.length > 0 && (
          <div className={styles.preview}>
            <h3 className={styles.previewTitle}>Card Preview</h3>
            <div className={styles.previewGrid}>
              {cards.slice(0, 6).map((c, i) => (
                <div key={i} className={styles.previewCard}>
                  <div className={styles.previewFront}>{stripHtml(c.front)}</div>
                  <div className={styles.previewBack}>{stripHtml(c.back)}</div>
                </div>
              ))}
            </div>
            {cards.length > 6 && (
              <p className={styles.more}>+ {cards.length - 6} more cards</p>
            )}
          </div>
        )}

        <button
          className={styles.cloneBtn}
          onClick={handleClone}
          disabled={cloning}
        >
          {cloning ? "Adding…" : "Add to My Library"}
        </button>

        {!isAuthenticated && (
          <p className={styles.hint}>You'll need to sign in to add this deck.</p>
        )}
      </div>
    </div>
  );
}
