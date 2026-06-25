const fs = require('fs');
const path = require('path');

let dbType = 'sqlite';
let sqliteDb = null;
let pgPool = null;
let firestore = null;
const jsonFilePath = path.join(__dirname, 'database.json');
const settingsFilePath = path.join(__dirname, 'settings.json');

// Check if PostgreSQL is configured (e.g. on Render)
const isPostgres = !!process.env.DATABASE_URL;

// Check if running in a Firebase Environment (Functions or Emulator)
const isFirebase = !isPostgres && !!(process.env.FIREBASE_CONFIG || process.env.FUNCTIONS_EMULATOR || process.env.USE_FIRESTORE);

if (isPostgres) {
  dbType = 'postgres';
  try {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    console.log('PostgreSQL Pool initialized.');
  } catch (err) {
    console.error('Failed to initialize PostgreSQL pool:', err.message);
  }
} else if (isFirebase) {
  dbType = 'json'; // Force JSON logic for Firestore
  try {
    const admin = require('firebase-admin');
    if (admin.apps.length === 0) {
      admin.initializeApp();
    }
    firestore = admin.firestore();
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK in database.js:', err.message);
  }
}

let memoryDb = null;

async function loadDb() {
  if (memoryDb) return memoryDb;

  if (isFirebase && firestore) {
    try {
      const doc = await firestore.collection('predictions_db').doc('worldcup').get();
      if (doc.exists) {
        memoryDb = doc.data();
      } else {
        memoryDb = {
          users: [],
          predictions: [],
          daily_predictions: [],
          matches: [],
          tournament_results: null,
          settings: { bracket_locked: '0' }
        };
        await firestore.collection('predictions_db').doc('worldcup').set(memoryDb);
      }
      return memoryDb;
    } catch (err) {
      console.error('Error loading DB from Firestore, falling back to local file:', err.message);
    }
  }

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
  if (isFirebase && firestore) {
    try {
      await firestore.collection('predictions_db').doc('worldcup').set(memoryDb);
      return;
    } catch (err) {
      console.error('Error saving DB to Firestore, falling back to local file:', err.message);
    }
  }

  fs.writeFileSync(jsonFilePath, JSON.stringify(memoryDb, null, 2));
}

// Helper to convert SQLite syntax (? placeholders) to PostgreSQL ($1, $2, $3...)
function convertSqlForPg(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

function queryAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (dbType === 'postgres') {
      const pgSql = convertSqlForPg(sql);
      pgPool.query(pgSql, params, (err, res) => {
        if (err) return reject(err);
        resolve(res.rows || []);
      });
    } else {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    }
  });
}

function queryRow(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (dbType === 'postgres') {
      const pgSql = convertSqlForPg(sql);
      pgPool.query(pgSql, params, (err, res) => {
        if (err) return reject(err);
        resolve(res.rows[0] || null);
      });
    } else {
      sqliteDb.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    }
  });
}

function runCommand(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (dbType === 'postgres') {
      const pgSql = convertSqlForPg(sql);
      pgPool.query(pgSql, params, (err, res) => {
        if (err) return reject(err);
        resolve({ changes: res.rowCount });
      });
    } else {
      sqliteDb.run(sql, params, function(err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    }
  });
}

