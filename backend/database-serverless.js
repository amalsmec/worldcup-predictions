import { getStore } from '@netlify/blobs';

// Initialize database
export function initDb() {
  console.log('Connected to Netlify Blobs serverless storage.');
  return Promise.resolve();
}

// Check if phone number already exists
export function checkPhoneExists(phone) {
  return new Promise(async (resolve, reject) => {
    try {
      const store = getStore('participants-store');
      const data = await store.get(phone);
      const exists = data !== null;
      resolve(exists);
    } catch (err) {
      reject(err);
    }
  });
}

// Save participant prediction
export function savePrediction(name, phone, predictionJson, winner) {
  return new Promise(async (resolve, reject) => {
    if (!name || !phone || !predictionJson || !winner) {
      return reject(new Error('Missing required fields: name, phone, predictions, or winner'));
    }

    try {
      const store = getStore('participants-store');
      const data = await store.get(phone);
      if (data !== null) {
        return reject(new Error('This phone number is already registered. Only one entry per participant is allowed.'));
      }

      const newRecord = {
        id: Date.now(),
        name,
        phone,
        prediction_json: predictionJson,
        winner,
        created_at: new Date().toISOString()
      };

      await store.set(phone, JSON.stringify(newRecord));
      resolve(newRecord);
    } catch (err) {
      reject(err);
    }
  });
}

// Get statistics for the dashboard
export function getStats() {
  return new Promise(async (resolve, reject) => {
    try {
      const store = getStore('participants-store');
      const listResult = await store.list();
      
      const participants = [];
      for (const blob of listResult.blobs) {
        const raw = await store.get(blob.key);
        if (raw) {
          participants.push(JSON.parse(raw));
        }
      }

      const counts = {};
      const championOnlyCounts = {};
      participants.forEach(p => {
        if (p.winner) {
          counts[p.winner] = (counts[p.winner] || 0) + 1;
        }
        if (p.champion_only) {
          championOnlyCounts[p.champion_only] = (championOnlyCounts[p.champion_only] || 0) + 1;
        }
      });

      const winnerStats = Object.keys(counts).map(winner => ({
        winner,
        count: counts[winner]
      })).sort((a, b) => b.count - a.count);

      const championOnlyStats = Object.keys(championOnlyCounts).map(champion_only => ({
        champion_only,
        count: championOnlyCounts[champion_only]
      })).sort((a, b) => b.count - a.count);

      resolve({
        dbType: 'netlify-blobs',
        totalParticipants: participants.length,
        participants: [...participants].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
        winnerStats,
        championOnlyStats
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Delete a participant prediction
export function deleteParticipant(id) {
  return new Promise(async (resolve, reject) => {
    try {
      const store = getStore('participants-store');
      const listResult = await store.list();
      let deleted = false;
      
      for (const blob of listResult.blobs) {
        const raw = await store.get(blob.key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.id.toString() === id.toString()) {
            await store.delete(blob.key);
            deleted = true;
            break;
          }
        }
      }
      resolve({ changes: deleted ? 1 : 0 });
    } catch (err) {
      reject(err);
    }
  });
}

// Clear all participants
export function clearAllParticipants() {
  return new Promise(async (resolve, reject) => {
    try {
      const store = getStore('participants-store');
      const listResult = await store.list();
      for (const blob of listResult.blobs) {
        await store.delete(blob.key);
      }
      resolve({ changes: 'all' });
    } catch (err) {
      reject(err);
    }
  });
}
