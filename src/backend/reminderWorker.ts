import { query, collection, where, getDocs } from 'firebase/firestore';
import { fsOps, getDb } from './firebase';
import { PushService } from './services/pushService';

/**
 * Worker em segundo plano para verificar lembretes
 */
export const startBackgroundReminderWorker = () => {
  console.log("[ReminderWorker] Inicializando verificação de lembretes...");
  
  setInterval(async () => {
    try {
      const nowStr = new Date().toISOString();
      const db = getDb();
      let snapshot;
      
      // Lógica resiliente para Admin vs Client SDK
      try {
        const db = getDb();
        if (db.collection) {
          snapshot = await db.collection('reminders')
            .where('notified', '==', false)
            .where('date', '<=', nowStr)
            .get();
        } else {
          // Client SDK
          const remindersColl = collection(db as any, 'reminders');
          const q = query(
            remindersColl, 
            where('notified', '==', false),
            where('date', '<=', nowStr)
          );
          snapshot = await getDocs(q);
        }
      } catch (dbErr: any) {
        // Se falhar com Admin por algum motivo não detectado na inicialização, tenta Client uma vez
        if (dbErr.code === 7 || dbErr.message?.includes('PERMISSION_DENIED')) {
          console.warn("[ReminderWorker] Admin falhou com PERMISSION_DENIED. Tentando Client SDK...");
          const clientAppDb = getDb(); // Caso tenha mudado
          const q = query(
            collection(clientAppDb as any, 'reminders'), 
            where('notified', '==', false),
            where('date', '<=', nowStr)
          );
          snapshot = await getDocs(q);
        } else {
          throw dbErr;
        }
      }

      if (!snapshot || snapshot.empty) return;

      console.log(`[ReminderWorker] Processando ${snapshot.docs.length} lembretes pendentes...`);

      for (const reminderDoc of snapshot.docs) {
        const reminder = reminderDoc.data();
        const title = "Lembrete de Produto";
        const message = `Está na hora de comprar: ${reminder.productName}`;

        await PushService.broadcast(title, message);

        try {
          await fsOps.update(reminderDoc.ref, { notified: true });
        } catch (updateErr) {
          console.error(`[ReminderWorker] Erro ao atualizar lembrete ${reminderDoc.id}:`, updateErr);
        }
      }
    } catch (err) {
      console.error("[ReminderWorker] Erro no ciclo de verificação:", err);
    }
  }, 30000); 
};
