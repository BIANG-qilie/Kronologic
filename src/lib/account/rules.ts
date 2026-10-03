export const USERNAME_MIN = 2;
export const USERNAME_MAX = 16;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

const USERNAME_RE = /^[\p{Script=Han}A-Za-z0-9_]+$/u;

export function normalizeUsername(raw: string): string {
  return raw.normalize("NFKC").trim();
}

/** Returns a user-facing message, or null when the username is acceptable. */
export function usernameProblem(raw: string): string | null {
  const name = normalizeUsername(raw);
  const len = [...name].length;
  if (len < USERNAME_MIN || len > USERNAME_MAX) {
    return `称呼要 ${USERNAME_MIN}–${USERNAME_MAX} 个字`;
  }
  if (!USERNAME_RE.test(name)) return "称呼只能用中文、英文、数字和下划线";
  return null;
}

export function passwordProblem(raw: string): string | null {
  if (raw.length < PASSWORD_MIN) return `密码至少 ${PASSWORD_MIN} 位`;
  if (raw.length > PASSWORD_MAX) return `密码最多 ${PASSWORD_MAX} 位`;
  return null;
}

export const LOGIN_FAILED = "称呼或密码不对";
