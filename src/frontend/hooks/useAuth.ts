/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, signInAnonymously, onAuthStateChanged, db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs } from 'firebase/firestore';
import { AuthorizedUser } from '../types';
import { extractErrorMessage, safeStringify, handleFirestoreError, OperationType } from '../utils';

export const useAuth = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('cache_isLoggedIn') === 'true');
  const [isApproved, setIsApproved] = useState(false);
  const [loggedCpf, setLoggedCpf] = useState(() => localStorage.getItem('cache_loggedCpf') || '');
  const [loggedName, setLoggedName] = useState(() => localStorage.getItem('cache_loggedName') || '');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authorizedUsers, setAuthorizedUsers] = useState<AuthorizedUser[]>(() => {
    const cached = localStorage.getItem('cache_authorizedUsers');
    return cached ? JSON.parse(cached) : [];
  });
  const [loginError, setLoginError] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthReady(true);
      } else {
        signInAnonymously(auth).catch(err => {
          console.error("Auth error:", extractErrorMessage(err));
          if (err.message.toLowerCase().includes('quota') || err.message.toLowerCase().includes('resource-exhausted')) {
            setAuthError(err.message);
          }
        });
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;

    let unsubAll: (() => void) | undefined;

    // Listen only to the current user's document to save reads
    const unsubUser = onSnapshot(doc(db, 'authorized_users', currentUid), (snapshot) => {
      const adminEmail = 'vitorisalves1@gmail.com';
      const isHardcodedAdmin = auth.currentUser?.email === adminEmail && auth.currentUser?.emailVerified;

      if (snapshot.exists()) {
        const userData = snapshot.data() as AuthorizedUser;
        
        const adminCpf = '05839352144';
        const userIsAdmin = userData.role === 'admin' || userData.cpf === adminCpf || !!isHardcodedAdmin;
        const userIsApproved = userData.status === 'approved' || userIsAdmin;

        setIsApproved(userIsApproved);

        // Fetch list if admin (REAL-TIME)
        if (userIsAdmin) {
          if (!unsubAll) {
            unsubAll = onSnapshot(collection(db, 'authorized_users'), (allSnapshot) => {
              const rawData = allSnapshot.docs.map(d => ({ ...d.data() }) as AuthorizedUser);
              
              // Deduplicate by CPF (keep latest request)
              const uniqueMap = new Map<string, AuthorizedUser>();
              rawData.forEach(u => {
                if (!u.cpf) return;
                const existing = uniqueMap.get(u.cpf);
                if (!existing || (u.requestDate && existing.requestDate && new Date(u.requestDate) > new Date(existing.requestDate))) {
                  uniqueMap.set(u.cpf, u);
                } else if (!existing) {
                  uniqueMap.set(u.cpf, u);
                }
              });
              const data = Array.from(uniqueMap.values());
              
              setAuthorizedUsers(data);
              localStorage.setItem('cache_authorizedUsers', safeStringify(data));
            }, (err) => {
               if (err.message.toLowerCase().includes('quota')) {
                 setAuthError(err.message);
               }
            });
          }
        } else {
          setAuthorizedUsers([userData]);
          if (unsubAll) {
            unsubAll();
            unsubAll = undefined;
          }
        }

        // AUTO-LOGIN: Only if approved AND we have the intent to be logged in (cache_loggedCpf exists)
        // This prevents immediate re-login after manual logout
        if (userIsApproved && !isLoggedIn && localStorage.getItem('cache_loggedCpf') === userData.cpf) {
          setIsLoggedIn(true);
          setLoggedCpf(userData.cpf);
          setLoggedName(userData.name || '');
          localStorage.setItem('cache_isLoggedIn', 'true');
        }
      } else {
        setIsApproved(!!isHardcodedAdmin);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, currentUid);
      if (extractErrorMessage(error).toLowerCase().includes('quota') || extractErrorMessage(error).toLowerCase().includes('resource-exhausted')) {
        setAuthError(extractErrorMessage(error));
      }
    });

    return () => {
      unsubUser();
      if (unsubAll) (unsubAll as any)();
    };
  }, [isAuthReady, isLoggedIn]);

  const handleLogin = async (loginCpf: string, loginName: string) => {
    const adminCpf = '05839352144';
    const cleanCpf = loginCpf.replace(/\D/g, '');
    const currentUid = auth.currentUser?.uid;

    if (!currentUid) {
      setLoginError('Erro de autenticação. Tente recarregar a página.');
      return false;
    }

    if (cleanCpf.length !== 11) {
      setLoginError('CPF inválido. Digite os 11 números.');
      return false;
    }

    const existingUserByCpf = authorizedUsers.find(u => u.cpf === cleanCpf);

    if (existingUserByCpf) {
      const updatedUser: AuthorizedUser = {
        ...existingUserByCpf,
        uid: currentUid,
        lastLogin: new Date().toISOString()
      };

      // Ensure all required fields for rules are present
      if (!updatedUser.requestDate) updatedUser.requestDate = new Date().toISOString();
      if (!updatedUser.role) updatedUser.role = 'user';
      if (!updatedUser.status) updatedUser.status = 'pending';

      if (cleanCpf === adminCpf) {
        updatedUser.status = 'approved';
        updatedUser.role = 'admin';
        if (loginName.trim()) {
          updatedUser.name = loginName.trim();
        }
      }

      try {
        // Se o registro existente tinha um UID diferente, removemos o antigo para evitar duplicatas
        if (existingUserByCpf.uid && existingUserByCpf.uid !== currentUid) {
          try {
            await deleteDoc(doc(db, 'authorized_users', existingUserByCpf.uid));
          } catch (delErr) {
            console.warn("Could not delete duplicate user doc:", delErr);
          }
        }
        await setDoc(doc(db, 'authorized_users', currentUid), updatedUser);
        
        if (updatedUser.status === 'approved') {
          setIsLoggedIn(true);
          setLoggedCpf(cleanCpf);
          setLoggedName(updatedUser.name || '');
          localStorage.setItem('cache_isLoggedIn', 'true');
          localStorage.setItem('cache_loggedCpf', cleanCpf);
          localStorage.setItem('cache_loggedName', updatedUser.name || '');
          return true;
        } else {
          setLoginError('Seu acesso está aguardando aprovação.');
          return false;
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `authorized_users/${currentUid}`);
        setLoginError('Erro ao registrar acesso. Tente novamente.');
        return false;
      }
    } else {
      const newUser: AuthorizedUser = {
        uid: currentUid,
        cpf: cleanCpf,
        name: loginName.trim(),
        status: cleanCpf === adminCpf ? 'approved' : 'pending',
        role: cleanCpf === adminCpf ? 'admin' : 'user',
        requestDate: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, 'authorized_users', currentUid), newUser);
        if (newUser.status === 'approved') {
          setIsLoggedIn(true);
          setLoggedCpf(cleanCpf);
          setLoggedName(newUser.name || '');
          localStorage.setItem('cache_isLoggedIn', 'true');
          localStorage.setItem('cache_loggedCpf', cleanCpf);
          localStorage.setItem('cache_loggedName', newUser.name || '');
          return true;
        } else {
          setLoginError('Sua solicitação de acesso foi enviada e aguarda aprovação.');
          return false;
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `authorized_users/${currentUid}`);
        return false;
      }
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setLoggedCpf('');
    setLoggedName('');
    localStorage.removeItem('cache_isLoggedIn');
    localStorage.removeItem('cache_loggedCpf');
    localStorage.removeItem('cache_loggedName');
  };

  const updateUserStatus = async (uid: string, status: 'approved' | 'denied') => {
    try {
      if (status === 'denied') {
        await deleteDoc(doc(db, 'authorized_users', uid));
      } else {
        await updateDoc(doc(db, 'authorized_users', uid), { status });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `authorized_users/${uid}`);
    }
  };

  const confirmDeleteUser = async (uid: string) => {
    try {
      await deleteDoc(doc(db, 'authorized_users', uid));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `authorized_users/${uid}`);
    }
  };

  const isAdmin = authorizedUsers.find(u => u.cpf === loggedCpf)?.role === 'admin' || 
                 (auth.currentUser?.email === 'vitorisalves1@gmail.com' && auth.currentUser?.emailVerified);

  return {
    isLoggedIn,
    isApproved,
    loggedCpf,
    loggedName,
    loginError,
    authError,
    setLoginError,
    handleLogin,
    handleLogout,
    authorizedUsers,
    updateUserStatus,
    removeUserRequest: confirmDeleteUser,
    isAdmin,
    isAuthReady
  };
};
