const fs = require('fs');
const path = require('path');

let dbType = 'sqlite';
let sqliteDb = null;
const jsonFilePath = path.join(__dirname, 'database.json');
const settingsFilePath = path.join(__dirname, 'settings.json');

let memoryDb = null;

async function loadDb() {
  if (memoryDb) return memoryDb;
  if (!fs.existsSync(jsonFilePath)) {
    memoryDb = {
      users: [],
      predictions: [],
      daily_predictions: [],
      matches: [],
      tournament_results: null,
      settings: { bracket_locked: '0' }
    };
    fs.writeFileSync(jsonFilePath, JSON.stringify(memoryDb, null, 2));
  } else {
    memoryDb = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
  }
  return memoryDb;
}

async function saveDb() {
  fs.writeFileSync(jsonFilePath, JSON.stringify(memoryDb, null, 2));
}


// Initialize database
function initDb() {
  return new Promise(async (resolve, reject) => {
    
    try {
      const sqlite3 = require('sqlite3').verbose();
      const dbPath = path.join(__dirname, 'database.sqlite');
      sqliteDb = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Failed to open SQLite database, falling back to JSON:', err.message);
          setupJsonDb();
          resolve();
        } else {
          console.log('Connected to SQLite database.');
          
          // Create tables sequentially
          sqliteDb.serialize(() => {
            // 1. Users table
            sqliteDb.run(`
              CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                user_type TEXT DEFAULT 'public',
                employee_code TEXT DEFAULT NULL,
                student_id TEXT DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )
            `, (usersErr) => {
              if (usersErr) {
                console.error('Error creating users table:', usersErr.message);
              }
              // Migration to add user_type, employee_code, student_id to users table if they are not already there
              sqliteDb.all(`PRAGMA table_info(users)`, (pragmaErr, columns) => {
                if (!pragmaErr && columns) {
                  const hasUserType = columns.some(col => col.name === 'user_type');
                  const hasEmployeeCode = columns.some(col => col.name === 'employee_code');
                  const hasStudentId = columns.some(col => col.name === 'student_id');
                  
                  if (!hasUserType) {
                    console.log('Migrating users table: adding user_type column...');
                    sqliteDb.run(`ALTER TABLE users ADD COLUMN user_type TEXT DEFAULT 'public'`);
                  }
                  if (!hasEmployeeCode) {
                    console.log('Migrating users table: adding employee_code column...');
                    sqliteDb.run(`ALTER TABLE users ADD COLUMN employee_code TEXT DEFAULT NULL`);
                  }
                  if (!hasStudentId) {
                    console.log('Migrating users table: adding student_id column...');
                    sqliteDb.run(`ALTER TABLE users ADD COLUMN student_id TEXT DEFAULT NULL`);
                  }
                }
              });
            });

            // 2. Predictions table (Bracket & Direct Champion Choice)
            sqliteDb.run(`
              CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL,
                prediction_json TEXT,
                winner TEXT,
                champion_only TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
              )
            `);

            // 3. Create matches table
            sqliteDb.run(`
              CREATE TABLE IF NOT EXISTS matches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                team_a TEXT NOT NULL,
                team_b TEXT NOT NULL,
                match_date TEXT NOT NULL,
                match_time TEXT NOT NULL,
                actual_score_a INTEGER DEFAULT NULL,
                actual_score_b INTEGER DEFAULT NULL,
                is_locked INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )
            `, (matchesErr) => {
              if (matchesErr) {
                console.error('Error creating matches table:', matchesErr.message);
              }
              
              // Run migrations for matches table to add actual_score and is_locked columns if they are not already there
              sqliteDb.all(`PRAGMA table_info(matches)`, (pragmaErr, columns) => {
                if (!pragmaErr && columns) {
                  const hasActualScoreA = columns.some(col => col.name === 'actual_score_a');
                  const hasIsLocked = columns.some(col => col.name === 'is_locked');
                  
                  const addIsLocked = (cb) => {
                    if (!hasIsLocked) {
                      console.log('Migrating matches table: adding is_locked column...');
                      sqliteDb.run(`ALTER TABLE matches ADD COLUMN is_locked INTEGER DEFAULT 0`, cb);
                    } else {
                      cb();
                    }
                  };

                  if (!hasActualScoreA) {
                    console.log('Migrating matches table: adding actual_score columns...');
                    sqliteDb.run(`ALTER TABLE matches ADD COLUMN actual_score_a INTEGER DEFAULT NULL`, () => {
                      sqliteDb.run(`ALTER TABLE matches ADD COLUMN actual_score_b INTEGER DEFAULT NULL`, () => {
                        addIsLocked(() => checkDailyPredictionsMigration());
                      });
                    });
                  } else {
                    addIsLocked(() => checkDailyPredictionsMigration());
                  }
                } else {
                  checkDailyPredictionsMigration();
                }
              });

              const checkDailyPredictionsMigration = () => {
                // Now check if daily_predictions has match_id. If not, recreate it.
                sqliteDb.all(`PRAGMA table_info(daily_predictions)`, (pragmaErr, columns) => {
                  const hasMatchId = columns && columns.some(col => col.name === 'match_id');
                  if (pragmaErr || (columns && columns.length > 0 && !hasMatchId)) {
                    console.log('Migrating daily_predictions table...');
                    sqliteDb.run(`DROP TABLE IF EXISTS daily_predictions`, () => {
                      createDailyPredictionsTable();
                    });
                  } else {
                    createDailyPredictionsTable();
                  }
                });
              };
            });

            const createDailyPredictionsTable = () => {
              sqliteDb.run(`
                CREATE TABLE IF NOT EXISTS daily_predictions (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  user_id INTEGER NOT NULL,
                  match_id INTEGER NOT NULL,
                  score_a INTEGER NOT NULL,
                  score_b INTEGER NOT NULL,
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
                  UNIQUE(user_id, match_id)
                )
              `, (dpErr) => {
                if (dpErr) {
                  console.error('Error creating daily_predictions table:', dpErr.message);
                }
                createTournamentResultsTable();
              });
            };

            const createTournamentResultsTable = () => {
              sqliteDb.run(`
                CREATE TABLE IF NOT EXISTS tournament_results (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  results_json TEXT,
                  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
              `, (trErr) => {
                if (trErr) {
                  console.error('Error creating tournament_results table:', trErr.message);
                }
                createSettingsTable();
              });
            };

            const createSettingsTable = () => {
              sqliteDb.run(`
                CREATE TABLE IF NOT EXISTS settings (
                  key TEXT PRIMARY KEY,
                  value TEXT
                )
              `, (setErr) => {
                if (setErr) {
                  console.error('Error creating settings table:', setErr.message);
                }
                // Seed bracket_locked default value if not exists
                sqliteDb.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('bracket_locked', '0')`, () => {
                  dbType = 'sqlite';
                  console.log('All SQLite tables initialized successfully.');
                  resolve();
                });
              });
            };
          });
        }
      });
    } catch (e) {
      console.warn('SQLite3 module not available. Falling back to JSON database storage.');
      setupJsonDb();
      resolve();
    }
  });
}

function setupJsonDb() {
  dbType = 'json';
  return new Promise(async (resolve, reject) => {
    try {
      await loadDb();
      console.log('JSON database initialized successfully via loadDb().');
      resolve();
    } catch (err) {
      console.error('Failed to initialize JSON database:', err.message);
      reject(err);
    }
  });
}

// Get Active Today's Match Settings (kept for compatibility, returns first upcoming match)
function getTodayMatch() {
  return new Promise(async (resolve, reject) => {
    getMatches()
      .then(list => {
        if (list && list.length > 0) {
          resolve({ teamA: list[0].team_a, teamB: list[0].team_b });
        } else {
          resolve({ teamA: 'Mexico', teamB: 'Canada' });
        }
      })
      .catch(err => {
        resolve({ teamA: 'Mexico', teamB: 'Canada' });
      });
  });
}

// Save/Update Today's Match Settings (kept for compatibility, schedules a match for today)
function saveTodayMatch(teamA, teamB) {
  const todayDate = new Date().toISOString().slice(0, 10);
  return addMatch(teamA, teamB, todayDate, '18:00');
}

// User Registration
function registerUser(name, phone, password, userType = 'public', employeeCode = null, studentId = null) {
  return new Promise(async (resolve, reject) => {
    if (!name || !phone || !password) {
      return reject(new Error('Name, Phone, and Password are required.'));
    }

    if (dbType === 'sqlite') {
      sqliteDb.run(
        `INSERT INTO users (name, phone, password, user_type, employee_code, student_id) VALUES (?, ?, ?, ?, ?, ?)`, 
        [name, phone, password, userType, employeeCode, studentId], 
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              reject(new Error('This phone number is already registered. Please login instead.'));
            } else {
              reject(err);
            }
          } else {
            resolve({ id: this.lastID, name, phone, user_type: userType, employee_code: employeeCode, student_id: studentId });
          }
        }
      );
    } else {
      try {
        const db = await loadDb();
        
        const exists = db.users.some(u => u.phone === phone);
        if (exists) {
          return reject(new Error('This phone number is already registered. Please login instead.'));
        }

        const newUser = {
          id: db.users.length + 1,
          name,
          phone,
          password,
          user_type: userType,
          employee_code: employeeCode,
          student_id: studentId,
          created_at: new Date().toISOString()
        };

        db.users.push(newUser);
        await saveDb();
        resolve({ id: newUser.id, name, phone, user_type: userType, employee_code: employeeCode, student_id: studentId });
      } catch (err) {
        reject(err);
      }
    }
  });
}

// User Login
function loginUser(phone, password) {
  return new Promise(async (resolve, reject) => {
    if (!phone || !password) {
      return reject(new Error('Phone number and password are required.'));
    }

    if (dbType === 'sqlite') {
      sqliteDb.get(`SELECT id, name, phone, password, user_type, employee_code, student_id FROM users WHERE phone = ?`, [phone], (err, row) => {
        if (err) return reject(err);
        if (!row || row.password !== password) {
          return reject(new Error('Invalid phone number or password.'));
        }
        resolve({ id: row.id, name: row.name, phone: row.phone, user_type: row.user_type, employee_code: row.employee_code, student_id: row.student_id });
      });
    } else {
      try {
        const db = await loadDb();
        const user = db.users.find(u => u.phone === phone && u.password === password);
        
        if (!user) {
          return reject(new Error('Invalid phone number or password.'));
        }
        resolve({ id: user.id, name: user.name, phone: user.phone, user_type: user.user_type || 'public', employee_code: user.employee_code || null, student_id: user.student_id || null });
      } catch (err) {
        reject(err);
      }
    }
  });
}

// Fetch all predictions for a logged-in user
function getUserPredictions(userId) {
  return new Promise(async (resolve, reject) => {
    if (dbType === 'sqlite') {
      sqliteDb.get(`SELECT prediction_json, winner, champion_only FROM predictions WHERE user_id = ?`, [userId], (err, row) => {
        if (err) return reject(err);
        resolve(row || { prediction_json: null, winner: null, champion_only: null });
      });
    } else {
      try {
        const db = await loadDb();
        const pred = db.predictions.find(p => p.user_id === parseInt(userId, 10));
        resolve(pred || { prediction_json: null, winner: null, champion_only: null });
      } catch (err) {
        reject(err);
      }
    }
  });
}

// Fetch user daily score predictions
function getUserDailyPredictions(userId) {
  return new Promise(async (resolve, reject) => {
    if (dbType === 'sqlite') {
      sqliteDb.all(`
        SELECT 
          dp.id, dp.match_id,
          m.team_a AS match_team_a, m.team_b AS match_team_b, 
          dp.score_a, dp.score_b, dp.created_at,
          m.actual_score_a, m.actual_score_b
        FROM daily_predictions dp
        JOIN matches m ON dp.match_id = m.id
        WHERE dp.user_id = ? 
        ORDER BY dp.created_at DESC
      `, [userId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    } else {
      try {
        const db = await loadDb();
        const preds = (db.daily_predictions || []).filter(dp => dp.user_id === parseInt(userId, 10));
        const matches = db.matches || [];
        
        const result = preds.map(dp => {
          const match = matches.find(m => m.id === dp.match_id) || { team_a: 'Unknown', team_b: 'Unknown' };
          return {
            id: dp.id,
            match_id: dp.match_id,
            match_team_a: match.team_a,
            match_team_b: match.team_b,
            score_a: dp.score_a,
            score_b: dp.score_b,
            created_at: dp.created_at,
            actual_score_a: match.actual_score_a !== undefined ? match.actual_score_a : null,
            actual_score_b: match.actual_score_b !== undefined ? match.actual_score_b : null
          };
        });
        
        resolve(result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      } catch (err) {
        reject(err);
      }
    }
  });
}

// Save Bracket Prediction
function saveBracketPrediction(userId, predictionJson, winner) {
  return new Promise(async (resolve, reject) => {
    if (!userId || !predictionJson || !winner) {
      return reject(new Error('Missing required bracket parameters.'));
    }

    getSetting('bracket_locked')
      .then(async (locked) => {
        if (locked === '1') {
          return reject(new Error('Bracket predictions are locked. You cannot submit or modify predictions.'));
        }

        if (dbType === 'sqlite') {
          sqliteDb.run(`
            INSERT INTO predictions (user_id, prediction_json, winner) 
            VALUES (?, ?, ?) 
            ON CONFLICT(user_id) DO UPDATE SET prediction_json = ?, winner = ?
          `, [userId, predictionJson, winner, predictionJson, winner], function(err) {
            if (err) return reject(err);
            resolve({ success: true });
          });
        } else {
          try {
            const db = await loadDb();
            
            const existing = db.predictions.find(p => p.user_id === parseInt(userId, 10));
            if (existing) {
              existing.prediction_json = predictionJson;
              existing.winner = winner;
            } else {
              db.predictions.push({
                id: db.predictions.length + 1,
                user_id: parseInt(userId, 10),
                prediction_json: predictionJson,
                winner: winner,
                champion_only: null,
                created_at: new Date().toISOString()
              });
            }

            await saveDb();
            resolve({ success: true });
          } catch (err) {
            reject(err);
          }
        }
      })
      .catch(reject);
  });
}

// Save Direct Champion Selection (48 teams choice)
function saveDirectChampion(userId, champion) {
  return new Promise(async (resolve, reject) => {
    if (!userId || !champion) {
      return reject(new Error('Champion selection is required.'));
    }

    if (dbType === 'sqlite') {
      sqliteDb.get(`SELECT 1 FROM predictions WHERE user_id = ? AND champion_only IS NOT NULL`, [userId], (checkErr, row) => {
        if (checkErr) return reject(checkErr);
        if (row) return reject(new Error('You have already predicted a World Cup champion. Only one entry is allowed.'));

        sqliteDb.run(`
          INSERT INTO predictions (user_id, champion_only) 
          VALUES (?, ?) 
          ON CONFLICT(user_id) DO UPDATE SET champion_only = ?
        `, [userId, champion, champion], function(err) {
          if (err) return reject(err);
          resolve({ success: true });
        });
      });
    } else {
      try {
        const db = await loadDb();
        
        const existing = db.predictions.find(p => p.user_id === parseInt(userId, 10));
        if (existing && existing.champion_only) {
          return reject(new Error('You have already predicted a World Cup champion. Only one entry is allowed.'));
        }

        if (existing) {
          existing.champion_only = champion;
        } else {
          db.predictions.push({
            id: db.predictions.length + 1,
            user_id: parseInt(userId, 10),
            prediction_json: null,
            winner: null,
            champion_only: champion,
            created_at: new Date().toISOString()
          });
        }

        await saveDb();
        resolve({ success: true });
      } catch (err) {
        reject(err);
      }
    }
  });
}

// Save Today's Score Prediction (compatibility wrapper, links to first matching scheduled game)
function saveDailyPrediction(userId, teamA, teamB, scoreA, scoreB) {
  return new Promise(async (resolve, reject) => {
    getMatches()
      .then(list => {
        const match = list.find(m => m.team_a === teamA && m.team_b === teamB);
        if (match) {
          saveMatchPrediction(userId, match.id, scoreA, scoreB)
            .then(resolve)
            .catch(reject);
        } else {
          // If no scheduled match, dynamically schedule it and save prediction
          const todayDate = new Date().toISOString().slice(0, 10);
          addMatch(teamA, teamB, todayDate, '18:00')
            .then(newM => {
              saveMatchPrediction(userId, newM.id, scoreA, scoreB)
                .then(resolve)
                .catch(reject);
            })
            .catch(reject);
        }
      })
      .catch(reject);
  });
}

// Add Scheduled Match
function addMatch(teamA, teamB, date, time) {
  return new Promise(async (resolve, reject) => {
    if (!teamA || !teamB || !date || !time) {
      return reject(new Error('All match details are required.'));
    }
    if (teamA === teamB) {
      return reject(new Error('Team A and Team B must be different.'));
    }

    if (dbType === 'sqlite') {
      sqliteDb.run(`INSERT INTO matches (team_a, team_b, match_date, match_time) VALUES (?, ?, ?, ?)`, [teamA, teamB, date, time], function(err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, team_a: teamA, team_b: teamB, match_date: date, match_time: time });
      });
    } else {
      try {
        const db = await loadDb();
        db.matches = db.matches || [];
        const newMatch = {
          id: db.matches.length + 1,
          team_a: teamA,
          team_b: teamB,
          match_date: date,
          match_time: time,
          created_at: new Date().toISOString()
        };
        db.matches.push(newMatch);
        await saveDb();
        resolve(newMatch);
      } catch (err) {
        reject(err);
      }
    }
  });
}

// Delete Scheduled Match
function deleteMatch(matchId) {
  return new Promise(async (resolve, reject) => {
    const id = parseInt(matchId, 10);
    if (isNaN(id)) return reject(new Error('Invalid match ID.'));

    if (dbType === 'sqlite') {
      sqliteDb.run(`DELETE FROM matches WHERE id = ?`, [id], function(err) {
        if (err) return reject(err);
        sqliteDb.run(`DELETE FROM daily_predictions WHERE match_id = ?`, [id], (delErr) => {
          if (delErr) console.error('Error cleaning up daily predictions:', delErr);
          resolve({ changes: this.changes });
        });
      });
    } else {
      try {
        const db = await loadDb();
        db.matches = (db.matches || []).filter(m => m.id !== id);
        db.daily_predictions = (db.daily_predictions || []).filter(dp => dp.match_id !== id);
        await saveDb();
        resolve({ changes: 1 });
      } catch (err) {
        reject(err);
      }
    }
  });
}

// Get Scheduled Matches with predictions status
function getMatches(userId = null) {
  return new Promise(async (resolve, reject) => {
    if (dbType === 'sqlite') {
      if (userId) {
        sqliteDb.all(`
          SELECT 
            m.id, m.team_a, m.team_b, m.match_date, m.match_time, 
            m.actual_score_a, m.actual_score_b, m.is_locked,
            dp.score_a, dp.score_b
          FROM matches m
          LEFT JOIN daily_predictions dp ON m.id = dp.match_id AND dp.user_id = ?
          ORDER BY m.match_date DESC, m.match_time DESC
        `, [userId], (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      } else {
        sqliteDb.all(`
          SELECT id, team_a, team_b, match_date, match_time, actual_score_a, actual_score_b, is_locked
          FROM matches 
          ORDER BY match_date DESC, match_time DESC
        `, [], (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      }
    } else {
      try {
        const db = await loadDb();
        const matches = db.matches || [];
        const uId = userId ? parseInt(userId, 10) : null;
        
        const result = matches.map(m => {
          const pred = uId ? (db.daily_predictions || []).find(dp => dp.user_id === uId && dp.match_id === m.id) : null;
          return {
            id: m.id,
            team_a: m.team_a,
            team_b: m.team_b,
            match_date: m.match_date,
            match_time: m.match_time,
            score_a: pred ? pred.score_a : null,
            score_b: pred ? pred.score_b : null,
            actual_score_a: m.actual_score_a !== undefined ? m.actual_score_a : null,
            actual_score_b: m.actual_score_b !== undefined ? m.actual_score_b : null,
            is_locked: m.is_locked || 0
          };
        });
        
        resolve(result.sort((a, b) => b.match_date.localeCompare(a.match_date) || b.match_time.localeCompare(a.match_time)));
      } catch (err) {
        reject(err);
      }
    }
  });
}

// Save Score Prediction for a Match
function saveMatchPrediction(userId, matchId, scoreA, scoreB) {
  return new Promise(async (resolve, reject) => {
    if (!userId || !matchId || scoreA === '' || scoreB === '') {
      return reject(new Error('Missing required score fields.'));
    }

    const sA = parseInt(scoreA, 10);
    const sB = parseInt(scoreB, 10);
    const mId = parseInt(matchId, 10);

    if (dbType === 'sqlite') {
      sqliteDb.get(`SELECT actual_score_a, actual_score_b, is_locked, match_date, match_time FROM matches WHERE id = ?`, [mId], (err, match) => {
        if (err) return reject(err);
        if (!match) return reject(new Error('Match not found.'));
        
        // 1. Result Entered Lock
        if (match.actual_score_a !== null && match.actual_score_b !== null) {
          return reject(new Error('Predictions are closed because the final match result has already been entered.'));
        }
        
        // 2. Admin Manual Lock
        if (match.is_locked === 1) {
          return reject(new Error('Predictions are locked for this match.'));
        }

        // 3. Time Lock (5 minutes before match start in IST timezone)
        if (match.match_date && match.match_time) {
          const matchStartTime = new Date(`${match.match_date}T${match.match_time}:00+05:30`).getTime();
          if (!isNaN(matchStartTime)) {
            const cutoffTime = matchStartTime - (5 * 60 * 1000);
            if (Date.now() >= cutoffTime) {
              return reject(new Error('Predictions are closed. You cannot submit predictions within 5 minutes of the match start time.'));
            }
          }
        }

        sqliteDb.run(`
          INSERT INTO daily_predictions (user_id, match_id, score_a, score_b) 
          VALUES (?, ?, ?, ?)
        `, [userId, mId, sA, sB], function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              reject(new Error("You have already submitted a score prediction for this match."));
            } else {
              reject(err);
            }
          } else {
            resolve({ success: true });
          }
        });
      });
    } else {
      try {
        const db = await loadDb();
        
        const match = (db.matches || []).find(m => m.id === mId);
        if (!match) return reject(new Error('Match not found.'));
        
        // 1. Result Entered Lock
        if (match.actual_score_a !== undefined && match.actual_score_a !== null && match.actual_score_b !== undefined && match.actual_score_b !== null) {
          return reject(new Error('Predictions are closed because the final match result has already been entered.'));
        }

        // 2. Admin Manual Lock
        if (match.is_locked === 1) {
          return reject(new Error('Predictions are locked for this match.'));
        }

        // 3. Time Lock (5 minutes before match start in IST timezone)
        if (match.match_date && match.match_time) {
          const matchStartTime = new Date(`${match.match_date}T${match.match_time}:00+05:30`).getTime();
          if (!isNaN(matchStartTime)) {
            const cutoffTime = matchStartTime - (5 * 60 * 1000);
            if (Date.now() >= cutoffTime) {
              return reject(new Error('Predictions are closed. You cannot submit predictions within 5 minutes of the match start time.'));
            }
          }
        }

        const exists = (db.daily_predictions || []).some(dp => dp.user_id === parseInt(userId, 10) && dp.match_id === mId);
        if (exists) {
          return reject(new Error("You have already submitted a score prediction for this match."));
        }

        db.daily_predictions = db.daily_predictions || [];
        db.daily_predictions.push({
          id: db.daily_predictions.length + 1,
          user_id: parseInt(userId, 10),
          match_id: mId,
          score_a: sA,
          score_b: sB,
          created_at: new Date().toISOString()
        });

        await saveDb();
        resolve({ success: true });
      } catch (err) {
        reject(err);
      }
    }
  });
}

// Get statistics for the dashboard
function getStats() {
  return new Promise(async (resolve, reject) => {
    if (dbType === 'sqlite') {
      sqliteDb.all(`
        SELECT 
          u.id, u.name, u.phone, u.user_type, u.employee_code, u.student_id, p.winner, p.prediction_json, p.champion_only, u.created_at 
        FROM users u 
        LEFT JOIN predictions p ON u.id = p.user_id 
        ORDER BY u.created_at DESC
      `, [], (err, participants) => {
        if (err) return reject(err);

        sqliteDb.all(`
          SELECT winner, COUNT(*) as count 
          FROM predictions 
          WHERE winner IS NOT NULL 
          GROUP BY winner 
          ORDER BY count DESC
        `, [], (statsErr, winnerStats) => {
          if (statsErr) return reject(statsErr);

          sqliteDb.all(`
            SELECT champion_only, COUNT(*) as count 
            FROM predictions 
            WHERE champion_only IS NOT NULL 
            GROUP BY champion_only 
            ORDER BY count DESC
          `, [], (championOnlyErr, championOnlyStats) => {
            if (championOnlyErr) return reject(championOnlyErr);

            sqliteDb.all(`
              SELECT 
                dp.user_id, dp.match_id, m.team_a, m.team_b, dp.score_a, dp.score_b
              FROM daily_predictions dp
              JOIN matches m ON dp.match_id = m.id
            `, [], (dailyErr, dailyRows) => {
              if (dailyErr) return reject(dailyErr);

              sqliteDb.all(`
                SELECT 
                  m.id, m.team_a, m.team_b, m.match_date, m.match_time, m.actual_score_a, m.actual_score_b,
                  COUNT(dp.id) as prediction_count
                FROM matches m
                LEFT JOIN daily_predictions dp ON m.id = dp.match_id
                GROUP BY m.id
                ORDER BY m.match_date ASC, m.match_time ASC
              `, [], (matchesErr, matchesList) => {
                if (matchesErr) return reject(matchesErr);

                const mappedParticipants = participants.map(p => {
                  const userDaily = dailyRows.filter(dr => dr.user_id === p.id);
                  return {
                    ...p,
                    daily_predictions: userDaily
                  };
                });

                getTournamentResults()
                  .then(tr => {
                    resolve({
                      dbType,
                      totalParticipants: participants.length,
                      participants: mappedParticipants,
                      winnerStats,
                      championOnlyStats,
                      matches: matchesList,
                      tournamentResults: tr
                    });
                  })
                  .catch(() => {
                    resolve({
                      dbType,
                      totalParticipants: participants.length,
                      participants: mappedParticipants,
                      winnerStats,
                      championOnlyStats,
                      matches: matchesList,
                      tournamentResults: null
                    });
                  });
              });
            });
          });
        });
      });
    } else {
      try {
        const db = await loadDb();
        const matches = db.matches || [];
        const dailyPreds = db.daily_predictions || [];
        const predictions = db.predictions || [];
        
        const counts = {};
        const championOnlyCounts = {};
        
        const mappedParticipants = db.users.map(u => {
          const pred = predictions.find(p => p.user_id === u.id) || {};
          const userDaily = dailyPreds
            .filter(dp => dp.user_id === u.id)
            .map(dp => {
              const match = matches.find(m => m.id === dp.match_id) || { team_a: 'Unknown', team_b: 'Unknown' };
              return {
                user_id: u.id,
                match_id: dp.match_id,
                team_a: match.team_a,
                team_b: match.team_b,
                score_a: dp.score_a,
                score_b: dp.score_b
              };
            });

          if (pred.winner) {
            counts[pred.winner] = (counts[pred.winner] || 0) + 1;
          }
          if (pred.champion_only) {
            championOnlyCounts[pred.champion_only] = (championOnlyCounts[pred.champion_only] || 0) + 1;
          }

          return {
            id: u.id,
            name: u.name,
            phone: u.phone,
            user_type: u.user_type || 'public',
            employee_code: u.employee_code || null,
            student_id: u.student_id || null,
            winner: pred.winner || null,
            prediction_json: pred.prediction_json || null,
            champion_only: pred.champion_only || null,
            created_at: u.created_at,
            daily_predictions: userDaily
          };
        });

        const winnerStats = Object.keys(counts).map(winner => ({
          winner,
          count: counts[winner]
        })).sort((a, b) => b.count - a.count);

        const championOnlyStats = Object.keys(championOnlyCounts).map(champion_only => ({
          champion_only,
          count: championOnlyCounts[champion_only]
        })).sort((a, b) => b.count - a.count);

        const matchesList = matches.map(m => {
          const count = dailyPreds.filter(dp => dp.match_id === m.id).length;
          return {
            id: m.id,
            team_a: m.team_a,
            team_b: m.team_b,
            match_date: m.match_date,
            match_time: m.match_time,
            actual_score_a: m.actual_score_a !== undefined ? m.actual_score_a : null,
            actual_score_b: m.actual_score_b !== undefined ? m.actual_score_b : null,
            prediction_count: count
          };
        }).sort((a, b) => a.match_date.localeCompare(b.match_date) || a.match_time.localeCompare(b.match_time));

        resolve({
          dbType,
          totalParticipants: db.users.length,
          participants: mappedParticipants.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
          winnerStats,
          championOnlyStats,
          matches: matchesList,
          tournamentResults: db.tournament_results || null
        });
      } catch (err) {
        reject(err);
      }
    }
  });
}

// Check if phone number exists (kept for registration validation)
function checkPhoneExists(phone) {
  return new Promise(async (resolve, reject) => {
    if (dbType === 'sqlite') {
      sqliteDb.get(`SELECT 1 FROM users WHERE phone = ?`, [phone], (err, row) => {
        if (err) return reject(err);
        resolve(!!row);
      });
    } else {
      try {
        const db = await loadDb();
        const exists = db.users.some(u => u.phone === phone);
        resolve(exists);
      } catch (err) {
        reject(err);
      }
    }
  });
}

// Delete a participant prediction (deletes user account entirely)
function deleteParticipant(id) {
  return new Promise(async (resolve, reject) => {
    if (dbType === 'sqlite') {
      sqliteDb.run(`DELETE FROM users WHERE id = ?`, [id], function(err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    } else {
      try {
        const db = await loadDb();
        const userIdInt = parseInt(id, 10);
        
        db.users = db.users.filter(u => u.id !== userIdInt);
        db.predictions = db.predictions.filter(p => p.user_id !== userIdInt);
        db.daily_predictions = db.daily_predictions.filter(dp => dp.user_id !== userIdInt);
        
        await saveDb();
        resolve({ changes: 1 });
      } catch (err) {
        reject(err);
      }
    }
  });
}

// Clear all participant logs (keeps settings, resets user schema)
function clearAllParticipants() {
  return new Promise(async (resolve, reject) => {
    if (dbType === 'sqlite') {
      sqliteDb.serialize(() => {
        sqliteDb.run(`DELETE FROM daily_predictions`);
        sqliteDb.run(`DELETE FROM predictions`);
        sqliteDb.run(`DELETE FROM users`, [], function(err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        });
      });
    } else {
      try {
        const db = await loadDb();
        db.users = [];
        db.predictions = [];
        db.daily_predictions = [];
        await saveDb();
        resolve({ changes: 'all' });
      } catch (err) {
        reject(err);
      }
    }
  });
}

function getUserById(userId) {
  return new Promise(async (resolve, reject) => {
    if (dbType === 'sqlite') {
      sqliteDb.get(`SELECT id, name, phone, user_type, employee_code, student_id FROM users WHERE id = ?`, [userId], (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    } else {
      try {
        const db = await loadDb();
        const user = db.users.find(u => u.id === parseInt(userId, 10));
        if (user) {
          resolve({ id: user.id, name: user.name, phone: user.phone, user_type: user.user_type || 'public', employee_code: user.employee_code || null, student_id: user.student_id || null });
        } else {
          resolve(null);
        }
      } catch (err) {
        reject(err);
      }
    }
  });
}

module.exports = {
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
};

function updateMatchResult(matchId, actualScoreA, actualScoreB) {
  return new Promise(async (resolve, reject) => {
    const id = parseInt(matchId, 10);
    const scoreA = (actualScoreA === null || actualScoreA === '') ? null : parseInt(actualScoreA, 10);
    const scoreB = (actualScoreB === null || actualScoreB === '') ? null : parseInt(actualScoreB, 10);

    if (dbType === 'sqlite') {
      sqliteDb.run(`
        UPDATE matches 
        SET actual_score_a = ?, actual_score_b = ? 
        WHERE id = ?
      `, [scoreA, scoreB, id], function(err) {
        if (err) return reject(err);
        resolve({ success: true, changes: this.changes });
      });
    } else {
      try {
        const db = await loadDb();
        const match = (db.matches || []).find(m => m.id === id);
        if (match) {
          match.actual_score_a = scoreA;
          match.actual_score_b = scoreB;
          await saveDb();
          resolve({ success: true });
        } else {
          reject(new Error('Match not found.'));
        }
      } catch (err) {
        reject(err);
      }
    }
  });
}

function toggleMatchLock(matchId, isLocked) {
  return new Promise(async (resolve, reject) => {
    const id = parseInt(matchId, 10);
    const lockedVal = isLocked ? 1 : 0;

    if (dbType === 'sqlite') {
      sqliteDb.run(`
        UPDATE matches 
        SET is_locked = ? 
        WHERE id = ?
      `, [lockedVal, id], function(err) {
        if (err) return reject(err);
        resolve({ success: true, changes: this.changes });
      });
    } else {
      try {
        const db = await loadDb();
        const match = (db.matches || []).find(m => m.id === id);
        if (match) {
          match.is_locked = lockedVal;
          await saveDb();
          resolve({ success: true });
        } else {
          reject(new Error('Match not found.'));
        }
      } catch (err) {
        reject(err);
      }
    }
  });
}

function getTournamentResults() {
  return new Promise(async (resolve, reject) => {
    if (dbType === 'sqlite') {
      sqliteDb.get(`SELECT results_json FROM tournament_results ORDER BY id DESC LIMIT 1`, [], (err, row) => {
        if (err) return reject(err);
        if (row && row.results_json) {
          try {
            resolve(JSON.parse(row.results_json));
          } catch (e) {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    } else {
      try {
        const db = await loadDb();
        resolve(db.tournament_results || null);
      } catch (err) {
        reject(err);
      }
    }
  });
}

function saveTournamentResults(champion, finalists, semifinalists, quarterfinalists) {
  return new Promise(async (resolve, reject) => {
    const resultsObj = { champion, finalists, semifinalists, quarterfinalists };
    const resultsJson = JSON.stringify(resultsObj);

    if (dbType === 'sqlite') {
      sqliteDb.run(`INSERT INTO tournament_results (results_json) VALUES (?)`, [resultsJson], function(err) {
        if (err) return reject(err);
        resolve({ success: true });
      });
    } else {
      try {
        const db = await loadDb();
        db.tournament_results = resultsObj;
        await saveDb();
        resolve({ success: true });
      } catch (err) {
        reject(err);
      }
    }
  });
}

function clearTournamentResults() {
  return new Promise(async (resolve, reject) => {
    if (dbType === 'sqlite') {
      sqliteDb.run(`DELETE FROM tournament_results`, [], function(err) {
        if (err) return reject(err);
        resolve({ success: true, changes: this.changes });
      });
    } else {
      try {
        const db = await loadDb();
        db.tournament_results = null;
        await saveDb();
        resolve({ success: true });
      } catch (err) {
        reject(err);
      }
    }
  });
}

function getSetting(key) {
  return new Promise(async (resolve, reject) => {
    if (dbType === 'sqlite') {
      sqliteDb.get(`SELECT value FROM settings WHERE key = ?`, [key], (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.value : null);
      });
    } else {
      try {
        const db = await loadDb();
        db.settings = db.settings || {};
        resolve(db.settings[key] || null);
      } catch (e) {
        resolve(null);
      }
    }
  });
}

function saveSetting(key, value) {
  return new Promise(async (resolve, reject) => {
    if (dbType === 'sqlite') {
      sqliteDb.run(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = ?
      `, [key, value, value], function(err) {
        if (err) return reject(err);
        resolve({ success: true });
      });
    } else {
      try {
        const db = await loadDb();
        db.settings = db.settings || {};
        db.settings[key] = value;
        await saveDb();
        resolve({ success: true });
      } catch (err) {
        reject(err);
      }
    }
  });
}


