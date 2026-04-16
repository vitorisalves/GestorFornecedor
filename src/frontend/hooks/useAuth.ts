/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, signInAnonymously, onAuthStateChanged, db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { AuthorizedUser } from '../types';

export const useAuth = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggedCpf, setLoggedCpf] = useState('');
  const [loggedName, setLoggedName] = useState('');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authorizedUsers, setAuthorizedUsers] = useState<AuthorizedUser[]>([]);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthReady(true);
      } else {
        signInAnonymously(auth).catch(err => console.error("Auth error:", err));
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    const unsubAuthorized = onSnapshot(collection(db, 'authorized_users'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as AuthorizedUser);
      setAuthorizedUsers(data);
    }, (error) => {
      console.error("Authorized users listener error:", error);
    });
    return () => unsubAuthorized();
  }, [isAuthReady]);

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
  };

  const updateUserStatus = async (uid: string, status: 'approved' | 'denied') => {
    await updateDoc(doc(db, 'authorized_users', uid), { status });
  };

  const removeUserRequest = async (uid: string) => {
    await deleteDoc(doc(db, 'authorized_users', uid));
  };

  const isAdmin = authorizedUsers.find(u => u.cpf === loggedCpf)?.role === 'admin';

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
    isAdmin
  };
};
