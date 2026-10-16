/**
 * `localStorage` en mémoire pour les tests : chaque test part d'un stockage vide
 * et ne dépend ni du navigateur ni de la version de Node utilisée par Vitest.
 */
export function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}
