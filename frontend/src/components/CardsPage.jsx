import { useEffect, useState } from "react";
import { listCards, createAvrech } from "../api";
import AvrechCard from "./AvrechCard";

function AddCardPersonForm({ onChanged }) {
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      await createAvrech(trimmed, 0, true);
      setName("");
      setOpen(false);
      await onChanged();
    } finally {
      setAdding(false);
    }
  }

  if (!open) {
    return (
      <button className="add-card-person-toggle" onClick={() => setOpen(true)}>
        + כרטיס חדש (למי שאינו ברשימת האברכים)
      </button>
    );
  }

  return (
    <form className="add-card-person-form" onSubmit={handleAdd}>
      <input
        type="text"
        placeholder="שם"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit" disabled={adding || !name.trim()}>
        {adding ? "יוצר..." : "צור כרטיס"}
      </button>
      <button type="button" onClick={() => setOpen(false)}>
        בטל
      </button>
    </form>
  );
}

export default function CardsPage() {
  const [cards, setCards] = useState(null);

  function refresh() {
    return listCards().then(setCards);
  }

  useEffect(() => {
    refresh();
  }, []);

  if (!cards) {
    return <main className="cards-page">טוען...</main>;
  }

  return (
    <main className="cards-page">
      <AddCardPersonForm onChanged={refresh} />

      {cards.length === 0 ? (
        <p className="archive-empty">אין עדיין אברכים במערכת.</p>
      ) : (
        <div className="cards-grid">
          {cards.map((avrech) => (
            <AvrechCard key={avrech.id} avrech={avrech} onChanged={refresh} />
          ))}
        </div>
      )}
    </main>
  );
}
