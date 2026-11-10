import { createFileRoute, Link } from '@tanstack/react-router';
import { PasMark } from '@/components/pas/logo';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { beginSupplierActivation, completeSupplierActivation, readSupplierActivation } from '@/lib/supplier-activation.functions';

export const Route = createFileRoute('/ativar-acesso')({
  head: () => ({ meta: [{ title: 'Ativar acesso gratuito — Shop Center' }, { name: 'description', content: 'Confirme sua conta e ative o acesso gratuito ao Shop Center com os fornecedores gratuitos.' }, { property: 'og:title', content: 'Acesso gratuito — Shop Center' }, { property: 'og:description', content: 'Ativação segura e individual do acesso gratuito ao Shop Center.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' }] }),
  component: ActivationPage,
});

function ActivationPage() {
  const { user, loading } = useAuth();
  const begin = useServerFn(beginSupplierActivation);
  const complete = useServerFn(completeSupplierActivation);
  const read = useServerFn(readSupplierActivation);
  const qc = useQueryClient();
  const [session, setSession] = useState<Awaited<ReturnType<typeof beginSupplierActivation>> | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [signup, setSignup] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  async function start() {
    setBusy(true); setError('');
    try { const next = await begin(); setSession(next); const ms = Math.max(0, Date.parse(next.expires_at) - Date.parse(next.server_now)); setRemaining(Math.ceil(ms / 1000)); setDeadline(performance.now() + ms); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível iniciar.'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    let cancelled = false;
    if (!user) { setSession(null); setDeadline(0); return; }
    setBusy(true);
    void read().then(next => {
      if (cancelled) return;
      setSession(next);
      const ms = next ? Math.max(0, Date.parse(next.expires_at) - Date.parse(next.server_now)) : 0;
      setRemaining(Math.ceil(ms / 1000)); setDeadline(performance.now() + ms);
    }).catch(() => { if (!cancelled) setError('Não foi possível consultar a ativação. Tente novamente.'); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [user?.id]);
  useEffect(() => { if (!deadline) return; const tick = () => setRemaining(Math.max(0, Math.ceil((deadline - performance.now()) / 1000))); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer); }, [deadline]);
  async function authenticate(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (signup) {
        const result = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() }, emailRedirectTo: `${window.location.origin}/ativar-acesso` } });
        if (result.error) throw result.error;
        if (!result.data.session) setMessage('Confira seu e-mail e confirme sua conta. Depois, entre aqui para ativar o acesso.');
      } else { const result = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (result.error) throw result.error; }
    } catch { setError('Não foi possível entrar ou criar a conta. Confira os dados e a confirmação do e-mail.'); } finally { setBusy(false); }
  }
  async function finish() {
    if (!session || remaining <= 0) return;
    setBusy(true); setError('');
    try { const next = await complete({ data: { id: session.id } }); setSession(next); await qc.invalidateQueries({ queryKey: ['profile'] }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir.'); } finally { setBusy(false); }
  }
  return <main className="pas-seller-landing min-h-screen bg-background px-5 py-12 text-foreground"><div className="mx-auto max-w-lg"><Link to="/" className="inline-flex items-center gap-2.5 text-sm font-bold"><PasMark className="size-9" /><span className="sc-wordmark text-lg">Shop<span className="sc-wordmark-accent">Center</span></span></Link><p className="seller-kicker mt-10">Acesso gratuito</p><h1 className="mt-3 text-3xl font-bold">Ative sua operação no Shop Center.</h1><p className="mt-4 text-sm leading-relaxed text-muted-foreground">Acesso gratuito às ferramentas de cliente. Fornecedores premium têm contratação separada. Nenhum pagamento é necessário nesta ativação.</p>
    {loading ? <p className="mt-8">Verificando conta...</p> : !user ? <form onSubmit={authenticate} className="mt-8 grid gap-4"><div className="flex gap-2"><Button type="button" variant={signup ? 'secondary' : 'ghost'} onClick={() => setSignup(true)}>Criar conta</Button><Button type="button" variant={!signup ? 'secondary' : 'ghost'} onClick={() => setSignup(false)}>Já tenho conta</Button></div>{signup && <label className="grid gap-2 text-sm">Nome completo<Input value={name} onChange={e => setName(e.target.value)} required minLength={3} maxLength={120} autoComplete="name"/></label>}<label className="grid gap-2 text-sm">E-mail<Input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"/></label><label className="grid gap-2 text-sm">Senha<Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete={signup ? 'new-password' : 'current-password'}/></label><Button disabled={busy}>{busy ? 'Aguarde...' : signup ? 'Criar conta gratuita' : 'Entrar para ativar'}<ArrowRight/></Button></form> : <div className="mt-8 border-y border-border py-8">{session?.completed_at ? <><Check className="size-8 text-success"/><h2 className="mt-3 text-xl font-bold">Acesso gratuito ativado</h2><p className="mt-3 text-sm text-muted-foreground">Sua ativação foi confirmada. Seus produtos e lojas continuam vinculados à sua conta.</p><Button asChild className="mt-6"><Link to="/produtos">Abrir o Shop Center<ArrowRight/></Link></Button></> : session ? remaining > 0 ? <><Clock className="size-6 text-primary"/><h2 className="mt-3 text-xl font-bold">Sua sessão de ativação está aberta</h2><p className="mt-3 text-sm text-muted-foreground">Confirme dentro do prazo. Este prazo é da sessão de ativação, não de um desconto ou reserva de vagas.</p><p className="my-6 text-5xl font-bold tabular-nums" role="timer">{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</p><Button onClick={finish} disabled={busy}>{busy ? 'Confirmando...' : 'Finalizar ativação'}<ArrowRight/></Button></> : <><h2 className="text-xl font-bold">O prazo desta condição terminou.</h2><p className="mt-3 text-sm text-muted-foreground">Você pode iniciar uma nova ativação gratuita. Os preços dos demais fornecedores não mudaram.</p><Button onClick={start} disabled={busy} className="mt-6">Consultar condições</Button></> : <Button onClick={start} disabled={busy}>{busy ? 'Iniciando...' : 'Iniciar ativação'}</Button>}</div>}
    {message && <p role="status" className="mt-5 text-sm text-success">{message}</p>}{error && <p role="alert" className="mt-5 text-sm text-destructive">{error}</p>}
  </div></main>;
}