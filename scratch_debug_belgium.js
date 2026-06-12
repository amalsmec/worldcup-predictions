const sqlite3 = require('sqlite3').verbose();
const dbPath = 'd:/Football/backend/database.sqlite';

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Could not connect to database', err);
    return;
  }
  
  console.log("--- MATCHES ---");
  db.all("SELECT * FROM matches", [], (err, matches) => {
    if (err) console.error(err);
    console.log(JSON.stringify(matches, null, 2));
    
    console.log("--- DAILY PREDICTIONS ---");
    db.all("SELECT * FROM daily_predictions", [], (err, preds) => {
      if (err) console.error(err);
      console.log(JSON.stringify(preds, null, 2));
      
      console.log("--- USERS ---");
      db.all("SELECT * FROM users", [], (err, users) => {
        if (err) console.error(err);
        console.log(JSON.stringify(users, null, 2));
        db.close();
      });
    });
  });
});
