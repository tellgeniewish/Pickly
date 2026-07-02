export function getAnonKey(): string | null {
  if (typeof window === "undefined") return null;
  let key = localStorage.getItem("pickly_anon_key");
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem("pickly_anon_key", key);
  }
  return key;
}

export function getAnonName(): string {
  if (typeof window === "undefined") return "게스트";
  let name = localStorage.getItem("pickly_anon_name");
  if (!name) {
    const n = Math.floor(Math.random() * 9000) + 1000;
    name = `게스트${n}`;
    localStorage.setItem("pickly_anon_name", name);
  }
  return name;
}
