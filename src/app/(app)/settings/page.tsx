"use client";
import { useExperience } from "@/components/experience-provider";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { WorkspaceRail } from "@/components/workspace-rail";
import { EditorDialog } from "@/components/editor-dialog";
import { signOut } from "next-auth/react";
import { Clock, Monitor, Moon, Sun, LogOut, Trash2, Globe } from "lucide-react";
import { Alert, Page, PageSkeleton } from "@/components/ui";
import { useTheme, type ThemePreference } from "@/components/theme-provider";
import { deviceTimeZone } from "@/lib/client-date";
import { SYSTEM_TZ, systemTzLabel, timezoneGroups } from "@/lib/timezones";

type SettingsCache = {
  name: string;
  emailEnabled: boolean;
  emailTimeLocal: string;
  timezone: string;
  digest: {
    createdAt: string;
    payload: { headline?: string; summary?: string };
  } | null;
};

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  Icon: typeof Sun;
}[] = [
  { value: "system", label: "System", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "schedule", label: "Auto", Icon: Clock },
];

export default function SettingsPage() {
  const { fetch, requestJson, getCache, setCache, invalidateCache, isDemo } =
    useExperience();
  const { preference, setPreference, schedule, setSchedule, scheduleStatus } =
    useTheme();
  const deliveryEdited = useRef(false);
  const cached0 = getCache<SettingsCache>("settings");
  const [loading, setLoading] = useState(!cached0);
  const [emailEnabled, setEmailEnabled] = useState(
    cached0?.emailEnabled ?? false,
  );
  const [savedDelivery, setSavedDelivery] = useState({
    enabled: cached0?.emailEnabled ?? false,
    time: cached0?.emailTimeLocal ?? "07:00",
    zone: cached0?.timezone ?? "",
  });
  const [emailTimeLocal, setEmailTimeLocal] = useState(
    cached0?.emailTimeLocal || "07:00",
  );
  const [timezone, setTimezone] = useState(cached0?.timezone || "");
  const [deviceTz, setDeviceTz] = useState("");
  const tzGroups = useMemo(timezoneGroups, []);
  const [name, setName] = useState(cached0?.name || "");
  const [draftName, setDraftName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleteOtp, setDeleteOtp] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [digest, setDigest] = useState<{
    createdAt: string;
    payload: { headline?: string; summary?: string };
  } | null>(cached0?.digest ?? null);
  const [editor, setEditor] = useState<
    "account" | "password" | "delete" | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [latestOpen, setLatestOpen] = useState(false);

  useEffect(() => {
    const detected = deviceTimeZone();
    setDeviceTz(detected);
    const cached = getCache<SettingsCache>("settings");
    if (cached) {
      setName(cached.name);
      setEmailEnabled(cached.emailEnabled);
      setEmailTimeLocal(cached.emailTimeLocal);
      setTimezone(cached.timezone || detected);
      setDigest(cached.digest);
      setLoading(false);
    } else if (!timezone) {
      setTimezone(detected);
    }
    let cancelled = false;
    (async () => {
      try {
        const me = await fetch("/api/me").then((r) => r.json());
        if (cancelled) return;
        const n = me.user?.name || "";
        if (n) setName(n);
        let en = false;
        let t = "07:00";
        let tz = detected;
        if (me.prefs) {
          en = !!me.prefs.emailEnabled;
          t = me.prefs.emailTimeLocal || "07:00";
          tz = me.prefs.timezone || detected;
          if (!deliveryEdited.current) {
            setEmailEnabled(en);
            setEmailTimeLocal(t);
            setTimezone(tz);
          }
        } else setTimezone(detected);
        setSavedDelivery({ enabled: en, time: t, zone: tz });
        const d = await fetch("/api/digests/latest").then((r) => r.json());
        if (cancelled) return;
        setDigest(d.digest);
        setCache<SettingsCache>(
          "settings",
          {
            name: n || name,
            emailEnabled: en,
            emailTimeLocal: t,
            timezone: tz,
            digest: d.digest,
          },
          2 * 60_000,
        );
      } catch {
        if (!cancelled)
          setError(
            "Could not load your settings. Please refresh and try again.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendTest() {
    setMessage("");
    setError("");
    setTesting(true);
    try {
      const res = await fetch("/api/digests/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Test send failed");
        return;
      }
      setMessage(data.message || "Test digest sent");
      const d = await fetch("/api/digests/latest").then((r) => r.json());
      setDigest(d.digest);
      if (isDemo) setLatestOpen(true);
    } catch {
      setError("Test send failed");
    } finally {
      setTesting(false);
    }
  }

  async function saveDigest() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await requestJson("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailEnabled,
          emailTimeLocal,
          timezone,
          runAi: false,
        }),
      });
      invalidateCache("settings");
      invalidateCache("prefs");
      setSavedDelivery({
        enabled: emailEnabled,
        time: emailTimeLocal,
        zone: timezone,
      });
      setMessage("Digest settings saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function sendStepUp() {
    setMessage("");
    setError("");
    setSendingCode(true);
    try {
      const res = await fetch("/api/identity/stepup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Could not send code");
      else
        setMessage(
          data.message || "If this email can be used, we sent a code.",
        );
    } catch {
      setError("Could not send the code. Please try again.");
    } finally {
      setSendingCode(false);
    }
  }

  async function saveAccount() {
    if (busy) return;
    setMessage("");
    setError("");
    setBusy(true);
    try {
      await requestJson("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editor === "account" ? draftName.trim() : undefined,
          currentPassword: currentPassword || undefined,
          newPassword: editor === "password" ? newPassword : undefined,
          otp: otp || undefined,
        }),
      });
      if (editor === "account") setName(draftName.trim());
      invalidateCache("settings");
      setMessage("Account updated.");
      setCurrentPassword("");
      setNewPassword("");
      setOtp("");
      setEditor(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not update your account.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function deleteAccount() {
    if (
      busy ||
      !window.confirm(
        "Permanently delete your MealWorks account and personal data? Office menus will remain.",
      )
    )
      return;
    setMessage("");
    setError("");
    setBusy(true);
    try {
      await requestJson("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: deleteOtp, confirmEmail }),
      });
      await signOut({ callbackUrl: "/" });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not delete your account.",
      );
    } finally {
      setBusy(false);
    }
  }
  function openEditor(next: "account" | "password" | "delete") {
    setDraftName(name);
    setError("");
    setMessage("");
    setCurrentPassword("");
    setNewPassword("");
    setOtp("");
    setDeleteOtp("");
    setConfirmEmail("");
    setEditor(next);
  }

  if (loading) {
    return (
      <Page>
        <h1 className="sr-only">Settings</h1>
        <PageSkeleton rows={4} />
      </Page>
    );
  }

  const deliveryChanged =
    emailEnabled !== savedDelivery.enabled ||
    emailTimeLocal !== savedDelivery.time ||
    timezone !== savedDelivery.zone;
  return (
    <Page className="settings-page">
      <h1 className="sr-only">Settings</h1>
      {!editor && error && <Alert tone="bad">{error}</Alert>}
      {!editor && message && <Alert tone="good">{message}</Alert>}
      <div className="profile-layout">
        <WorkspaceRail
          label="Settings sections"
          sections={[
            { id: "appearance", label: "Appearance" },
            { id: "email-delivery", label: "Email delivery" },
            { id: "your-account", label: "Your account" },
          ]}
        />
        <div className="profile-main">
          <div className="settings-main">
            <section
              id="appearance"
              className="settings-appearance workspace-panel"
            >
              <h2>Appearance</h2>
              <p className="section-description">
                Choose your view. Changes apply immediately.
              </p>
              <div
                className="theme-previews"
                role="radiogroup"
                aria-label="Color theme"
              >
                {[...THEME_OPTIONS]
                  .sort(
                    (a, b) =>
                      ["light", "dark", "system", "schedule"].indexOf(a.value) -
                      ["light", "dark", "system", "schedule"].indexOf(b.value),
                  )
                  .map(({ value, label, Icon }) => (
                    <button
                      type="button"
                      className="theme-preview"
                      data-theme-option={value}
                      data-active={preference === value}
                      role="radio"
                      aria-checked={preference === value}
                      key={value}
                      tabIndex={preference === value ? 0 : -1}
                      onKeyDown={(event) => {
                        if (
                          ![
                            "ArrowLeft",
                            "ArrowRight",
                            "ArrowUp",
                            "ArrowDown",
                            "Home",
                            "End",
                          ].includes(event.key)
                        )
                          return;
                        event.preventDefault();
                        const choices = Array.from(
                          event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                            '[role="radio"]',
                          ),
                        );
                        const index = choices.indexOf(event.currentTarget);
                        const next =
                          event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? choices.length - 1
                              : (index +
                                  (event.key === "ArrowLeft" ||
                                  event.key === "ArrowUp"
                                    ? -1
                                    : 1) +
                                  choices.length) %
                                choices.length;
                        choices[next].focus();
                        choices[next].click();
                      }}
                      onClick={() => setPreference(value)}
                    >
                      <span className="theme-swatch" aria-hidden="true">
                        <Icon size={30} strokeWidth={1.4} />
                        <span className="theme-mini">
                          <i />
                          <i />
                          <i />
                        </span>
                      </span>
                      <span className="theme-preview-label">
                        <Icon size={17} />
                        {label}
                        <span className="selection-dot" />
                      </span>
                    </button>
                  ))}
              </div>
              {preference === "schedule" && (
                <div className="schedule-fields">
                  <label className="editor-label">
                    Dark from
                    <input
                      className="field"
                      type="time"
                      value={schedule.darkFrom}
                      onChange={(e) =>
                        setSchedule({ darkFrom: e.target.value || "20:00" })
                      }
                    />
                  </label>
                  <label className="editor-label">
                    Until
                    <input
                      className="field"
                      type="time"
                      value={schedule.darkTo}
                      onChange={(e) =>
                        setSchedule({ darkTo: e.target.value || "07:00" })
                      }
                    />
                  </label>
                </div>
              )}
              <p className="section-description" role="status">
                {scheduleStatus}
              </p>
            </section>
            <section
              id="email-delivery"
              className="settings-digest workspace-panel"
              data-enabled={emailEnabled}
            >
              <div className="section-heading">
                <h2>Email delivery</h2>
                <label className="switch-control">
                  <span className="sr-only">Enable email digests</span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={emailEnabled}
                    onChange={(e) => {
                      deliveryEdited.current = true;
                      setEmailEnabled(e.target.checked);
                    }}
                  />
                  <span aria-hidden />
                </label>
              </div>
              <p className="section-description">
                {isDemo
                  ? "Try delivery settings here. Create an account to receive emails."
                  : emailEnabled
                    ? "Your day’s best picks, delivered each morning."
                    : "Email delivery is off. Turn it on for your morning picks."}
              </p>
              {emailEnabled && (
                <div className="field-row-2">
                  <div>
                    <label className="label" htmlFor="digest-time">
                      Time
                    </label>
                    <div className="field-shell digest-control">
                      <input
                        id="digest-time"
                        className="field field-native"
                        type="time"
                        disabled={!emailEnabled}
                        value={emailTimeLocal}
                        onChange={(e) => {
                          deliveryEdited.current = true;
                          setEmailTimeLocal(e.target.value);
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="digest-zone">
                      Timezone
                    </label>
                    <div className="field-shell digest-control">
                      <Globe size={22} aria-hidden="true" />
                      <select
                        id="digest-zone"
                        disabled={!emailEnabled}
                        className="field field-native"
                        value={
                          !timezone || timezone === deviceTz
                            ? SYSTEM_TZ
                            : timezone
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          deliveryEdited.current = true;
                          setTimezone(v === SYSTEM_TZ ? deviceTz : v);
                        }}
                      >
                        <option value={SYSTEM_TZ}>
                          {systemTzLabel(deviceTz)}
                        </option>
                        {timezone &&
                          timezone !== deviceTz &&
                          !tzGroups.some((g) => g.zones.includes(timezone)) && (
                            <option value={timezone}>
                              {timezone.replace(/_/g, " ")}
                            </option>
                          )}
                        {tzGroups.map((g) => (
                          <optgroup key={g.region} label={g.region}>
                            {g.zones.map((z) => (
                              <option key={z} value={z}>
                                {z.replace(/_/g, " ")}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
              <div className="settings-actions">
                {!emailEnabled && !deliveryChanged ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      deliveryEdited.current = true;
                      setEmailEnabled(true);
                    }}
                  >
                    Set up digest
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || !deliveryChanged}
                    onClick={saveDigest}
                  >
                    {busy
                      ? "Saving…"
                      : deliveryChanged
                        ? "Save delivery settings"
                        : "Delivery settings saved"}
                  </button>
                )}
                {emailEnabled && (
                  <button
                    type="button"
                    className="text-action"
                    disabled={testing}
                    onClick={sendTest}
                  >
                    {testing
                      ? "Preparing…"
                      : isDemo
                        ? "Preview digest"
                        : "Send test email"}
                  </button>
                )}
              </div>
              <details
                className="settings-latest"
                open={latestOpen}
                onToggle={(event) => setLatestOpen(event.currentTarget.open)}
              >
                <summary>View latest digest</summary>
                {digest ? (
                  <div className="digest-summary digest-with-photo">
                    <div className="digest-copy">
                      <p className="eyebrow">
                        {new Date(digest.createdAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      <h3>{digest.payload.headline || "Your daily digest"}</h3>
                      <p>{digest.payload.summary}</p>
                    </div>
                  </div>
                ) : (
                  <div className="digest-summary">
                    <p>No digest yet.</p>
                    <p className="section-description">
                      Once one is sent, you’ll find it here.
                    </p>
                  </div>
                )}
              </details>
            </section>
          </div>
          <div className="settings-secondary">
            <section
              id="your-account"
              className="workspace-panel settings-account"
            >
              {isDemo ? (
                <div className="demo-account">
                  <h2>Make it yours</h2>
                  <p className="section-description">
                    Set up your food profile, keep your preferences and get your
                    own daily recommendations.
                  </p>
                  <Link href="/register" className="btn btn-primary">
                    Create an account
                  </Link>
                  <Link href="/login" className="text-action">
                    Sign in
                  </Link>
                </div>
              ) : (
                <>
                  <div className="account-heading">
                    <span className="account-monogram" aria-hidden="true">
                      {name
                        ? name
                            .trim()
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join("")
                        : "M"}
                    </span>
                    <div>
                      <h2>Your account</h2>
                      <p className="section-description">
                        Your personal details and sign-in.
                      </p>
                    </div>
                  </div>
                  <div className="setting-row">
                    <div>
                      <h3>Profile</h3>
                      <p>{name || "Your MealWorks profile"}</p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => openEditor("account")}
                    >
                      Edit profile
                    </button>
                  </div>
                  <div className="setting-row">
                    <div>
                      <h3>Password</h3>
                      <p>Keep your account secure.</p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => openEditor("password")}
                    >
                      Change password
                    </button>
                  </div>
                  <div className="account-footer">
                    <button
                      type="button"
                      className="text-action signout-action"
                      onClick={() => signOut({ callbackUrl: "/" })}
                    >
                      <LogOut size={18} />
                      Sign out
                    </button>
                    <button
                      type="button"
                      className="text-action account-delete"
                      onClick={() => openEditor("delete")}
                    >
                      <Trash2 size={18} />
                      Delete account
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </div>
      <EditorDialog
        open={!!editor}
        title={
          editor === "delete"
            ? "Delete your account"
            : editor === "password"
              ? "Change password"
              : "Edit your details"
        }
        description={
          editor === "delete"
            ? "This permanently removes your personal data. Office menus remain. Confirm your email and a fresh verification code."
            : "Use a fresh email code to confirm this change."
        }
        onClose={() => {
          if (!busy) setEditor(null);
        }}
      >
        {error && <Alert tone="bad">{error}</Alert>}
        {message && <Alert tone="good">{message}</Alert>}
        <form
          className="editor-body"
          onSubmit={(e) => {
            e.preventDefault();
            void (editor === "delete" ? deleteAccount() : saveAccount());
          }}
        >
          {editor === "account" && (
            <label className="editor-label">
              Name
              <input
                className="field"
                required
                maxLength={80}
                autoComplete="name"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
              />
            </label>
          )}
          {editor === "password" && (
            <>
              <label className="editor-label">
                Current password
                <input
                  className="field"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </label>
              <label className="editor-label">
                New password
                <input
                  className="field"
                  required
                  type="password"
                  minLength={10}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <span>At least 10 characters.</span>
              </label>
            </>
          )}
          {editor === "delete" && (
            <label className="editor-label">
              Confirm your email
              <input
                className="field"
                required
                type="email"
                autoComplete="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
              />
            </label>
          )}
          <label className="editor-label">
            Email verification code
            <div className="custom-choice">
              <input
                className="field"
                required
                pattern="[0-9]{6}"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={editor === "delete" ? deleteOtp : otp}
                onChange={(e) =>
                  (editor === "delete" ? setDeleteOtp : setOtp)(
                    e.target.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
              />
              <button
                type="button"
                className="btn btn-secondary"
                disabled={sendingCode}
                onClick={sendStepUp}
              >
                {sendingCode ? "Sending…" : "Send code"}
              </button>
            </div>
          </label>
          <footer className="editor-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => setEditor(null)}
            >
              Cancel
            </button>
            <button
              className={
                editor === "delete" ? "btn btn-danger" : "btn btn-primary"
              }
              disabled={busy}
            >
              {busy
                ? "Working…"
                : editor === "delete"
                  ? "Delete permanently"
                  : "Save changes"}
            </button>
          </footer>
        </form>
      </EditorDialog>
    </Page>
  );
}
