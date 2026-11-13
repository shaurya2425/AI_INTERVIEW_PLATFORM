// Clerk name fields are optional; never interpolate missing values into a name.
export function getClerkDisplayName(user) {
  const name = [user.firstName, user.lastName]
    .filter((part) => typeof part === "string" && part.trim())
    .map((part) => part.trim())
    .join(" ");

  return name || user.username?.trim() || "User";
}

export function getDisplayName(name, fallback = "User") {
  const parts = typeof name === "string" ? name.trim().split(/\s+/) : [];
  // Repair only the lowercase literals produced by the old interpolation.
  // Preserve real surnames such as "Null" and "Nullman".
  const missing = (part) => part === "null" || part === "undefined";
  while (parts.length && missing(parts[0])) parts.shift();
  while (parts.length && missing(parts.at(-1))) parts.pop();
  return parts.join(" ") || fallback;
}

export function withDisplayName(user) {
  return user ? { ...user, name: getDisplayName(user.name) } : user;
}
