import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db = null;

export async function initDatabase() {
  try {
    db = await open({
      filename: path.join(__dirname, 'processed_logs.db'),
      driver: sqlite3.Database
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS processed_interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seqNo INTEGER NOT NULL,
        serviceOrder_fk TEXT NOT NULL,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(seqNo, serviceOrder_fk)
      );
      
      CREATE INDEX IF NOT EXISTS idx_interaction_lookup 
      ON processed_interactions(seqNo, serviceOrder_fk);
    `);

    console.log('✅ Banco de dados inicializado com sucesso');
    return db;
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    throw error;
  }
}

export async function isInteractionProcessed(seqNo, serviceOrder_fk) {
  try {
    const result = await db.get(
      'SELECT 1 FROM processed_interactions WHERE seqNo = ? AND serviceOrder_fk = ?',
      [seqNo, serviceOrder_fk]
    );
    return !!result;
  } catch (error) {
    console.error('❌ Erro ao verificar interação processada:', error);
    return false;
  }
}

export async function saveProcessedInteraction(seqNo, serviceOrder_fk) {
  try {
    const result = await db.run(
      'INSERT OR IGNORE INTO processed_interactions (seqNo, serviceOrder_fk) VALUES (?, ?)',
      [seqNo, serviceOrder_fk]
    );
    return result.changes > 0;
  } catch (error) {
    console.error('❌ Erro ao salvar interação processada:', error);
    return false;
  }
}

export async function getUnprocessedInteractions(logs, serviceOrder_fk) {
  try {
    const unprocessedLogs = [];
    
    // Otimização: verificar em lote se possível
    for (const log of logs) {
      if (!log.SeqNo) {
        console.log('⚠️ Log sem SeqNo:', log);
        continue;
      }
      
      const isProcessed = await isInteractionProcessed(log.SeqNo, serviceOrder_fk);
      if (!isProcessed) {
        unprocessedLogs.push(log);
      }
    }
    
    return unprocessedLogs;
  } catch (error) {
    console.error('❌ Erro ao obter interações não processadas:', error);
    return logs;
  }
}

export async function batchSaveInteractions(interactions) {
  try {
    const stmt = await db.prepare(
      'INSERT OR IGNORE INTO processed_interactions (seqNo, serviceOrder_fk) VALUES (?, ?)'
    );
    
    for (const { seqNo, serviceOrder_fk } of interactions) {
      await stmt.run(seqNo, serviceOrder_fk);
    }
    
    await stmt.finalize();
    return true;
  } catch (error) {
    console.error('❌ Erro ao salvar interações em lote:', error);
    return false;
  }
}

export async function closeDatabase() {
  if (db) {
    await db.close();
    console.log('✅ Conexão com banco de dados fechada');
  }
}