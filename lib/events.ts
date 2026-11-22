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

const employeeListeners = new Set<Listener>();

/** Avisa quando funcionários foram criados/editados (o aviso de "sem equipe" recalcula). */
export function onEmployeesChanged(cb: Listener): () => void {
  employeeListeners.add(cb);
  return () => employeeListeners.delete(cb);
}

export function notifyEmployeesChanged() {
  employeeListeners.forEach((cb) => cb());
}
