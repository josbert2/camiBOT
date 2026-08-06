'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  FavouriteIcon,
  Comment01Icon,
  Delete02Icon,
  GunIcon,
  SentIcon,
  Share08Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';
import { COMMENT_MAX, type FeedComment, type FeedPost } from '@/lib/community';
import { useLogin } from './login-gate';
import { VideoPlayer } from './video-player';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short' });
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 border-2 border-border object-cover"
      />
    );
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center border-2 border-border bg-muted">
      <span className="display text-sm text-muted-foreground">
        {name.slice(0, 2).toUpperCase()}
      </span>
    </div>
  );
}

export function Feed({
  initialPosts,
  initialCursor,
  weaponId,
  isAuthed,
}: {
  initialPosts: FeedPost[];
  initialCursor: string | null;
  weaponId?: string;
  isAuthed: boolean;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Tras publicar/borrar, router.refresh() trae initialPosts nuevos: prependemos
  // los que no teníamos (así el clip recién subido aparece sin F5) sin pisar la
  // paginación ya cargada.
  useEffect(() => {
    setPosts((prev) => {
      const known = new Set(prev.map((p) => p.id));
      const fresh = initialPosts.filter((p) => !known.has(p.id));
      return fresh.length ? [...fresh, ...prev] : prev;
    });
  }, [initialPosts]);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ cursor });
      if (weaponId) params.set('weaponId', weaponId);
      const res = await fetch(`/api/community/posts?${params}`);
      const json = await res.json();
      if (res.ok) {
        setPosts((prev) => [...prev, ...(json.posts as FeedPost[])]);
        setCursor(json.nextCursor);
      }
    } finally {
      setLoading(false);
    }
  }

  // Scroll infinito: cargamos la siguiente página (de a 5) cuando el sentinel
  // se acerca al viewport. El botón "Ver más" queda de fallback.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !cursor) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '600px' },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, loading]);

  function patch(id: string, fn: (p: FeedPost) => FeedPost) {
    setPosts((prev) => prev.map((p) => (p.id === id ? fn(p) : p)));
  }

  function drop(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  if (posts.length === 0) {
    return (
      <div className="hud-panel px-6 py-16 text-center">
        <p className="display text-2xl tracking-widest text-muted-foreground">
          Todavía no hay nada acá
        </p>
        <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
          {isAuthed ? 'Subí la primera play' : 'Iniciá sesión y subí la primera play'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          isAuthed={isAuthed}
          onPatch={patch}
          onDrop={drop}
        />
      ))}

      {cursor && (
        <>
          <div ref={sentinelRef} aria-hidden className="h-1" />
          <div className="flex justify-center pt-2">
            <button onClick={loadMore} disabled={loading} className="btn-ghost disabled:opacity-50">
              {loading ? 'Cargando…' : 'Ver más'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PostCard({
  post,
  isAuthed,
  onPatch,
  onDrop,
}: {
  post: FeedPost;
  isAuthed: boolean;
  onPatch: (id: string, fn: (p: FeedPost) => FeedPost) => void;
  onDrop: (id: string) => void;
}) {
  const openLogin = useLogin();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<FeedComment[]>(post.comments);
  const [allLoaded, setAllLoaded] = useState(post.commentCount <= post.comments.length);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [slug, setSlug] = useState(post.slug);
  const [slugDraft, setSlugDraft] = useState(post.slug ?? '');
  const [slugBusy, setSlugBusy] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

  const shareUrl = () =>
    `${typeof window !== 'undefined' ? window.location.origin : ''}/c/${slug || post.id}`;

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    } catch {
      // sin clipboard: nada que hacer
    }
  }

  async function saveSlug() {
    if (slugBusy) return;
    setSlugBusy(true);
    setSlugError(null);
    try {
      const res = await fetch(`/api/community/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: slugDraft }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'No se pudo guardar.');
      setSlug(json.slug);
      setSlugDraft(json.slug ?? '');
    } catch (err) {
      setSlugError(err instanceof Error ? err.message : 'Algo salió mal.');
    } finally {
      setSlugBusy(false);
    }
  }

  async function toggleLike() {
    if (!isAuthed) {
      openLogin();
      return;
    }

    // Optimista: invertimos ya y revertimos si el server dice otra cosa.
    const before = { liked: post.likedByMe, count: post.likeCount };
    onPatch(post.id, (p) => ({
      ...p,
      likedByMe: !p.likedByMe,
      likeCount: p.likeCount + (p.likedByMe ? -1 : 1),
    }));

    const res = await fetch(`/api/community/posts/${post.id}/like`, { method: 'POST' });
    if (!res.ok) {
      onPatch(post.id, (p) => ({ ...p, likedByMe: before.liked, likeCount: before.count }));
      return;
    }
    const json = await res.json();
    onPatch(post.id, (p) => ({ ...p, likedByMe: json.liked, likeCount: json.likeCount }));
  }

  async function openComments() {
    const next = !showComments;
    setShowComments(next);
    if (next && !allLoaded) {
      const res = await fetch(`/api/community/posts/${post.id}/comments`);
      if (res.ok) {
        const json = await res.json();
        setComments(json.comments);
        setAllLoaded(true);
      }
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/community/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'No se pudo comentar.');

      setComments((prev) => [...prev, json.comment]);
      onPatch(post.id, (p) => ({ ...p, commentCount: p.commentCount + 1 }));
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal.');
    } finally {
      setSending(false);
    }
  }

  async function deleteComment(id: string) {
    const res = await fetch(`/api/community/comments/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id));
      onPatch(post.id, (p) => ({ ...p, commentCount: Math.max(0, p.commentCount - 1) }));
    }
  }

  async function deletePost() {
    const res = await fetch(`/api/community/posts/${post.id}`, { method: 'DELETE' });
    if (res.ok) onDrop(post.id);
  }

  return (
    <article className="hud-panel overflow-hidden">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Avatar url={post.author.avatarUrl} name={post.author.name} />
        <div className="min-w-0 flex-1">
          <p className="display truncate text-base tracking-wide">{post.author.name}</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {timeAgo(post.createdAt)}
          </p>
        </div>
        {post.canDelete && (
          <button
            onClick={deletePost}
            title="Borrar clip"
            className="border-2 border-transparent p-1.5 text-muted-foreground transition hover:border-danger hover:text-danger"
          >
            <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4" />
          </button>
        )}
      </header>

      {post.caption && <p className="px-4 pt-3 text-sm leading-relaxed">{post.caption}</p>}

      {(post.weaponName || post.gameMode) && (
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {post.weaponName && (
            <Link
              href={`/comunidad?arma=${post.weaponId}`}
              className="flex items-center gap-1.5 border border-border px-2 py-1 text-[10px] uppercase tracking-widest text-primary transition hover:border-border-strong"
            >
              <HugeiconsIcon icon={GunIcon} className="h-3 w-3" />
              {post.weaponName}
            </Link>
          )}
          {post.gameMode && (
            <span className="border border-border px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              {post.gameMode}
            </span>
          )}
        </div>
      )}

      <div className="mt-3">
        <VideoPlayer src={post.videoUrl} poster={post.posterUrl ?? undefined} />
      </div>

      <div className="flex items-center gap-1 border-t border-border px-2 py-2">
        <button
          onClick={toggleLike}
          title={isAuthed ? 'Me gusta' : 'Iniciá sesión para reaccionar'}
          className={`flex items-center gap-2 border-2 border-transparent px-3 py-1.5 text-xs uppercase tracking-widest transition ${
            post.likedByMe
              ? 'text-danger'
              : 'text-muted-foreground hover:border-border-strong hover:text-foreground'
          }`}
        >
          <HugeiconsIcon icon={FavouriteIcon} className="h-4 w-4" />
          <span>{post.likeCount}</span>
        </button>

        <button
          onClick={openComments}
          className="flex items-center gap-2 border-2 border-transparent px-3 py-1.5 text-xs uppercase tracking-widest text-muted-foreground transition hover:border-border-strong hover:text-foreground"
        >
          <HugeiconsIcon icon={Comment01Icon} className="h-4 w-4" />
          <span>{post.commentCount}</span>
        </button>

        <div className="relative ml-auto">
          <button
            onClick={() => setShareOpen((o) => !o)}
            title="Compartir"
            className="flex items-center gap-2 border-2 border-transparent px-3 py-1.5 text-xs uppercase tracking-widest text-muted-foreground transition hover:border-border-strong hover:text-foreground"
          >
            <HugeiconsIcon icon={Share08Icon} className="h-4 w-4" />
            <span>Compartir</span>
          </button>

          {shareOpen && (
            <>
              <button
                aria-label="Cerrar"
                onClick={() => setShareOpen(false)}
                className="fixed inset-0 z-30 cursor-default"
              />
              <div className="absolute bottom-full right-0 z-40 mb-2 w-72 border-2 border-border-strong bg-card p-3 shadow-xl">
                <div className="mb-2 tag-tactical">// COMPARTIR</div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={shareUrl()}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 border-2 border-border bg-input px-2 py-1.5 text-[11px] text-muted-foreground outline-none"
                  />
                  <button
                    type="button"
                    onClick={copyShare}
                    title="Copiar"
                    className="btn-tactical text-xs"
                  >
                    <HugeiconsIcon icon={shared ? Tick02Icon : Share08Icon} className="h-4 w-4" />
                  </button>
                </div>

                {post.canDelete && (
                  <div className="mt-3 border-t border-border pt-3">
                    <div className="mb-1 tag-tactical">URL personalizada</div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">/c/</span>
                      <input
                        value={slugDraft}
                        onChange={(e) => setSlugDraft(e.target.value)}
                        placeholder="mi-mejor-play"
                        className="min-w-0 flex-1 border-2 border-border bg-input px-2 py-1.5 text-xs outline-none focus:border-border-strong"
                      />
                      <button
                        type="button"
                        onClick={saveSlug}
                        disabled={slugBusy}
                        className="btn-ghost text-xs disabled:opacity-50"
                      >
                        {slugBusy ? '…' : 'Guardar'}
                      </button>
                    </div>
                    {slugError && <p className="mt-1 text-[11px] text-danger">{slugError}</p>}
                    <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                      Vacío = URL por defecto.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showComments && (
        <div className="border-t border-border px-4 py-3">
          {comments.length === 0 ? (
            <p className="py-2 text-xs uppercase tracking-widest text-muted-foreground">
              Sin comentarios todavía
            </p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="flex items-start gap-3">
                  <Avatar url={c.author.avatarUrl} name={c.author.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="display text-sm tracking-wide">{c.author.name}</span>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {timeAgo(c.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 break-words text-sm text-foreground/90">{c.body}</p>
                  </div>
                  {c.canDelete && (
                    <button
                      onClick={() => deleteComment(c.id)}
                      title="Borrar comentario"
                      className="p-1 text-muted-foreground transition hover:text-danger"
                    >
                      <HugeiconsIcon icon={Delete02Icon} className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {isAuthed ? (
            <form onSubmit={submitComment} className="mt-4 flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, COMMENT_MAX))}
                placeholder="Escribí un comentario…"
                className="min-w-0 flex-1 border-2 border-border bg-input px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-border-strong"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="btn-tactical text-xs disabled:opacity-50"
              >
                <HugeiconsIcon icon={SentIcon} className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">
              <button
                type="button"
                onClick={openLogin}
                className="text-primary hover:underline"
              >
                Iniciá sesión
              </button>{' '}
              para comentar
            </p>
          )}

          {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        </div>
      )}
    </article>
  );
}
