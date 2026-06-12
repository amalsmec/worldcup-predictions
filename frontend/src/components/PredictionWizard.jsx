import React, { useState, useEffect } from 'react';

const TEAMS = [
  // Group A
  { id: 'mex', name: 'Mexico', code: 'mx' },
  { id: 'rsa', name: 'South Africa', code: 'za' },
  { id: 'kor', name: 'South Korea', code: 'kr' },
  { id: 'cze', name: 'Czechia', code: 'cz' },
  // Group B
  { id: 'can', name: 'Canada', code: 'ca' },
  { id: 'bih', name: 'Bosnia and Herzegovina', code: 'ba' },
  { id: 'qat', name: 'Qatar', code: 'qa' },
  { id: 'sui', name: 'Switzerland', code: 'ch' },
  // Group C
  { id: 'bra', name: 'Brazil', code: 'br' },
  { id: 'mar', name: 'Morocco', code: 'ma' },
  { id: 'hai', name: 'Haiti', code: 'ht' },
  { id: 'sco', name: 'Scotland', code: 'gb-sct' },
  // Group D
  { id: 'usa', name: 'United States (USA)', code: 'us' },
  { id: 'par', name: 'Paraguay', code: 'py' },
  { id: 'aus', name: 'Australia', code: 'au' },
  { id: 'tur', name: 'Turkiye', code: 'tr' },
  // Group E
  { id: 'ger', name: 'Germany', code: 'de' },
  { id: 'cur', name: 'Curaçao', code: 'cw' },
  { id: 'civ', name: "Ivory Coast (Côte d'Ivoire)", code: 'ci' },
  { id: 'ecu', name: 'Ecuador', code: 'ec' },
  // Group F
  { id: 'ned', name: 'Netherlands', code: 'nl' },
  { id: 'jpn', name: 'Japan', code: 'jp' },
  { id: 'swe', name: 'Sweden', code: 'se' },
  { id: 'tun', name: 'Tunisia', code: 'tn' },
  // Group G
  { id: 'bel', name: 'Belgium', code: 'be' },
  { id: 'egy', name: 'Egypt', code: 'eg' },
  { id: 'irn', name: 'Iran (IR Iran)', code: 'ir' },
  { id: 'nzl', name: 'New Zealand', code: 'nz' },
  // Group H
  { id: 'esp', name: 'Spain', code: 'es' },
  { id: 'cpv', name: 'Cape Verde', code: 'cv' },
  { id: 'ksa', name: 'Saudi Arabia', code: 'sa' },
  { id: 'uru', name: 'Uruguay', code: 'uy' },
  // Group I
  { id: 'fra', name: 'France', code: 'fr' },
  { id: 'sen', name: 'Senegal', code: 'sn' },
  { id: 'irq', name: 'Iraq', code: 'iq' },
  { id: 'nor', name: 'Norway', code: 'no' },
  // Group J
  { id: 'arg', name: 'Argentina', code: 'ar' },
  { id: 'alg', name: 'Algeria', code: 'dz' },
  { id: 'aut', name: 'Austria', code: 'at' },
  { id: 'jor', name: 'Jordan', code: 'jo' },
  // Group K
  { id: 'por', name: 'Portugal', code: 'pt' },
  { id: 'cod', name: 'DR Congo', code: 'cd' },
  { id: 'uzb', name: 'Uzbekistan', code: 'uz' },
  { id: 'col', name: 'Colombia', code: 'co' },
  // Group L
  { id: 'eng', name: 'England', code: 'gb-eng' },
  { id: 'cro', name: 'Croatia', code: 'hr' },
  { id: 'gha', name: 'Ghana', code: 'gh' },
  { id: 'pan', name: 'Panama', code: 'pa' }
];

