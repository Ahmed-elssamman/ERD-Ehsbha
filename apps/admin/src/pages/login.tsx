import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Loader2 } from 'lucide-react';
import { AdminAuthContract } from '@ehsbha/api-contracts';
import { adminApi } from '@/lib/api/admin-client';
import { useAdminAuth } from '@/stores/admin-auth.store';
import { cn } from '@/lib/utils';

type Form = AdminAuthContract.AdminLoginRequest;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAdminAuth((s) => s.setSession);
  const [serverError, setServerError] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  const { register, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(AdminAuthContract.AdminLoginRequestSchema),
    defaultValues: { email: '', password: '' },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: Form) => {
      const { data: res } = await adminApi.post('/admin/auth/login', data);
      return AdminAuthContract.AdminLoginResponseSchema.parse(res);
    },
    onSuccess: (res) => {
      if (res.mfaRequired) {
        setMfaChallengeId(res.challengeId);
      } else {
        setSession(res);
        const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
        navigate(from ?? '/', { replace: true });
      }
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Login failed. Check your credentials.';
      setServerError(msg);
    },
  });

  const mfaMutation = useMutation({
    mutationFn: async () => {
      if (!mfaChallengeId) throw new Error('No MFA challenge');
      const { data: res } = await adminApi.post('/admin/auth/mfa/verify', {
        challengeId: mfaChallengeId,
        code: mfaCode,
      });
      return AdminAuthContract.AdminLoginResponseSchema.parse(res);
    },
    onSuccess: (res) => {
      if (!res.mfaRequired) {
        setSession(res);
        navigate('/', { replace: true });
      }
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Invalid MFA code.';
      setServerError(msg);
    },
  });

  return (
    <div className="grid min-h-screen place-items-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Shield className="h-5 w-5" />
          </div>
          <div className="text-xl font-semibold tracking-tight">Ehsbha Admin</div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          {mfaChallengeId ? (
            <>
              <h1 className="mb-1 text-lg font-semibold">Two-factor authentication</h1>
              <p className="mb-4 text-sm text-muted-foreground">
                Enter the 6-digit code from your authenticator app.
              </p>
              <input
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                pattern="\d{6}"
                className="w-full rounded-md border bg-background px-3 py-2 text-center font-mono text-lg tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              {serverError && (
                <p className="mt-3 text-sm text-danger" role="alert">
                  {serverError}
                </p>
              )}
              <button
                onClick={() => mfaMutation.mutate()}
                disabled={mfaCode.length !== 6 || mfaMutation.isPending}
                className={cn(
                  'mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                {mfaMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify
              </button>
            </>
          ) : (
            <form
              onSubmit={handleSubmit((data) => {
                setServerError(null);
                loginMutation.mutate(data);
              })}
              noValidate
            >
              <h1 className="mb-1 text-lg font-semibold">Sign in to the admin</h1>
              <p className="mb-4 text-sm text-muted-foreground">
                Use your admin credentials. MFA may be required.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    {...register('email')}
                  />
                  {formState.errors.email && (
                    <p className="mt-1 text-xs text-danger">{formState.errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    {...register('password')}
                  />
                  {formState.errors.password && (
                    <p className="mt-1 text-xs text-danger">{formState.errors.password.message}</p>
                  )}
                </div>
              </div>

              {serverError && (
                <p className="mt-3 text-sm text-danger" role="alert">
                  {serverError}
                </p>
              )}

              <button
                type="submit"
                disabled={loginMutation.isPending}
                className={cn(
                  'mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                {loginMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign in
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Admin access only. All actions are audited.
        </p>
      </div>
    </div>
  );
}
