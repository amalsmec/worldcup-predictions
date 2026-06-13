const express = require('express');
const cors = require('cors');
const { 
  initDb, 
  getTodayMatch, 
  saveTodayMatch, 
  registerUser, 
  loginUser, 
  getUserById, 
  getUserPredictions, 
  getUserDailyPredictions, 
  saveBracketPrediction, 
  saveDirectChampion, 
  saveDailyPrediction, 
  getStats, 
  checkPhoneExists, 
  deleteParticipant, 
  clearAllParticipants,
  addMatch,
  deleteMatch,
  getMatches,
  saveMatchPrediction,
  updateMatchResult,
  toggleMatchLock,
  getTournamentResults,
  saveTournamentResults,
  clearTournamentResults,
  getSetting,
  saveSetting
} = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_TOKEN = 'admin-secret-session-token-worldcup-2026';

// Middleware
app.use(cors());
app.use(express.json());

// Log incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Root API path message/redirect
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>World Cup Prediction API</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: #0f172a;
            color: #f1f5f9;
            text-align: center;
          }
          .card {
            background: #1e293b;
            padding: 2.5rem;
            border-radius: 1rem;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
            border: 1px solid #334155;
            max-width: 500px;
          }
          h1 { color: #38bdf8; margin-bottom: 0.5rem; font-size: 1.8rem; }
          p { color: #94a3b8; font-size: 1.1rem; line-height: 1.6; }
          a {
            display: inline-block;
            margin-top: 1.5rem;
            padding: 0.75rem 1.5rem;
            background: #0284c7;
            color: white;
            text-decoration: none;
            border-radius: 0.5rem;
            font-weight: 600;
            transition: background 0.2s;
          }
          a:hover { background: #0369a1; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>World Cup Predictions API ⚽</h1>
          <p>The backend API is running successfully. To use the prediction application, please open the frontend dashboard.</p>
          <a href="http://localhost:5173">Go to Frontend App</a>
        </div>
      </body>
    </html>
  `);
});

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader === `Bearer ${ADMIN_TOKEN}`) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized: Admin authentication required.' });
  }
};

// User authentication middleware
const authenticateUser = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer user-secret-')) {
    const userIdStr = authHeader.replace('Bearer user-secret-', '');
    const userId = parseInt(userIdStr, 10);
    if (!isNaN(userId)) {
      req.user = { id: userId };
      return next();
    }
  }
  res.status(401).json({ error: 'Unauthorized: User login session expired or invalid.' });
};

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === 'admin' && password === ADMIN_PASSWORD) {
    return res.json({ success: true, token: ADMIN_TOKEN });
  } else {
    return res.status(401).json({ error: 'Invalid admin username or password.' });
  }
});

// User Registration
app.post('/api/auth/register', async (req, res) => {
  const { name, phone, password, userType, employeeCode, studentId } = req.body;
  try {
    const user = await registerUser(name, phone, password, userType, employeeCode, studentId);
    res.status(201).json({ success: true, user });
  } catch (error) {
    console.error('Error during registration:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  const { phone, password } = req.body;
  try {
    const user = await loginUser(phone, password);
    const token = `user-secret-${user.id}`;
    res.json({ success: true, token, user });
  } catch (error) {
    console.error('Error during login:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Check if phone number is already registered (kept for client-side registration checks)
app.get('/api/check-phone/:phone', async (req, res) => {
  const { phone } = req.params;
  const cleanPhone = phone.replace(/[^0-9+]/g, '');

  if (cleanPhone.length < 7) {
    return res.status(400).json({ error: 'Please enter a valid phone number.' });
  }

  try {
    const exists = await checkPhoneExists(cleanPhone);
    return res.json({ exists });
  } catch (error) {
    console.error('Error checking phone number:', error.message);
    return res.status(500).json({ error: 'Failed to verify phone number.' });
  }
});

// Fetch Active Today's Match Settings
app.get('/api/today-match', async (req, res) => {
  try {
    const match = await getTodayMatch();
    res.json(match);
  } catch (error) {
    console.error('Error fetching today match:', error.message);
    res.status(500).json({ error: "Failed to retrieve today's match settings." });
  }
});

// Admin: Update Active Today's Match Settings
app.post('/api/admin/today-match', authenticateAdmin, async (req, res) => {
  const { teamA, teamB } = req.body;
  if (!teamA || !teamB) {
    return res.status(400).json({ error: 'Both teamA and teamB are required.' });
  }

  try {
    const result = await saveTodayMatch(teamA.trim(), teamB.trim());
    res.json({ success: true, match: result });
  } catch (error) {
    console.error('Error saving today match:', error.message);
    res.status(500).json({ error: "Failed to save today's match settings." });
  }
});

// Admin: Schedule matches (supports single match or array of matches)
app.post('/api/admin/matches', authenticateAdmin, async (req, res) => {
  const matches = Array.isArray(req.body) ? req.body : [req.body];
  
  if (matches.length === 0) {
    return res.status(400).json({ error: 'No matches provided.' });
  }

  for (const m of matches) {
    if (!m.teamA || !m.teamB || !m.date || !m.time) {
      return res.status(400).json({ error: 'All match scheduling fields (teamA, teamB, date, time) are required for each entry.' });
    }
    if (m.teamA.trim() === m.teamB.trim()) {
      return res.status(400).json({ error: 'Team A and Team B must be different.' });
    }
  }

  try {
    const results = [];
    for (const m of matches) {
      const result = await addMatch(m.teamA.trim(), m.teamB.trim(), m.date.trim(), m.time.trim());
      results.push(result);
    }
    res.json({ success: true, matches: results });
  } catch (error) {
    console.error('Error scheduling matches:', error.message);
    res.status(500).json({ error: error.message || 'Failed to schedule matches.' });
  }
});

// Admin: Delete a scheduled match
app.delete('/api/admin/matches/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await deleteMatch(id);
    res.json({ success: true, message: 'Match deleted successfully.', result });
  } catch (error) {
    console.error('Error deleting match:', error.message);
    res.status(500).json({ error: 'Failed to delete match.' });
  }
});

// Admin: Update actual score/result of a scheduled match
app.post('/api/admin/matches/:id/result', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { actualScoreA, actualScoreB } = req.body;

  // Validation: If both are provided, they must be valid integers (can be empty string/null for clear/reset)
  if (actualScoreA !== null && actualScoreA !== undefined && actualScoreA !== '') {
    if (isNaN(parseInt(actualScoreA, 10)) || parseInt(actualScoreA, 10) < 0) {
      return res.status(400).json({ error: 'Score A must be a non-negative integer.' });
    }
  }
  if (actualScoreB !== null && actualScoreB !== undefined && actualScoreB !== '') {
    if (isNaN(parseInt(actualScoreB, 10)) || parseInt(actualScoreB, 10) < 0) {
      return res.status(400).json({ error: 'Score B must be a non-negative integer.' });
    }
  }

  try {
    const result = await updateMatchResult(id, actualScoreA, actualScoreB);
    res.json({ success: true, message: 'Match result updated successfully.', result });
  } catch (error) {
    console.error('Error updating match result:', error.message);
    res.status(500).json({ error: error.message || 'Failed to update match result.' });
  }
});

// Admin: Toggle manual lock of predictions for a match
app.post('/api/admin/matches/:id/lock', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { isLocked } = req.body;

  try {
    const result = await toggleMatchLock(id, isLocked);
    res.json({ success: true, message: `Match lock status updated successfully to ${isLocked ? 'locked' : 'unlocked'}.`, result });
  } catch (error) {
    console.error('Error toggling match lock:', error.message);
    res.status(500).json({ error: error.message || 'Failed to update match lock status.' });
  }
});

// Public/User: Get bracket prediction lock status
app.get('/api/user/bracket-lock-status', async (req, res) => {
  try {
    const locked = await getSetting('bracket_locked');
    res.json({ locked: locked === '1' });
  } catch (error) {
    console.error('Error fetching bracket lock status:', error.message);
    res.status(500).json({ error: 'Failed to retrieve bracket lock status.' });
  }
});

// Admin: Toggle global bracket prediction lock status
app.post('/api/admin/toggle-bracket-lock', authenticateAdmin, async (req, res) => {
  const { locked } = req.body;
  if (locked === undefined) {
    return res.status(400).json({ error: 'Field "locked" is required.' });
  }
  try {
    await saveSetting('bracket_locked', locked ? '1' : '0');
    res.json({ success: true, locked });
  } catch (error) {
    console.error('Error toggling bracket lock:', error.message);
    res.status(500).json({ error: 'Failed to toggle bracket lock status.' });
  }
});

// Admin: Save actual World Cup tournament outcomes (quarterfinalists, semifinalists, finalists, champion)
app.post('/api/admin/tournament-results', authenticateAdmin, async (req, res) => {
  const { champion, finalists, semifinalists, quarterfinalists } = req.body;
  if (champion === undefined || 
      !Array.isArray(finalists) || finalists.length !== 2 || 
      !Array.isArray(semifinalists) || semifinalists.length !== 4 ||
      !Array.isArray(quarterfinalists) || quarterfinalists.length !== 8) {
    return res.status(400).json({ error: 'Champion (string), exactly 2 finalists, exactly 4 semifinalists, and exactly 8 quarterfinalists arrays are required.' });
  }
  try {
    await saveTournamentResults(
      (champion || '').trim(), 
      finalists.map(f => (f || '').trim()), 
      semifinalists.map(s => (s || '').trim()),
      quarterfinalists.map(q => (q || '').trim())
    );
    res.json({ success: true, message: 'Tournament outcomes saved successfully!' });
  } catch (error) {
    console.error('Error saving tournament results:', error.message);
    res.status(500).json({ error: error.message || 'Failed to save tournament outcomes.' });
  }
});

// Admin: Clear actual World Cup tournament outcomes
app.delete('/api/admin/tournament-results', authenticateAdmin, async (req, res) => {
  try {
    await clearTournamentResults();
    res.json({ success: true, message: 'Tournament outcomes cleared successfully!' });
  } catch (error) {
    console.error('Error clearing tournament results:', error.message);
    res.status(500).json({ error: error.message || 'Failed to clear tournament outcomes.' });
  }
});

// Public/User: Get actual World Cup tournament outcomes
app.get('/api/user/tournament-results', async (req, res) => {
  try {
    const results = await getTournamentResults();
    res.json(results);
  } catch (error) {
    console.error('Error fetching tournament results:', error.message);
    res.status(500).json({ error: 'Failed to retrieve tournament outcomes.' });
  }
});

// Get User Profile & Predictions Details
app.get('/api/user/profile', authenticateUser, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User session expired or user not found.' });
    }
    const predictions = await getUserPredictions(req.user.id);
    const dailyPredictions = await getUserDailyPredictions(req.user.id);
    const tournamentResults = await getTournamentResults();
    res.json({
      user,
      predictions,
      dailyPredictions,
      tournamentResults
    });
  } catch (error) {
    console.error('Error fetching user profile:', error.message);
    res.status(500).json({ error: 'Failed to retrieve user profile information.' });
  }
});

// User: Submit Bracket Prediction
app.post('/api/user/predict-bracket', authenticateUser, async (req, res) => {
  const { prediction, winner } = req.body;
  if (!prediction || !winner) {
    return res.status(400).json({ error: 'Incomplete prediction details.' });
  }

  try {
    const predictionString = JSON.stringify(prediction);
    await saveBracketPrediction(req.user.id, predictionString, winner);
    res.json({ success: true, message: 'Tournament bracket prediction saved successfully!' });
  } catch (error) {
    console.error('Error saving bracket prediction:', error.message);
    res.status(400).json({ error: error.message || 'Failed to save bracket prediction.' });
  }
});

// User: Submit Direct Champion Selection
app.post('/api/user/predict-champion', authenticateUser, async (req, res) => {
  const { champion } = req.body;
  if (!champion) {
    return res.status(400).json({ error: 'Champion selection is required.' });
  }

  try {
    await saveDirectChampion(req.user.id, champion);
    res.json({ success: true, message: 'Champion selection saved successfully!' });
  } catch (error) {
    console.error('Error saving champion prediction:', error.message);
    res.status(400).json({ error: error.message || 'Failed to save champion prediction.' });
  }
});

// User: Submit Today's Match score prediction
app.post('/api/user/predict-daily', authenticateUser, async (req, res) => {
  const { teamA, teamB, scoreA, scoreB } = req.body;
  if (!teamA || !teamB || scoreA === '' || scoreB === '') {
    return res.status(400).json({ error: 'Both scores are required.' });
  }

  try {
    await saveDailyPrediction(req.user.id, teamA, teamB, scoreA, scoreB);
    res.json({ success: true, message: 'Today\'s match score prediction saved successfully!' });
  } catch (error) {
    console.error('Error saving daily prediction:', error.message);
    res.status(400).json({ error: error.message || 'Failed to save score prediction.' });
  }
});

// User: Fetch all scheduled matches with their predictions
app.get('/api/user/matches', authenticateUser, async (req, res) => {
  try {
    const matches = await getMatches(req.user.id);
    res.json(matches);
  } catch (error) {
    console.error('Error fetching matches:', error.message);
    res.status(500).json({ error: 'Failed to retrieve scheduled matches.' });
  }
});

// User: Submit Match Score Prediction
app.post('/api/user/predict-match', authenticateUser, async (req, res) => {
  const { matchId, scoreA, scoreB } = req.body;
  if (!matchId || scoreA === '' || scoreB === '') {
    return res.status(400).json({ error: 'Match ID and score predictions are required.' });
  }

  try {
    await saveMatchPrediction(req.user.id, matchId, scoreA, scoreB);
    res.json({ success: true, message: 'Match score prediction saved successfully!' });
  } catch (error) {
    console.error('Error saving match prediction:', error.message);
    res.status(400).json({ error: error.message || 'Failed to save score prediction.' });
  }
});

// Public: Fetch stats (DISABLED - Admin only)
app.get('/api/stats', async (req, res) => {
  res.status(403).json({ error: 'Forbidden: Access to global leaderboard is restricted to administrators.' });
});

// User: Fetch leaderboard stats (masked phone numbers for privacy)
app.get('/api/user/stats', async (req, res) => {
  try {
    const stats = await getStats();
    if (stats && stats.participants) {
      stats.participants = stats.participants.map(p => {
        const maskedPhone = p.phone ? p.phone.replace(/.(?=.{4})/g, '*') : '';
        return {
          ...p,
          phone: maskedPhone
        };
      });
    }
    res.json(stats);
  } catch (error) {
    console.error('Error fetching user stats:', error.message);
    res.status(500).json({ error: 'Failed to retrieve stats.' });
  }
});

// Admin: Fetch all participants (unmasked phone numbers!)
app.get('/api/admin/participants', authenticateAdmin, async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching admin stats:', error.message);
    res.status(500).json({ error: 'Failed to retrieve admin stats.' });
  }
});

// Admin: Delete a participant entry (deletes user account entirely)
app.delete('/api/admin/participants/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await deleteParticipant(id);
    res.json({ success: true, message: 'Participant deleted.', result });
  } catch (error) {
    console.error('Error deleting participant:', error.message);
    res.status(500).json({ error: 'Failed to delete participant.' });
  }
});

// Admin: Clear all participants
app.post('/api/admin/reset', authenticateAdmin, async (req, res) => {
  try {
    const result = await clearAllParticipants();
    res.json({ success: true, message: 'All prediction entries cleared.', result });
  } catch (error) {
    console.error('Error resetting database:', error.message);
    res.status(500).json({ error: 'Failed to reset database.' });
  }
});


// Initialize DB and start server
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`========================================`);
      console.log(`Admin Username: admin`);
      console.log(`Admin Password: ${ADMIN_PASSWORD}`);
      console.log(`========================================`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
