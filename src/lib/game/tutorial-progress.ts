const PROLOGUE_KEY = "lampxu-prologue-done";

export function loadPrologueDone(): boolean {
  try {
    return !!localStorage.getItem(PROLOGUE_KEY);
  } catch {
    return false;
  }
}

export function markPrologueDone() {
  try {
    if (!localStorage.getItem(PROLOGUE_KEY)) localStorage.setItem(PROLOGUE_KEY, new Date().toISOString());
  } catch {
    /* private mode */
  }
}
