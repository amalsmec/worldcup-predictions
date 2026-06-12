import React from 'react';

export default function SuccessScreen({ participant, prediction, onReset, onViewLeaderboard, tournamentResults, isLocked }) {
  // Find score values
  const scoreKeys = Object.keys(prediction.scores);
  const teamAScore = prediction.scores[scoreKeys[0]];
  const teamBScore = prediction.scores[scoreKeys[1]];

  const getBracketPointsBreakdown = () => {
    if (!tournamentResults) return null;
    let quarterPoints = 0;
    let semiPoints = 0;
    let finalPoints = 0;
    let champPoints = 0;
    
    const correctQuarters = [];
    const correctSemis = [];
    const correctFinals = [];
    let isChampCorrect = false;

    if (prediction.quarterfinalists && tournamentResults.quarterfinalists) {
      const actualQuarters = tournamentResults.quarterfinalists.map(t => (t || '').toLowerCase().trim()).filter(Boolean);
      prediction.quarterfinalists.forEach(team => {
        if (team && actualQuarters.includes(team.toLowerCase().trim())) {
          correctQuarters.push(team);
          quarterPoints += 2;
        }
      });
    }

    if (prediction.semifinalists && tournamentResults.semifinalists) {
      const actualSemis = tournamentResults.semifinalists.map(t => (t || '').toLowerCase().trim()).filter(Boolean);
      prediction.semifinalists.forEach(team => {
        if (team && actualSemis.includes(team.toLowerCase().trim())) {
          correctSemis.push(team);
          semiPoints += 5;
        }
      });
    }

    if (prediction.finalists && tournamentResults.finalists) {
      const actualFinals = tournamentResults.finalists.map(t => (t || '').toLowerCase().trim()).filter(Boolean);
      prediction.finalists.forEach(team => {
        if (team && actualFinals.includes(team.toLowerCase().trim())) {
          correctFinals.push(team);
          finalPoints += 10;
        }
      });
    }

    if (prediction.champion && tournamentResults.champion && tournamentResults.champion.trim() !== '' &&
        prediction.champion.toLowerCase().trim() === tournamentResults.champion.toLowerCase().trim()) {
      isChampCorrect = true;
      champPoints = 15;
    }

    let bracketWinnerSemiPoints = 0;
    if (prediction.champion && tournamentResults.semifinalists) {
      const actualSemis = tournamentResults.semifinalists.map(t => (t || '').toLowerCase().trim()).filter(Boolean);
      if (prediction.champion.trim() !== '' && actualSemis.includes(prediction.champion.toLowerCase().trim())) {
        bracketWinnerSemiPoints = 1;
      }
    }

    let bracketWinnerQuarterPoints = 0;
    if (prediction.champion && tournamentResults.quarterfinalists) {
      const actualQuarters = tournamentResults.quarterfinalists.map(t => (t || '').toLowerCase().trim()).filter(Boolean);
      if (prediction.champion.trim() !== '' && actualQuarters.includes(prediction.champion.toLowerCase().trim())) {
        bracketWinnerQuarterPoints = 1;
      }
    }

    const totalPoints = quarterPoints + semiPoints + finalPoints + champPoints + bracketWinnerSemiPoints + bracketWinnerQuarterPoints;
    return {
      quarterPoints,
      semiPoints,
      finalPoints,
      champPoints,
      bracketWinnerSemiPoints,
      bracketWinnerQuarterPoints,
      totalPoints,
      correctQuarters,
      correctSemis,
      correctFinals,
      isChampCorrect
    };
  };

  const breakdown = getBracketPointsBreakdown();
  
  const actualQuarters = tournamentResults?.quarterfinalists?.map(t => t.toLowerCase().trim()) || [];
  const actualSemis = tournamentResults?.semifinalists?.map(t => t.toLowerCase().trim()) || [];
  const actualFinals = tournamentResults?.finalists?.map(t => t.toLowerCase().trim()) || [];
  const actualChampion = tournamentResults?.champion?.toLowerCase().trim() || '';

  const getNodeStyle = (teamName, actualList) => {
    if (!tournamentResults || actualList.length === 0) return {};
    const isCorrect = actualList.includes((teamName || '').toLowerCase().trim());
    return {
      border: isCorrect ? '1px solid #39ff14' : '1px solid #ff4d4d',
      background: isCorrect ? 'rgba(57, 255, 20, 0.08)' : 'rgba(255, 77, 77, 0.08)',
      color: isCorrect ? '#39ff14' : '#ff4d4d'
    };
  };

  const getChampNodeStyle = (teamName) => {
    if (!tournamentResults || !actualChampion) return {};
    const isCorrect = (teamName || '').toLowerCase().trim() === actualChampion;
    return {
      border: isCorrect ? '2px solid #ffd700' : '1px solid #ff4d4d',
      background: isCorrect ? 'rgba(255, 215, 0, 0.1)' : 'rgba(255, 77, 77, 0.08)',
      color: isCorrect ? '#ffd700' : '#ff4d4d',
      boxShadow: isCorrect ? '0 0 15px rgba(255, 215, 0, 0.2)' : 'none'
    };
  };

  return (
    <div className="success-card glass-panel">
      <div className="success-grid">
        {/* Left Column: Success Message & Breakdown */}
        <div className="success-left">
          <div className="success-icon">🏆</div>
          <h2>Entry Confirmed!</h2>
          <p className="success-desc">
            Thank you, <strong>{participant.name}</strong>. Your prediction has been registered under phone number{' '}
            <strong>{participant.phone}</strong>.
          </p>

          {breakdown && (
            <div className="breakdown-card glass-panel">
              <h3>🏆 Tournament Bracket Scoring</h3>
              <p>
                The tournament actual outcomes are recorded! Here is how your predictions performed:
              </p>
              <div className="breakdown-list">
                {prediction.quarterfinalists && (
                  <>
                    <div className="breakdown-row">
                      <span>Quarterfinalists correctly predicted ({breakdown.correctQuarters.length}/8)</span>
                      <span className="pts-plus">+{breakdown.quarterPoints} pts</span>
                    </div>
                    {breakdown.correctQuarters.length > 0 && (
                      <div className="correct-teams">
                        Correct: {breakdown.correctQuarters.join(', ')}
                      </div>
                    )}
                  </>
                )}

                <div className="breakdown-row">
                  <span>Semifinalists correctly predicted ({breakdown.correctSemis.length}/4)</span>
                  <span className="pts-plus">+{breakdown.semiPoints} pts</span>
                </div>
                {breakdown.correctSemis.length > 0 && (
                  <div className="correct-teams">
                    Correct: {breakdown.correctSemis.join(', ')}
                  </div>
                )}

                <div className="breakdown-row">
                  <span>Finalists correctly predicted ({breakdown.correctFinals.length}/2)</span>
                  <span className="pts-plus">+{breakdown.finalPoints} pts</span>
                </div>
                {breakdown.correctFinals.length > 0 && (
                  <div className="correct-teams">
                    Correct: {breakdown.correctFinals.join(', ')}
                  </div>
                )}

                <div className="breakdown-row">
                  <span>Champion correctly predicted</span>
                  <span style={{ fontWeight: 'bold', color: breakdown.isChampCorrect ? '#39ff14' : '#ff4d4d' }}>
                    {breakdown.isChampCorrect ? '+15 pts' : '0 pts'}
                  </span>
                </div>

                <div className="breakdown-row">
                  <span>Bracket Winner reached Semifinals</span>
                  <span style={{ fontWeight: 'bold', color: breakdown.bracketWinnerSemiPoints > 0 ? '#39ff14' : '#ff4d4d' }}>
                    {breakdown.bracketWinnerSemiPoints > 0 ? '+1 pt' : '0 pts'}
                  </span>
                </div>

                <div className="breakdown-row">
                  <span>Bracket Winner reached Quarterfinals</span>
                  <span style={{ fontWeight: 'bold', color: breakdown.bracketWinnerQuarterPoints > 0 ? '#39ff14' : '#ff4d4d' }}>
                    {breakdown.bracketWinnerQuarterPoints > 0 ? '+1 pt' : '0 pts'}
                  </span>
                </div>

                <div className="breakdown-total">
                  <span>Total Bracket Points</span>
                  <span>{breakdown.totalPoints} pts</span>
                </div>
              </div>
            </div>
          )}
          {!isLocked && onReset && (
            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem', width: '100%', maxWidth: '300px' }}>
              <button 
                className="btn btn-primary" 
                onClick={onReset} 
                style={{ width: '100%' }}
              >
                ✏️ Edit Bracket Prediction
              </button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', textAlign: 'left' }}>
                📅 You can edit your bracket prediction until July 4, 2026, 5:30 PM IST.
              </span>
            </div>
          )}
        </div>

        {/* Right Column: Prediction Bracket Visualizer */}
        <div className="success-right">
          <div className="prediction-tree">
            <h3>Your Prediction Bracket</h3>
            
            {/* CHAMPION */}
            <div className="tree-level">
              <span className="tree-level-title">Champion</span>
              <div className="tree-node champion" style={getChampNodeStyle(prediction.champion)}>
                🥇 {prediction.champion}
              </div>
              <span className="tree-score-prediction">
                Predicted Final Score: {scoreKeys[0]} ({teamAScore}) - ({teamBScore}) {scoreKeys[1]}
              </span>
            </div>

            {/* FINALISTS */}
            <div className="tree-level">
              <span className="tree-level-title">Finalists</span>
              <div className="tree-nodes-row">
                <div className="tree-node" style={getNodeStyle(prediction.finalists[0], actualFinals)}>🤝 {prediction.finalists[0]}</div>
                <div className="tree-node" style={getNodeStyle(prediction.finalists[1], actualFinals)}>🤝 {prediction.finalists[1]}</div>
              </div>
            </div>

            {/* SEMIFINALISTS */}
            <div className="tree-level">
              <span className="tree-level-title">Semi-Finals</span>
              <div className="tree-nodes-row">
                {prediction.semifinalists.map((team, idx) => (
                  <div key={idx} className="tree-node" style={getNodeStyle(team, actualSemis)}>
                    ⚽ {team}
                  </div>
                ))}
              </div>
            </div>

            {/* QUARTERFINALISTS */}
            {prediction.quarterfinalists && (
              <div className="tree-level">
                <span className="tree-level-title">Quarter-Finals</span>
                <div className="tree-nodes-row" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5rem', width: '100%' }}>
                  {prediction.quarterfinalists.map((team, idx) => (
                    <div key={idx} className="tree-node" style={{ ...getNodeStyle(team, actualQuarters), fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}>
                      ⚽ {team}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
