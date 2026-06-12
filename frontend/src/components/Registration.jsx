import React, { useState } from 'react';

export default function Registration({ onRegister }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState({});

  const [isChecking, setIsChecking] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (cleanPhone.length < 7) {
      newErrors.phone = 'Please enter a valid phone number (at least 7 digits)';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsChecking(true);
    try {
      const cleanPhone = phone.replace(/[^0-9+]/g, '');
      const response = await fetch(`/api/check-phone/${encodeURIComponent(cleanPhone)}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to check phone number.');
      }

      if (result.exists) {
        setErrors({
          phone: 'This phone number has already submitted a prediction. Only one entry is allowed.'
        });
      } else {
        onRegister({ name: name.trim(), phone: phone.trim() });
      }
    } catch (err) {
      console.error(err);
      setErrors({
        phone: 'Could not contact server to verify phone number. Please try again.'
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="glass-panel" style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
        Ready to Predict?
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>
        Enter your details to join the World Cup Winning Prediction Game.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Full Name</label>
          <input
            id="name"
            type="text"
            className="form-input"
            placeholder="John Doe"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
            }}
          />
          {errors.name && (
            <div className="error-msg">
              <span>⚠️</span> {errors.name}
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="phone">Phone Number</label>
          <input
            id="phone"
            type="tel"
            className="form-input"
            placeholder="+1 234 567 890"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
            }}
          />
          {errors.phone && (
            <div className="error-msg">
              <span>⚠️</span> {errors.phone}
            </div>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '1rem', padding: '0.9rem' }}
          disabled={isChecking}
        >
          {isChecking ? 'Verifying Phone...' : 'Start Predictions'}
        </button>
      </form>
    </div>
  );
}