// Initialize database
function initDb() {
  if (dbType === 'json') {
    return setupJsonDb();
  }
  
  if (dbType === 'postgres') {
    return new Promise(async (resolve, reject) => {
      try {
        // Initialize tables sequentially/together in PostgreSQL
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            phone VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            user_type VARCHAR(50) DEFAULT 'public',
            employee_code VARCHAR(255) DEFAULT NULL,
            student_id VARCHAR(255) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS predictions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            prediction_json TEXT,
            winner VARCHAR(255),
            champion_only VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS matches (
            id SERIAL PRIMARY KEY,
            team_a VARCHAR(255) NOT NULL,
            team_b VARCHAR(255) NOT NULL,
            match_date VARCHAR(255) NOT NULL,
            match_time VARCHAR(255) NOT NULL,
            actual_score_a INTEGER DEFAULT NULL,
            actual_score_b INTEGER DEFAULT NULL,
            is_locked INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS daily_predictions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
            score_a INTEGER NOT NULL,
            score_b INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, match_id)
          );
        `);

        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS tournament_results (
            id SERIAL PRIMARY KEY,
            results_json TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS settings (
            key VARCHAR(255) PRIMARY KEY,
            value TEXT
          );
        `);

        await pgPool.query(`
          INSERT INTO settings (key, value) VALUES ('bracket_locked', '0') ON CONFLICT (key) DO NOTHING;
        `);

        console.log('All PostgreSQL tables initialized successfully.');
        resolve();
      } catch (err) {
        console.error('Failed to initialize PostgreSQL database:', err.message);
        reject(err);
      }
    });
  }

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

    if (dbType === 'postgres') {
      pgPool.query(
        `INSERT INTO users (name, phone, password, user_type, employee_code, student_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [name, phone, password, userType, employeeCode, studentId],
        (err, res) => {
          if (err) {
            if (err.message.includes('unique constraint') || err.message.includes('UNIQUE') || err.message.includes('duplicate key')) {
              reject(new Error('This phone number is already registered. Please login instead.'));
            } else {
              reject(err);
            }
          } else {
            resolve({ id: res.rows[0].id, name, phone, user_type: userType, employee_code: employeeCode, student_id: studentId });
          }
        }
      );
    } else if (dbType === 'sqlite') {
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

    if (dbType === 'json') {
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
    } else {
      queryRow(`SELECT id, name, phone, password, user_type, employee_code, student_id FROM users WHERE phone = ?`, [phone])
        .then(row => {
          if (!row || row.password !== password) {
            return reject(new Error('Invalid phone number or password.'));
          }
          resolve({ id: row.id, name: row.name, phone: row.phone, user_type: row.user_type, employee_code: row.employee_code, student_id: row.student_id });
        })
        .catch(reject);
    }
  });
}

// Fetch all predictions for a logged-in user
function getUserPredictions(userId) {
  return new Promise(async (resolve, reject) => {
    if (dbType === 'json') {
      try {
        const db = await loadDb();
        const pred = db.predictions.find(p => p.user_id === parseInt(userId, 10));
        resolve(pred || { prediction_json: null, winner: null, champion_only: null });
      } catch (err) {
        reject(err);
      }
    } else {
      queryRow(`SELECT prediction_json, winner, champion_only FROM predictions WHERE user_id = ?`, [userId])
        .then(row => resolve(row || { prediction_json: null, winner: null, champion_only: null }))
        .catch(reject);
    }
  });
}

// Fetch user daily score predictions
function getUserDailyPredictions(userId) {
  return new Promise(async (resolve, reject) => {
    if (dbType === 'json') {
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
    } else {
      queryAll(`
        SELECT 
          dp.id, dp.match_id,
          m.team_a AS match_team_a, m.team_b AS match_team_b, 
          dp.score_a, dp.score_b, dp.created_at,
          m.actual_score_a, m.actual_score_b
        FROM daily_predictions dp
        JOIN matches m ON dp.match_id = m.id
        WHERE dp.user_id = ? 
        ORDER BY dp.created_at DESC
      `, [userId])
        .then(resolve)
        .catch(reject);
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

        if (dbType === 'json') {
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
        } else {
          runCommand(`
            INSERT INTO predictions (user_id, prediction_json, winner) 
            VALUES (?, ?, ?) 
            ON CONFLICT(user_id) DO UPDATE SET prediction_json = EXCLUDED.prediction_json, winner = EXCLUDED.winner
          `, [userId, predictionJson, winner])
            .then(() => resolve({ success: true }))
            .catch(reject);
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

    if (dbType === 'json') {
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
    } else {
      queryRow(`SELECT 1 FROM predictions WHERE user_id = ? AND champion_only IS NOT NULL`, [userId])
        .then(row => {
          if (row) return reject(new Error('You have already predicted a World Cup champion. Only one entry is allowed.'));

          runCommand(`
            INSERT INTO predictions (user_id, champion_only) 
            VALUES (?, ?) 
            ON CONFLICT(user_id) DO UPDATE SET champion_only = EXCLUDED.champion_only
          `, [userId, champion])
            .then(() => resolve({ success: true }))
            .catch(reject);
        })
        .catch(reject);
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

    if (dbType === 'postgres') {
      pgPool.query(
        `INSERT INTO matches (team_a, team_b, match_date, match_time) VALUES ($1, $2, $3, $4) RETURNING id`,
        [teamA, teamB, date, time],
        (err, res) => {
          if (err) return reject(err);
          resolve({ id: res.rows[0].id, team_a: teamA, team_b: teamB, match_date: date, match_time: time });
        }
      );
    } else if (dbType === 'sqlite') {
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

    if (dbType === 'json') {
      try {
        const db = await loadDb();
        db.matches = (db.matches || []).filter(m => m.id !== id);
        db.daily_predictions = (db.daily_predictions || []).filter(dp => dp.match_id !== id);
        await saveDb();
        resolve({ changes: 1 });
      } catch (err) {
        reject(err);
      }
    } else {
      runCommand(`DELETE FROM daily_predictions WHERE match_id = ?`, [id])
        .then(() => runCommand(`DELETE FROM matches WHERE id = ?`, [id]))
        .then((res) => resolve({ changes: res.changes }))
        .catch(reject);
    }
  });
}

// Get Scheduled Matches with predictions status
function getMatches(userId = null) {
  return new Promise(async (resolve, reject) => {
    if (dbType === 'json') {
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
    } else {
      if (userId) {
        queryAll(`
          SELECT 
            m.id, m.team_a, m.team_b, m.match_date, m.match_time, 
            m.actual_score_a, m.actual_score_b, m.is_locked,
            dp.score_a, dp.score_b
          FROM matches m
          LEFT JOIN daily_predictions dp ON m.id = dp.match_id AND dp.user_id = ?
          ORDER BY m.match_date DESC, m.match_time DESC
        `, [userId])
          .then(resolve)
          .catch(reject);
      } else {
        queryAll(`
          SELECT id, team_a, team_b, match_date, match_time, actual_score_a, actual_score_b, is_locked
          FROM matches 
          ORDER BY match_date DESC, match_time DESC
        `)
          .then(resolve)
          .catch(reject);
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

    if (dbType === 'json') {
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
    } else {
      queryRow(`SELECT actual_score_a, actual_score_b, is_locked, match_date, match_time FROM matches WHERE id = ?`, [mId])
        .then(match => {
          if (!match) return reject(new Error('Match not found.'));
          
          // 1. Result Entered Lock
          if (match.actual_score_a !== null && match.actual_score_a !== undefined && match.actual_score_b !== null && match.actual_score_b !== undefined) {
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

          runCommand(`
            INSERT INTO daily_predictions (user_id, match_id, score_a, score_b) 
            VALUES (?, ?, ?, ?)
          `, [userId, mId, sA, sB])
            .then(() => resolve({ success: true }))
            .catch(err => {
              if (err.message.includes('UNIQUE') || err.message.includes('unique constraint')) {
                reject(new Error("You have already submitted a score prediction for this match."));
              } else {
                reject(err);
              }
            });
        })
        .catch(reject);
    }
  });
}

// Get statistics for the dashboard
function getStats() {
  return new Promise(async (resolve, reject) => {
    if (dbType === 'json') {
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
    } else {
      Promise.all([
        queryAll(`
          SELECT 
            u.id, u.name, u.phone, u.user_type, u.employee_code, u.student_id, p.winner, p.prediction_json, p.champion_only, u.created_at 
          FROM users u 
          LEFT JOIN predictions p ON u.id = p.user_id 
          ORDER BY u.created_at DESC
        `),
        queryAll(`
          SELECT winner, COUNT(*) as count 
          FROM predictions 
          WHERE winner IS NOT NULL 
          GROUP BY winner 
          ORDER BY count DESC
        `),
        queryAll(`
          SELECT champion_only, COUNT(*) as count 
          FROM predictions 
          WHERE champion_only IS NOT NULL 
          GROUP BY champion_only 
          ORDER BY count DESC
        `),
        queryAll(`
          SELECT 
            dp.user_id, dp.match_id, m.team_a, m.team_b, dp.score_a, dp.score_b
          FROM daily_predictions dp
          JOIN matches m ON dp.match_id = m.id
        `),
        queryAll(`
          SELECT 
            m.id, m.team_a, m.team_b, m.match_date, m.match_time, m.actual_score_a, m.actual_score_b,
            COUNT(dp.id) as prediction_count
          FROM matches m
          LEFT JOIN daily_predictions dp ON m.id = dp.match_id
          GROUP BY m.id, m.team_a, m.team_b, m.match_date, m.match_time, m.actual_score_a, m.actual_score_b
          ORDER BY m.match_date ASC, m.match_time ASC
        `),
        getTournamentResults()
      ])
        .then(([participants, winnerStats, championOnlyStats, dailyRows, matchesList, tr]) => {
          // Map integers for winner counts and prediction count in PostgreSQL
          const formattedWinnerStats = winnerStats.map(w => ({ winner: w.winner, count: parseInt(w.count, 10) }));
          const formattedChampionStats = championOnlyStats.map(c => ({ champion_only: c.champion_only, count: parseInt(c.count, 10) }));
          const formattedMatches = matchesList.map(m => ({ ...m, prediction_count: parseInt(m.prediction_count, 10) }));

          const mappedParticipants = participants.map(p => {
            const userDaily = dailyRows.filter(dr => dr.user_id === p.id);
            return {
              ...p,
              daily_predictions: userDaily
            };
          });

          resolve({
            dbType,
            totalParticipants: participants.length,
            participants: mappedParticipants,
            winnerStats: formattedWinnerStats,
            championOnlyStats: formattedChampionStats,
            matches: formattedMatches,
            tournamentResults: tr
          });
        })
        .catch(reject);
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
    if (dbType === 'json') {
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
    } else {
      queryRow(`SELECT id, name, phone, user_type, employee_code, student_id FROM users WHERE id = ?`, [userId])
        .then(resolve)
        .catch(reject);
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

    if (dbType === 'json') {
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
    } else {
      runCommand(`
        UPDATE matches 
        SET actual_score_a = ?, actual_score_b = ? 
        WHERE id = ?
      `, [scoreA, scoreB, id])
        .then((res) => resolve({ success: true, changes: res.changes }))
        .catch(reject);
    }
  });
}

function toggleMatchLock(matchId, isLocked) {
  return new Promise(async (resolve, reject) => {
    const id = parseInt(matchId, 10);
    const lockedVal = isLocked ? 1 : 0;

    if (dbType === 'json') {
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
    } else {
      runCommand(`
        UPDATE matches 
        SET is_locked = ? 
        WHERE id = ?
      `, [lockedVal, id])
        .then((res) => resolve({ success: true, changes: res.changes }))
        .catch(reject);
    }
  });
}

function getTournamentResults() {
  return new Promise(async (resolve, reject) => {
    if (dbType === 'json') {
      try {
        const db = await loadDb();
        resolve(db.tournament_results || null);
      } catch (err) {
        reject(err);
      }
    } else {
      queryRow(`SELECT results_json FROM tournament_results ORDER BY id DESC LIMIT 1`)
        .then(row => {
          if (row && row.results_json) {
            try {
              resolve(JSON.parse(row.results_json));
            } catch (e) {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        })
        .catch(reject);
    }
  });
}

function saveTournamentResults(champion, finalists, semifinalists, quarterfinalists) {
  return new Promise(async (resolve, reject) => {
    const resultsObj = { champion, finalists, semifinalists, quarterfinalists };
    const resultsJson = JSON.stringify(resultsObj);

    if (dbType === 'json') {
      try {
        const db = await loadDb();
        db.tournament_results = resultsObj;
        await saveDb();
        resolve({ success: true });
      } catch (err) {
        reject(err);
      }
    } else {
      runCommand(`INSERT INTO tournament_results (results_json) VALUES (?)`, [resultsJson])
        .then(() => resolve({ success: true }))
        .catch(reject);
    }
  });
}

function clearTournamentResults() {
  return new Promise(async (resolve, reject) => {
    if (dbType === 'json') {
      try {
        const db = await loadDb();
        db.tournament_results = null;
        await saveDb();
        resolve({ success: true });
      } catch (err) {
        reject(err);
      }
    } else {
      runCommand(`DELETE FROM tournament_results`)
        .then((res) => resolve({ success: true, changes: res.changes }))
        .catch(reject);
    }
  });
}

function getSetting(key) {
  return new Promise(async (resolve, reject) => {
    if (dbType === 'json') {
      try {
        const db = await loadDb();
        db.settings = db.settings || {};
        resolve(db.settings[key] || null);
      } catch (e) {
        resolve(null);
      }
    } else {
      queryRow(`SELECT value FROM settings WHERE key = ?`, [key])
        .then(row => resolve(row ? row.value : null))
        .catch(reject);
    }
  });
}

function saveSetting(key, value) {
  return new Promise(async (resolve, reject) => {
    if (dbType === 'json') {
      try {
        const db = await loadDb();
        db.settings = db.settings || {};
        db.settings[key] = value;
        await saveDb();
        resolve({ success: true });
      } catch (err) {
        reject(err);
      }
    } else {
      runCommand(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value
      `, [key, value])
        .then(() => resolve({ success: true }))
        .catch(reject);
    }
  });
}
