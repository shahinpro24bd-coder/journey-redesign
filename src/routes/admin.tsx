import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  FileText,
  ImagePlus,
  Images,
  Loader2,
  LogOut,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { TREATMENTS } from "@/lib/site-content/treatments";
import {
  claimFirstAdmin,
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
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<Status>({ tone: "idle", message: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg({ tone: "busy", message: "" });
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg({ tone: "error", message: error.message });
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/admin` },
      });
      setMsg(
        error
          ? { tone: "error", message: error.message }
          : { tone: "ok", message: "Check your email to confirm the account, then sign in." },
      );
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/admin`,
    });
    if (result.error) setMsg({ tone: "error", message: "Google sign-in failed." });
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-7 shadow-sm">
        <div className="mb-5 flex items-center gap-2 text-card-foreground">
          <ShieldCheck className="size-5" />
          <h1 className="text-lg font-semibold">Content Management</h1>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">
          {mode === "in" ? "Sign in to edit the website." : "Create an account for the admin panel."}
        </p>
        <Button type="button" variant="outline" className="w-full" onClick={google}>
          Continue with Google
        </Button>
        <div className="my-4 text-center text-xs text-muted-foreground">or</div>
        <form onSubmit={submit} className="space-y-3">
          <Input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
          <Input type="password" required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Password" />
          {msg.message ? (
            <p className={"text-xs " + (msg.tone === "error" ? "text-destructive" : "text-muted-foreground")}>{msg.message}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={msg.tone === "busy"}>
            {msg.tone === "busy" ? <Loader2 className="animate-spin" /> : null}
            {mode === "in" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <button type="button" className="mt-4 w-full text-center text-xs text-muted-foreground underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "No account yet? Create one" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
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
        <p className="text-xs text-muted-foreground">Signed in as {email}</p>
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
  const [images, setImages] = useState<{ slot: string; url: string }[]>([]);
  const [pageSearch, setPageSearch] = useState("");
  const [imageSearch, setImageSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [mobilePanel, setMobilePanel] = useState<"pages" | "images" | null>(null);

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
      if (file.size > 5_000_000) return setStatus({ tone: "error", message: "Image is too large (max 5 MB)." });
      setStatus({ tone: "busy", message: "Uploading image…" });
      try {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `images/${slot}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("site-content").upload(path, file, { contentType: file.type });
        if (error) throw error;
        await publishImageFn({ data: { slot, storagePath: path, mimeType: file.type } });
        const { data } = await supabase.storage.from("site-content").createSignedUrl(path, 3600);
        if (data?.signedUrl) {
          frameRef.current?.contentWindow?.postMessage({ source: "cms-admin", type: "image-saved", slot, url: data.signedUrl }, "*");
        }
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
      if (data.type === "images" && Array.isArray(data.images)) setImages(data.images);
      else if (data.type === "text") setDirty((prev) => ({ ...prev, [data.key]: data.value }));
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
    setImages([]);
    if (next.pageId) setPageId(next.pageId);
    if (next.lang) setLang(next.lang);
    setMobilePanel(null);
  }

  const filteredPages = useMemo(
    () => PAGES.filter((p) => p.label.toLowerCase().includes(pageSearch.toLowerCase())),
    [pageSearch],
  );
  const filteredImages = images.filter((i) => i.slot.includes(imageSearch.toLowerCase()));

  const pagesPanel = (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b border-border p-3">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => switchTo({ lang: l.code })}
              className={"rounded-md px-2 py-1.5 text-sm transition " + (lang === l.code ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground")}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={pageSearch} onChange={(e) => setPageSearch(e.target.value)} placeholder="Search pages" className="pl-8" aria-label="Search pages" />
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {["Main pages", "Treatment details"].map((group) => {
          const items = filteredPages.filter((p) => p.group === group);
          if (!items.length) return null;
          return (
            <div key={group} className="mb-3">
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
    </div>
  );

  const imagesPanel = (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-border p-3">
        <h2 className="text-sm font-semibold text-card-foreground">Images on this page ({images.length})</h2>
        <Input value={imageSearch} onChange={(e) => setImageSearch(e.target.value)} placeholder="Search images" aria-label="Search images" />
      </div>
      <ul className="flex-1 space-y-3 overflow-y-auto p-3">
        {filteredImages.map((img) => (
          <li key={img.slot} className="overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              title="Show on page"
              className="block w-full"
              onClick={() => frameRef.current?.contentWindow?.postMessage({ source: "cms-admin", type: "scroll-to", slot: img.slot }, "*")}
            >
              <img src={img.url} alt={img.slot} className="h-28 w-full bg-muted object-cover" />
            </button>
            <div className="flex items-center justify-between gap-2 p-2">
              <span className="truncate text-xs text-muted-foreground">{img.slot}</span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  pendingSlot.current = img.slot;
                  fileRef.current?.click();
                }}
              >
                <ImagePlus /> Replace
              </Button>
            </div>
          </li>
        ))}
        {!filteredImages.length ? <li className="text-xs text-muted-foreground">No images found.</li> : null}
      </ul>
    </div>
  );

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-muted">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2.5">
        <div className="mr-auto min-w-0">
          <p className="text-sm font-semibold text-card-foreground">Content Management</p>
          <p className="truncate text-xs text-muted-foreground">
            {page.label} · {lang === "en" ? "English" : "Arabic"} · {email}
          </p>
        </div>
        {status.message ? (
          <span className={"order-last w-full text-xs sm:order-none sm:w-auto " + (status.tone === "error" ? "text-destructive" : "text-muted-foreground")}>
            {busy ? <Loader2 className="mr-1 inline size-3 animate-spin" /> : null}
            {status.message}
          </span>
        ) : null}
        <Button size="sm" variant="outline" className="lg:hidden" onClick={() => setMobilePanel("pages")}><FileText /> Pages</Button>
        <Button size="sm" variant="outline" className="lg:hidden" onClick={() => setMobilePanel("images")}><Images /> Images</Button>
        <Button size="sm" onClick={handlePublish} disabled={!dirtyCount || busy}>
          <Save /> Publish{dirtyCount ? ` (${dirtyCount})` : ""}
        </Button>
        {dirtyCount ? (
          <Button size="sm" variant="ghost" onClick={() => { setDirty({}); setReloadKey((k) => k + 1); }}>Discard</Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={handleReset} disabled={busy} title="Restore original website"><RotateCcw /> <span className="hidden sm:inline">Restore</span></Button>
        <a href={`${page.path}?lang=${lang}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground">
          <ExternalLink className="size-4" /> <span className="hidden sm:inline">View site</span>
        </a>
        <Button size="sm" variant="ghost" onClick={signOut} title="Sign out"><LogOut /> <span className="hidden sm:inline">Sign out</span></Button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:block">{pagesPanel}</aside>
        <main className="flex min-w-0 flex-1 flex-col p-2 sm:p-3">
          <p className="mb-2 px-1 text-xs text-muted-foreground">Click outlined text to edit it, click any image to replace it, then press Publish.</p>
          <iframe ref={frameRef} key={frameSrc} src={frameSrc} title="Website preview" className="min-h-0 flex-1 rounded-lg border border-border bg-background shadow-sm" />
        </main>
        <aside className="hidden w-72 shrink-0 border-l border-border bg-card lg:block">{imagesPanel}</aside>
      </div>

      <Sheet open={mobilePanel !== null} onOpenChange={(o) => !o && setMobilePanel(null)}>
        <SheetContent side={mobilePanel === "images" ? "right" : "left"} className="w-80 p-0">
          <SheetHeader className="border-b border-border p-3 text-left">
            <SheetTitle>{mobilePanel === "images" ? "Images" : "Pages & language"}</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100%-3.5rem)]">{mobilePanel === "images" ? imagesPanel : pagesPanel}</div>
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
