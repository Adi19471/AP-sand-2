/**
 * Authentication context.
 *
 * Holds the Firebase Auth user *and* a live `onSnapshot` on the matching
 * Firestore profile, so a role change, an approval or an account being
 * disabled takes effect immediately in every open tab without a refresh.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { hasPasswordLogin, watchAuthState } from '../firebase/auth';
import { isFirebaseConfigured, missingFirebaseKeys } from '../firebase/firebaseConfig';
import { userDoc } from '../firebase/firestore';
import {
  completeRedirectSignIn,
  ensureProfile,
  signInWithGoogle,
  signOutUser,
  updateOwnPassword,
} from '../services/authService';
import { ROLES, USER_STATUS } from '../utils/constants';
import { friendlyError, logError } from '../utils/errors';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [initialising, setInitialising] = useState(true);
  const [profileError, setProfileError] = useState('');
  /** Why the last session was turned away; shown on the sign-in screen. */
  const [notice, setNotice] = useState('');
  const profileUnsub = useRef(null);

  // ------------------------------------------------------------ auth state
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setInitialising(false);
      return undefined;
    }

    const unsubscribe = watchAuthState((firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        profileUnsub.current?.();
        profileUnsub.current = null;
        setProfile(null);
        setProfileError('');
        setInitialising(false);
      }
    });

    // A browser that would not open the Google popup was sent to Google's own
    // page instead; this finishes that sign-in on the way back.
    completeRedirectSignIn().catch((error) => {
      logError('useAuth:redirectSignIn', error);
      setNotice(friendlyError(error, 'Unable to sign in with Google. Please try again.'));
    });

    return () => {
      unsubscribe();
      profileUnsub.current?.();
      profileUnsub.current = null;
    };
  }, []);

  // -------------------------------------------------- live profile listener
  useEffect(() => {
    if (!user) return undefined;

    let active = true;
    setProfileError('');
    const unsubscribe = onSnapshot(
      userDoc(user.uid),
      (snapshot) => {
        if (snapshot.exists()) {
          setProfile({ id: snapshot.id, ...snapshot.data() });
          setProfileError('');
          setInitialising(false);
          return;
        }

        // First sign-in of this Google account: create the profile it maps
        // to. The listener fires again as soon as the document exists.
        setProfile(null);
        ensureProfile(user).catch((error) => {
          logError('useAuth:ensureProfile', error);
          if (!active) return;
          setProfileError(friendlyError(error, 'PROFILE_MISSING'));
          setInitialising(false);
        });
      },
      (error) => {
        logError('useAuth:profileSnapshot', error);
        setProfileError(friendlyError(error, 'Unable to load your profile.'));
        setInitialising(false);
      },
    );

    profileUnsub.current = unsubscribe;
    return () => {
      active = false;
      unsubscribe();
      profileUnsub.current = null;
    };
  }, [user]);

  // An administrator disabling an account boots that session out immediately.
  useEffect(() => {
    if (profile && profile.status === USER_STATUS.DISABLED) {
      setNotice(friendlyError(new Error('ACCOUNT_DISABLED')));
      signOutUser(profile).catch((error) => logError('useAuth:autoSignOut', error));
    }
  }, [profile]);

  // --------------------------------------------------------------- actions
  const loginWithGoogle = useCallback(async () => {
    setNotice('');
    return signInWithGoogle();
  }, []);

  const logout = useCallback(async () => {
    await signOutUser(profile);
  }, [profile]);

  const changeOwnPassword = useCallback((payload) => updateOwnPassword(payload), []);

  const value = useMemo(() => {
    const role = profile?.role || null;
    const status = profile?.status || null;
    return {
      user,
      profile,
      role,
      status,
      isAdmin: role === ROLES.ADMIN,
      /** Signed in with Google, but no administrator has approved it yet. */
      isPending: status === USER_STATUS.PENDING,
      isAuthenticated: Boolean(user && profile),
      /** Legacy accounts only: one that still has an e-mail/password credential. */
      hasPassword: hasPasswordLogin(user),
      initialising,
      profileError,
      notice,
      configured: isFirebaseConfigured,
      missingKeys: missingFirebaseKeys,
      /** Compact identity object passed to the services as the acting user. */
      actor: user
        ? {
            uid: user.uid,
            email: (user.email || '').toLowerCase(),
            name: profile?.name || user.displayName || '',
            role,
          }
        : null,
      loginWithGoogle,
      logout,
      changeOwnPassword,
    };
  }, [
    user,
    profile,
    initialising,
    profileError,
    notice,
    loginWithGoogle,
    logout,
    changeOwnPassword,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
};

export default useAuth;
