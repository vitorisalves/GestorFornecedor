/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, signInAnonymously, onAuthStateChanged, db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs } from 'firebase/firestore';
import { AuthorizedUser } from '../types';

export const useAuth = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('cache_isLoggedIn') === 'true');
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
          console.error("Auth error:", err);
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

    // Function to handle the global list of users if user is admin
    const checkAdminAndFetch = async (userData: AuthorizedUser) => {
      const adminCpf = '05839352144';
      if (userData.role === 'admin' || userData.cpf === adminCpf) {
         try {
           const snapshot = await getDocs(collection(db, 'authorized_users'));
           const data = snapshot.docs.map(doc => doc.data() as AuthorizedUser);
           setAuthorizedUsers(data);
           localStorage.setItem('cache_authorizedUsers', JSON.stringify(data));
         } catch (error: any) {
           if (error.message.toLowerCase().includes('quota') || error.message.toLowerCase().includes('resource-exhausted')) {
             setAuthError(error.message);
           }
         }
      } else {
        // Non-admins only know about themselves
        setAuthorizedUsers([userData]);
      }
    };

    // Listen only to the current user's document to save reads
    const unsubUser = onSnapshot(doc(db, 'authorized_users', currentUid), (snapshot) => {
      if (snapshot.exists()) {
        const userData = snapshot.data() as AuthorizedUser;
        
        // Fetch or update local user list
        checkAdminAndFetch(userData);

        if (userData.status === 'approved' && !isLoggedIn) {
          setIsLoggedIn(true);
          setLoggedCpf(userData.cpf);
          setLoggedName(userData.name || '');
          localStorage.setItem('cache_isLoggedIn', 'true');
        }
      }
    }, (error) => {
      if (error.message.toLowerCase().includes('quota') || error.message.toLowerCase().includes('resource-exhausted')) {
        setAuthError(error.message);
      }
    });

    return () => {
      unsubUser();
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

    const currentUserDoc = authorizedUsers.find(u => u.uid === currentUid);
    
    if (currentUserDoc && currentUserDoc.cpf === cleanCpf) {
      if (currentUserDoc.status === 'approved') {
        setIsLoggedIn(true);
        setLoggedCpf(cleanCpf);
        setLoggedName(currentUserDoc.name || '');
        localStorage.setItem('cache_isLoggedIn', 'true');
        localStorage.setItem('cache_loggedCpf', cleanCpf);
        localStorage.setItem('cache_loggedName', currentUserDoc.name || '');
        setLoginError('');
        return true;
      } else if (currentUserDoc.status === 'pending') {
        setLoginError('Aguardando liberação do administrador.');
        return false;
      } else {
        setLoginError('Seu acesso foi negado pelo administrador.');
        return false;
      }
    }

    const existingUserByCpf = authorizedUsers.find(u => u.cpf === cleanCpf);

    if (existingUserByCpf) {
      const updatedUser: AuthorizedUser = {
        ...existingUserByCpf,
        uid: currentUid,
        name: loginName.trim() || existingUserByCpf.name
      };
      
      if (cleanCpf === adminCpf) {
        updatedUser.status = 'approved';
        updatedUser.role = 'admin';
        // Garante que o nome "Vitor" seja salvo se fornecido
        if (loginName.trim()) {
          updatedUser.name = loginName.trim();
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
        setLoginError('');
        return true;
      } else {
        setLoginError(updatedUser.status === 'pending' ? 'Aguardando liberação.' : 'Acesso negado.');
        return false;
      }
    } else {
      const newUser: AuthorizedUser = {
        uid: currentUid,
        cpf: cleanCpf,
        name: loginName.trim(),
        status: cleanCpf === adminCpf ? 'approved' : 'pending',
        requestDate: new Date().toISOString(),
        role: cleanCpf === adminCpf ? 'admin' : 'user'
      };
      await setDoc(doc(db, 'authorized_users', currentUid), newUser);
      
      if (newUser.status === 'approved') {
        setIsLoggedIn(true);
        setLoggedCpf(cleanCpf);
        setLoggedName(newUser.name || '');
        localStorage.setItem('cache_isLoggedIn', 'true');
        localStorage.setItem('cache_loggedCpf', cleanCpf);
        localStorage.setItem('cache_loggedName', newUser.name || '');
        setLoginError('');
        return true;
      } else {
        setLoginError('Solicitação enviada. Aguarde a liberação do administrador.');
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
    await updateDoc(doc(db, 'authorized_users', uid), { status });
  };

  const removeUserRequest = async (uid: string) => {
    await deleteDoc(doc(db, 'authorized_users', uid));
  };

  const isAdmin = authorizedUsers.find(u => u.uid === auth.currentUser?.uid)?.role === 'admin';

  return {
    isLoggedIn,
    loggedCpf,
    loggedName,
    isAuthReady,
    authorizedUsers,
    loginError,
    setLoginError,
    handleLogin,
    handleLogout,
    updateUserStatus,
    removeUserRequest,
    isAdmin,
    authError,
    setAuthError
  };
};
