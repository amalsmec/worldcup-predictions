import React, { useState, useEffect } from 'react';
import LoginRegister from './components/LoginRegister';
import PredictionWizard from './components/PredictionWizard';
import SuccessScreen from './components/SuccessScreen';
import Leaderboard from './components/Leaderboard';
import posterImage from './assets/poster.jpg';
import smeclabsLogo from './assets/smeclabs_logo.png';

const WIZARD_TEAMS = [
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

export default function App() {
  const [screen, setScreen] = useState('hero'); // 'hero' | 'auth' | 'leaderboard' | 'dashboard'
  const [userToken, setUserToken] = useState(localStorage.getItem('userToken'));
  const [userProfile, setUserProfile] = useState(null);
  const [globalStats, setGlobalStats] = useState(null);
  
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'bracket' | 'champion' | 'daily' | 'leaderboard'
  const [matches, setMatches] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isBracketLocked, setIsBracketLocked] = useState(false);
  const [isEditingBracket, setIsEditingBracket] = useState(false);
  
  // Champion Picker states
  const [selectedChampion, setSelectedChampion] = useState('');
  const [isSubmittingChamp, setIsSubmittingChamp] = useState(false);

  // Fetch scheduled matches
  const fetchMatches = async (token = userToken) => {
    try {
      const url = token ? '/api/user/matches' : '/api/today-match';
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setMatches(data);
        } else {
          setMatches([data]);
        }
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
    }
  };

  // Fetch global stats (standings and trends)
  const fetchGlobalStats = async (token = userToken) => {
    if (!token) return;
    try {
      const res = await fetch('/api/user/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setGlobalStats(data);
      }
    } catch (err) {
      console.error('Error fetching global stats:', err);
    }
  };

  // Fetch logged-in user profile & predictions
  const fetchUserProfile = async (token = userToken) => {
    if (!token) return;
    try {
      const res = await fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data);
        setScreen('dashboard');
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const fetchBracketLockStatus = async () => {
    try {
      const res = await fetch('/api/user/bracket-lock-status');
      if (res.ok) {
        const data = await res.json();
        setIsBracketLocked(data.locked);
      }
    } catch (err) {
      console.error('Error fetching bracket lock status:', err);
    }
  };

  useEffect(() => {
    fetchMatches(userToken);
    fetchBracketLockStatus();
    if (userToken) {
      fetchUserProfile(userToken);
      fetchGlobalStats(userToken);
    }
  }, [userToken, activeTab]);

  useEffect(() => {
    const handleRouting = () => {
      const hash = window.location.hash;
      const path = window.location.pathname;
      if (hash === '#/admin' || path === '/admin') {
        setScreen('admin-portal');
      }
    };
    handleRouting();
    window.addEventListener('hashchange', handleRouting);
    return () => window.removeEventListener('hashchange', handleRouting);
  }, []);

  // Auth success handler
  const handleAuthSuccess = (token, user) => {
    localStorage.setItem('userToken', token);
    setUserToken(token);
    fetchUserProfile(token);
    fetchGlobalStats(token);
    setActiveTab('overview');
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('userToken');
    setUserToken(null);
    setUserProfile(null);
    setGlobalStats(null);
    setScreen('hero');
    setActiveTab('overview');
  };

  // Submit Bracket Predictions
  const handleBracketSubmit = async (predictionData, championName) => {
    try {
      setErrorMessage('');
      const response = await fetch('/api/user/predict-bracket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({
          prediction: predictionData,
          winner: championName
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save bracket predictions.');
      }
      
      // Refresh profile state
      fetchUserProfile();
      fetchGlobalStats();
      setIsEditingBracket(false);
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message);
    }
  };

  // Submit Direct Champion Prediction
  const handleChampionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedChampion) return;

    setIsSubmittingChamp(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/user/predict-champion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({ champion: selectedChampion })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save champion prediction.');
      }
      
      fetchUserProfile();
      fetchGlobalStats();
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message);
    } finally {
      setIsSubmittingChamp(false);
    }
  };

  // Submit Match score prediction
  const handleMatchPredictionSubmit = async (matchId, scoreA, scoreB) => {
    setErrorMessage('');
    try {
      const response = await fetch('/api/user/predict-match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({
          matchId,
          scoreA,
          scoreB
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save score prediction.');
      }
      
      fetchMatches();
      fetchUserProfile();
      fetchGlobalStats();
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message);
    }
  };

  // Helper to parse flag CDN codes
  const getTeamCode = (name) => {
    // Basic mapping
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


  const getMyRankAndPoints = () => {
    if (!globalStats || !globalStats.participants || !userProfile) {
      return { rank: '-', points: 0, exactCount: 0, outcomeCount: 0, sortedParticipants: [] };
    }

    // Helper to determine prediction correctness outcome
    const getPredOutcome = (predA, predB, actA, actB) => {
      if (actA === null || actB === null || actA === undefined || actB === undefined) return null;
      const pA = parseInt(predA, 10);
      const pB = parseInt(predB, 10);
      const aA = parseInt(actA, 10);
      const aB = parseInt(actB, 10);
      
      if (pA === aA && pB === aB) {
        return { type: 'exact' };
      }
      
      const predOutcome = pA > pB ? 'winA' : pA < pB ? 'winB' : 'draw';
      const actOutcome = aA > aB ? 'winA' : aA < aB ? 'winB' : 'draw';
      
      if (predOutcome === actOutcome) {
        return { type: 'outcome' };
      }
      
      return null;
    };

    const participantsWithScores = globalStats.participants.map(p => {
      let exactCount = 0;
      let outcomeCount = 0;
      let tournamentPoints = 0;

      if (p.daily_predictions && globalStats.matches) {
        p.daily_predictions.forEach(dp => {
          const m = globalStats.matches.find(match => Number(match.id) === Number(dp.match_id));
          if (m && m.actual_score_a !== null && m.actual_score_b !== null) {
            const out = getPredOutcome(dp.score_a, dp.score_b, m.actual_score_a, m.actual_score_b);
            if (out) {
              if (out.type === 'exact') exactCount++;
              else if (out.type === 'outcome') outcomeCount++;
            }
          }
        });
      }

      const tr = globalStats.tournamentResults;
      if (tr) {
        if (p.champion_only && tr.champion && p.champion_only.toLowerCase().trim() === tr.champion.toLowerCase().trim()) {
          tournamentPoints += 15;
        }
        if (p.prediction_json) {
          try {
            const bracket = JSON.parse(p.prediction_json);
            if (bracket.quarterfinalists && tr.quarterfinalists) {
              const actualQuarters = tr.quarterfinalists.map(t => (t || '').toLowerCase().trim()).filter(Boolean);
              bracket.quarterfinalists.forEach(team => {
                if (team && actualQuarters.includes(team.toLowerCase().trim())) {
                  tournamentPoints += 2;
                }
              });
            }
            if (bracket.semifinalists && tr.semifinalists) {
              const actualSemis = tr.semifinalists.map(t => (t || '').toLowerCase().trim()).filter(Boolean);
              bracket.semifinalists.forEach(team => {
                if (team && actualSemis.includes(team.toLowerCase().trim())) {
                  tournamentPoints += 5;
                }
              });
            }
            if (bracket.finalists && tr.finalists) {
              const actualFinals = tr.finalists.map(t => (t || '').toLowerCase().trim()).filter(Boolean);
              bracket.finalists.forEach(team => {
                if (team && actualFinals.includes(team.toLowerCase().trim())) {
                  tournamentPoints += 10;
                }
              });
            }
            if (bracket.champion && tr.champion && tr.champion.trim() !== '' && bracket.champion.toLowerCase().trim() === tr.champion.toLowerCase().trim()) {
              tournamentPoints += 15;
            }
            if (bracket.champion && tr.semifinalists) {
              const actualSemis = tr.semifinalists.map(t => (t || '').toLowerCase().trim()).filter(Boolean);
              if (bracket.champion.trim() !== '' && actualSemis.includes(bracket.champion.toLowerCase().trim())) {
                tournamentPoints += 1;
              }
            }
            if (bracket.champion && tr.quarterfinalists) {
              const actualQuarters = tr.quarterfinalists.map(t => (t || '').toLowerCase().trim()).filter(Boolean);
              if (bracket.champion.trim() !== '' && actualQuarters.includes(bracket.champion.toLowerCase().trim())) {
                tournamentPoints += 1;
              }
            }
          } catch (e) {}
        }
      }

      const points = (exactCount * 3) + outcomeCount + tournamentPoints;
      return { id: p.id, name: p.name, points, exactCount, outcomeCount, tournamentPoints };
    });

    // Sort participants by points DESC, exact DESC, outcome DESC
    const sorted = [...participantsWithScores].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
      return b.outcomeCount - a.outcomeCount;
    });

    const myIndex = sorted.findIndex(p => p.id === userProfile.user.id);
    const myStats = myIndex !== -1 ? sorted[myIndex] : { points: 0, exactCount: 0, outcomeCount: 0, tournamentPoints: 0 };
    const myRank = myIndex !== -1 ? myIndex + 1 : '-';

    return {
      rank: myRank,
      points: myStats.points,
      exactCount: myStats.exactCount,
      outcomeCount: myStats.outcomeCount,
      tournamentPoints: myStats.tournamentPoints || 0,
      sortedParticipants: sorted
    };
  };

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


  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-inner">
          <div className="logo-container" onClick={() => setScreen(userToken ? 'dashboard' : 'hero')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <img src={smeclabsLogo} alt="Smeclabs Logo" style={{ height: '36px', width: 'auto', display: 'block' }} />
          </div>
          <div className="nav-buttons">
            {userToken && userProfile && (
              <span style={{ 
                marginRight: '1rem', 
                fontSize: '0.95rem', 
                color: 'var(--text-secondary)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                👤 Welcome, {userProfile.user.name}!
              </span>
            )}
            {userToken ? (
              <button className="btn btn-secondary" onClick={handleLogout}>
                🔒 Logout
              </button>
            ) : (
              <>
                {screen !== 'leaderboard' && screen !== 'admin-portal' && (
                  <button className="btn btn-secondary" onClick={() => setScreen('leaderboard')}>
                    📊 Leaderboard
                  </button>
                )}
                {(screen === 'leaderboard' || screen === 'admin-portal') && (
                  <button className="btn btn-primary" onClick={() => setScreen('hero')}>
                    🎮 Back to Game
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {errorMessage && (
          <div 
            className="glass-panel" 
            style={{ 
              position: 'fixed', 
              top: '2rem', 
              left: '50%', 
              transform: 'translateX(-50%)', 
              borderColor: '#ff4d4d', 
              padding: '1rem 2rem', 
              zIndex: 100, 
              boxShadow: '0 10px 30px rgba(255, 77, 77, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <div>
              <strong style={{ color: '#ff4d4d' }}>Error Message</strong>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{errorMessage}</div>
            </div>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', marginLeft: '1rem' }} 
              onClick={() => setErrorMessage('')}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* HERO / LANDING */}
        {screen === 'hero' && (
          <div className="center-hero">
            <div className="hero-main-layout">
              {/* Left Column: Contents */}
              <div className="hero-contents">
                <div className="hero-badge">
                  <span>⚽</span> World Cup 2026 Prediction Game
                </div>

                <h1 className="hero-title">
                  Predict The <span>World Cup Champion</span>
                </h1>
                
                <p className="hero-description">
                  Think you can predict the tournament brackets? Enter your prediction today. Select your semifinalists, finalists, and the champion. Share your brackets and compete on the global leaderboard!
                </p>

                {/* Quick stats counter */}
                <div className="hero-stats">
                  <div className="hero-stat-item">
                    <div className="hero-stat-number accent-cyan">48</div>
                    <div className="hero-stat-label">Qualified Teams</div>
                  </div>
                  <div className="hero-stat-divider"></div>
                  <div className="hero-stat-item">
                    <div className="hero-stat-number primary-gold">3</div>
                    <div className="hero-stat-label">Ways to Play</div>
                  </div>
                  <div className="hero-stat-divider"></div>
                  <div className="hero-stat-item">
                    <div className="hero-stat-number accent-cyan">Live</div>
                    <div className="hero-stat-label">Leaderboard</div>
                  </div>
                </div>

                <div className="hero-actions">
                  <button className="btn btn-primary hero-play-btn" onClick={() => setScreen('auth')}>
                    Play Now 🏆
                  </button>
                </div>
              </div>

              {/* Right Column: Visual */}
              <div className="center-hero-visual">
                <div className="glow-ring"></div>
                <img 
                  src={posterImage} 
                  alt="Who Will Be The Champions" 
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 20px 45px rgba(0, 0, 0, 0.6), 0 0 35px rgba(0, 229, 255, 0.35)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 15px 35px rgba(0, 0, 0, 0.5), 0 0 25px rgba(0, 229, 255, 0.2)';
                  }}
                />
              </div>
            </div>

            {/* Game Features Grid */}
            <div style={{ marginTop: '5rem', width: '100%' }}>
              <h2 className="groups-showcase-title">
                🎮 Interactive Prediction Challenges
              </h2>
              <p className="groups-showcase-desc">
                Put your football knowledge to the test and earn points with three distinct game modes.
              </p>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                gap: '2rem',
                width: '100%',
                textAlign: 'left'
              }}>
                {/* Feature 1 */}
                <div 
                  className="glass-panel" 
                  style={{ 
                    padding: '2.5rem 2rem', 
                    borderRadius: '20px', 
                    transition: 'transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    height: '100%'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                    e.currentTarget.style.borderColor = 'var(--primary-gold)';
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(255, 215, 0, 0.15)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.borderColor = 'var(--panel-border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onClick={() => setScreen('auth')}
                >
                  <div style={{ fontSize: '2.5rem' }}>🎮</div>
                  <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--primary-gold)', fontWeight: 800 }}>
                    Bracket Predictor
                  </h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
                    Predict the tournament bracket from Semifinals through to the Champion. Correct picks award cumulative points.
                  </p>
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                    Up to +70 pts 🏆
                  </div>
                </div>

                {/* Feature 2 */}
                <div 
                  className="glass-panel" 
                  style={{ 
                    padding: '2.5rem 2rem', 
                    borderRadius: '20px', 
                    transition: 'transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    height: '100%'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                    e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 229, 255, 0.15)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.borderColor = 'var(--panel-border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onClick={() => setScreen('auth')}
                >
                  <div style={{ fontSize: '2.5rem' }}>🥇</div>
                  <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--primary-gold)', fontWeight: 800 }}>
                    Direct Champion Pick
                  </h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
                    Choose the tournament winner directly from the 48 qualified teams. Simple, direct choice.
                  </p>
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                    +15 pts on success 🎯
                  </div>
                </div>

                {/* Feature 3 */}
                <div 
                  className="glass-panel" 
                  style={{ 
                    padding: '2.5rem 2rem', 
                    borderRadius: '20px', 
                    transition: 'transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    height: '100%'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                    e.currentTarget.style.borderColor = 'var(--primary-gold)';
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(255, 215, 0, 0.15)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.borderColor = 'var(--panel-border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onClick={() => setScreen('auth')}
                >
                  <div style={{ fontSize: '2.5rem' }}>📅</div>
                  <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--primary-gold)', fontWeight: 800 }}>
                    Daily Match Predictor
                  </h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
                    Predict scorelines for daily scheduled matches. Earn points for matching the winner outcome or guessing the exact score.
                  </p>
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                    +3 pts (exact), +1 pt (win) ⚽
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AUTHENTICATION (LOGIN / REGISTER) */}
        {screen === 'auth' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <LoginRegister onAuthSuccess={handleAuthSuccess} />
            <button 
              className="btn btn-secondary" 
              style={{ marginTop: '1.5rem', padding: '0.6rem 1.5rem', fontSize: '0.85rem' }} 
              onClick={() => setScreen('hero')}
            >
              ⬅️ Back to Home
            </button>
          </div>
        )}

        {/* LEADERBOARD (UNAUTHENTICATED) */}
        {screen === 'leaderboard' && (
          <Leaderboard onBackToGame={() => setScreen('hero')} onUpdateTodayMatch={fetchMatches} isAdmin={false} />
        )}

        {/* ADMIN PORTAL (SEPARATE ROUTE) */}
        {screen === 'admin-portal' && (
          <Leaderboard onBackToGame={() => setScreen('hero')} onUpdateTodayMatch={fetchMatches} isAdmin={true} />
        )}

        {/* LOGGED IN: USER DASHBOARD */}
        {screen === 'dashboard' && userProfile && (
          <div className="dashboard-container" style={{ width: '100%' }}>
            {/* Tabs Selector Navigation */}
            <div 
              style={{ 
                display: 'flex', 
                gap: '0.5rem', 
                marginBottom: '2.5rem', 
                borderBottom: '1px solid var(--panel-border)',
                paddingBottom: '1rem',
                flexWrap: 'wrap'
              }}
            >
              <button 
                className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem' }}
                onClick={() => setActiveTab('overview')}
              >
                🏠 Overview
              </button>
              <button 
                className={`btn ${activeTab === 'bracket' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem' }}
                onClick={() => setActiveTab('bracket')}
              >
                🎮 Bracket Predictor
              </button>
              <button 
                className={`btn ${activeTab === 'champion' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem' }}
                onClick={() => setActiveTab('champion')}
              >
                🏆 Predict the Champion
              </button>
              <button 
                className={`btn ${activeTab === 'daily' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem' }}
                onClick={() => setActiveTab('daily')}
              >
                📅 Today's Match
              </button>
              <button 
                className={`btn ${activeTab === 'leaderboard' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem' }}
                onClick={() => setActiveTab('leaderboard')}
              >
                📊 Leaderboard
              </button>
            </div>

            {/* TAB 0: DASHBOARD OVERVIEW */}
            {activeTab === 'overview' && (() => {
              const myStats = getMyRankAndPoints();
              const points = myStats.points;
              const rank = myStats.rank;
              const exactCount = myStats.exactCount;
              const outcomeCount = myStats.outcomeCount;
              const tournamentPoints = myStats.tournamentPoints || 0;

              const isBracketSubmitted = !!userProfile.predictions.prediction_json;
              const championOnlyPick = userProfile.predictions.champion_only;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', width: '100%', textAlign: 'left' }}>
                  
                  {/* Welcome & Stats Row */}
                  <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
                      <div>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, margin: 0 }}>
                          Welcome back, {userProfile.user.name}! ⚽
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '0.25rem 0 0 0' }}>
                          Here is your World Cup prediction dashboard overview.
                        </p>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        📞 {userProfile.user.phone ? userProfile.user.phone.replace(/.(?=.{4})/g, '*') : ''}
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="stats-grid" style={{ marginBottom: 0 }}>
                      <div className="stat-card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                        <span className="stat-val stat-val-gold">{points}</span>
                        <span className="stat-label">Total Points</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {exactCount} Exact ({exactCount * 3} pts) • {outcomeCount} Outcome ({outcomeCount} pts) • {tournamentPoints} Bracket ({tournamentPoints} pts)
                        </span>
                      </div>
                      <div className="stat-card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                        <span className="stat-val" style={{ color: 'var(--accent-cyan)' }}>#{rank}</span>
                        <span className="stat-label">Leaderboard Position</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Out of {globalStats?.totalParticipants || 0} participants
                        </span>
                      </div>
                      <div className="stat-card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                        <span className="stat-val" style={{ color: isBracketSubmitted ? '#39ff14' : '#ff4d4d', fontSize: '2rem' }}>
                          {isBracketSubmitted ? '✅ Submitted' : '❌ Pending'}
                        </span>
                        <span className="stat-label">Bracket Predictor</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                          <span>
                            {isBracketSubmitted 
                              ? (globalStats?.tournamentResults 
                                  ? `Earned: ${tournamentPoints} points 🏆` 
                                  : (isBracketLocked ? 'Predictions Locked 🔒' : 'Submitted (Click Bracket tab to edit) ✏️'))
                              : (isBracketLocked ? 'Predictions Closed 🔒' : 'Click Bracket tab to submit 🎮')
                            }
                          </span>
                          {!isBracketLocked && !globalStats?.tournamentResults && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              ⏳ Edit until July 4, 2026, 5:30 PM IST
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="stat-card" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        {championOnlyPick ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                            <div className="flag-wrapper" style={{ width: '38px', height: '38px', borderColor: 'var(--primary-gold)' }}>
                              <img src={`https://flagcdn.com/w80/${getTeamCode(championOnlyPick)}.png`} alt={championOnlyPick} className="team-flag" />
                            </div>
                            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-gold)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '180px' }}>
                              {championOnlyPick}
                            </span>
                          </div>
                        ) : (
                          <span className="stat-val" style={{ color: '#ff4d4d', fontSize: '2rem' }}>None</span>
                        )}
                        <span className="stat-label" style={{ marginTop: '0.5rem' }}>Champion Pick</span>
                      </div>
                    </div>
                  </div>

                  {/* Main Grid: Left and Right Columns */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '2.5rem', width: '100%' }} className="dashboard-sections">
                    
                    {/* Left Column: Matches and History */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                      
                      {/* Open Match Predictor */}
                      <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.75rem' }}>
                          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
                            📅 Today's Match Predictions
                          </h3>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', borderRadius: '6px' }}
                            onClick={() => setActiveTab('daily')}
                          >
                            View All Matches
                          </button>
                        </div>

                        {matches && matches.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {matches.slice(0, 3).map(match => {
                              const hasPredicted = match.score_a !== null && match.score_b !== null;
                              const isTimeLocked = match.match_date && match.match_time && (
                                Date.now() >= new Date(`${match.match_date}T${match.match_time}:00+05:30`).getTime() - (5 * 60 * 1000)
                              );
                              const isLocked = match.is_locked === 1 || isTimeLocked || (match.actual_score_a !== null && match.actual_score_b !== null);

                              return (
                                <div 
                                  key={match.id} 
                                  style={{ 
                                    padding: '1.25rem 1.5rem', 
                                    borderRadius: '16px', 
                                    border: '1px solid var(--panel-border)', 
                                    background: 'rgba(255,255,255,0.01)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '1rem'
                                  }}
                                >
                                  {/* Team names & flags */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '220px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <img src={`https://flagcdn.com/w40/${getTeamCode(match.team_a)}.png`} alt="" style={{ width: '24px', height: '16px', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.1)' }} />
                                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{match.team_a}</span>
                                    </div>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 'bold' }}>VS</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <img src={`https://flagcdn.com/w40/${getTeamCode(match.team_b)}.png`} alt="" style={{ width: '24px', height: '16px', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.1)' }} />
                                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{match.team_b}</span>
                                    </div>
                                  </div>

                                  {/* Score input / output */}
                                  <div>
                                    {hasPredicted ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Your prediction:</span>
                                        <span style={{ fontWeight: 800, color: 'var(--accent-cyan)', background: 'rgba(0,229,255,0.1)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.9rem' }}>
                                          {match.score_a} - {match.score_b}
                                        </span>
                                        {match.actual_score_a !== null && (
                                          <span style={{ fontWeight: 'bold', color: 'var(--primary-gold)', fontSize: '0.9rem' }}>
                                            (Actual: {match.actual_score_a}-{match.actual_score_b})
                                          </span>
                                        )}
                                      </div>
                                    ) : isLocked ? (
                                      <span style={{ fontSize: '0.8rem', color: '#ff4d4d', fontWeight: 'bold', background: 'rgba(255,77,77,0.1)', padding: '0.25rem 0.5rem', borderRadius: '6px' }}>
                                        🔒 Closed
                                      </span>
                                    ) : (
                                      <button 
                                        className="btn btn-primary" 
                                        style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', borderRadius: '8px' }}
                                        onClick={() => setActiveTab('daily')}
                                      >
                                        ✍️ Predict Score
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0', margin: 0 }}>
                            No matches scheduled today.
                          </p>
                        )}
                      </div>

                      {/* Score Predictions History summary */}
                      <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.75rem' }}>
                          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
                             Your Prediction History
                          </h3>
                        </div>

                        {userProfile.dailyPredictions && userProfile.dailyPredictions.length > 0 ? (
                          <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {userProfile.dailyPredictions.map(dp => {
                              const match = matches.find(m => Number(m.id) === Number(dp.match_id));
                              const actualScoreStr = match && match.actual_score_a !== null ? `${match.actual_score_a} - ${match.actual_score_b}` : '-';
                              const outcome = match ? getPredictionOutcome(dp.score_a, dp.score_b, match.actual_score_a, match.actual_score_b) : null;
                              
                              return (
                                <div key={dp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem' }}>
                                  <div style={{ fontSize: '0.85rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>⚽ {match ? `${match.team_a} vs ${match.team_b}` : 'Match'}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Pred: {dp.score_a} - {dp.score_b}</span>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Act: {actualScoreStr}</span>
                                    {outcome && (
                                      <span style={{ fontSize: '0.75rem', color: outcome.color, fontWeight: 'bold' }}>
                                        {outcome.type === 'exact' ? '🏆 +3' : '⚽ +1'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0', margin: 0 }}>
                            You haven't submitted any match score predictions yet.
                          </p>
                        )}
                      </div>

                    </div>

                    {/* Right Column: Mini Leaderboard and Trends */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                      
                      {/* Compact Leaderboard */}
                      <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.75rem' }}>
                          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
                            🏆 Top Standings
                          </h3>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', borderRadius: '6px' }}
                            onClick={() => setActiveTab('leaderboard')}
                          >
                            View All
                          </button>
                        </div>

                        {globalStats?.participants && globalStats.participants.length > 0 ? (() => {
                          return (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'left' }}>
                                  <th style={{ padding: '0.5rem 0.25rem' }}>Rank</th>
                                  <th style={{ padding: '0.5rem' }}>Name</th>
                                  <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>Points</th>
                                </tr>
                              </thead>
                              <tbody>
                                {myStats.sortedParticipants.slice(0, 5).map((p, idx) => {
                                  const isMe = p.id === userProfile.user.id;
                                  return (
                                    <tr 
                                      key={p.id} 
                                      style={{ 
                                        borderBottom: '1px solid rgba(255,255,255,0.03)', 
                                        fontSize: '0.85rem',
                                        fontWeight: isMe ? 700 : 500,
                                        color: isMe ? 'var(--primary-gold)' : 'inherit'
                                      }}
                                    >
                                      <td style={{ padding: '0.5rem 0.25rem' }}>#{idx + 1}</td>
                                      <td style={{ padding: '0.5rem' }}>
                                        {p.name} {isMe && '👤'}
                                      </td>
                                      <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', fontWeight: 'bold' }}>{p.points}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          );
                        })() : (
                          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0', margin: 0 }}>
                            No entries yet.
                          </p>
                        )}
                      </div>

                      {/* Compact Champion Pick Trends */}
                      <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.75rem' }}>
                          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
                            📈 Expected Champions
                          </h3>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', borderRadius: '6px' }}
                            onClick={() => setActiveTab('leaderboard')}
                          >
                            Details
                          </button>
                        </div>

                        {globalStats?.championOnlyStats && globalStats.championOnlyStats.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {globalStats.championOnlyStats.slice(0, 3).map(stat => {
                              const pct = globalStats.totalParticipants > 0 
                                ? Math.round((stat.count / globalStats.totalParticipants) * 100) 
                                : 0;
                              return (
                                <div key={stat.champion_only} className="trend-bar-wrapper">
                                  <div className="trend-bar-info" style={{ fontSize: '0.8rem' }}>
                                    <span className="trend-team-name">🏆 {stat.champion_only}</span>
                                    <span style={{ color: 'var(--text-secondary)' }}>
                                      {stat.count} votes ({pct}%)
                                    </span>
                                  </div>
                                  <div className="trend-bar-bg" style={{ height: '6px' }}>
                                    <div className="trend-bar-fill" style={{ width: `${pct}%` }}></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0', margin: 0 }}>
                            No predictions submitted yet.
                          </p>
                        )}
                      </div>

                    </div>
                  </div>
                </div>
              );
            })()}

            {/* TAB 1: BRACKET WIZARD */}
            {activeTab === 'bracket' && (
              <div>
                {userProfile.predictions.prediction_json && !isEditingBracket ? (
                  <SuccessScreen
                    participant={userProfile.user}
                    prediction={{
                      scores: JSON.parse(userProfile.predictions.prediction_json).scores || {},
                      finalists: JSON.parse(userProfile.predictions.prediction_json).finalists || [],
                      semifinalists: JSON.parse(userProfile.predictions.prediction_json).semifinalists || [],
                      champion: userProfile.predictions.winner
                    }}
                    isLocked={isBracketLocked}
                    onReset={() => setIsEditingBracket(true)}
                    onViewLeaderboard={() => setActiveTab('leaderboard')}
                    tournamentResults={userProfile.tournamentResults}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {isBracketLocked ? (
                      <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center', borderRadius: '24px', border: '1px solid rgba(255, 77, 77, 0.2)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, color: '#ff4d4d', margin: '0 0 0.5rem 0' }}>
                          Predictions Closed
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0, lineHeight: '1.6' }}>
                          Tournament bracket predictions are locked by the administrator. No further entries or updates can be submitted.
                        </p>
                      </div>
                    ) : (
                      <>
                        {isEditingBracket && (
                          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                            <button 
                              className="btn btn-secondary" 
                              onClick={() => setIsEditingBracket(false)}
                              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                            >
                              ⬅️ Cancel Editing (View Saved Bracket)
                            </button>
                          </div>
                        )}
                        <PredictionWizard 
                          onSubmit={handleBracketSubmit} 
                          initialPrediction={userProfile.predictions.prediction_json ? JSON.parse(userProfile.predictions.prediction_json) : null}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: PREDICT THE CHAMPION */}
            {activeTab === 'champion' && (
              <div className="glass-panel" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 700, marginBottom: '1rem' }}>
                  Predict the World Cup Winner
                </h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                  Directly choose the team you think will win the entire tournament from all 48 qualified countries.
                </p>

                {userProfile.predictions.champion_only ? (() => {
                  const tr = userProfile.tournamentResults;
                  const isCorrect = tr && tr.champion && 
                    userProfile.predictions.champion_only.toLowerCase().trim() === tr.champion.toLowerCase().trim();
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', marginTop: '1rem' }}>
                      {tr && tr.champion && (
                        <div style={{ 
                          width: '100%',
                          maxWidth: '380px',
                          padding: '0.75rem 1rem', 
                          borderRadius: '8px', 
                          fontWeight: 'bold', 
                          textAlign: 'center',
                          fontSize: '0.9rem',
                          background: isCorrect ? 'rgba(57, 255, 20, 0.12)' : 'rgba(255, 77, 77, 0.12)', 
                          border: isCorrect ? '1px solid rgba(57, 255, 20, 0.25)' : '1px solid rgba(255, 77, 77, 0.25)', 
                          color: isCorrect ? '#39ff14' : '#ff4d4d' 
                        }}>
                          {isCorrect 
                            ? '🎉 Correct Champion Pick! (+15 points)' 
                            : `😔 Incorrect Pick. Actual Champion: ${tr.champion} (0 points)`}
                        </div>
                      )}
                      <div 
                        className="flag-wrapper" 
                        style={{ 
                          width: '80px', 
                          height: '80px', 
                          borderColor: tr && tr.champion ? (isCorrect ? '#39ff14' : '#ff4d4d') : 'var(--primary-gold)',
                          borderWidth: '2px',
                          boxShadow: tr && tr.champion ? (isCorrect ? '0 0 20px rgba(57, 255, 20, 0.25)' : '0 0 20px rgba(255, 77, 77, 0.25)') : '0 0 20px rgba(255, 215, 0, 0.3)'
                        }}
                      >
                        <img 
                          src={`https://flagcdn.com/w160/${getTeamCode(userProfile.predictions.champion_only)}.png`} 
                          alt={userProfile.predictions.champion_only} 
                          className="team-flag" 
                        />
                      </div>
                      <h4 style={{ fontSize: '1.5rem', color: tr && tr.champion ? (isCorrect ? '#39ff14' : '#ff4d4d') : 'var(--primary-gold)' }}>
                        🥇 {userProfile.predictions.champion_only}
                      </h4>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Your champion prediction has been saved successfully. Good luck!
                      </p>
                    </div>
                  );
                })() : (
                  <form onSubmit={handleChampionSubmit}>
                    <div className="form-group" style={{ marginBottom: '2rem' }}>
                      <label htmlFor="champion-select">Select Winner</label>
                      <select
                        id="champion-select"
                        className="form-input"
                        style={{ background: 'rgba(5, 6, 15, 0.9)' }}
                        value={selectedChampion}
                        onChange={(e) => setSelectedChampion(e.target.value)}
                        required
                      >
                        <option value="">-- Choose Champion --</option>
                        {WIZARD_TEAMS.map(team => (
                          <option key={team} value={team}>{team}</option>
                        ))}
                      </select>
                    </div>

                    <button 
                      type="submit" 
                      className="btn btn-gold" 
                      style={{ padding: '0.9rem 2.5rem', width: '100%' }}
                      disabled={isSubmittingChamp || !selectedChampion}
                    >
                      {isSubmittingChamp ? 'Saving Prediction...' : '🏆 Submit Champion Selection'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* TAB 3: TODAY'S MATCH */}
            {activeTab === 'daily' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', maxWidth: '800px', margin: '0 auto' }}>
                
                {/* Active Predictor Card */}
                <div className="glass-panel" style={{ textAlign: 'center' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                    Match Predictor
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', fontSize: '0.95rem' }}>
                    Predict scorelines for all scheduled matches. You can submit one score prediction per match.
                  </p>

                  {matches && matches.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                      {matches.map(match => {
                        const hasPredicted = match.score_a !== null && match.score_b !== null;
                        
                        // Check if match is locked (either manually locked, starts within 5 minutes, or result entered)
                        const isTimeLocked = match.match_date && match.match_time && (
                          Date.now() >= new Date(`${match.match_date}T${match.match_time}:00+05:30`).getTime() - (5 * 60 * 1000)
                        );
                        const isLocked = match.is_locked === 1 || isTimeLocked || (match.actual_score_a !== null && match.actual_score_b !== null);

                        return (
                          <div 
                            key={match.id} 
                            style={{ 
                              padding: '2rem', 
                              borderRadius: '16px', 
                              border: '1px solid var(--panel-border)', 
                              background: 'rgba(255,255,255,0.01)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '1.5rem',
                              alignItems: 'center'
                            }}
                          >
                            {/* Match Date and Time */}
                            <div style={{ 
                              fontSize: '0.85rem', 
                              color: 'var(--text-muted)', 
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '1px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}>
                              <span>📅 {match.match_date} @ {match.match_time}</span>
                              <span style={{
                                fontSize: '0.75rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                fontWeight: 'bold',
                                background: isLocked ? 'rgba(255, 77, 77, 0.12)' : 'rgba(57, 255, 20, 0.12)',
                                color: isLocked ? '#ff4d4d' : '#39ff14',
                                border: isLocked ? '1px solid rgba(255, 77, 77, 0.25)' : '1px solid rgba(57, 255, 20, 0.25)'
                              }}>
                                {isLocked ? '🔒 Locked' : '🟢 Open'}
                              </span>
                            </div>

                            {hasPredicted ? (() => {
                              const outcome = getPredictionOutcome(match.score_a, match.score_b, match.actual_score_a, match.actual_score_b);
                              const themeColor = outcome ? outcome.color : 'var(--accent-cyan)';
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%' }}>
                                  {outcome ? (
                                    <div style={{ 
                                      fontSize: '0.9rem', 
                                      color: themeColor, 
                                      fontWeight: 'bold', 
                                      background: outcome.type === 'exact' ? 'rgba(57,255,20,0.07)' : outcome.type === 'outcome' ? 'rgba(0,229,255,0.07)' : 'rgba(255,77,77,0.07)',
                                      border: `1px solid ${themeColor}33`,
                                      padding: '0.5rem 1rem',
                                      borderRadius: '8px',
                                      textAlign: 'center',
                                      width: '100%',
                                      maxWidth: '380px'
                                    }}>
                                      {outcome.label}
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                                      ✓ PREDICTION SUBMITTED
                                    </div>
                                  )}
                                  
                                  <div className="score-inputs-wrapper" style={{ gap: '2rem', marginBottom: 0 }}>
                                    <div className="score-team-info" style={{ width: '120px' }}>
                                      <div className="flag-wrapper" style={{ width: '50px', height: '50px', borderColor: themeColor }}>
                                        <img src={`https://flagcdn.com/w160/${getTeamCode(match.team_a)}.png`} alt={match.team_a} className="team-flag" />
                                      </div>
                                      <span style={{ fontSize: '1rem', marginTop: '0.5rem', fontWeight: 600 }}>{match.team_a}</span>
                                    </div>

                                    <div 
                                      style={{ 
                                        fontSize: '2.5rem', 
                                        fontWeight: 800, 
                                        color: themeColor,
                                        fontFamily: 'var(--font-display)',
                                        alignSelf: 'center'
                                      }}
                                    >
                                      {match.score_a} : {match.score_b}
                                    </div>

                                    <div className="score-team-info" style={{ width: '120px' }}>
                                      <div className="flag-wrapper" style={{ width: '50px', height: '50px', borderColor: themeColor }}>
                                        <img src={`https://flagcdn.com/w160/${getTeamCode(match.team_b)}.png`} alt={match.team_b} className="team-flag" />
                                      </div>
                                      <span style={{ fontSize: '1rem', marginTop: '0.5rem', fontWeight: 600 }}>{match.team_b}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()
                            : isLocked ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%' }}>
                                <div style={{ 
                                  fontSize: '0.9rem', 
                                  color: '#ff4d4d', 
                                  fontWeight: 'bold', 
                                  background: 'rgba(255,77,77,0.07)',
                                  border: '1px solid rgba(255,77,77,0.33)',
                                  padding: '0.5rem 1rem',
                                  borderRadius: '8px',
                                  textAlign: 'center',
                                  width: '100%',
                                  maxWidth: '380px'
                                }}>
                                  {match.actual_score_a !== null && match.actual_score_b !== null ? (
                                    '🔒 Predictions Closed (Match Completed)'
                                  ) : match.is_locked === 1 ? (
                                    '🔒 Predictions Closed (Locked by Admin)'
                                  ) : (
                                    '🔒 Predictions Closed (Match Starting Soon)'
                                  )}
                                </div>
                                <div className="score-inputs-wrapper" style={{ gap: '2rem', marginBottom: 0 }}>
                                  <div className="score-team-info" style={{ width: '120px' }}>
                                    <div className="flag-wrapper" style={{ width: '50px', height: '50px' }}>
                                      <img src={`https://flagcdn.com/w160/${getTeamCode(match.team_a)}.png`} alt={match.team_a} className="team-flag" />
                                    </div>
                                    <span style={{ fontSize: '1rem', marginTop: '0.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>{match.team_a}</span>
                                  </div>

                                  <div 
                                    style={{ 
                                      fontSize: '2.2rem', 
                                      fontWeight: 800, 
                                      color: 'var(--text-muted)',
                                      fontFamily: 'var(--font-display)',
                                      alignSelf: 'center'
                                    }}
                                  >
                                    {match.actual_score_a !== null && match.actual_score_b !== null ? (
                                      `${match.actual_score_a} : ${match.actual_score_b}`
                                    ) : (
                                      '- : -'
                                    )}
                                  </div>

                                  <div className="score-team-info" style={{ width: '120px' }}>
                                    <div className="flag-wrapper" style={{ width: '50px', height: '50px' }}>
                                      <img src={`https://flagcdn.com/w160/${getTeamCode(match.team_b)}.png`} alt={match.team_b} className="team-flag" />
                                    </div>
                                    <span style={{ fontSize: '1rem', marginTop: '0.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>{match.team_b}</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <MatchPredictionForm 
                                match={match} 
                                onSubmit={handleMatchPredictionSubmit} 
                                getTeamCode={getTeamCode} 
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-secondary)' }}>No scheduled matches available at the moment.</p>
                  )}
                </div>

                {/* Daily Predictions History List */}
                <div className="glass-panel" style={{ textAlign: 'left' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.75rem' }}>
                    🕒 Your Score Predictions History
                  </h3>
                  
                  {userProfile.dailyPredictions && userProfile.dailyPredictions.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {userProfile.dailyPredictions.map((pred, idx) => (
                        <div 
                          key={idx} 
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            background: 'rgba(255,255,255,0.02)',
                            padding: '1rem 1.25rem',
                            borderRadius: '12px',
                            border: '1px solid var(--panel-border)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <img src={`https://flagcdn.com/w160/${getTeamCode(pred.match_team_a)}.png`} alt="" style={{ width: '24px', height: '16px', objectFit: 'cover', borderRadius: '2px' }} />
                              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{pred.match_team_a}</span>
                            </div>
                            <span style={{ color: 'var(--text-muted)' }}>vs</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <img src={`https://flagcdn.com/w160/${getTeamCode(pred.match_team_b)}.png`} alt="" style={{ width: '24px', height: '16px', objectFit: 'cover', borderRadius: '2px' }} />
                              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{pred.match_team_b}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                            {(() => {
                              const outcome = getPredictionOutcome(pred.score_a, pred.score_b, pred.actual_score_a, pred.actual_score_b);
                              if (!outcome) return null;
                              return (
                                <span style={{ 
                                  fontSize: '0.75rem', 
                                  color: outcome.color, 
                                  fontWeight: 'bold',
                                  background: outcome.type === 'exact' ? 'rgba(57,255,20,0.08)' : outcome.type === 'outcome' ? 'rgba(0,229,255,0.08)' : 'rgba(255,77,77,0.08)',
                                  border: `1px solid ${outcome.color}33`,
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '6px'
                                }}>
                                  {outcome.type === 'exact' ? '🏆 Exact Match' : outcome.type === 'outcome' ? '⚽ Outcome Match' : '❌ Incorrect'}
                                </span>
                              );
                            })()}
                            <span style={{ color: 'var(--accent-cyan)', fontWeight: 800, fontSize: '1.2rem', fontFamily: 'var(--font-display)' }}>
                              {pred.score_a} - {pred.score_b}
                            </span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {formatDate(pred.created_at)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1.5rem 0' }}>
                      You have not submitted any daily score predictions yet.
                    </p>
                  )}
                </div>

              </div>
            )}

            {/* TAB 4: GLOBAL LEADERBOARD */}
            {activeTab === 'leaderboard' && (
              <Leaderboard 
                isAdmin={false} 
                userToken={userToken} 
                onBackToGame={() => setActiveTab('bracket')} 
              />
            )}

          </div>
        )}
      </main>
      <footer className="app-footer">
        <p>Designed and Developed by IT & Marketing Team SMEClabs</p>
      </footer>
    </div>
  );
}
function MatchPredictionForm({ match, onSubmit, getTeamCode }) {
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (scoreA === '' || scoreB === '') return;
    setSubmitting(true);
    await onSubmit(match.id, scoreA, scoreB);
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="score-inputs-wrapper" style={{ marginBottom: '1.5rem' }}>
        <div className="score-team-info">
          <div className="flag-wrapper" style={{ width: '50px', height: '50px' }}>
            <img src={`https://flagcdn.com/w160/${getTeamCode(match.team_a)}.png`} alt={match.team_a} className="team-flag" />
          </div>
          <span style={{ fontWeight: 600 }}>{match.team_a}</span>
        </div>

        <input
          type="text"
          maxLength="2"
          className="score-input"
          placeholder="0"
          value={scoreA}
          onChange={(e) => setScoreA(e.target.value.replace(/[^0-9]/g, ''))}
          required
        />

        <span className="score-divider">:</span>

        <input
          type="text"
          maxLength="2"
          className="score-input"
          placeholder="0"
          value={scoreB}
          onChange={(e) => setScoreB(e.target.value.replace(/[^0-9]/g, ''))}
          required
        />

        <div className="score-team-info">
          <div className="flag-wrapper" style={{ width: '50px', height: '50px' }}>
            <img src={`https://flagcdn.com/w160/${getTeamCode(match.team_b)}.png`} alt={match.team_b} className="team-flag" />
          </div>
          <span style={{ fontWeight: 600 }}>{match.team_b}</span>
        </div>
      </div>

      <button 
        type="submit" 
        className="btn btn-primary" 
        style={{ padding: '0.75rem 2rem', width: '100%', maxWidth: '240px' }}
        disabled={submitting || scoreA === '' || scoreB === ''}
      >
        {submitting ? 'Submitting...' : '🎯 Submit Prediction'}
      </button>
    </form>
  );
}
function formatDate(isoString) {
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
}
function getPredictionOutcome(predA, predB, actA, actB) {
  if (actA === null || actB === null || actA === undefined || actB === undefined) return null;
  const pA = parseInt(predA, 10);
  const pB = parseInt(predB, 10);
  const aA = parseInt(actA, 10);
  const aB = parseInt(actB, 10);
  
  if (pA === aA && pB === aB) {
    return { type: 'exact', label: '🏆 Exact Match! Correct Score Predicted 🎉', color: '#39ff14' };
  }
  
  const predOutcome = pA > pB ? 'winA' : pA < pB ? 'winB' : 'draw';
  const actOutcome = aA > aB ? 'winA' : aA < aB ? 'winB' : 'draw';
  
  if (predOutcome === actOutcome) {
    return { type: 'outcome', label: '⚽ Correct Winner Predicted! 👍', color: '#00e5ff' };
  }
  
  return { type: 'incorrect', label: `❌ Incorrect Prediction (Actual: ${aA} - ${aB})`, color: '#ff4d4d' };
}
