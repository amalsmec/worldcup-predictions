import React, { useState } from 'react';

export default function LoginRegister({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Category-specific states
  const [userType, setUserType] = useState('public'); // 'public' | 'student' | 'staff'
  const [employeeCode, setEmployeeCode] = useState('');
  const [studentId, setStudentId] = useState('');
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validate = () => {
    const newErrors = {};
    
    if (!isLogin && !name.trim()) {
      newErrors.name = 'Full name is required.';
    }

    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required.';
    } else if (cleanPhone.length < 7) {
      newErrors.phone = 'Enter a valid phone number (at least 7 digits).';
    }

    if (!password) {
      newErrors.password = 'Password is required.';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }

    if (!isLogin && password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    if (!isLogin && userType === 'staff' && !employeeCode.trim()) {
      newErrors.employeeCode = 'Employee Code is required for Staff.';
    }

    if (!isLogin && userType === 'student' && !studentId.trim()) {
      newErrors.studentId = 'Student ID Code is required for Students.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});
    
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin 
      ? { phone: cleanPhone, password } 
      : { 
          name: name.trim(), 
          phone: cleanPhone, 
          password, 
          userType, 
          employeeCode: userType === 'staff' ? employeeCode.trim() : null, 
          studentId: userType === 'student' ? studentId.trim() : null 
        };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Authentication failed. Please check credentials.');
      }

      if (isLogin) {
        onAuthSuccess(result.token, result.user);
      } else {
        // Automatically log them in after registration
        const loginResponse = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ phone: cleanPhone, password })
        });
        const loginResult = await loginResponse.json();
        if (loginResponse.ok) {
          onAuthSuccess(loginResult.token, loginResult.user);
        } else {
          setIsLogin(true);
          setName('');
          setPassword('');
          setConfirmPassword('');
          setUserType('public');
          setEmployeeCode('');
          setStudentId('');
          setErrors({ form: 'Registration successful! Please login below.' });
        }
      }
    } catch (err) {
      console.error(err);
      setErrors({ form: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
        {isLogin ? 'Welcome Back!' : 'Join the Game'}
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>
        {isLogin 
          ? 'Log in to place your predictions and view your scoreboard.' 
          : 'Register your details to predict brackets and scores.'
        }
      </p>

      {errors.form && (
        <div className="error-msg" style={{ marginBottom: '1.5rem', justifyContent: 'center' }}>
          <span>⚠️</span> {errors.form}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Full Name (Registration only) */}
        {!isLogin && (
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
                if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
              }}
              required={!isLogin}
            />
            {errors.name && (
              <div className="error-msg">
                <span>⚠️</span> {errors.name}
              </div>
            )}
          </div>
        )}

        {/* User Category Selector (Registration only) */}
        {!isLogin && (
          <div className="form-group">
            <label style={{ display: 'block', textAlign: 'left', marginBottom: '0.5rem' }}>User Category</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                className={`btn ${userType === 'public' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.5rem 0.25rem', fontSize: '0.85rem', borderRadius: '8px' }}
                onClick={() => {
                  setUserType('public');
                  setErrors(prev => ({ ...prev, employeeCode: '', studentId: '' }));
                }}
              >
                🌍 Public
              </button>
              <button
                type="button"
                className={`btn ${userType === 'student' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.5rem 0.25rem', fontSize: '0.85rem', borderRadius: '8px' }}
                onClick={() => {
                  setUserType('student');
                  setErrors(prev => ({ ...prev, employeeCode: '', studentId: '' }));
                }}
              >
                🎓 Student
              </button>
              <button
                type="button"
                className={`btn ${userType === 'staff' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.5rem 0.25rem', fontSize: '0.85rem', borderRadius: '8px' }}
                onClick={() => {
                  setUserType('staff');
                  setErrors(prev => ({ ...prev, employeeCode: '', studentId: '' }));
                }}
              >
                👨‍💼 Staff
              </button>
            </div>
          </div>
        )}

        {/* Student ID Code Input (Registration only) */}
        {!isLogin && userType === 'student' && (
          <div className="form-group">
            <label htmlFor="studentId">Student ID Code</label>
            <input
              id="studentId"
              type="text"
              className="form-input"
              placeholder="e.g. STU12345"
              value={studentId}
              onChange={(e) => {
                setStudentId(e.target.value);
                if (errors.studentId) setErrors(prev => ({ ...prev, studentId: '' }));
              }}
              required
            />
            {errors.studentId && (
              <div className="error-msg">
                <span>⚠️</span> {errors.studentId}
              </div>
            )}
          </div>
        )}

        {/* Employee Code Input (Registration only) */}
        {!isLogin && userType === 'staff' && (
          <div className="form-group">
            <label htmlFor="employeeCode">Employee Code</label>
            <input
              id="employeeCode"
              type="text"
              className="form-input"
              placeholder="e.g. EMP9876"
              value={employeeCode}
              onChange={(e) => {
                setEmployeeCode(e.target.value);
                if (errors.employeeCode) setErrors(prev => ({ ...prev, employeeCode: '' }));
              }}
              required
            />
            {errors.employeeCode && (
              <div className="error-msg">
                <span>⚠️</span> {errors.employeeCode}
              </div>
            )}
          </div>
        )}

        {/* Phone Number */}
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
              if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
            }}
            required
          />
          {errors.phone && (
            <div className="error-msg">
              <span>⚠️</span> {errors.phone}
            </div>
          )}
        </div>

        {/* Password */}
        <div className="form-group" style={{ position: 'relative' }}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            className="form-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
            }}
            required
          />
          <button
            type="button"
            style={{
              position: 'absolute',
              right: '12px',
              top: '38px',
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? '👁️' : '👁️‍🗨️'}
          </button>
          {errors.password && (
            <div className="error-msg">
              <span>⚠️</span> {errors.password}
            </div>
          )}
        </div>

        {/* Confirm Password (Registration only) */}
        {!isLogin && (
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: '' }));
              }}
              required={!isLogin}
            />
            {errors.confirmPassword && (
              <div className="error-msg">
                <span>⚠️</span> {errors.confirmPassword}
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '1rem', padding: '0.9rem' }}
          disabled={loading}
        >
          {loading ? 'Processing...' : isLogin ? 'Log In' : 'Register Account'}
        </button>
      </form>

      <div style={{ marginTop: '1.5rem', fontSize: '0.9rem' }}>
        <span style={{ color: 'var(--text-secondary)' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
        </span>
        <button
          className="btn-link"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent-cyan)',
            cursor: 'pointer',
            fontWeight: 600,
            textDecoration: 'underline',
            padding: 0
          }}
          onClick={() => {
            setIsLogin(!isLogin);
            setErrors({});
            setName('');
            setPassword('');
            setConfirmPassword('');
            setUserType('public');
            setEmployeeCode('');
            setStudentId('');
          }}
        >
          {isLogin ? 'Register Here' : 'Login Here'}
        </button>
      </div>
    </div>
  );
}
