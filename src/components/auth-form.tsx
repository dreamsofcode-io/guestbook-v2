'use client';

import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Mail, Lock, User, AlertCircle, KeyRound, ArrowLeft } from 'lucide-react';
import { validateUsername } from '@/lib/username-validation';

interface AuthFormProps {
  onSuccess?: () => void;
  onSignUpSuccess?: () => void; // For when signup completes but needs verification
}

export function AuthForm({ onSuccess }: AuthFormProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [step, setStep] = useState<'auth' | 'verify'>('auth');
  const [pendingVerification, setPendingVerification] = useState(false);

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    setUsernameError('');
    
    if (!isLogin && value.length > 0) {
      const validation = validateUsername(value);
      if (!validation.isValid) {
        setUsernameError(validation.error!);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setUsernameError('');

    try {
      if (step === 'auth') {
        if (isLogin) {
          // For login, sign in directly
          await authClient.signIn.email({
            email,
            password,
          });
          onSuccess?.();
        } else {
          // For signup, validate username first
          const usernameValidation = validateUsername(username);
          if (!usernameValidation.isValid) {
            setUsernameError(usernameValidation.error!);
            return;
          }

          // For signup with OTP verification
          await authClient.signUp.email({
            email,
            password,
            name: usernameValidation.sanitized!,
            username: usernameValidation.sanitized!,
          });
          setStep('verify');
          setPendingVerification(true);
          return; // Explicitly return to avoid any fallthrough
        }
      } else {
        // Verify OTP step 
        await authClient.emailOtp.verifyEmail({
          email,
          otp,
        });
        onSuccess?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'email-verification',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend OTP');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {step === 'auth' && (
        <div className="flex rounded-lg bg-white/5 border border-white/10 p-1">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${
              isLogin
                ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${
              !isLogin
                ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            }`}
          >
            Sign Up
          </button>
        </div>
      )}

      {step === 'verify' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setStep('auth')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Check your email</h3>
            <p className="text-sm text-muted-foreground">
              We've sent a verification code to <span className="font-medium">{email}</span>
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {step === 'auth' && (
          <>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/10 border border-input rounded-lg shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-foreground"
                placeholder="you@example.com"
                required
                disabled={isLoading}
              />
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className={`w-full px-4 py-2.5 bg-white/10 border rounded-lg shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-all text-foreground ${
                    usernameError 
                      ? 'border-destructive focus:ring-destructive/30 focus:border-destructive' 
                      : 'border-input focus:ring-primary/30 focus:border-primary'
                  }`}
                  placeholder="username"
                  required
                  disabled={isLoading}
                />
                {usernameError && (
                  <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {usernameError}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/10 border border-input rounded-lg shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-foreground"
                placeholder="••••••••"
                required
                disabled={isLoading}
              />
            </div>
          </>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="otp" className="text-sm font-medium text-foreground flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-muted-foreground" />
                Verification Code
              </label>
              <input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/10 border border-input rounded-lg shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-foreground text-center text-lg tracking-widest"
                placeholder="000000"
                maxLength={6}
                required
                disabled={isLoading}
              />
            </div>
            <div className="text-center">
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={isLoading}
                className="text-sm text-primary hover:text-primary/80 underline disabled:opacity-50"
              >
                Resend code
              </button>
            </div>
          </div>
        )}

        <div className="pt-2">
          <Button
            type="submit"
            disabled={isLoading}
            size="lg"
            className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25"
          >
          {isLoading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white mr-2" />
              {step === 'auth' 
                ? (isLogin ? 'Signing in...' : 'Creating account...') 
                : 'Verifying...'}
            </>
          ) : (
            step === 'auth' 
              ? (isLogin ? 'Sign In' : 'Create Account') 
              : 'Verify & Continue'
          )}
          </Button>
        </div>
      </form>
    </div>
  );
}