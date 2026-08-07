'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  FavouriteIcon,
  Comment01Icon,
  Delete02Icon,
  SentIcon,
  Share08Icon,
  Tick02Icon,
  IncognitoIcon,
} from '@hugeicons/core-free-icons';
import { COMMENT_MAX, type DiscussionPost, type FeedComment } from '@/lib/community';
import { useLogin } from '../comunidad/login-gate';
import { MentionInput } from '../comunidad/mention-input';

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

function renderMentions(body: string) {
  return body.split(/(@[\w.]+)/g).map((part, i) =>
    part.startsWith('@') ? (
      <Link key={i} href={`/u/${part.slice(1)}`} className="font-bold text-primary hover:underline">
        {part}
      </Link>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

function Avatar({ url, name, anon }: { url: string | null; name: string; anon: boolean }) {
  if (anon) {
    return (
      <div className="flex h-9 w-9 items-center justify-center border-2 border-border bg-muted">
        <HugeiconsIcon icon={IncognitoIcon} className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-9 w-9 border-2 border-border object-cover" />;
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center border-2 border-border bg-muted">
      <span className="display text-sm text-muted-foreground">{name.slice(0, 2).toUpperCase()}</span>
    </div>
  );
}

export function DiscussionFeed({
  initialPosts,
  initialCursor,
  isAuthed,
}: {
  initialPosts: DiscussionPost[];
  initialCursor: string | null;
  isAuthed: boolean;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);

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
      const res = await fetch(`/api/community/discussion?cursor=${cursor}`);
      const json = await res.json();
      if (res.ok) {
        setPosts((prev) => [...prev, ...(json.posts as DiscussionPost[])]);
        setCursor(json.nextCursor);
      }
    } finally {
      setLoading(false);
    }
  }

  function patch(id: string, fn: (p: DiscussionPost) => DiscussionPost) {
    setPosts((prev) => prev.map((p) => (p.id === id ? fn(p) : p)));
  }
  function drop(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  if (posts.length === 0) {
    return (
      <div className="hud-panel px-6 py-16 text-center">
        <p className="display text-2xl tracking-widest text-muted-foreground">Sin temas todavía</p>
        <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
          {isAuthed ? 'Abrí el primero' : 'Iniciá sesión y abrí el primero'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <DiscussionCard key={post.id} post={post} isAuthed={isAuthed} onPatch={patch} onDrop={drop} />
      ))}
      {cursor && (
        <div className="flex justify-center pt-2">
          <button onClick={loadMore} disabled={loading} className="btn-ghost disabled:opacity-50">
            {loading ? 'Cargando…' : 'Ver más'}
          </button>
        </div>
      )}
    </div>
  );
}

function DiscussionCard({
  post,
  isAuthed,
  onPatch,
  onDrop,
}: {
  post: DiscussionPost;
  isAuthed: boolean;
  onPatch: (id: string, fn: (p: DiscussionPost) => DiscussionPost) => void;
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

  async function toggleLike() {
    if (!isAuthed) return openLogin();
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

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/c/${post.slug || post.id}`);
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    } catch {
      /* noop */
    }
  }

  const NameTag = post.anonymous ? (
    <span className="display truncate text-base tracking-wide text-muted-foreground">Anónimo</span>
  ) : (
    <Link
      href={`/u/${post.author.username}`}
      className="display block truncate text-base tracking-wide transition hover:text-primary"
    >
      {post.author.name}
    </Link>
  );

  return (
    <article className="hud-panel overflow-hidden">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Avatar url={post.author.avatarUrl} name={post.author.name} anon={post.anonymous} />
        <div className="min-w-0 flex-1">
          {NameTag}
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {timeAgo(post.createdAt)}
          </p>
        </div>
        {post.canDelete && (
          <button
            onClick={deletePost}
            title="Borrar"
            className="border-2 border-transparent p-1.5 text-muted-foreground transition hover:border-danger hover:text-danger"
          >
            <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4" />
          </button>
        )}
      </header>

      {post.body && (
        <p className="whitespace-pre-wrap break-words px-4 pt-3 text-sm leading-relaxed">
          {renderMentions(post.body)}
        </p>
      )}

      {post.imageUrl && (
        <div className="mt-3 bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.imageUrl} alt="" className="max-h-[70vh] w-full object-contain" />
        </div>
      )}

      <div className="mt-3 flex items-center gap-1 border-t border-border px-2 py-2">
        <button
          onClick={toggleLike}
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
        <button
          onClick={copyShare}
          title="Compartir"
          className="ml-auto flex items-center gap-2 border-2 border-transparent px-3 py-1.5 text-xs uppercase tracking-widest text-muted-foreground transition hover:border-border-strong hover:text-foreground"
        >
          <HugeiconsIcon icon={shared ? Tick02Icon : Share08Icon} className="h-4 w-4" />
          <span>{shared ? 'Copiado' : 'Compartir'}</span>
        </button>
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
                  <Avatar url={c.author.avatarUrl} name={c.author.name} anon={false} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <Link
                        href={`/u/${c.author.username}`}
                        className="display text-sm tracking-wide transition hover:text-primary"
                      >
                        {c.author.name}
                      </Link>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {timeAgo(c.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 break-words text-sm text-foreground/90">
                      {renderMentions(c.body)}
                    </p>
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
              <MentionInput
                value={draft}
                onChange={setDraft}
                maxLength={COMMENT_MAX}
                placeholder="Comentá… (@ para etiquetar)"
                className="w-full border-2 border-border bg-input px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-border-strong"
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
              <button type="button" onClick={openLogin} className="text-primary hover:underline">
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
