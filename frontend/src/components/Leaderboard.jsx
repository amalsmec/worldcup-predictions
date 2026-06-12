import React, { useState, useEffect } from 'react';

const LEADERBOARD_TEAMS = [
  "Mexico", "South Africa", "South Korea", "Czechia",
  "Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland",
  "Brazil", "Morocco", "Haiti", "Scotland",
  "United States (USA)", "Paraguay", "Australia", "Turkiye",
  "Germany", "Curaçao", "Ivory Coast (Côte d'Ivoire)", "Ecuador",
  "Netherlands", "Japan", "Sweden", "Tunisia",
  "Belgium", "Egypt", "Iran (IR Iran)", "New Zealand",
  "Spain", "Cape Verde", "Saudi Arabia", "Uruguay",
  "France", "Senegal", "Iraq", "Norway",
  "Argentina", "Algeria", "Austria", "Jordan",
  "Portugal", "DR Congo", "Uzbekistan", "Colombia",
  "England", "Croatia", "Ghana", "Panama"
].sort();

export default function Leaderboard({ onBackToGame, onUpdateTodayMatch, isAdmin = false, userToken = null }) {
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken'));
  const [isLocalAdmin, setIsLocalAdmin] = useState(isAdmin || (!!localStorage.getItem('adminToken') && !userToken));
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(isLocalAdmin ? !!adminToken : true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isBracketLocked, setIsBracketLocked] = useState(false);
  const [categoryTab, setCategoryTab] = useState('staff'); // 'staff' | 'student' | 'public'

  // Admin states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Admin Today's Match states
  const [pendingMatches, setPendingMatches] = useState([
    { teamA: '', teamB: '', date: '', time: '' }
  ]);
  const [isUpdatingMatch, setIsUpdatingMatch] = useState(false);

  // Edit match result states
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [editScoreA, setEditScoreA] = useState('');
  const [editScoreB, setEditScoreB] = useState('');
  const [selectedWinnersMatch, setSelectedWinnersMatch] = useState(null);
  const [rightPanelTab, setRightPanelTab] = useState(isLocalAdmin ? 'logs' : 'leaderboard');

  // Actual tournament results states
  const [actualChampion, setActualChampion] = useState('');
  const [actualFinalist1, setActualFinalist1] = useState('');
  const [actualFinalist2, setActualFinalist2] = useState('');
  const [actualSemi1, setActualSemi1] = useState('');
  const [actualSemi2, setActualSemi2] = useState('');
  const [actualSemi3, setActualSemi3] = useState('');
  const [actualSemi4, setActualSemi4] = useState('');
  const [actualQuarter1, setActualQuarter1] = useState('');
  const [actualQuarter2, setActualQuarter2] = useState('');
  const [actualQuarter3, setActualQuarter3] = useState('');
  const [actualQuarter4, setActualQuarter4] = useState('');
  const [actualQuarter5, setActualQuarter5] = useState('');
  const [actualQuarter6, setActualQuarter6] = useState('');
  const [actualQuarter7, setActualQuarter7] = useState('');
  const [actualQuarter8, setActualQuarter8] = useState('');
  const [isSubmittingResults, setIsSubmittingResults] = useState(false);
  const [selectedParticipantBracket, setSelectedParticipantBracket] = useState(null);

  const getTeamCode = (name) => {
    const codes = {
      "mexico": "mx", "south africa": "za", "south korea": "kr", "czechia": "cz",
      "canada": "ca", "bosnia and herzegovina": "ba", "qatar": "qa", "switzerland": "ch",
      "brazil": "br", "morocco": "ma", "haiti": "ht", "scotland": "gb-sct",
      "united states (usa)": "us", "paraguay": "py", "australia": "au", "turkiye": "tr",
      "germany": "de", "curaçao": "cw", "ivory coast (côte d'ivoire)": "ci", "ecuador": "ec",
      "netherlands": "nl", "japan": "jp", "sweden": "se", "tunisia": "tn",
      "belgium": "be", "egypt": "eg", "iran (ir iran)": "ir", "new zealand": "nz",
      "spain": "es", "cape verde": "cv", "saudi arabia": "sa", "uruguay": "uy",
      "france": "fr", "senegal": "sn", "iraq": "iq", "norway": "no",
      "argentina": "ar", "algeria": "dz", "austria": "at", "jordan": "jo",
      "portugal": "pt", "dr congo": "cd", "uzbekistan": "uz", "colombia": "co",
      "england": "gb-eng", "croatia": "hr", "ghana": "gh", "panama": "pa"
    };
    return codes[(name || '').toLowerCase()] || 'un';
  };

  // Base API URL
  const API_URL = '';

  // Fetch stats from backend
  const fetchStats = async (token = (isLocalAdmin ? adminToken : userToken), forceAdmin = null) => {
    const useAdmin = forceAdmin !== null ? forceAdmin : isLocalAdmin;
    const activeToken = token !== undefined ? token : (useAdmin ? adminToken : userToken);
    if (useAdmin && !activeToken) return;
    try {
      setLoading(true);
      setError(null);
      const endpoint = useAdmin ? '/api/admin/participants' : '/api/user/stats';
      const headers = {};
      if (activeToken) {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }
      const response = await fetch(`${API_URL}${endpoint}`, { headers });
      
      if (response.status === 401) {
        // Token invalid or expired
        if (useAdmin) {
          localStorage.removeItem('adminToken');
          setAdminToken(null);
          setIsLocalAdmin(false);
        }
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch statistics.');
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const activeToken = isLocalAdmin ? adminToken : userToken;
    if (isLocalAdmin && !adminToken) {
      setLoading(false);
      return;
    }
    fetchStats(activeToken);
  }, [adminToken, userToken, isLocalAdmin]);

  const fetchBracketLockStatus = async () => {
    try {
      const res = await fetch('/api/user/bracket-lock-status');
      if (res.ok) {
        const data = await res.json();
        setIsBracketLocked(data.locked);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchBracketLockStatus();
  }, []);

  useEffect(() => {
    if (stats && stats.tournamentResults) {
      const tr = stats.tournamentResults;
      setActualChampion(tr.champion || '');
      if (tr.finalists) {
        setActualFinalist1(tr.finalists[0] || '');
        setActualFinalist2(tr.finalists[1] || '');
      }
      if (tr.semifinalists) {
        setActualSemi1(tr.semifinalists[0] || '');
        setActualSemi2(tr.semifinalists[1] || '');
        setActualSemi3(tr.semifinalists[2] || '');
        setActualSemi4(tr.semifinalists[3] || '');
      }
      if (tr.quarterfinalists) {
        setActualQuarter1(tr.quarterfinalists[0] || '');
        setActualQuarter2(tr.quarterfinalists[1] || '');
        setActualQuarter3(tr.quarterfinalists[2] || '');
        setActualQuarter4(tr.quarterfinalists[3] || '');
        setActualQuarter5(tr.quarterfinalists[4] || '');
        setActualQuarter6(tr.quarterfinalists[5] || '');
        setActualQuarter7(tr.quarterfinalists[6] || '');
        setActualQuarter8(tr.quarterfinalists[7] || '');
      }
    }
  }, [stats]);

  // Utility: Format Date
  const formatDate = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Recent';
    }
  };

  // Login handler
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const response = await fetch(`${API_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Invalid username or password.');
      }
      localStorage.setItem('adminToken', data.token);
      setAdminToken(data.token);
      setIsLocalAdmin(true);
      setUsername('');
      setPassword('');
      fetchStats(data.token, true);
    } catch (err) {
      setLoginError(err.message);
    }
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setAdminToken(null);
    setStats(null);
    setIsLocalAdmin(isAdmin);
  };

  const handleToggleBracketLock = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/toggle-bracket-lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ locked: !isBracketLocked })
      });
      const data = await response.json();
      if (response.ok) {
        setIsBracketLocked(data.locked);
        alert(`Bracket prediction lock status updated to: ${data.locked ? 'LOCKED' : 'UNLOCKED'}`);
      } else {
        alert(data.error || 'Failed to toggle bracket prediction lock status.');
      }
    } catch (err) {
      alert('Error updating lock status: ' + err.message);
    }
  };

  // Add another empty match row
  const handleAddRow = () => {
    setPendingMatches(prev => [...prev, { teamA: '', teamB: '', date: '', time: '' }]);
  };

  // Remove a pending match row
  const handleRemoveRow = (index) => {
    if (pendingMatches.length === 1) {
      alert("At least one match row is required.");
      return;
    }
    setPendingMatches(prev => prev.filter((_, i) => i !== index));
  };

  // Update specific field in a pending match row
  const handleRowChange = (index, field, value) => {
    setPendingMatches(prev => prev.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const startEditingResult = (match) => {
    setEditingMatchId(match.id);
    setEditScoreA(match.actual_score_a !== null ? match.actual_score_a.toString() : '');
    setEditScoreB(match.actual_score_b !== null ? match.actual_score_b.toString() : '');
  };

  const handleSaveResult = async (matchId) => {
    if (editScoreA === '' || editScoreB === '') {
      return alert('Both scores are required.');
    }

    try {
      const response = await fetch(`${API_URL}/api/admin/matches/${matchId}/result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          actualScoreA: editScoreA,
          actualScoreB: editScoreB
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update match result.');
      }

      alert('Match result updated successfully!');
      setEditingMatchId(null);
      
      if (onUpdateTodayMatch) {
        onUpdateTodayMatch(); // Refresh parent state
      }
      fetchStats(adminToken);
    } catch (err) {
      alert(err.message);
    }
  };

  // Admin Match scheduling handler
  const handleUpdateMatchSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    for (let i = 0; i < pendingMatches.length; i++) {
      const { teamA, teamB, date, time } = pendingMatches[i];
      if (!teamA || !teamB || !date || !time) {
        return alert(`All fields are required in match row #${i + 1}.`);
      }
      if (teamA === teamB) {
        return alert(`Team A and Team B must be different in match row #${i + 1}.`);
      }
    }

    setIsUpdatingMatch(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/matches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(pendingMatches)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to schedule matches.");
      }

      alert("Matches scheduled successfully!");
      setPendingMatches([{ teamA: '', teamB: '', date: '', time: '' }]);
      
      if (onUpdateTodayMatch) {
        onUpdateTodayMatch(); // Refresh parent app state
      }
      fetchStats(adminToken);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsUpdatingMatch(false);
    }
  };

  const handleDeleteMatch = async (matchId) => {
    if (!window.confirm('Are you sure you want to delete this match? This will also delete all user score predictions for it.')) return;
    try {
      const response = await fetch(`${API_URL}/api/admin/matches/${matchId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete match.');
      }
      alert('Match deleted.');
      if (onUpdateTodayMatch) {
        onUpdateTodayMatch();
      }
      fetchStats(adminToken);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleLock = async (matchId, currentLockStatus) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/matches/${matchId}/lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ isLocked: !currentLockStatus })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update lock status.');
      }
      if (onUpdateTodayMatch) {
        onUpdateTodayMatch();
      }
      fetchStats(adminToken);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSaveTournamentResults = async (e) => {
    e.preventDefault();
    
    const quarters = [actualQuarter1, actualQuarter2, actualQuarter3, actualQuarter4, actualQuarter5, actualQuarter6, actualQuarter7, actualQuarter8];
    const semis = [actualSemi1, actualSemi2, actualSemi3, actualSemi4];
    const finalists = [actualFinalist1, actualFinalist2];

    const filledQuarters = quarters.filter(Boolean);
    const filledSemis = semis.filter(Boolean);
    const filledFinalists = finalists.filter(Boolean);

    if (filledQuarters.length === 0 && filledSemis.length === 0 && filledFinalists.length === 0 && !actualChampion) {
      return alert('At least one tournament outcome selection is required.');
    }
    
    // Check duplicates on selected ones
    if (new Set(filledQuarters).size !== filledQuarters.length) {
      return alert('All selected quarterfinalists must be unique.');
    }
    if (new Set(filledSemis).size !== filledSemis.length) {
      return alert('All selected semifinalists must be unique.');
    }
    if (new Set(filledFinalists).size !== filledFinalists.length) {
      return alert('Both selected finalists must be unique.');
    }
    
    // Check subset logic with warnings on selected ones
    if (filledQuarters.length > 0 && filledSemis.some(s => !quarters.includes(s))) {
      if (!window.confirm('Warning: One or more selected semifinalists are not selected as quarterfinalists. Proceed anyway?')) {
        return;
      }
    }
    if (filledSemis.length > 0 && filledFinalists.some(f => !semis.includes(f))) {
      if (!window.confirm('Warning: One or more selected finalists are not selected as semifinalists. Proceed anyway?')) {
        return;
      }
    }
    if (filledFinalists.length > 0 && actualChampion && !finalists.includes(actualChampion)) {
      if (!window.confirm('Warning: The champion is not selected as a finalist. Proceed anyway?')) {
        return;
      }
    }

    setIsSubmittingResults(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/tournament-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          champion: actualChampion,
          finalists,
          semifinalists: semis,
          quarterfinalists: quarters
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save tournament results.');
      }
      alert('Tournament results recorded successfully! Leaderboard rankings and points have been updated.');
      fetchStats(adminToken);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmittingResults(false);
    }
  };

  const handleClearTournamentResults = async () => {
    if (!window.confirm('Are you sure you want to clear the recorded tournament outcomes? This will reset all participant tournament points back to 0.')) {
      return;
    }
    
    setIsSubmittingResults(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/tournament-results`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to clear tournament results.');
      }
      alert('Tournament outcomes cleared successfully! All participant tournament points have been reset.');
      
      // Reset local outcomes state
      setActualChampion('');
      setActualFinalist1('');
      setActualFinalist2('');
      setActualSemi1('');
      setActualSemi2('');
      setActualSemi3('');
      setActualSemi4('');
      setActualQuarter1('');
      setActualQuarter2('');
      setActualQuarter3('');
      setActualQuarter4('');
      setActualQuarter5('');
      setActualQuarter6('');
      setActualQuarter7('');
      setActualQuarter8('');
      
      fetchStats(adminToken);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmittingResults(false);
    }
  };

  // Delete participant handler
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete the prediction from ${name}?`)) return;
    try {
      const response = await fetch(`${API_URL}/api/admin/participants/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete participant.');
      }
      fetchStats(adminToken);
    } catch (err) {
      alert(err.message);
    }
  };

  // Clear database handler
  const handleResetDb = async () => {
    if (!window.confirm('WARNING: Are you sure you want to clear ALL prediction entries? This action is permanent.')) return;
    try {
      const response = await fetch(`${API_URL}/api/admin/reset`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reset database.');
      }
      fetchStats(adminToken);
    } catch (err) {
      alert(err.message);
    }
  };

  // Export to CSV helper
  const handleExportCSV = () => {
    if (!stats || !stats.participants) return;
    const headers = ['ID', 'Name', 'Phone', 'Winner', 'Predictions Json', "Today's Prediction Score", 'Date'];
    const rows = stats.participants.map(p => [
      p.id,
      p.name,
      p.phone,
      p.winner,
      p.prediction_json ? p.prediction_json.replace(/"/g, '""') : '',
      p.today_match_prediction ? p.today_match_prediction.replace(/"/g, '""') : '',
      p.created_at
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `worldcup_predictions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLocalAdmin && !adminToken) {
    return (
      <div className="auth-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <div className="glass-panel" style={{ width: '90%', maxWidth: '400px', textAlign: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '1.5rem', fontSize: '1.5rem' }}>
            🔒 Admin Portal Login
          </h3>
          <form onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label htmlFor="admin-user">Username</label>
              <input
                id="admin-user"
                type="text"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label htmlFor="admin-pass">Password</label>
              <input
                id="admin-pass"
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {loginError && (
              <p style={{ color: '#ff4d4d', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                ⚠️ {loginError}
              </p>
            )}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '1rem' }}>
              Login to Dashboard
            </button>
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ width: '100%' }} 
              onClick={() => {
                if (!isAdmin) {
                  setIsLocalAdmin(false);
                } else {
                  onBackToGame();
                }
              }}
            >
              ⬅️ Back
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading || !stats) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', width: '100%', maxWidth: '600px' }}>
        <div className="trophy-container" style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>⏳</div>
        <h3>Loading Stats...</h3>
        <p style={{ color: 'var(--text-secondary)' }}>Gathering tournament data, please wait.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', width: '100%', maxWidth: '600px', borderColor: '#ff4d4d' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>⚠️</div>
        <h3>Failed to Load Stats</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
        <button className="btn btn-primary" onClick={() => fetchStats(adminToken)}>🔄 Try Again</button>
      </div>
    );
  }

  const { totalParticipants, participants, winnerStats, championOnlyStats = [], dbType, matches } = stats;
  const topChampion = winnerStats && winnerStats.length > 0 ? winnerStats[0].winner : 'None';

  // Helper to determine prediction correctness outcome
  const getPredictionOutcome = (predA, predB, actA, actB) => {
    if (actA === null || actB === null || actA === undefined || actB === undefined) return null;
    const pA = parseInt(predA, 10);
    const pB = parseInt(predB, 10);
    const aA = parseInt(actA, 10);
    const aB = parseInt(actB, 10);
    
    if (pA === aA && pB === aB) {
      return { type: 'exact', label: '🏆 Exact Match', color: '#39ff14' };
    }
    
    const predOutcome = pA > pB ? 'winA' : pA < pB ? 'winB' : 'draw';
    const actOutcome = aA > aB ? 'winA' : aA < aB ? 'winB' : 'draw';
    
    if (predOutcome === actOutcome) {
      return { type: 'outcome', label: '⚽ Correct Winner', color: '#00e5ff' };
    }
    
    return null;
  };

  // Helper to retrieve all predictions for a match (with correctness outcomes)
  const getMatchPredictions = (match) => {
    if (!stats || !stats.participants) {
      return [];
    }
    
    const list = [];
    stats.participants.forEach(p => {
      if (!p.daily_predictions) return;
      const pred = p.daily_predictions.find(dp => Number(dp.match_id) === Number(match.id));
      if (pred) {
        const outcome = getPredictionOutcome(
          pred.score_a, 
          pred.score_b, 
          match.actual_score_a, 
          match.actual_score_b
        );
        list.push({
          participant: p,
          score_a: pred.score_a,
          score_b: pred.score_b,
          outcome
        });
      }
    });
    return list;
  };

  const getCorrectPredictorsCount = (match) => {
    const all = getMatchPredictions(match);
    return all.filter(p => p.outcome && (p.outcome.type === 'exact' || p.outcome.type === 'outcome')).length;
  };
  
  // Filter participants
  // Calculate participant performance stats
  const getParticipantStats = (p, tournamentResults = stats?.tournamentResults) => {
    let exactCount = 0;
    let outcomeCount = 0;
    let tournamentPoints = 0;
    
    if (p.daily_predictions && matches) {
      p.daily_predictions.forEach(dp => {
        const match = matches.find(m => Number(m.id) === Number(dp.match_id));
        if (match && match.actual_score_a !== null && match.actual_score_b !== null) {
          const outcome = getPredictionOutcome(
            dp.score_a, 
            dp.score_b, 
            match.actual_score_a, 
            match.actual_score_b
          );
          if (outcome) {
            if (outcome.type === 'exact') {
              exactCount++;
            } else if (outcome.type === 'outcome') {
              outcomeCount++;
            }
          }
        }
      });
    }

    // Add tournament results points
    if (tournamentResults) {
      // 1. Direct Champion Selection (15 points)
      if (p.champion_only && tournamentResults.champion && 
          p.champion_only.toLowerCase().trim() === tournamentResults.champion.toLowerCase().trim()) {
        tournamentPoints += 15;
      }
      
      // 2. Bracket Predictions
      if (p.prediction_json) {
        try {
          const bracket = JSON.parse(p.prediction_json);
          
          // Bracket Quarterfinalists (2 pts per correct team, max 16)
          if (bracket.quarterfinalists && tournamentResults.quarterfinalists) {
            const actualQuarters = tournamentResults.quarterfinalists.map(t => (t || '').toLowerCase().trim()).filter(Boolean);
            bracket.quarterfinalists.forEach(team => {
              if (team && actualQuarters.includes(team.toLowerCase().trim())) {
                tournamentPoints += 2;
              }
            });
          }
          
          // Bracket Semifinalists (5 pts per correct team, max 20)
          if (bracket.semifinalists && tournamentResults.semifinalists) {
            const actualSemis = tournamentResults.semifinalists.map(t => (t || '').toLowerCase().trim()).filter(Boolean);
            bracket.semifinalists.forEach(team => {
              if (team && actualSemis.includes(team.toLowerCase().trim())) {
                tournamentPoints += 5;
              }
            });
          }

          // Bracket Finalists (10 pts per correct team, max 20)
          if (bracket.finalists && tournamentResults.finalists) {
            const actualFinals = tournamentResults.finalists.map(t => (t || '').toLowerCase().trim()).filter(Boolean);
            bracket.finalists.forEach(team => {
              if (team && actualFinals.includes(team.toLowerCase().trim())) {
                tournamentPoints += 10;
              }
            });
          }

          // Bracket Winner/Champion (15 pts if correct)
          if (bracket.champion && tournamentResults.champion && tournamentResults.champion.trim() !== '' &&
              bracket.champion.toLowerCase().trim() === tournamentResults.champion.toLowerCase().trim()) {
            tournamentPoints += 15;
          }

          // Bracket Winner in Semis (1 pt if correct)
          if (bracket.champion && tournamentResults.semifinalists) {
            const actualSemis = tournamentResults.semifinalists.map(t => (t || '').toLowerCase().trim()).filter(Boolean);
            if (bracket.champion.trim() !== '' && actualSemis.includes(bracket.champion.toLowerCase().trim())) {
              tournamentPoints += 1;
            }
          }
          // Bracket Winner in Quarters (1 pt if correct)
          if (bracket.champion && tournamentResults.quarterfinalists) {
            const actualQuarters = tournamentResults.quarterfinalists.map(t => (t || '').toLowerCase().trim()).filter(Boolean);
            if (bracket.champion.trim() !== '' && actualQuarters.includes(bracket.champion.toLowerCase().trim())) {
              tournamentPoints += 1;
            }
          }
        } catch (e) {
          console.error('Error parsing prediction json:', e);
        }
      }
    }

    const points = (exactCount * 3) + outcomeCount + tournamentPoints;
    return { exactCount, outcomeCount, tournamentPoints, points };
  };

  const participantsWithStats = participants.map(p => ({
    ...p,
    stats: getParticipantStats(p, stats?.tournamentResults)
  }));

  // Sort by points DESC, then exact DESC, then outcome DESC, then name ASC
  const sortedParticipants = [...participantsWithStats].sort((a, b) => {
    if (b.stats.points !== a.stats.points) {
      return b.stats.points - a.stats.points;
    }
    if (b.stats.exactCount !== a.stats.exactCount) {
      return b.stats.exactCount - a.stats.exactCount;
    }
    if (b.stats.outcomeCount !== a.stats.outcomeCount) {
      return b.stats.outcomeCount - a.stats.outcomeCount;
    }
    return (a.name || '').localeCompare(b.name || '');
  });

  const categoryTabLower = categoryTab.toLowerCase();
  
  const categoryParticipants = participants.filter(p => {
    const type = (p.user_type || 'public').toLowerCase();
    return type === categoryTabLower;
  });

  const categorySortedParticipants = sortedParticipants.filter(p => {
    const type = (p.user_type || 'public').toLowerCase();
    return type === categoryTabLower;
  });

  const filteredParticipants = categoryParticipants.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.winner && p.winner.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredSortedParticipants = categorySortedParticipants.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            Tournament Dashboard 
            {isLocalAdmin && adminToken ? (
              <span style={{ 
                color: 'var(--primary-gold)', 
                fontSize: '0.9rem', 
                background: 'rgba(255,215,0,0.1)', 
                padding: '0.2rem 0.6rem', 
                borderRadius: '8px', 
                border: '1px solid rgba(255,215,0,0.2)' 
              }}>
                ADMIN MODE
              </span>
            ) : (
              <span style={{ 
                color: 'var(--accent-cyan)', 
                fontSize: '0.9rem', 
                background: 'rgba(0, 229, 255, 0.1)', 
                padding: '0.2rem 0.6rem', 
                borderRadius: '8px', 
                border: '1px solid rgba(0, 229, 255, 0.2)' 
              }}>
                GLOBAL STATS
              </span>
            )}
          </h2>
          <p>
            {isLocalAdmin 
              ? `Real-time participant predictions and statistics. Storage: ${dbType === 'sqlite' ? 'SQLite DB' : 'JSON DB'}`
              : 'Global leader predictions and tournament trends.'
            }
          </p>
        </div>
        
        <div className="dashboard-actions">
          {isLocalAdmin && (
            <>
              <button className="btn btn-gold" onClick={handleExportCSV}>
                📥 Export CSV
              </button>
              <button 
                className="btn btn-secondary" 
                style={{ borderColor: 'rgba(255, 77, 77, 0.4)', color: '#ff4d4d' }} 
                onClick={handleResetDb}
              >
                🗑️ Clear DB
              </button>
              <button 
                className="btn btn-secondary" 
                style={{ 
                  borderColor: isBracketLocked ? 'rgba(255, 77, 77, 0.4)' : 'rgba(57, 255, 20, 0.4)', 
                  color: isBracketLocked ? '#ff4d4d' : '#39ff14' 
                }} 
                onClick={handleToggleBracketLock}
              >
                {isBracketLocked ? '🔒 Bracket Locked' : '🔓 Bracket Open'}
              </button>
              <button className="btn btn-secondary" onClick={handleLogout}>
                🔒 Logout
              </button>
            </>
          )}

          {onBackToGame && (
            <button className="btn btn-primary" onClick={onBackToGame}>
              🎮 Back to Game
            </button>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-val">{totalParticipants}</span>
          <span className="stat-label">Total Predictions</span>
        </div>
        <div className="stat-card">
          <span className="stat-val stat-val-gold">🏆 {topChampion}</span>
          <span className="stat-label">Most Predicted Winner</span>
        </div>
        <div className="stat-card">
          <span className="stat-val" style={{ color: 'var(--accent-purple)' }}>
            {matches ? matches.length : 0}
          </span>
          <span className="stat-label">Scheduled Matches</span>
        </div>
      </div>

      {/* Admin Today's Match Manager Panel */}
      {isLocalAdmin && adminToken && (
        <div className="glass-panel" style={{ marginBottom: '3rem', textAlign: 'left' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '1.25rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.75rem' }}>
            ⚙️ Match Scheduler (Add Multiple Matches Manually)
          </h3>
          <form onSubmit={handleUpdateMatchSubmit}>
            {/* Header Row for Desktop only */}
            <div className="scheduler-header-row" style={{ gap: '1rem', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', paddingLeft: '80px' }}>
              <div style={{ flex: 1, minWidth: '160px' }}>Team A</div>
              <div style={{ flex: 1, minWidth: '160px' }}>Team B</div>
              <div style={{ flex: 1, minWidth: '140px' }}>Date</div>
              <div style={{ flex: 1, minWidth: '100px' }}>Time</div>
              {pendingMatches.length > 1 && <div style={{ width: '92px' }}></div>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {pendingMatches.map((row, index) => (
                <div key={index} className="scheduler-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '1rem' }}>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, minWidth: '80px' }}>
                    Match #{index + 1}
                  </div>

                  <div className="form-group" style={{ flex: 1, minWidth: '160px', marginBottom: 0 }}>
                    <label className="mobile-only-label">Team A</label>
                    <select
                      className="form-input"
                      style={{ background: 'rgba(5, 6, 15, 0.9)' }}
                      value={row.teamA}
                      onChange={(e) => handleRowChange(index, 'teamA', e.target.value)}
                      required
                    >
                      <option value="">-- Select Team A --</option>
                      {LEADERBOARD_TEAMS.map(team => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ flex: 1, minWidth: '160px', marginBottom: 0 }}>
                    <label className="mobile-only-label">Team B</label>
                    <select
                      className="form-input"
                      style={{ background: 'rgba(5, 6, 15, 0.9)' }}
                      value={row.teamB}
                      onChange={(e) => handleRowChange(index, 'teamB', e.target.value)}
                      required
                    >
                      <option value="">-- Select Team B --</option>
                      {LEADERBOARD_TEAMS.map(team => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ flex: 1, minWidth: '140px', marginBottom: 0 }}>
                    <label className="mobile-only-label">Date</label>
                    <input
                      type="date"
                      className="form-input"
                      style={{ background: 'rgba(5, 6, 15, 0.9)' }}
                      value={row.date}
                      onChange={(e) => handleRowChange(index, 'date', e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ flex: 1, minWidth: '100px', marginBottom: 0 }}>
                    <label className="mobile-only-label">Time</label>
                    <input
                      type="time"
                      className="form-input"
                      style={{ background: 'rgba(5, 6, 15, 0.9)' }}
                      value={row.time}
                      onChange={(e) => handleRowChange(index, 'time', e.target.value)}
                      required
                    />
                  </div>

                  {pendingMatches.length > 1 && (
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ 
                        padding: '0.6rem 0.8rem', 
                        background: 'rgba(255, 77, 77, 0.12)', 
                        borderColor: 'rgba(255, 77, 77, 0.25)', 
                        color: '#ff4d4d',
                        borderRadius: '8px'
                      }}
                      onClick={() => handleRemoveRow(index)}
                    >
                      🗑️ Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ padding: '0.8rem 1.5rem' }} 
                onClick={handleAddRow}
              >
                ➕ Add Another Match Row
              </button>
              <button 
                type="submit" 
                className="btn btn-gold" 
                style={{ padding: '0.8rem 2.5rem' }} 
                disabled={isUpdatingMatch}
              >
                {isUpdatingMatch ? 'Scheduling Matches...' : `📅 Schedule All ${pendingMatches.length} Matches`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admin Tournament Results Entry Panel */}
      {isLocalAdmin && adminToken && (
        <div className="glass-panel" style={{ marginBottom: '3rem', textAlign: 'left' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '1.25rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.75rem' }}>
            🏆 Tournament Results Entry (Record Final Outcomes)
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>
            Enter the actual World Cup semifinalists, finalists, and champion once they are determined. This will calculate bracket/champion points for all participants.
          </p>
          <form onSubmit={handleSaveTournamentResults}>
            {/* Quarterfinalists Row */}
            <h4 style={{ color: 'var(--accent-cyan)', fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
              1. Actual Quarterfinalists (8 Teams)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {[
                { val: actualQuarter1, setVal: setActualQuarter1, num: 1 },
                { val: actualQuarter2, setVal: setActualQuarter2, num: 2 },
                { val: actualQuarter3, setVal: setActualQuarter3, num: 3 },
                { val: actualQuarter4, setVal: setActualQuarter4, num: 4 },
                { val: actualQuarter5, setVal: setActualQuarter5, num: 5 },
                { val: actualQuarter6, setVal: setActualQuarter6, num: 6 },
                { val: actualQuarter7, setVal: setActualQuarter7, num: 7 },
                { val: actualQuarter8, setVal: setActualQuarter8, num: 8 }
              ].map((q) => (
                <div key={q.num} className="form-group" style={{ marginBottom: 0 }}>
                  <label>Quarterfinalist #{q.num}</label>
                  <select
                    className="form-input"
                    style={{ background: 'rgba(5, 6, 15, 0.9)' }}
                    value={q.val}
                    onChange={(e) => q.setVal(e.target.value)}
                  >
                    <option value="">-- Select Team --</option>
                    {LEADERBOARD_TEAMS.map(team => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Semifinalists Row */}
            <h4 style={{ color: 'var(--accent-cyan)', fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
              2. Actual Semifinalists (4 Teams)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Semifinalist #1</label>
                <select
                  className="form-input"
                  style={{ background: 'rgba(5, 6, 15, 0.9)' }}
                  value={actualSemi1}
                  onChange={(e) => setActualSemi1(e.target.value)}
                >
                  <option value="">-- Select Team --</option>
                  {LEADERBOARD_TEAMS.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Semifinalist #2</label>
                <select
                  className="form-input"
                  style={{ background: 'rgba(5, 6, 15, 0.9)' }}
                  value={actualSemi2}
                  onChange={(e) => setActualSemi2(e.target.value)}
                >
                  <option value="">-- Select Team --</option>
                  {LEADERBOARD_TEAMS.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Semifinalist #3</label>
                <select
                  className="form-input"
                  style={{ background: 'rgba(5, 6, 15, 0.9)' }}
                  value={actualSemi3}
                  onChange={(e) => setActualSemi3(e.target.value)}
                >
                  <option value="">-- Select Team --</option>
                  {LEADERBOARD_TEAMS.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Semifinalist #4</label>
                <select
                  className="form-input"
                  style={{ background: 'rgba(5, 6, 15, 0.9)' }}
                  value={actualSemi4}
                  onChange={(e) => setActualSemi4(e.target.value)}
                >
                  <option value="">-- Select Team --</option>
                  {LEADERBOARD_TEAMS.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Finalists Row */}
            <h4 style={{ color: 'var(--accent-cyan)', fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
              3. Actual Finalists (2 Teams)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Finalist #1</label>
                <select
                  className="form-input"
                  style={{ background: 'rgba(5, 6, 15, 0.9)' }}
                  value={actualFinalist1}
                  onChange={(e) => setActualFinalist1(e.target.value)}
                >
                  <option value="">-- Select Team --</option>
                  {LEADERBOARD_TEAMS.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Finalist #2</label>
                <select
                  className="form-input"
                  style={{ background: 'rgba(5, 6, 15, 0.9)' }}
                  value={actualFinalist2}
                  onChange={(e) => setActualFinalist2(e.target.value)}
                >
                  <option value="">-- Select Team --</option>
                  {LEADERBOARD_TEAMS.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Champion Row */}
            <h4 style={{ color: 'var(--primary-gold)', fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
              4. Actual Tournament Champion
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>World Cup Champion 🏆</label>
                <select
                  className="form-input"
                  style={{ background: 'rgba(5, 6, 15, 0.9)' }}
                  value={actualChampion}
                  onChange={(e) => setActualChampion(e.target.value)}
                >
                  <option value="">-- Select Champion --</option>
                  {LEADERBOARD_TEAMS.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
              {stats && stats.tournamentResults && (
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ padding: '0.8rem 2rem', borderColor: 'rgba(255, 77, 77, 0.4)', color: '#ff4d4d' }}
                  onClick={handleClearTournamentResults}
                  disabled={isSubmittingResults}
                >
                  🗑️ Clear Outcomes
                </button>
              )}
              <button 
                type="submit" 
                className="btn btn-gold" 
                style={{ padding: '0.8rem 3rem' }} 
                disabled={isSubmittingResults}
              >
                {isSubmittingResults ? 'Saving Results...' : '🏆 Record Tournament Outcomes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main sections */}
      <div className="dashboard-sections">
        {/* Left column: Trends */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          {/* Champion Predictions Trend */}
          <div className="glass-panel">
            <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.75rem' }}>
              Champion Predictions Trend
            </h3>
            
            {winnerStats.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
                No predictions submitted yet. Be the first!
              </p>
            ) : (
              <div className="predictions-trend">
                {winnerStats.map((stat) => {
                  const percentage = totalParticipants > 0 
                    ? Math.round((stat.count / totalParticipants) * 100) 
                    : 0;
                  return (
                    <div key={stat.winner} className="trend-bar-wrapper">
                      <div className="trend-bar-info">
                        <span className="trend-team-name">⚽ {stat.winner}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          <strong>{stat.count}</strong> votes ({percentage}%)
                        </span>
                      </div>
                      <div className="trend-bar-bg">
                        <div className="trend-bar-fill" style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Most Expected Champion Picks */}
          <div className="glass-panel">
            <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.75rem' }}>
              Most Expected Champion Picks
            </h3>
            
            {championOnlyStats.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
                No direct champion predictions submitted yet.
              </p>
            ) : (
              <div className="predictions-trend">
                {championOnlyStats.map((stat) => {
                  const percentage = totalParticipants > 0 
                    ? Math.round((stat.count / totalParticipants) * 100) 
                    : 0;
                  return (
                    <div key={stat.champion_only} className="trend-bar-wrapper">
                      <div className="trend-bar-info">
                        <span className="trend-team-name">🏆 {stat.champion_only}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          <strong>{stat.count}</strong> votes ({percentage}%)
                        </span>
                      </div>
                      <div className="trend-bar-bg">
                        <div className="trend-bar-fill" style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Scheduled Matches & Prediction Counts */}
          <div className="glass-panel">
            <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.75rem' }}>
              🗓️ Scheduled Matches
            </h3>
            {matches && matches.length > 0 ? (
              <div className="table-container">
                <table className="participants-table" style={{ fontSize: '0.9rem' }}>
                  <thead>
                    <tr>
                      <th>Match</th>
                      <th>Date / Time</th>
                      <th style={{ textAlign: 'center' }}>Predictions</th>
                      <th style={{ textAlign: 'center' }}>Result</th>
                      {isLocalAdmin && adminToken && <th style={{ textAlign: 'center' }}>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map(m => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 600 }}>
                          <div>{m.team_a} vs {m.team_b}</div>
                          {isLocalAdmin && adminToken && m.prediction_count > 0 && (
                            <div style={{ marginTop: '0.25rem' }}>
                              <button
                                onClick={() => setSelectedWinnersMatch(m)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--accent-cyan)',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                  padding: 0,
                                  textDecoration: 'underline',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}
                              >
                                👥 View Predictions ({m.actual_score_a !== null && m.actual_score_b !== null 
                                  ? `${getCorrectPredictorsCount(m)}/${m.prediction_count} Correct` 
                                  : m.prediction_count})
                              </button>
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{m.match_date} @ {m.match_time}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{m.prediction_count}</td>
                        <td style={{ textAlign: 'center' }}>
                          {isLocalAdmin && adminToken ? (
                            editingMatchId === m.id ? (
                              <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center', alignItems: 'center' }}>
                                <input 
                                  type="text" 
                                  maxLength="2" 
                                  style={{ width: '30px', padding: '0.2rem', textAlign: 'center', background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '4px' }} 
                                  value={editScoreA} 
                                  onChange={(e) => setEditScoreA(e.target.value.replace(/[^0-9]/g, ''))}
                                />
                                <span>-</span>
                                <input 
                                  type="text" 
                                  maxLength="2" 
                                  style={{ width: '30px', padding: '0.2rem', textAlign: 'center', background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '4px' }} 
                                  value={editScoreB} 
                                  onChange={(e) => setEditScoreB(e.target.value.replace(/[^0-9]/g, ''))}
                                />
                                <button 
                                  type="button" 
                                  style={{ background: 'none', border: 'none', color: '#00e5ff', cursor: 'pointer', fontSize: '1.1rem', padding: '0 0.25rem', fontWeight: 'bold' }}
                                  onClick={() => handleSaveResult(m.id)}
                                  title="Save result"
                                >
                                  ✓
                                </button>
                                <button 
                                  type="button" 
                                  style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '1.1rem', padding: '0 0.25rem', fontWeight: 'bold' }}
                                  onClick={() => setEditingMatchId(null)}
                                  title="Cancel"
                                >
                                  ✗
                                </button>
                              </div>
                            ) : (
                              m.actual_score_a !== null ? (
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 'bold', color: 'var(--primary-gold)' }}>
                                    {m.actual_score_a} - {m.actual_score_b}
                                  </span>
                                  <button 
                                    type="button" 
                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}
                                    onClick={() => startEditingResult(m)}
                                    title="Edit result"
                                  >
                                    ✏️
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', borderColor: 'var(--primary-gold)', color: 'var(--primary-gold)', borderRadius: '6px' }}
                                  onClick={() => startEditingResult(m)}
                                >
                                  🏆 Enter Result
                                </button>
                              )
                            )
                          ) : (
                            m.actual_score_a !== null ? (
                              <span style={{ fontWeight: 'bold', color: 'var(--primary-gold)' }}>
                                {m.actual_score_a} - {m.actual_score_b}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>-</span>
                            )
                          )}
                        </td>
                        {isLocalAdmin && adminToken && (
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <button
                              className="btn btn-secondary"
                              style={{
                                padding: '0.25rem 0.5rem',
                                marginRight: '0.5rem',
                                background: m.is_locked === 1 ? 'rgba(255, 215, 0, 0.15)' : 'rgba(0, 229, 255, 0.1)',
                                borderColor: m.is_locked === 1 ? 'rgba(255, 215, 0, 0.35)' : 'rgba(0, 229, 255, 0.25)',
                                color: m.is_locked === 1 ? 'var(--primary-gold)' : 'var(--accent-cyan)',
                                borderRadius: '6px',
                                fontSize: '0.8rem'
                              }}
                              onClick={() => handleToggleLock(m.id, m.is_locked === 1)}
                              title={m.is_locked === 1 ? "Unlock Predictions" : "Lock Predictions"}
                            >
                              {m.is_locked === 1 ? '🔒' : '🔓'}
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ 
                                padding: '0.25rem 0.5rem', 
                                background: 'rgba(255, 77, 77, 0.12)', 
                                borderColor: 'rgba(255, 77, 77, 0.25)', 
                                color: '#ff4d4d',
                                borderRadius: '6px',
                                fontSize: '0.8rem'
                              }}
                              onClick={() => handleDeleteMatch(m.id)}
                            >
                              🗑️
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
                No matches scheduled yet.
              </p>
            )}
          </div>
        </div>

        {/* Right column: Participant Log Table */}
        <div className="glass-panel participants-panel">
          {isLocalAdmin && adminToken ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>
                {rightPanelTab === 'logs' ? 'Participant Logs' : '🏆 Score Leaderboard'}
              </h3>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button 
                  className={`btn ${rightPanelTab === 'logs' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px' }}
                  onClick={() => setRightPanelTab('logs')}
                >
                  👥 Entries Log
                </button>
                <button 
                  className={`btn ${rightPanelTab === 'leaderboard' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px' }}
                  onClick={() => setRightPanelTab('leaderboard')}
                >
                  🏆 Top Predictors
                </button>
              </div>
            </div>
          ) : (
            <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.75rem' }}>
              🏆 Top Predictors Leaderboard
            </h3>
          )}
          
          {/* User Category Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.75rem' }}>
            <button
              className={`btn ${categoryTab === 'staff' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', borderRadius: '8px', flex: 1 }}
              onClick={() => setCategoryTab('staff')}
            >
              👨‍💼 Staff
            </button>
            <button
              className={`btn ${categoryTab === 'student' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', borderRadius: '8px', flex: 1 }}
              onClick={() => setCategoryTab('student')}
            >
              🎓 Students
            </button>
            <button
              className={`btn ${categoryTab === 'public' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', borderRadius: '8px', flex: 1 }}
              onClick={() => setCategoryTab('public')}
            >
              🌍 Public
            </button>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              className="form-input"
              placeholder={`🔍 Search ${categoryTab === 'staff' ? 'Staff' : categoryTab === 'student' ? 'Students' : 'Public'} by name...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="table-container">
            {rightPanelTab === 'logs' && isLocalAdmin && adminToken ? (
              filteredParticipants.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
                  No matching participants found.
                </p>
              ) : (
                <table className="participants-table">
                  <thead>
                    <tr>
                      <th>Participant</th>
                      <th>Phone</th>
                      {categoryTab === 'staff' && <th>Employee Code</th>}
                      {categoryTab === 'student' && <th>Student ID</th>}
                      <th>Today's Prediction</th>
                      <th>Champion Pick</th>
                      <th>Bracket Winner</th>
                      <th>Time</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{p.phone}</td>
                        {categoryTab === 'staff' && <td style={{ fontFamily: 'monospace', color: 'var(--primary-gold)', fontWeight: 'bold' }}>{p.employee_code || '-'}</td>}
                        {categoryTab === 'student' && <td style={{ fontFamily: 'monospace', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>{p.student_id || '-'}</td>}
                        <td>
                          {p.daily_predictions && p.daily_predictions.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem' }}>
                              {p.daily_predictions.map((dp, i) => (
                                <div key={i} style={{ whiteSpace: 'nowrap' }}>
                                  ⚽ {dp.team_a} ({dp.score_a}) - ({dp.score_b}) {dp.team_b}
                                </div>
                              ))}
                            </div>
                          ) : '-'}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--primary-gold)' }}>
                          {p.champion_only ? `🥇 ${p.champion_only}` : '-'}
                        </td>
                        <td>
                          {p.winner ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                              <span className="winner-badge" style={{ display: 'inline-block', marginBottom: '0.15rem' }}>🏆 {p.winner}</span>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ 
                                  padding: '0.25rem 0.5rem', 
                                  fontSize: '0.75rem', 
                                  borderRadius: '6px',
                                  borderColor: 'var(--accent-cyan)',
                                  color: 'var(--accent-cyan)',
                                  background: 'rgba(0, 229, 255, 0.05)'
                                }}
                                onClick={() => setSelectedParticipantBracket(p)}
                              >
                                🔍 View Bracket
                              </button>
                            </div>
                          ) : '-'}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDate(p.created_at)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.35rem 0.6rem', background: 'rgba(255, 77, 77, 0.12)', borderColor: 'rgba(255, 77, 77, 0.25)', color: '#ff4d4d', borderRadius: '8px' }}
                            onClick={() => handleDelete(p.id, p.name)}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              filteredSortedParticipants.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
                  No matching participants found.
                </p>
              ) : (
                <table className="participants-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px', textAlign: 'center' }}>Rank</th>
                      <th>Participant</th>
                      <th>Phone</th>
                      {categoryTab === 'staff' && <th>Employee Code</th>}
                      {categoryTab === 'student' && <th>Student ID</th>}
                      <th style={{ textAlign: 'center' }}>Exact Wins 🥇</th>
                      <th style={{ textAlign: 'center' }}>Match Wins ⚽</th>
                      <th style={{ textAlign: 'center' }}>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSortedParticipants.map((p, idx) => (
                      <tr key={p.id}>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: idx === 0 ? 'var(--primary-gold)' : 'var(--text-secondary)' }}>
                          {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                        </td>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{p.phone}</td>
                        {categoryTab === 'staff' && <td style={{ fontFamily: 'monospace', color: 'var(--primary-gold)', fontWeight: 'bold' }}>{p.employee_code || '-'}</td>}
                        {categoryTab === 'student' && <td style={{ fontFamily: 'monospace', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>{p.student_id || '-'}</td>}
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#ffd700' }}>
                          {p.stats.exactCount}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#39ff14' }}>
                          {p.stats.outcomeCount}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                          <div>{p.stats.points} pts</div>
                          {p.stats.tournamentPoints > 0 && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--primary-gold)', fontWeight: 600, marginTop: '0.15rem' }}>
                              🏆 +{p.stats.tournamentPoints}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        </div>
      </div>

      {/* Correct Predictions Modal */}
      {selectedWinnersMatch && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 6, 15, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '600px',
            maxHeight: '85vh',
            overflowY: 'auto',
            position: 'relative',
            border: '1px solid var(--panel-hover-border)',
            boxShadow: '0 20px 50px rgba(0, 229, 255, 0.2)',
            textAlign: 'left'
          }}>
            {/* Close button */}
            <button 
              onClick={() => setSelectedWinnersMatch(null)}
              style={{
                position: 'absolute',
                top: '1.5rem',
                right: '1.5rem',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--panel-border)',
                color: 'var(--text-primary)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                transition: 'var(--transition-smooth)'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 77, 77, 0.2)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
              ✕
            </button>

            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--accent-cyan)' }}>
              🏆 Match Predictions Detail
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              For match: <strong>{selectedWinnersMatch.team_a} vs {selectedWinnersMatch.team_b}</strong> 
              {selectedWinnersMatch.actual_score_a !== null && selectedWinnersMatch.actual_score_b !== null 
                ? ` (Result: ${selectedWinnersMatch.actual_score_a} - ${selectedWinnersMatch.actual_score_b})` 
                : ' (Result Pending)'}
            </p>

            {/* Predictions List */}
            {(() => {
              const allPredictions = getMatchPredictions(selectedWinnersMatch);
              if (allPredictions.length === 0) {
                return (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
                    No participants predicted this match yet.
                  </p>
                );
              }

              const isCompleted = selectedWinnersMatch.actual_score_a !== null && selectedWinnersMatch.actual_score_b !== null;

              if (!isCompleted) {
                // Single section: All predictions (pending result)
                return (
                  <div>
                    <h4 style={{ 
                      color: 'var(--accent-cyan)', 
                      fontSize: '0.95rem', 
                      textTransform: 'uppercase', 
                      letterSpacing: '1px', 
                      marginBottom: '1rem',
                      borderBottom: '1px solid rgba(0, 229, 255, 0.2)',
                      paddingBottom: '0.25rem',
                      fontWeight: 700
                    }}>
                      📋 Submitted Predictions ({allPredictions.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {allPredictions.map((w, idx) => (
                        <div key={idx} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          background: 'rgba(255, 255, 255, 0.02)', 
                          padding: '0.75rem 1rem', 
                          borderRadius: '8px',
                          border: '1px solid var(--panel-border)'
                        }}>
                          <div>
                            <span style={{ fontWeight: 600 }}>{w.participant.name}</span>
                            <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', marginLeft: '0.75rem', fontSize: '0.85rem' }}>
                              {w.participant.phone}
                            </span>
                          </div>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>
                            {w.score_a} - {w.score_b}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              // Match is completed: show two sections
              const correct = allPredictions.filter(w => w.outcome !== null);
              const incorrect = allPredictions.filter(w => w.outcome === null);

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {/* SECTION 1: CORRECT PREDICTIONS */}
                  <div>
                    <h4 style={{ 
                      color: '#39ff14', 
                      fontSize: '1rem', 
                      textTransform: 'uppercase', 
                      letterSpacing: '1px', 
                      marginBottom: '1rem',
                      borderBottom: '2px solid rgba(57, 255, 20, 0.3)',
                      paddingBottom: '0.4rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span>✅ Correct Predictions</span>
                      <span style={{ background: 'rgba(57, 255, 20, 0.1)', padding: '0.1rem 0.5rem', borderRadius: '10px', fontSize: '0.8rem', color: '#39ff14' }}>
                        {correct.length}
                      </span>
                    </h4>
                    {correct.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '0.5rem 0' }}>
                        No correct predictions.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {correct.map((w, idx) => {
                          const isExact = w.outcome.type === 'exact';
                          const themeColor = isExact ? '#ffd700' : '#39ff14';
                          return (
                            <div key={idx} style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              background: isExact ? 'rgba(255, 215, 0, 0.05)' : 'rgba(57, 255, 20, 0.05)', 
                              padding: '0.75rem 1rem', 
                              borderRadius: '8px',
                              border: `1px solid ${themeColor}22`
                            }}>
                              <div>
                                <span style={{ fontWeight: 600 }}>{w.participant.name}</span>
                                <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', marginLeft: '0.75rem', fontSize: '0.85rem' }}>
                                  {w.participant.phone}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ 
                                  fontSize: '0.7rem', 
                                  color: themeColor, 
                                  fontWeight: 'bold', 
                                  background: isExact ? 'rgba(255,215,0,0.15)' : 'rgba(57,255,20,0.15)',
                                  padding: '0.15rem 0.4rem', 
                                  borderRadius: '4px' 
                                }}>
                                  {isExact ? 'Exact' : 'Winner'}
                                </span>
                                <span style={{ color: themeColor, fontWeight: 800, fontSize: '1.05rem' }}>
                                  {w.score_a} - {w.score_b}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* SECTION 2: INCORRECT PREDICTIONS */}
                  <div>
                    <h4 style={{ 
                      color: '#ff4d4d', 
                      fontSize: '1rem', 
                      textTransform: 'uppercase', 
                      letterSpacing: '1px', 
                      marginBottom: '1rem',
                      borderBottom: '2px solid rgba(255, 77, 77, 0.3)',
                      paddingBottom: '0.4rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span>❌ Incorrect Predictions</span>
                      <span style={{ background: 'rgba(255, 77, 77, 0.1)', padding: '0.1rem 0.5rem', borderRadius: '10px', fontSize: '0.8rem', color: '#ff4d4d' }}>
                        {incorrect.length}
                      </span>
                    </h4>
                    {incorrect.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '0.5rem 0' }}>
                        No incorrect predictions.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {incorrect.map((w, idx) => (
                          <div key={idx} style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            background: 'rgba(255, 77, 77, 0.02)', 
                            padding: '0.75rem 1rem', 
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 77, 77, 0.12)'
                          }}>
                            <div>
                              <span style={{ fontWeight: 600 }}>{w.participant.name}</span>
                              <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)', marginLeft: '0.75rem', fontSize: '0.85rem' }}>
                                {w.participant.phone}
                              </span>
                            </div>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                              {w.score_a} - {w.score_b}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
            
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedWinnersMatch(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Participant Bracket Predictions Modal */}
      {selectedParticipantBracket && (() => {
        let bracket = null;
        try {
          bracket = JSON.parse(selectedParticipantBracket.prediction_json);
        } catch (e) {
          console.error(e);
        }

        const scoreKeys = bracket && bracket.scores ? Object.keys(bracket.scores) : [];
        const teamAScore = scoreKeys[0] ? bracket.scores[scoreKeys[0]] : '0';
        const teamBScore = scoreKeys[1] ? bracket.scores[scoreKeys[1]] : '0';

        const flagUrl = (teamName) => `https://flagcdn.com/w40/${getTeamCode(teamName)}.png`;

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(5, 6, 15, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}>
            <div className="glass-panel" style={{
              width: '100%',
              maxWidth: '650px',
              maxHeight: '90vh',
              overflowY: 'auto',
              position: 'relative',
              border: '1px solid var(--panel-hover-border)',
              boxShadow: '0 20px 50px rgba(0, 229, 255, 0.25)',
              textAlign: 'left',
              padding: '2rem'
            }}>
              {/* Close button */}
              <button 
                onClick={() => setSelectedParticipantBracket(null)}
                style={{
                  position: 'absolute',
                  top: '1.5rem',
                  right: '1.5rem',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--panel-border)',
                  color: 'var(--text-primary)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  transition: 'var(--transition-smooth)'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 77, 77, 0.2)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              >
                ✕
              </button>

              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.25rem', color: 'var(--primary-gold)' }}>
                ⚽ Participant Bracket Prediction
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.75rem' }}>
                Participant: <strong style={{ color: 'var(--text-primary)' }}>{selectedParticipantBracket.name}</strong> 
                <span style={{ color: 'var(--text-muted)', marginLeft: '1rem' }}>📞 {selectedParticipantBracket.phone}</span>
              </p>

              {bracket ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  
                  {/* CHAMPION */}
                  <div style={{ background: 'rgba(255, 215, 0, 0.04)', border: '1px solid rgba(255, 215, 0, 0.15)', borderRadius: '12px', padding: '1rem 1.25rem' }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--primary-gold)', fontWeight: 700, marginBottom: '0.5rem' }}>
                      Predicted Champion 🏆
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <img src={flagUrl(bracket.champion)} alt={bracket.champion} style={{ width: '32px', height: '20px', borderRadius: '2px', objectFit: 'cover' }} />
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-gold)' }}>
                        {bracket.champion}
                      </span>
                    </div>
                    {scoreKeys.length >= 2 && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Predicted Final Score: <strong>{scoreKeys[0]} ({teamAScore})</strong> - <strong>({teamBScore}) {scoreKeys[1]}</strong>
                      </div>
                    )}
                  </div>

                  {/* FINALISTS */}
                  <div>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent-cyan)', fontWeight: 700, marginBottom: '0.75rem' }}>
                      Predicted Finalists (2 Teams) 🤝
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      {bracket.finalists?.map((team, idx) => (
                        <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <img src={flagUrl(team)} alt={team} style={{ width: '24px', height: '15px', borderRadius: '1px', objectFit: 'cover' }} />
                          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{team}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SEMIFINALISTS */}
                  <div>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '0.75rem' }}>
                      Predicted Semifinalists (4 Teams) ⚽
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
                      {bracket.semifinalists?.map((team, idx) => (
                        <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '0.6rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <img src={flagUrl(team)} alt={team} style={{ width: '20px', height: '12px', borderRadius: '1px', objectFit: 'cover' }} />
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{team}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* QUARTERFINALISTS */}
                  {bracket.quarterfinalists && (
                    <div>
                      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '0.75rem' }}>
                        Predicted Quarterfinalists (8 Teams) 🏃‍♂️
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
                        {bracket.quarterfinalists.map((team, idx) => (
                          <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '0.6rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <img src={flagUrl(team)} alt={team} style={{ width: '20px', height: '12px', borderRadius: '1px', objectFit: 'cover' }} />
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{team}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <p style={{ color: '#ff4d4d', textAlign: 'center', padding: '1rem' }}>
                  Error: Bracket prediction payload could not be parsed.
                </p>
              )}

              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--panel-border)', paddingTop: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => setSelectedParticipantBracket(null)}>
                  Close Bracket View
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
