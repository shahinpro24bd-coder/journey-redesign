import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  FileText,
  Loader2,
  LogOut,
  PanelLeft,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Undo2,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { TREATMENTS } from "@/lib/site-content/treatments";
import {
  claimFirstAdmin,
  ensureDefaultAdmin,
  usernameToEmail,
  getAdminStatus,
  publishImage,
  publishTextChanges,
  resetPublishedContent,
} from "@/lib/site-content/content.functions";

type PageItem = { id: string; label: string; path: string; group: string };

const PAGES: PageItem[] = [
  { id: "index", label: "Home", path: "/index.html", group: "Main pages" },
  { id: "about", label: "About", path: "/about.html", group: "Main pages" },
  { id: "service", label: "Treatments", path: "/service.html", group: "Main pages" },
  { id: "appoinment", label: "Appointment", path: "/appoinment.html", group: "Main pages" },
  { id: "contact", label: "Contact", path: "/contact.html", group: "Main pages" },
  ...TREATMENTS.map((t) => ({
    id: `t-${t.slug}`,
    label: t.title,
    path: `/treatments/${t.slug}`,
    group: "Treatment details",
  })),
];

const LANGS = [
  { code: "en", label: "English" },
  { code: "ar", label: "العربية" },
] as const;
type Lang = (typeof LANGS)[number]["code"];

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Content Management | Dr. Zaid Khaled Alamoudi" },
      { name: "description", content: "Edit and publish website text and images." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Content Management | Dr. Zaid Khaled Alamoudi" },
      { property: "og:description", content: "Edit and publish website text and images." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type Status = { tone: "idle" | "busy" | "ok" | "error"; message: string };

function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!ready) return <CenteredLoader />;
  if (!session) return <LoginScreen />;
  return <AdminGate email={session.user.email ?? ""} />;
}

function CenteredLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function LoginScreen() {
  const ensureFn = useServerFn(ensureDefaultAdmin);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<Status>({ tone: "idle", message: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg({ tone: "busy", message: "" });
    const email = usernameToEmail(username);
    let { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const r = await ensureFn({ data: { username, password } }).catch(() => ({ created: false }));
      if (r.created) ({ error } = await supabase.auth.signInWithPassword({ email, password }));
    }
    if (error) setMsg({ tone: "error", message: "Wrong username or password." });
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-7 shadow-sm">
        <div className="mb-5 flex items-center gap-3 text-card-foreground">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Admin Panel</h1>
            <p className="text-xs text-muted-foreground">Sign in to edit the website.</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Input required autoComplete="username" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} aria-label="Username" />
          <Input type="password" required autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Password" />
          {msg.message ? <p className="text-xs text-destructive">{msg.message}</p> : null}
          <Button type="submit" className="w-full" disabled={msg.tone === "busy"}>
            {msg.tone === "busy" ? <Loader2 className="animate-spin" /> : null}
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}

/** Resizes large photos (max 1920px) and converts to WebP so uploads finish fast. */
async function shrinkImage(file: File): Promise<Blob> {
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

async function signOut() {
  await supabase.auth.signOut();
}

function AdminGate({ email }: { email: string }) {
  const statusFn = useServerFn(getAdminStatus);
  const claimFn = useServerFn(claimFirstAdmin);
  const [state, setState] = useState<{ isAdmin: boolean; canClaim: boolean } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    statusFn().then(setState).catch(() => setError("Could not verify access."));
  }, [statusFn]);
  useEffect(load, [load]);

  if (error) return <Notice title="Access check failed" body={error} email={email} />;
  if (!state) return <CenteredLoader />;
  if (state.isAdmin) return <Editor email={email} />;
  if (state.canClaim)
    return (
      <Notice
        title="Set up the first admin"
        body="No admin exists yet. Make this account the website administrator."
        email={email}
        action={
          <Button onClick={() => claimFn().then(load).catch(() => setError("Setup failed."))}>
            <ShieldCheck /> Become admin
          </Button>
        }
      />
    );
  return <Notice title="No admin access" body="This account is not allowed to edit the website. Ask the current admin for access." email={email} />;
}

