import { auth } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";

export class AuthService {
  static async register(
    email: string,
    password: string,
    displayName?: string
  ): Promise<FirebaseUser> {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    if (displayName) {
      await updateProfile(userCredential.user, { displayName });
    }
    return userCredential.user;
  }

  static async login(email: string, password: string) {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    return userCredential.user;
  }

  static async logout() {
    await signOut(auth);
  }

  static getCurrentUser(): Promise<FirebaseUser | null> {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }

  static async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  }
}
