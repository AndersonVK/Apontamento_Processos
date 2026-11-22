type Listener = () => void;
const listeners = new Set<Listener>();

/** Avisa telas (lista, chamada do dia) que a fila local mudou ou algo foi sincronizado. */
export function onQueueChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function notifyQueueChange() {
  listeners.forEach((cb) => cb());
}