function Notice({ title, body, email, action }: { title: string; body: string; email: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-7 shadow-sm">
        <h1 className="text-lg font-semibold text-card-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{body}</p>
        <p className="text-xs text-muted-foreground">Signed in as {email.replace("@admin.local", "")}</p>
        <div className="flex gap-2">
          {action}
          <Button variant="ghost" onClick={signOut}><LogOut /> Sign out</Button>
        </div>
      </div>
    </div>
  );
}

function Editor({ email }: { email: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<string | null>(null);
  const publishTextFn = useServerFn(publishTextChanges);
  const publishImageFn = useServerFn(publishImage);
  const resetFn = useServerFn(resetPublishedContent);

  const [pageId, setPageId] = useState("index");
  const [lang, setLang] = useState<Lang>("en");
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ tone: "idle", message: "" });
  const [pageSearch, setPageSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  const page = PAGES.find((p) => p.id === pageId) ?? PAGES[0]!;
  const dirtyCount = Object.keys(dirty).length;
  const frameSrc = `${page.path}?edit=1&lang=${lang}&v=${reloadKey}`;
  const busy = status.tone === "busy";

  useEffect(() => {
    if (!dirtyCount) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyCount]);

  const saveImage = useCallback(
    async (slot: string, file: File) => {
      if (!file.type.startsWith("image/")) return setStatus({ tone: "error", message: "Please choose an image file." });
      if (file.size > 20_000_000) return setStatus({ tone: "error", message: "Image is too large (max 20 MB)." });
      setStatus({ tone: "busy", message: "Uploading image…" });
      // Show the new image immediately while it uploads.
      frameRef.current?.contentWindow?.postMessage({ source: "cms-admin", type: "image-saved", slot, url: URL.createObjectURL(file) }, "*");
      try {
        const upload = await shrinkImage(file);
        const ext = upload.type === "image/webp" ? "webp" : (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `images/${slot}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("site-content").upload(path, upload, { contentType: upload.type, cacheControl: "31536000" });
        if (error) throw error;
        await publishImageFn({ data: { slot, storagePath: path, mimeType: upload.type } });
        setStatus({ tone: "ok", message: "Image published to the website." });
      } catch {
        setStatus({ tone: "error", message: "Image upload failed. Please try again." });
      }
    },
    [publishImageFn],
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || data.source !== "cms-editor") return;
      if (data.type === "text") setDirty((prev) => ({ ...prev, [data.key]: data.value }));
      else if (data.type === "image" && data.file instanceof File) void saveImage(data.slot, data.file);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [saveImage]);

  async function handlePublish() {
    if (!dirtyCount) return;
    setStatus({ tone: "busy", message: "Publishing…" });
    try {
      await publishTextFn({ data: { language: lang, changes: dirty } });
      setDirty({});
      setStatus({ tone: "ok", message: "Changes are live on the website." });
    } catch {
      setStatus({ tone: "error", message: "Publishing failed. Your edits are kept — try again." });
    }
  }

  async function handleReset() {
    if (!window.confirm("Remove ALL published edits and restore the original website?")) return;
    setStatus({ tone: "busy", message: "Restoring original content…" });
    try {
      await resetFn();
      setDirty({});
      setReloadKey((k) => k + 1);
      setStatus({ tone: "ok", message: "Original content restored." });
    } catch {
      setStatus({ tone: "error", message: "Restore failed." });
    }
  }

  function switchTo(next: { pageId?: string; lang?: Lang }) {
    if (dirtyCount && !window.confirm("You have unpublished changes. Discard them?")) return;
    setDirty({});
    if (next.pageId) setPageId(next.pageId);
    if (next.lang) setLang(next.lang);
    setMobileOpen(false);
  }

  const filteredPages = useMemo(
    () => PAGES.filter((p) => p.label.toLowerCase().includes(pageSearch.toLowerCase())),
    [pageSearch],
  );

  const sidebar = (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <section className="rounded-2xl border border-border bg-background p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Editing tools</h2>
          <span className={"rounded-full px-2 py-0.5 text-[11px] font-medium " + (dirtyCount ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            {dirtyCount ? `${dirtyCount} unsaved` : "All saved"}
          </span>
        </div>

        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Language</p>
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => switchTo({ lang: l.code })}
              className={"rounded-md px-2 py-1.5 text-sm transition " + (lang === l.code ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <Button className="w-full" onClick={handlePublish} disabled={!dirtyCount || busy}>
            <Save /> Publish changes
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" disabled={!dirtyCount || busy} onClick={() => { setDirty({}); setReloadKey((k) => k + 1); }}>
              <Undo2 /> Discard
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset} disabled={busy}>
              <RotateCcw /> Restore
            </Button>
          </div>
        </div>

        {status.message ? (
          <p className={"mt-3 rounded-md bg-muted px-2.5 py-2 text-xs " + (status.tone === "error" ? "text-destructive" : "text-muted-foreground")}>
            {busy ? <Loader2 className="mr-1 inline size-3 animate-spin" /> : null}
            {status.message}
          </p>
        ) : null}

        <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
          Click outlined text to edit it, click any image to replace it, then press Publish.
        </p>
      </section>

      <section className="flex min-h-0 flex-col rounded-2xl border border-border bg-background p-3 shadow-sm">
        <h2 className="mb-2 px-1 text-sm font-semibold text-foreground">Pages</h2>
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={pageSearch} onChange={(e) => setPageSearch(e.target.value)} placeholder="Search pages" className="pl-8" aria-label="Search pages" />
        </div>
        <nav>
          {["Main pages", "Treatment details"].map((group) => {
            const items = filteredPages.filter((p) => p.group === group);
            if (!items.length) return null;
            return (
              <div key={group} className="mb-2">
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
                {items.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => switchTo({ pageId: p.id })}
                    className={"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition " + (p.id === pageId ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent")}
                  >
                    <FileText className="size-3.5 shrink-0" />
                    <span className="truncate">{p.label}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
      </section>
    </div>
  );

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-muted">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Button size="icon" variant="outline" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open editing tools">
          <PanelLeft />
        </Button>
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <ShieldCheck className="size-5" />
        </div>
        <div className="mr-auto min-w-0">
          <p className="text-sm font-semibold text-card-foreground">Admin Panel</p>
          <p className="truncate text-xs text-muted-foreground">
            Editing: {page.label} · {lang === "en" ? "English" : "Arabic"}
          </p>
        </div>
        <span className="hidden text-xs text-muted-foreground md:inline">{email.replace("@admin.local", "")}</span>
        <a href={`${page.path}?lang=${lang}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground">
          <ExternalLink className="size-4" /> <span className="hidden sm:inline">View site</span>
        </a>
        <Button size="sm" variant="ghost" onClick={signOut} title="Sign out"><LogOut /> <span className="hidden sm:inline">Sign out</span></Button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-80 shrink-0 border-r border-border bg-card lg:block">{sidebar}</aside>
        <main className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
          <iframe ref={frameRef} key={frameSrc} src={frameSrc} title="Website preview" className="min-h-0 flex-1 rounded-2xl border border-border bg-background shadow-sm" />
        </main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-80 bg-card p-0">
          <SheetHeader className="border-b border-border p-4 text-left">
            <SheetTitle>Editing tools</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100%-3.75rem)]">{sidebar}</div>
        </SheetContent>
      </Sheet>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file && pendingSlot.current) void saveImage(pendingSlot.current, file);
        }}
      />
    </div>
  );
}
