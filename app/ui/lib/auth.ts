// Simple client-side auth using localStorage (demo/dummy auth)

export type User = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  plan: "free" | "pro";
};

const DUMMY_USERS: Array<User & { password: string }> = [
  {
    id: "1",
    name: "Alex Chen",
    email: "alex@demo.com",
    password: "demo123",
    avatar: "AC",
    plan: "pro",
  },
  {
    id: "2",
    name: "Sam Rivera",
    email: "sam@demo.com",
    password: "demo123",
    avatar: "SR",
    plan: "free",
  },
  {
    id: "3",
    name: "Test User",
    email: "test@test.com",
    password: "test",
    avatar: "TU",
    plan: "free",
  },
];

const SESSION_KEY = "aai_session";

export function login(
  email: string,
  password: string
): { user: User } | { error: string } {
  const match = DUMMY_USERS.find(
    (u) => u.email === email && u.password === password
  );
  if (!match) return { error: "Invalid email or password." };
  const { password: _pw, ...user } = match;
  if (typeof window !== "undefined") {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }
  return { user };
}

export function loginWithGoogle(): User {
  // Demo Google login — uses a mock Google user
  const user: User = {
    id: "g1",
    name: "Google User",
    email: "googleuser@gmail.com",
    avatar: "GU",
    plan: "pro",
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }
  return user;
}

export function logout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function getSession(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}
