import { useEffect } from "react";
import { ref, set } from "firebase/database";
import { database } from "../firebase";
import { useAuth } from "../AuthContext";

export default function WriteUserToDB() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const userRef = ref(database, `users/${user.uid}`);
      set(userRef, {
        name: user.displayName || "Unknown",
        avatar: user.photoURL || "",
        status: "Available",
        lastSeen: Date.now(),
      });
    }
  }, [user]);

  return null;
}