export default function PredictionWizard({ onSubmit, initialPrediction }) {
  const [step, setStep] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selections state
  const [quarterfinalists, setQuarterfinalists] = useState(() => {
    if (initialPrediction && Array.isArray(initialPrediction.quarterfinalists)) {
      return initialPrediction.quarterfinalists.map(name => TEAMS.find(t => t.name.toLowerCase().trim() === name.toLowerCase().trim())).filter(Boolean);
    }
    return [];
  });
  const [semifinalists, setSemifinalists] = useState(() => {
    if (initialPrediction && Array.isArray(initialPrediction.semifinalists)) {
      return initialPrediction.semifinalists.map(name => TEAMS.find(t => t.name.toLowerCase().trim() === name.toLowerCase().trim())).filter(Boolean);
    }
    return [];
  });
  const [finalists, setFinalists] = useState(() => {
    if (initialPrediction && Array.isArray(initialPrediction.finalists)) {
      return initialPrediction.finalists.map(name => TEAMS.find(t => t.name.toLowerCase().trim() === name.toLowerCase().trim())).filter(Boolean);
    }
    return [];
  });
  const [champion, setChampion] = useState(() => {
    if (initialPrediction && initialPrediction.champion) {
      return TEAMS.find(t => t.name.toLowerCase().trim() === initialPrediction.champion.toLowerCase().trim()) || null;
    }
    return null;
  });
  
  // Score state
  const [scores, setScores] = useState(() => {
    if (initialPrediction && initialPrediction.scores && initialPrediction.finalists && initialPrediction.finalists.length === 2) {
      const f1 = initialPrediction.finalists[0];
      const f2 = initialPrediction.finalists[1];
      return {
        teamA: initialPrediction.scores[f1] !== undefined ? initialPrediction.scores[f1].toString() : '',
        teamB: initialPrediction.scores[f2] !== undefined ? initialPrediction.scores[f2].toString() : ''
      };
    }
    return {
      teamA: '',
      teamB: ''
    };
  });

  // Prune invalid downstream selections when upstream selections change
  useEffect(() => {
    setSemifinalists(prev => prev.filter(semi => quarterfinalists.some(q => q.id === semi.id)));
  }, [quarterfinalists]);

  useEffect(() => {
    setFinalists(prev => prev.filter(final => semifinalists.some(s => s.id === final.id)));
  }, [semifinalists]);

  useEffect(() => {
    if (champion && !finalists.some(f => f.id === champion.id)) {
      setChampion(null);
    }
  }, [finalists, champion]);

  // Flag URL builder
  const getFlagUrl = (code) => `https://flagcdn.com/w160/${code}.png`;

  // Step 1: Quarterfinalists handler
  const handleSelectQuarterfinalist = (team) => {
    if (quarterfinalists.some(t => t.id === team.id)) {
      setQuarterfinalists(quarterfinalists.filter(t => t.id !== team.id));
      // Reset subsequent steps if we unselect
      setSemifinalists([]);
      setFinalists([]);
      setChampion(null);
    } else {
      if (quarterfinalists.length < 8) {
        setQuarterfinalists([...quarterfinalists, team]);
      }
    }
  };

  // Step 2: Semifinalists handler
  const handleSelectSemifinalist = (team) => {
    if (semifinalists.some(t => t.id === team.id)) {
      setSemifinalists(semifinalists.filter(t => t.id !== team.id));
      // Reset subsequent steps if we unselect
      setFinalists([]);
      setChampion(null);
    } else {
      if (semifinalists.length < 4) {
        setSemifinalists([...semifinalists, team]);
      }
    }
  };

  // Step 3: Finalists handler
  const handleSelectFinalist = (team) => {
    if (finalists.some(t => t.id === team.id)) {
      setFinalists(finalists.filter(t => t.id !== team.id));
      setChampion(null);
    } else {
      if (finalists.length < 2) {
        setFinalists([...finalists, team]);
      }
    }
  };

  // Step 4: Champion handler
  const handleSelectChampion = (team) => {
    setChampion(team);
  };

  const handleScoreChange = (teamKey, val) => {
    const numericVal = val.replace(/[^0-9]/g, '');
    setScores(prev => ({
      ...prev,
      [teamKey]: numericVal
    }));
  };

  // Navigation handlers
  const nextStep = () => {
    if (step < 4) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = () => {
    if (!champion) return;
    
    // Prepare structured prediction payload
    const payload = {
      quarterfinalists: quarterfinalists.map(t => t.name),
      semifinalists: semifinalists.map(t => t.name),
      finalists: finalists.map(t => t.name),
      champion: champion.name,
      scores: {
        [finalists[0].name]: scores.teamA || '0',
        [finalists[1].name]: scores.teamB || '0'
      }
    };
    
    onSubmit(payload, champion.name);
  };

  // Search filtering for Step 1
  const filteredTeams = TEAMS.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate progress percent
  const progressPercent = ((step - 1) / 3) * 100;

  return (
    <div className="wizard-container glass-panel">
      <div style={{ 
        background: 'rgba(0, 229, 255, 0.04)', 
        border: '1px solid rgba(0, 229, 255, 0.15)', 
        borderRadius: '12px', 
        padding: '0.75rem 1rem', 
        marginBottom: '1.5rem', 
        fontSize: '0.85rem', 
        color: 'var(--accent-cyan)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <span style={{ fontSize: '1.1rem' }}>📅</span>
        <span>You can edit/update your bracket prediction until <strong>July 4, 2026, 5:30 PM IST</strong>.</span>
      </div>

      {/* Progress & Header */}
      <div className="wizard-header">
        <div className="wizard-title">
          {step === 1 && (
            <>
              <h2>Select 8 Quarterfinalists</h2>
              <p>Pick the eight teams you think will reach the Quarterfinals.</p>
            </>
          )}
          {step === 2 && (
            <>
              <h2>Select 4 Semifinalists</h2>
              <p>Pick the four teams that will advance to the Semifinals.</p>
            </>
          )}
          {step === 3 && (
            <>
              <h2>Select 2 Finalists</h2>
              <p>Pick the two teams that will battle in the final match.</p>
            </>
          )}
          {step === 4 && (
            <>
              <h2>Predict Champion & Score</h2>
              <p>Crown your Champion and predict the final scoreline.</p>
            </>
          )}
        </div>
        <div className="step-indicator">Step {step} of 4</div>
      </div>

      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${progressPercent}%` }}></div>
      </div>

      {/* STEP 1: QUARTERFINALISTS */}
      {step === 1 && (
        <div>
          {/* Search bar */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'flex-start' }}>
            <input
              type="text"
              className="form-input"
              placeholder="🔍 Search teams..."
              style={{ maxWidth: '300px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="team-grid">
            {filteredTeams.map((team) => {
              const selectedIndex = quarterfinalists.findIndex(t => t.id === team.id);
              const isSelected = selectedIndex !== -1;
              return (
                <div
                  key={team.id}
                  className={`team-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectQuarterfinalist(team)}
                >
                  <div className="flag-wrapper">
                    <img src={getFlagUrl(team.code)} alt={`${team.name} flag`} className="team-flag" />
                  </div>
                  <span className="team-name">{team.name}</span>
                  {isSelected && (
                    <div className="selection-badge">{selectedIndex + 1}</div>
                  )}
                </div>
              );
            })}
          </div>
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Selected: <strong>{quarterfinalists.length}</strong> of 8
          </p>
        </div>
      )}

      {/* STEP 2: SEMIFINALISTS */}
      {step === 2 && (
        <div>
          <div className="wizard-selections-row">
            {quarterfinalists.map((team) => {
              const selectedIndex = semifinalists.findIndex(t => t.id === team.id);
              const isSelected = selectedIndex !== -1;
              return (
                <div
                  key={team.id}
                  className={`team-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectSemifinalist(team)}
                >
                  <div className="flag-wrapper">
                    <img src={getFlagUrl(team.code)} alt={`${team.name} flag`} className="team-flag" />
                  </div>
                  <span className="team-name">{team.name}</span>
                  {isSelected && (
                    <div className="selection-badge">{selectedIndex + 1}</div>
                  )}
                </div>
              );
            })}
          </div>
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Selected: <strong>{semifinalists.length}</strong> of 4
          </p>
        </div>
      )}

      {/* STEP 3: FINALISTS */}
      {step === 3 && (
        <div>
          <div className="wizard-selections-row">
            {semifinalists.map((team) => {
              const selectedIndex = finalists.findIndex(t => t.id === team.id);
              const isSelected = selectedIndex !== -1;
              return (
                <div
                  key={team.id}
                  className={`team-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectFinalist(team)}
                >
                  <div className="flag-wrapper">
                    <img src={getFlagUrl(team.code)} alt={`${team.name} flag`} className="team-flag" />
                  </div>
                  <span className="team-name">{team.name}</span>
                  {isSelected && (
                    <div className="selection-badge">{selectedIndex + 1}</div>
                  )}
                </div>
              );
            })}
          </div>
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Selected: <strong>{finalists.length}</strong> of 2
          </p>
        </div>
      )}

      {/* STEP 4: CHAMPION & SCORE */}
      {step === 4 && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontWeight: 600 }}>
              CLICK ON A TEAM TO CROWN THEM CHAMPION:
            </p>
            <div className="wizard-selections-row">
              {finalists.map((team) => {
                const isChampion = champion && champion.id === team.id;
                return (
                  <div
                    key={team.id}
                    className={`team-card ${isChampion ? 'selected-gold' : ''}`}
                    onClick={() => handleSelectChampion(team)}
                  >
                    <div className="flag-wrapper" style={{ borderColor: isChampion ? 'var(--primary-gold)' : 'rgba(255,255,255,0.1)' }}>
                      <img src={getFlagUrl(team.code)} alt={`${team.name} flag`} className="team-flag" />
                    </div>
                    <span className="team-name" style={{ color: isChampion ? 'var(--primary-gold)' : 'var(--text-primary)' }}>
                      {team.name}
                    </span>
                    {isChampion && (
                      <div className="selection-badge selection-badge-gold">🏆</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {champion && (
            <div className="score-predictor">
              <div className="score-predictor-title">Final Match Score Prediction</div>
              <div className="score-inputs-wrapper">
                <div className="score-team-info">
                  <div className="flag-wrapper" style={{ width: '40px', height: '40px' }}>
                    <img src={getFlagUrl(finalists[0].code)} alt="Team A" className="team-flag" />
                  </div>
                  <span>{finalists[0].name}</span>
                </div>
                
                <input
                  type="text"
                  maxLength="2"
                  className="score-input"
                  placeholder="0"
                  value={scores.teamA}
                  onChange={(e) => handleScoreChange('teamA', e.target.value)}
                />
                
                <span className="score-divider">:</span>
                
                <input
                  type="text"
                  maxLength="2"
                  className="score-input"
                  placeholder="0"
                  value={scores.teamB}
                  onChange={(e) => handleScoreChange('teamB', e.target.value)}
                />

                <div className="score-team-info">
                  <div className="flag-wrapper" style={{ width: '40px', height: '40px' }}>
                    <img src={getFlagUrl(finalists[1].code)} alt="Team B" className="team-flag" />
                  </div>
                  <span>{finalists[1].name}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="wizard-actions">
        {step > 1 ? (
          <button className="btn btn-secondary" onClick={prevStep}>
            ⬅️ Back
          </button>
        ) : (
          <div></div> // Spacer
        )}

        <button
          className="btn btn-primary"
          onClick={step < 4 ? nextStep : handleSubmit}
          disabled={
            (step === 1 && quarterfinalists.length < 8) ||
            (step === 2 && semifinalists.length < 4) ||
            (step === 3 && finalists.length < 2) ||
            (step === 4 && !champion)
          }
        >
          {step < 4 ? 'Continue ➡️' : '🏆 Submit Bracket Predictions'}
        </button>
      </div>
    </div>
  );
}
