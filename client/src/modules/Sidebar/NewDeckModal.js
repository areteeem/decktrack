import Modal from "../../common/components/Modal";
import TextInput from "../../common/components/TextInput";
import Button from "../../common/components/Button";
import { useState } from "react";
import { useCreateDeck } from "../../hooks/useSupabaseData";
import { toast } from "react-toastify";

const NewDeckModal = ({ open, setOpen, onCreated }) => {
  const { createDeck } = useCreateDeck();
  const [name, setName] = useState("");
  return (
    <Modal open={open} setOpen={setOpen}>
      <TextInput placeholder="Deck name" state={name} setState={setName} />
      <Button
        callback={async () => {
          if (!name.trim()) {
            toast.error("Deck name is required");
            return;
          }

          try {
            await createDeck({ name: name.trim() });
            setName("");
            setOpen(false);
            if (onCreated) onCreated();
          } catch (err) {
            toast.error(err.message || "Failed to create deck");
          }
        }}
      >
        Save
      </Button>
    </Modal>
  );
};

export default NewDeckModal;
