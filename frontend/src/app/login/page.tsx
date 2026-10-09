import LoginForm from '../../components/LoginForm';

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ mode?: string | string[]; redirect?: string | string[] }>;
}) {
  const params = await searchParams;
  const mode = params.mode === 'signup' ? 'signup' : 'login';
  const requested = typeof params.redirect === 'string' ? params.redirect : '/dashboard';
  return <LoginForm key={mode} mode={mode} requested={requested} />;
}
