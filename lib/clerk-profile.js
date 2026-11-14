import { getClerkDisplayName } from "./user-name.js";

// Clerk's editable profile is authoritative, including for Google sign-ins.
// Never copy roles, credits, or interviewer details from client profile data.
export function getClerkProfileUpdates(existing, clerkUser) {
  const profile = {
    name: getClerkDisplayName(clerkUser),
    imageUrl: clerkUser.imageUrl || null,
  };
  return Object.fromEntries(Object.entries(profile).filter(([key, value]) => existing[key] !== value));
}
