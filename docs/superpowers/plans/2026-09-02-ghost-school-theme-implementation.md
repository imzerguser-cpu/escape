# 유령 학교의 저주 테마 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle every student-facing screen (`#studentRoot`) of `index.html` to the "유령 학교의 저주" halloween/parchment/wood theme from `docs/superpowers/specs/2026-09-02-ghost-school-theme-design.md`, without changing any game logic (Firebase schema, answer checking, team/grade logic, QR/manual-code flow).

**Architecture:** One design-system CSS pass (Task 1) defines every reusable class, CSS custom property, keyframe and scene background this redesign needs, plus three small shared JS helpers. Every later task only edits the HTML strings a single render/handler function returns, wiring in the classes and helpers Task 1 already created — no task after Task 1 adds new CSS. `#adminRoot` is untouched throughout.

**Tech Stack:** Vanilla JS, inline CSS in a single `<style>` block, no build step, no framework, no bundler. Verification is manual (open `index.html` in a browser) plus the existing `node --test` suite for unchanged logic.

## Global Constraints

- Do not modify any code inside `#adminRoot` or any function only used by the admin screens (`renderDash`, `renderRosterTab`, `renderQuestionsTab`, `renderQrPage`, and anything they call that student screens don't also use).
- Do not change Firebase read/write shapes, `CODES`/`CODE2QID`, `QUESTIONS`/`QFULL`/`QMETA`, answer-matching (`normalize`, `submitAnswer`'s correctness check), or team/grade logic (`computeEffectiveGrade`, `autoAssignTeams` in `scripts/roster-utils.js`).
- All new image assets are copied from `C:\Users\박정민\Downloads\escape_room_assets_transparent_png` into the repo's own `assets/` folder and referenced with plain relative paths (`assets/xxx.png`) — never reference the Downloads path from `index.html`.
- New/changed CSS only touches selectors scoped under `#studentRoot` (or a new top-level keyframe/`@media` block that only affects `.gs-*` animation classes). Never redefine the top-level `:root` custom properties (`--navy`, `--red`, etc.) — those are still used by `#adminRoot`.
- Keep `scripts/roster-utils.test.js` passing (`node --test scripts/roster-utils.test.js`) — this plan doesn't touch that file, so it must still pass unmodified at the end.
- Every screen must keep working with `view=` state transitions and Firebase sync exactly as before — only the returned HTML markup and CSS change, never the surrounding control flow (`if`/`else` branches, function names, global variables).

---

## File Structure

- **Modify: `index.html`**
  - `<style>` block, lines 8–121 (font import + `#studentRoot` CSS) — replaced in Task 1.
  - JS section after `const ALL_ROOMS=...` (around line 428) — three helpers (`ROOM_ICON`, `teamIconSrc`, `setScene`) added in Task 1.
  - `renderTeamPick`, `pickTeam` (Task 2)
  - `renderHome` (Task 3)
  - `renderRoomDetail` (Task 4)
  - `showCelebration`, `runConfetti` (Task 5)
  - `openScan` (Task 6)
  - `showGradeGate`, `showQuestionScreen`, `showRoomLockedScreen`, `renderCooldown`, `submitAnswer`, `initCanvas` (Task 7)
  - `showWrongNoticeModal`, `showInitialGuidePopup`, `showRequiredRoomsChangedNotification`, new `showInfoModal` helper (Task 8)
- **Create: `assets/*.png`** (39 files copied from the assets folder — exact list in Task 1)
- No other files change. No new files besides the copied PNGs.

---

### Task 1: Foundation — assets, fonts, design-system CSS, shared JS helpers

**Files:**
- Create: `assets/*.png` (copies, see step 1)
- Modify: `index.html:8-121` (style block), `index.html` after line 428 (new helpers)
- Test: manual browser check (no automated test — this task only lays groundwork)

**Interfaces:**
- Produces (used by every later task):
  - CSS scene selectors: `#studentRoot[data-scene="gate"|"village"|"corridor"|"study"|"guide"]`
  - CSS component classes: `.decor-img`, `.gs-drift`, `.gs-flicker`, `.gs-twinkle`, `.hero-block`, `.hero-title`, `.hero-sub`, `.wood-sign-wrap`, `.wood-sign-img`, `.wood-sign-label`, `.side-panel`, `.team-icon-img`, `.key-row`, `.key-icon` (+ `.off`), `.note-box` (+ `.sub`), `.parchment-frame`, `.parchment-frame-inner`, `.room-icon-lg`, `.room-title`, `.room-subprog`, `.room-detail-layout`, `.mission-grid`, `.mission-icon` (+ `.solved`/`.locked`/`.next`), `.badge-img`, `.result-stats`, `.result-stat`, `.chest-img`, `.curse-title`
  - Restyled existing classes (same names, new look): `.hd`, `.hd-title`, `.hd-team`, `.sync-ind`, `.sync-dot`/`.sync-on`/`.sync-off`/`.sync-err`, `.wrap`, `.btn*`, `.card`, `.team-btn` (+ nested `.team-btn-icon`/`.team-btn-body`/`.team-btn-name`/`.team-btn-members`), `.keys-bar*`, `.room-grid`, `.room-card*`, `.room-emoji` (now holds an `<img>`), `.room-name`, `.room-prog`, `.room-bar*`, `.final-card*`, `.scan-fab`, `.team-switch`, `.scan-wrap`, `.cam-box*`, `.cam-frame`, `.cam-msg`, `.manual-box*`, `.txt-inp*`, `.q-badges`, `.badge*`, `.grade-warn`, `.qimg*`, `.pictogram`, `.dotgrid`, `.q-text`, `.ans-row`, `.fb-box*`, `.center-icon`, `.cooldown-txt`, `.scr-hd*`, `.canvas-wrap*`, `.finale*`, `.top-back`, `.modal-ov`, `.modal-box*`, `.celebrate-ov*`
  - JS helpers: `ROOM_ICON` (object, `{R1:"classroom_library.png",...}`), `FINAL_ROOM_ICON` (string `"classroom_gym.png"`), `teamIconSrc(n)` → returns `"assets/team_"+N+".png"` string, `setScene(name)` → sets `#studentRoot`'s `data-scene` attribute (call with `null`/`""` to clear).
- Removed classes (no longer used after this redesign, safe to delete): `.grid8`, `.cell8` (+ `.solved`/`.next`), `.bounce`, `@keyframes bounce`, `@keyframes hue`, `.celebrate-ov h1`'s gradient-text rule (all superseded by `.mission-grid`/`.mission-icon` and `.curse-title` in later tasks — deleting them now is safe because Task 4 and Task 5 stop referencing them in the same work session, but until those tasks land the classes are simply unused, not broken).

- [ ] **Step 1: Copy the asset files into the repo**

Run this from the repo root (`C:\Users\박정민\Downloads\escape`):

```bash
mkdir -p assets
SRC="/c/Users/박정민/Downloads/escape_room_assets_transparent_png"
cp "$SRC/background_castle_gate.png" \
   "$SRC/background_classroom_select.png" \
   "$SRC/background_mission_select.png" \
   "$SRC/background_mission_guide.png" \
   "$SRC/background_problem_frame.png" \
   "$SRC/background_problem_example.png" \
   "$SRC/button_qr_scan.png" \
   "$SRC/classroom_library.png" "$SRC/classroom_computer.png" "$SRC/classroom_english.png" \
   "$SRC/classroom_vr.png" "$SRC/classroom_auditorium.png" "$SRC/classroom_gym.png" \
   "$SRC/common_bat.png" "$SRC/common_ghost.png" "$SRC/common_key.png" \
   "$SRC/common_spider_web.png" "$SRC/common_scroll.png" "$SRC/common_padlock.png" \
   "$SRC/decor_sparkles.png" \
   "$SRC/mission_1.png" "$SRC/mission_2.png" "$SRC/mission_3.png" "$SRC/mission_4.png" \
   "$SRC/mission_5.png" "$SRC/mission_6.png" "$SRC/mission_7.png" "$SRC/mission_8.png" \
   "$SRC/prop_lantern.png" "$SRC/prop_wooden_sign.png" "$SRC/prop_treasure_chest.png" \
   "$SRC/status_success.png" "$SRC/status_failure.png" "$SRC/status_locked.png" \
   "$SRC/team_1.png" "$SRC/team_2.png" "$SRC/team_3.png" "$SRC/team_4.png" "$SRC/team_5.png" \
   assets/
ls assets | wc -l
```

Expected: `39`.

- [ ] **Step 2: Add the Nanum font import**

In `index.html`, find:

```html
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800;900&display=swap');
```

Replace with:

```html
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800;900&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&family=Nanum+Gothic:wght@400;700;800&display=swap');
```

- [ ] **Step 3: Replace the entire `#studentRoot` CSS block**

Find the whole block from the `/* ===== 학생 화면 (#studentRoot 스코프) ===== */` comment through the line right before `/* ===== 관리자 화면 (#adminRoot 스코프) ===== */` (currently lines 15–121 — the block starting with `#studentRoot .hd{...}` and ending with `@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}`).

Replace it with:

```css
/* ===== 학생 화면 (#studentRoot 스코프) — 유령 학교의 저주 테마 ===== */
#studentRoot{
  --gs-bg:#120d21;
  --gs-ink:#efe6cf;
  --gs-gold:#ffcf7a;
  --gs-gold-lt:#ffe9b8;
  --gs-lilac:#c9b9e8;
  --gs-lilac-lt:#e2c6ff;
  --gs-green:#9ce6b4;
  --gs-red:#ff8fa0;
  --gs-parchment-1:rgba(236,220,180,.96);
  --gs-parchment-2:rgba(214,193,146,.96);
  --gs-ink-brown:#3f2c14;
  --gs-ink-brown-2:#5f4a26;
  --gs-stone-1:rgba(58,40,96,.9);
  --gs-stone-2:rgba(34,23,62,.92);
  --gs-stone-border:rgba(255,205,130,.4);
  --gs-success-1:rgba(60,86,58,.9);
  --gs-success-2:rgba(28,48,32,.92);
  --gs-success-border:rgba(140,230,160,.5);
  position:relative;
  background:var(--gs-bg);
  color:var(--gs-ink);
  font-family:'Nanum Gothic',sans-serif;
  min-height:100vh;
}
#studentRoot h1,#studentRoot h2,#studentRoot h3{font-family:'Nanum Myeongjo',serif;}

@keyframes gs-drift{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes gs-flicker{0%,100%{opacity:.9}45%{opacity:1}70%{opacity:.74}}
@keyframes gs-twinkle{0%,100%{opacity:.55;transform:scale(.94)}50%{opacity:1;transform:scale(1.05)}}
#studentRoot .gs-drift{animation:gs-drift 6s ease-in-out infinite;}
#studentRoot .gs-flicker{animation:gs-flicker 2.8s infinite;}
#studentRoot .gs-twinkle{animation:gs-twinkle 2.6s ease-in-out infinite;}
@media (prefers-reduced-motion: reduce){
  #studentRoot .gs-drift,#studentRoot .gs-flicker,#studentRoot .gs-twinkle{animation:none!important;}
}

/* 배경 장면 (data-scene 속성으로 전환) */
#studentRoot[data-scene="gate"]{
  background-image:linear-gradient(180deg,rgba(18,13,33,.35),rgba(18,13,33,.82)),url('assets/background_castle_gate.png');
  background-size:cover,cover;background-position:center,center;background-repeat:no-repeat,no-repeat;background-attachment:fixed,fixed;
}
#studentRoot[data-scene="village"]{
  background-image:linear-gradient(180deg,rgba(18,13,33,.4),rgba(18,13,33,.85)),url('assets/background_classroom_select.png');
  background-size:cover,cover;background-position:center,center;background-repeat:no-repeat,no-repeat;background-attachment:fixed,fixed;
}
#studentRoot[data-scene="corridor"]{
  background-image:linear-gradient(180deg,rgba(18,13,33,.3),rgba(18,13,33,.8)),url('assets/background_mission_select.png');
  background-size:cover,cover;background-position:center,center;background-repeat:no-repeat,no-repeat;background-attachment:fixed,fixed;
}
#studentRoot[data-scene="study"]{
  background-image:linear-gradient(180deg,rgba(18,13,33,.35),rgba(18,13,33,.82)),url('assets/background_problem_example.png');
  background-size:cover,cover;background-position:center,center;background-repeat:no-repeat,no-repeat;background-attachment:fixed,fixed;
}
#studentRoot[data-scene="guide"]{
  background-image:linear-gradient(180deg,rgba(18,13,33,.3),rgba(18,13,33,.8)),url('assets/background_mission_guide.png');
  background-size:cover,cover;background-position:center,center;background-repeat:no-repeat,no-repeat;background-attachment:fixed,fixed;
}

#studentRoot .decor-img{position:fixed;z-index:0;pointer-events:none;}

#studentRoot .hd{background:linear-gradient(180deg,#1b1430,#120d21);color:var(--gs-gold-lt);padding:12px 16px;position:sticky;top:0;z-index:50;box-shadow:0 2px 16px rgba(0,0,0,.6);display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid rgba(255,205,130,.35);}
#studentRoot .hd-l{display:flex;flex-direction:column;}
#studentRoot .hd-title{font-family:'Nanum Myeongjo',serif;font-size:16px;font-weight:800;color:var(--gs-gold-lt);text-shadow:0 2px 6px rgba(0,0,0,.7);}
#studentRoot .hd-team{font-size:11px;color:var(--gs-lilac);margin-top:1px;}
#studentRoot .sync-ind{font-size:10px;color:var(--gs-lilac);display:flex;align-items:center;gap:4px;}
#studentRoot .sync-dot{width:7px;height:7px;border-radius:50%;display:inline-block;}
#studentRoot .sync-on{background:#7ee39c;box-shadow:0 0 8px rgba(126,227,156,.9);}
#studentRoot .sync-off{background:#f0c05a;}
#studentRoot .sync-err{background:#ff6b7a;}
#studentRoot .wrap{max-width:640px;margin:0 auto;padding:16px 14px 40px;position:relative;z-index:1;}

#studentRoot .btn{border:none;border-radius:10px;cursor:pointer;font-family:'Nanum Gothic',sans-serif;font-weight:800;transition:.12s;}
#studentRoot .btn:active{transform:scale(.97);}
#studentRoot .btn:disabled{opacity:.55;cursor:default;}
#studentRoot .btn-lg{padding:16px;font-size:17px;width:100%;}
#studentRoot .btn-primary{background:linear-gradient(180deg,#ffe9b8,#d9a03e);color:#3f2c14;box-shadow:0 6px 16px rgba(0,0,0,.45);}
#studentRoot .btn-sub{background:rgba(46,32,80,.7);color:var(--gs-gold-lt);border:2px solid rgba(255,205,130,.4);}
#studentRoot .btn-danger{background:#c94a5a;color:#fff4dc;}
#studentRoot .btn-green{background:linear-gradient(180deg,#bdf0cd,#5fb87e);color:#173821;}

#studentRoot .card{background-image:linear-gradient(170deg,var(--gs-parchment-1),var(--gs-parchment-2));border-radius:14px;box-shadow:0 14px 32px rgba(0,0,0,.55);padding:18px;margin-bottom:14px;color:var(--gs-ink-brown);border:1px solid rgba(140,105,55,.35);}
#studentRoot .card h2{color:var(--gs-ink-brown);}
#studentRoot .card p{color:var(--gs-ink-brown-2);}

#studentRoot .hero-block{display:flex;flex-direction:column;align-items:center;padding:22px 16px 26px;position:relative;z-index:1;}
#studentRoot .wood-sign-wrap{position:relative;display:inline-block;}
#studentRoot .wood-sign-img{display:block;width:190px;}
#studentRoot .wood-sign-label{position:absolute;left:0;right:0;top:32%;font-family:'Nanum Myeongjo',serif;font-size:20px;font-weight:800;color:var(--gs-gold-lt);text-shadow:0 2px 4px rgba(0,0,0,.8);}
#studentRoot .hero-title{margin-top:18px;font-family:'Nanum Myeongjo',serif;font-size:34px;font-weight:800;line-height:1.3;color:#fff4dc;text-shadow:0 0 20px rgba(255,190,90,.6),0 4px 10px rgba(0,0,0,.85);text-align:center;}
#studentRoot .hero-sub{margin-top:10px;font-family:'Nanum Gothic',sans-serif;font-size:16px;font-weight:700;letter-spacing:.08em;color:var(--gs-lilac-lt);text-shadow:0 2px 8px rgba(0,0,0,.8);text-align:center;}

#studentRoot .team-btn{width:100%;padding:12px 22px 12px 14px;border-radius:10px;border:none;cursor:pointer;font-family:'Nanum Gothic',sans-serif;background-image:linear-gradient(100deg,var(--gs-parchment-1),var(--gs-parchment-2));box-shadow:0 6px 18px rgba(0,0,0,.5);display:flex;align-items:center;gap:16px;text-align:left;transition:.12s;}
#studentRoot .team-btn:active{transform:scale(.98);}
#studentRoot .team-btn-icon{width:44px;flex:none;filter:drop-shadow(0 3px 5px rgba(0,0,0,.45));}
#studentRoot .team-btn-body{min-width:0;display:flex;flex-direction:column;gap:2px;}
#studentRoot .team-btn-name{font-family:'Nanum Myeongjo',serif;font-size:18px;font-weight:800;color:var(--gs-ink-brown);}
#studentRoot .team-btn-members{font-size:12.5px;color:var(--gs-ink-brown-2);line-height:1.4;word-break:keep-all;}

#studentRoot .keys-bar{display:flex;align-items:center;justify-content:center;gap:6px;padding:14px;background:rgba(46,32,80,.7);border-radius:12px;margin-bottom:14px;border:1px solid rgba(255,205,130,.35);flex-wrap:wrap;}
#studentRoot .keys-bar .k{font-size:26px;filter:grayscale(1) brightness(.5);opacity:.55;}
#studentRoot .keys-bar .k.on{filter:none;opacity:1;text-shadow:0 0 10px rgba(255,205,120,.9);}
#studentRoot .keys-txt{font-size:12px;color:var(--gs-gold-lt);font-weight:700;margin-left:8px;}

#studentRoot .room-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
#studentRoot .room-card{background-image:linear-gradient(170deg,var(--gs-stone-1),var(--gs-stone-2));border-radius:14px;box-shadow:0 10px 26px rgba(0,0,0,.55);padding:16px 12px;text-align:center;border:2px solid var(--gs-stone-border);cursor:pointer;color:var(--gs-gold-lt);}
#studentRoot .room-card.done{border-color:var(--gs-success-border);background-image:linear-gradient(170deg,var(--gs-success-1),var(--gs-success-2));color:#e6ffe9;}
#studentRoot .room-card.locked{opacity:.55;}
#studentRoot .lock-msg{font-size:10px;color:var(--gs-lilac);margin-top:6px;font-weight:700;}
#studentRoot .room-emoji{font-size:32px;}
#studentRoot .room-emoji img{width:56px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.55));}
#studentRoot .room-name{font-family:'Nanum Myeongjo',serif;font-size:14px;font-weight:800;margin-top:4px;}
#studentRoot .room-prog{font-size:12px;color:var(--gs-lilac);margin-top:4px;font-weight:700;}
#studentRoot .room-card.done .room-prog{color:var(--gs-green);}
#studentRoot .room-bar{height:6px;background:rgba(0,0,0,.35);border-radius:3px;margin-top:6px;overflow:hidden;}
#studentRoot .room-bar-f{height:100%;background:var(--gs-gold);border-radius:3px;transition:width .3s;}
#studentRoot .room-card.done .room-bar-f{background:var(--gs-green);}
#studentRoot .final-card{background-image:linear-gradient(170deg,var(--gs-stone-1),var(--gs-stone-2));border-radius:14px;box-shadow:0 10px 26px rgba(0,0,0,.55);padding:16px 12px;text-align:center;border:2px solid var(--gs-gold);margin-top:12px;cursor:pointer;color:var(--gs-gold-lt);}
#studentRoot .final-card.done{border-color:var(--gs-success-border);background-image:linear-gradient(170deg,var(--gs-success-1),var(--gs-success-2));color:#e6ffe9;}

#studentRoot .scan-fab{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);width:min(560px,calc(100% - 32px));z-index:40;}
#studentRoot .scan-fab img{width:100%;display:block;filter:drop-shadow(0 8px 22px rgba(0,0,0,.6));cursor:pointer;}
#studentRoot .team-switch{font-size:11px;color:var(--gs-lilac);text-align:center;margin-top:18px;text-decoration:underline;cursor:pointer;}

#studentRoot .scan-wrap{text-align:center;position:relative;z-index:1;}
#studentRoot .cam-box{position:relative;width:100%;max-width:420px;margin:10px auto;border-radius:16px;overflow:hidden;background:#000;aspect-ratio:1/1;border:4px solid var(--gs-gold);box-shadow:0 0 24px rgba(255,205,120,.35),0 14px 30px rgba(0,0,0,.6);}
#studentRoot .cam-box video{width:100%;height:100%;object-fit:cover;}
#studentRoot .cam-frame{position:absolute;inset:14%;border:3px solid var(--gs-gold-lt);border-radius:16px;box-shadow:0 0 0 999px rgba(0,0,0,.45);}
#studentRoot .cam-msg{font-size:12px;color:var(--gs-lilac);margin:8px 0;}
#studentRoot .manual-box{background-image:linear-gradient(170deg,var(--gs-parchment-1),var(--gs-parchment-2));border-radius:12px;box-shadow:0 10px 24px rgba(0,0,0,.5);padding:14px;margin-top:16px;color:var(--gs-ink-brown);}
#studentRoot .manual-box h4{font-size:13px;color:var(--gs-ink-brown-2);margin-bottom:8px;font-weight:700;}
#studentRoot .manual-row{display:flex;gap:8px;}

#studentRoot .txt-inp{flex:1;padding:12px;border:2px solid rgba(140,105,55,.4);border-radius:10px;font-size:16px;font-family:'Nanum Gothic',sans-serif;text-transform:uppercase;background:#fffaf0;color:var(--gs-ink-brown);}
#studentRoot .txt-inp:focus{border-color:var(--gs-gold);outline:none;}

#studentRoot .q-badges{display:flex;gap:6px;align-items:center;margin-bottom:10px;flex-wrap:wrap;}
#studentRoot .badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:800;}
#studentRoot .b-id{background:#2e2050;color:var(--gs-gold-lt);}
#studentRoot .b-grade{background:rgba(140,105,55,.18);color:var(--gs-ink-brown);}
#studentRoot .b-unit{background:rgba(140,105,55,.1);color:var(--gs-ink-brown-2);}
#studentRoot .grade-warn{background:rgba(140,105,55,.12);border:1px solid rgba(140,105,55,.3);border-radius:10px;padding:10px 12px;font-size:13px;color:var(--gs-ink-brown-2);font-weight:700;margin-bottom:12px;}

#studentRoot .qimg{margin:10px 0;text-align:center;background:rgba(255,255,255,.35);border:1px solid rgba(140,105,55,.25);border-radius:10px;padding:10px;}
#studentRoot .qimg svg{width:100%;height:auto;max-width:320px;display:block;margin:0 auto;}
#studentRoot .qimg.wide svg{max-width:600px;}
#studentRoot .qimg table.plain{width:100%;max-width:230px;margin:0 auto 10px;border-collapse:collapse;}
#studentRoot .qimg table.plain th,#studentRoot .qimg table.plain td{border:1px solid rgba(140,105,55,.4);padding:5px 8px;font-size:12px;text-align:center;}
#studentRoot .qimg table.plain th{background:rgba(140,105,55,.12);}
#studentRoot .pictogram{font-size:30px;text-align:center;letter-spacing:8px;}
#studentRoot .dotgrid{font-size:19px;text-align:center;letter-spacing:2px;color:var(--gs-ink-brown-2);line-height:1.6;font-weight:700;}
#studentRoot .q-text{font-size:16px;font-weight:600;margin:12px 0;line-height:1.6;color:var(--gs-ink-brown);}
#studentRoot .ans-row{display:flex;gap:8px;margin-top:10px;}
#studentRoot .ans-row .txt-inp{text-transform:none;}

#studentRoot .fb-box{margin-top:14px;padding:14px;border-radius:12px;font-size:15px;font-weight:800;text-align:center;}
#studentRoot .fb-box img{width:28px;vertical-align:-6px;margin-right:6px;}
#studentRoot .fb-ok{background-image:linear-gradient(170deg,var(--gs-success-1),var(--gs-success-2));color:#e6ffe9;border:1px solid var(--gs-success-border);}
#studentRoot .fb-bad{background:rgba(90,20,30,.55);color:#ffd8dd;border:1px solid rgba(255,140,150,.4);}
#studentRoot .fb-lock{background:rgba(46,32,80,.7);color:var(--gs-gold-lt);border:1px solid rgba(255,205,130,.35);}
#studentRoot .fb-review{background:rgba(46,32,80,.5);color:var(--gs-lilac-lt);border:1px solid rgba(201,185,232,.35);}

#studentRoot .center-icon{font-size:42px;text-align:center;margin-bottom:6px;}
#studentRoot .cooldown-txt{font-size:12px;color:var(--gs-lilac);text-align:center;margin-top:8px;}

#studentRoot .scr-hd{display:flex;align-items:center;justify-content:space-between;margin:14px 0 6px;}
#studentRoot .scr-hd .lbl{font-size:12px;font-weight:800;color:var(--gs-ink-brown-2);}
#studentRoot .scr-hd button{border:1px solid rgba(140,105,55,.4);background:rgba(255,255,255,.4);border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;color:var(--gs-ink-brown);cursor:pointer;font-family:'Nanum Gothic',sans-serif;}
#studentRoot .canvas-wrap{position:relative;height:220px;border:1px solid rgba(140,105,55,.4);border-radius:10px;background:#15111f;touch-action:none;overflow:hidden;}
#studentRoot .canvas-wrap canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;}

#studentRoot .finale{text-align:center;padding:40px 16px;position:relative;z-index:1;}
#studentRoot .finale .em{font-size:64px;}
#studentRoot .finale h2{font-size:22px;margin:10px 0;color:var(--gs-gold-lt);}
#studentRoot .finale p{font-size:14px;color:var(--gs-lilac);line-height:1.7;}
#studentRoot .top-back{font-size:13px;color:var(--gs-gold);font-weight:800;cursor:pointer;margin-bottom:10px;display:inline-block;position:relative;z-index:1;}

#studentRoot .modal-ov{position:fixed;inset:0;background:rgba(5,3,12,.75);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;}
#studentRoot .modal-box{background-image:linear-gradient(170deg,var(--gs-parchment-1),var(--gs-parchment-2));border-radius:16px;padding:26px 20px;max-width:340px;width:100%;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.6);color:var(--gs-ink-brown);}
#studentRoot .modal-icon{width:56px;margin:0 auto 4px;display:block;}
#studentRoot .modal-box .em{font-size:56px;}
#studentRoot .modal-box h3{font-size:19px;margin:8px 0;color:var(--gs-ink-brown);}
#studentRoot .modal-box p{font-size:13px;color:var(--gs-ink-brown-2);line-height:1.6;margin-bottom:16px;text-align:left;}

/* 조/교실 상세 공용 레이아웃 */
#studentRoot .room-detail-layout{display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;justify-content:center;position:relative;z-index:1;}
#studentRoot .side-panel{flex:0 0 200px;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;}
#studentRoot .team-icon-img{width:90px;filter:drop-shadow(0 6px 14px rgba(0,0,0,.7));}
#studentRoot .key-row{display:flex;justify-content:center;align-items:flex-end;gap:12px;flex-wrap:wrap;}
#studentRoot .key-icon{width:40px;filter:drop-shadow(0 0 14px rgba(255,205,120,.95));}
#studentRoot .key-icon.off{filter:grayscale(1) brightness(.5);opacity:.55;}
#studentRoot .note-box{background:rgba(46,32,80,.86);border:1px solid rgba(255,205,130,.35);border-radius:8px;padding:12px 16px;color:var(--gs-gold-lt);font-weight:700;font-size:14px;line-height:1.6;box-shadow:0 6px 18px rgba(0,0,0,.55);}
#studentRoot .note-box .sub{font-weight:400;color:var(--gs-lilac);font-size:12.5px;}

#studentRoot .parchment-frame{flex:1 1 380px;max-width:520px;background-image:linear-gradient(180deg,rgba(20,14,32,.15),rgba(20,14,32,.15)),url('assets/background_problem_frame.png');background-size:100% 100%,100% 100%;background-repeat:no-repeat,no-repeat;padding:9% 10% 10%;box-sizing:border-box;}
#studentRoot .parchment-frame-inner{display:flex;flex-direction:column;align-items:center;text-align:center;}
#studentRoot .room-icon-lg{width:96px;filter:drop-shadow(0 5px 10px rgba(0,0,0,.4));}
#studentRoot .room-title{font-family:'Nanum Myeongjo',serif;font-size:28px;font-weight:800;color:var(--gs-ink-brown);margin-top:6px;}
#studentRoot .room-subprog{font-size:15px;color:var(--gs-ink-brown-2);margin-top:2px;}

#studentRoot .mission-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px 10px;margin-top:18px;width:100%;}
#studentRoot .mission-icon{position:relative;text-align:center;}
#studentRoot .mission-icon img{width:100%;max-width:90px;}
#studentRoot .mission-icon.locked img{filter:grayscale(.85) brightness(.62);}
#studentRoot .mission-icon.next img{filter:drop-shadow(0 0 16px rgba(255,205,120,.95));}
#studentRoot .mission-icon.solved img{filter:drop-shadow(0 4px 8px rgba(0,0,0,.35));}
#studentRoot .mission-icon .badge-img{position:absolute;width:30px;right:-2px;top:-6px;}
#studentRoot .mission-icon.solved .badge-img{right:4px;bottom:-2px;top:auto;width:26px;}

#studentRoot .celebrate-ov{position:fixed;inset:0;z-index:250;display:flex;align-items:center;justify-content:center;padding:24px;background-image:linear-gradient(180deg,rgba(16,10,32,.45),rgba(16,10,32,.85)),url('assets/background_mission_select.png');background-size:cover,cover;background-position:center,center;background-repeat:no-repeat,no-repeat;}
#studentRoot .celebrate-inner{display:flex;gap:32px;flex-wrap:wrap;align-items:center;justify-content:center;max-width:900px;}
#studentRoot .curse-title{font-family:'Nanum Myeongjo',serif;font-size:44px;font-weight:800;line-height:1.25;color:#fff4dc;text-shadow:0 0 24px rgba(255,190,90,.65),0 4px 12px rgba(0,0,0,.9);text-align:center;}
#studentRoot .chest-img{display:block;width:110px;margin:0 auto -14px;position:relative;z-index:1;filter:drop-shadow(0 0 22px rgba(255,205,120,.7));}
#studentRoot .result-card{background-image:linear-gradient(168deg,var(--gs-parchment-1),var(--gs-parchment-2));border-radius:8px;box-shadow:0 14px 36px rgba(0,0,0,.65);border:2px solid rgba(140,105,55,.5);padding:32px 28px 26px;max-width:420px;color:var(--gs-ink-brown);text-align:center;}
#studentRoot .result-stats{display:flex;justify-content:center;gap:22px;margin-top:22px;flex-wrap:wrap;}
#studentRoot .result-stat{text-align:center;}
#studentRoot .result-stat .label{font-size:13px;color:var(--gs-ink-brown-2);}
#studentRoot .result-stat .value{font-size:20px;font-weight:800;color:var(--gs-ink-brown);margin-top:4px;}

#studentRoot .admin-acc{margin-top:24px;text-align:center;position:relative;z-index:1;}
#studentRoot .admin-acc summary{font-size:11px;color:var(--gs-lilac);cursor:pointer;list-style:none;}
#studentRoot .admin-acc summary::-webkit-details-marker{display:none;}
#studentRoot .admin-acc-body{margin-top:10px;display:flex;gap:8px;justify-content:center;}
#studentRoot .confetti-cv{position:fixed;inset:0;pointer-events:none;z-index:300;}
```

- [ ] **Step 4: Add the shared JS helpers**

Find (around line 428 in the `<script>` section):

```js
const ALL_ROOMS=ROOMS.concat([FINAL_ROOM]);
function escapeHtml(s){return (s||"").toString().replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
```

Replace with:

```js
const ALL_ROOMS=ROOMS.concat([FINAL_ROOM]);
const ROOM_ICON={R1:"classroom_library.png",R2:"classroom_computer.png",R3:"classroom_english.png",R4:"classroom_vr.png",R5:"classroom_auditorium.png"};
const FINAL_ROOM_ICON="classroom_gym.png";
function teamIconSrc(n){const i=((Number(n)-1)%5+5)%5+1;return "assets/team_"+i+".png";}
function setScene(name){
  const root=document.getElementById("studentRoot");
  if(root)root.setAttribute("data-scene",name||"");
}
function escapeHtml(s){return (s||"").toString().replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
```

- [ ] **Step 5: Verify nothing is broken yet**

Open `index.html` directly in a browser (double-click it, or `start index.html` on Windows). Expected:
- Page loads with no red errors in the browser devtools console.
- Body/`#studentRoot` area now shows a dark navy background and parchment-colored cards (screens will look unfinished/plain — that's expected, later tasks add the scene art and layouts).
- `#adminRoot` is still hidden (`style="display:none"` unchanged) — nothing to see there yet, but no console errors when you manually check via devtools (`document.getElementById('adminRoot').style.display=''`) that its styling still looks like the original light-blue admin theme.

- [ ] **Step 6: Commit**

```bash
git add assets index.html
git commit -m "feat: add ghost-school theme foundation (assets, fonts, design-system CSS)"
```

---

### Task 2: Team pick screen (`renderTeamPick`, `pickTeam`)

**Files:**
- Modify: `index.html` — `renderTeamPick` function (currently lines 873–901)

**Interfaces:**
- Consumes: `setScene(name)`, `teamIconSrc(n)`, `adminAccordionHtml()` (existing, unchanged), `escapeHtml` (existing).
- Produces: no new exports — this is a leaf render function.

- [ ] **Step 1: Rewrite `renderTeamPick`**

Find:

```js
function renderTeamPick(){
  view="teamPick";
  setHeader();
  if(teamCount<1){
    app.innerHTML='<div class="card" style="text-align:center;"><div class="center-icon">🗂️</div><h2 style="font-size:16px;margin-bottom:8px;">아직 조가 편성되지 않았어요</h2><p style="font-size:12px;color:var(--tx2);">선생님이 명단을 올려서 조를 편성하면 여기에 표시돼요.</p></div>'+adminAccordionHtml();
    return;
  }
  const byTeam={};
  for(let n=1;n<=teamCount;n++)byTeam[n]=[];
  Object.values(rosterAll).forEach(s=>{
    if(!s||!s.teamId)return;
    const n=Number(s.teamId);
    if(!byTeam[n])return;
    byTeam[n].push(s);
  });
  let h='<div class="card"><h2 style="font-size:16px;margin-bottom:6px;">조를 선택하세요</h2><p style="font-size:12px;color:var(--tx2);">우리 조를 찾아서 눌러주세요.</p></div>';
  h+='<div style="display:flex;flex-direction:column;gap:12px;">';
  for(let n=1;n<=teamCount;n++){
    const members=byTeam[n].slice().sort((a,b)=>{
      if(a.grade!==b.grade)return b.grade-a.grade;
      return (a.name||"").localeCompare(b.name||"","ko");
    });
    const badge=members.length?members.map(s=>escapeHtml(s.name)+"("+s.grade+")").join(" · "):"명단 없음";
    h+='<button class="team-btn" onclick="pickTeam('+n+')" style="width:100%;padding:16px;text-align:left;display:flex;flex-direction:column;gap:6px;border:2px solid var(--bdr);background:#fff;border-radius:10px;cursor:pointer;transition:.12s;font-family:inherit;"><span style="font-size:16px;font-weight:800;color:var(--navy);">'+n+'조</span><span style="font-size:13px;font-weight:500;color:var(--tx);word-break:break-word;line-height:1.5;">'+badge+'</span></button>';
  }
  h+='</div>';
  h+=adminAccordionHtml();
  app.innerHTML=h;
}
```

Replace with:

```js
function renderTeamPick(){
  view="teamPick";
  setScene("gate");
  setHeader();
  const decor='<img class="decor-img gs-drift" src="assets/common_bat.png" alt="" style="left:4%;top:9%;width:70px;">'
    +'<img class="decor-img gs-drift" src="assets/common_ghost.png" alt="" style="left:7%;bottom:14%;width:84px;filter:drop-shadow(0 0 16px rgba(255,220,150,.35));">';
  const hero='<div class="hero-block"><div class="wood-sign-wrap"><img class="wood-sign-img" src="assets/prop_wooden_sign.png" alt=""><span class="wood-sign-label">방탈출 놀이</span></div><div class="hero-title">유령 학교의<br>저주</div><div class="hero-sub">조 편성</div></div>';
  if(teamCount<1){
    app.innerHTML=decor+hero+'<div class="card" style="text-align:center;"><div class="center-icon">🗂️</div><h2 style="font-size:16px;margin-bottom:8px;">아직 조가 편성되지 않았어요</h2><p style="font-size:12px;">선생님이 명단을 올려서 조를 편성하면 여기에 표시돼요.</p></div>'+adminAccordionHtml();
    return;
  }
  const byTeam={};
  for(let n=1;n<=teamCount;n++)byTeam[n]=[];
  Object.values(rosterAll).forEach(s=>{
    if(!s||!s.teamId)return;
    const n=Number(s.teamId);
    if(!byTeam[n])return;
    byTeam[n].push(s);
  });
  let h=decor+hero;
  h+='<div class="card"><h2 style="font-size:16px;margin-bottom:6px;">조를 선택하세요</h2><p style="font-size:12px;">우리 조를 찾아서 눌러주세요.</p></div>';
  h+='<div style="display:flex;flex-direction:column;gap:12px;">';
  for(let n=1;n<=teamCount;n++){
    const members=byTeam[n].slice().sort((a,b)=>{
      if(a.grade!==b.grade)return b.grade-a.grade;
      return (a.name||"").localeCompare(b.name||"","ko");
    });
    const badge=members.length?members.map(s=>escapeHtml(s.name)+"("+s.grade+")").join(" · "):"명단 없음";
    h+='<button class="team-btn" onclick="pickTeam('+n+')"><img class="team-btn-icon" src="'+teamIconSrc(n)+'" alt="'+n+'조"><span class="team-btn-body"><span class="team-btn-name">'+n+'조</span><span class="team-btn-members">'+badge+'</span></span></button>';
  }
  h+='</div>';
  h+=adminAccordionHtml();
  app.innerHTML=h;
}
```

- [ ] **Step 2: Manually verify in the browser**

Open `index.html`. If no team is picked yet (clear `localStorage.escape_team` in devtools if needed and reload), you should see:
- A moonlit castle-gate background filling the screen, with a bat and a ghost gently bobbing.
- A wooden sign reading "방탈출 놀이", the title "유령 학교의 저주", and "조 편성" underneath.
- Below that, a parchment "조를 선택하세요" card, then one parchment row per team with a team icon image and the member list.
- Clicking a team row still calls `pickTeam(n)` and moves to the home screen (which won't look themed yet until Task 3).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: reskin team-pick screen with ghost-school theme"
```

---

### Task 3: Home screen (`renderHome`)

**Files:**
- Modify: `index.html` — `renderHome` function (currently lines 1387–1446)

**Interfaces:**
- Consumes: `setScene`, `ROOM_ICON`, `FINAL_ROOM_ICON`, `roomProgress`, `totalKeys`, `activeRoomId`, `finalMissionAvailable`, `finalDone`, `unlocked`, `helpRequest`, `requiredRooms`, `pendingCelebration`, `showCelebration` (all existing globals/functions, unchanged signatures).

- [ ] **Step 1: Rewrite `renderHome`**

Find:

```js
function renderHome(){
  view="home";
  setHeader();
  const keys=totalKeys();
  const finalAvail=finalMissionAvailable();
  let h="";
  if(keys>=requiredRooms&&!finalDone()){
    h+='<div class="finale"><div class="em">🤸✨</div><h2>협동 미션에 도전할 수 있어요!</h2><p>강당에 모여 단체줄넘기 20개에 도전해보세요.</p></div>';
  }
  if(keys>=requiredRooms&&finalDone()){
    h+='<div class="finale"><div class="em">🎉🏆✨</div><h2>모든 미션 완료!</h2><p>정말 대단해요! 우리 조가 방탈출에 성공했어요.</p></div>';
  }
  h+='<div class="keys-bar">';
  for(let i=0;i<requiredRooms;i++)h+='<span class="k'+(i<keys?" on":"")+'">🔑</span>';
  h+='<span class="keys-txt">'+keys+' / '+requiredRooms+' 조각 모음 · '+requiredRooms+'개 방 + 강당 미션 완료 시 성공</span></div>';
  const active=activeRoomId();
  h+='<div class="room-grid">';
  ROOMS.forEach(r=>{
    const p=roomProgress(r.id),done=p===8;
    const locked=!done&&active&&active!==r.id;
    let extra="";
    if(locked){
      const activeRoom=ROOMS.find(x=>x.id===active);
      extra='<div class="lock-msg">🔒 '+activeRoom.name+' 먼저 끝내세요</div>';
    }else if(!done){
      const roomQids=QUESTIONS[r.id].map(x=>x.qid);
      const nextQid=roomQids[p];
      if(unlocked[nextQid]){
        extra='<button class="btn btn-green" style="width:100%;margin-top:6px;padding:6px;font-size:10.5px;font-weight:800;" onclick="event.stopPropagation();openUnlocked(\''+nextQid+'\')">🔓 선생님이 열어주셨어요!</button>';
      }else if(helpRequest&&helpRequest.qid===nextQid){
        extra='<div style="margin-top:6px;font-size:10px;color:#b45309;font-weight:800;">🙋 요청함 · 기다려주세요<br><span style="text-decoration:underline;cursor:pointer;color:var(--tx3);font-weight:600;" onclick="event.stopPropagation();cancelHelp()">요청 취소</span></div>';
      }else{
        extra='<div style="margin-top:6px;font-size:10px;color:var(--tx3);text-decoration:underline;cursor:pointer;" onclick="event.stopPropagation();requestHelp(\''+r.id+'\')">🙋 QR을 못 찾겠어요</div>';
      }
    }
    h+='<div class="room-card'+(done?" done":"")+(locked?" locked":"")+'" onclick="openRoomDetail(\''+r.id+'\')"><div class="room-emoji">'+r.emoji+"</div>"
      +'<div class="room-name">'+r.name+"</div>"
      +'<div class="room-prog">'+(done?"✅ 완료!":p+" / 8")+"</div>"
      +'<div class="room-bar"><div class="room-bar-f" style="width:'+(p/8*100)+'%"></div></div>'+extra+'</div>';
  });
  h+="</div>";
  // 강당 미션을 일반 방처럼 항상 표시 (순서 제약 없음)
  const fd=finalDone();
  let finalExtra="";
  if(!fd){
    if(unlocked["R6Q1"]){
      finalExtra='<button class="btn btn-green" style="width:100%;margin-top:6px;padding:6px;font-size:10.5px;font-weight:800;" onclick="event.stopPropagation();openUnlocked(\'R6Q1\')">🔓 선생님이 열어주셨어요!</button>';
    }else if(helpRequest&&helpRequest.qid==="R6Q1"){
      finalExtra='<div style="margin-top:6px;font-size:10px;color:#b45309;font-weight:800;">🙋 요청함 · 기다려주세요<br><span style="text-decoration:underline;cursor:pointer;color:var(--tx3);font-weight:600;" onclick="event.stopPropagation();cancelHelp()">요청 취소</span></div>';
    }
  }
  h+='<div class="final-card'+(fd?" done":"")+'" onclick="openFinalMission()"><div class="room-emoji">🤸</div>'
    +'<div class="room-name">협동 미션 · 강당 단체줄넘기 20개</div>'
    +'<div class="room-prog">'+(fd?"✅ 완료!":"터치해서 도전하기")+'</div>'+finalExtra+'</div>';
  h+='<div class="team-switch" onclick="switchTeam()">다른 조 선택</div>';
  h+='<div style="height:90px"></div>';
  h+='<div class="scan-fab"><button class="btn btn-lg btn-primary" onclick="openScan()">📷 QR 스캔하기</button></div>';
  app.innerHTML=h;
  if(pendingCelebration){pendingCelebration=false;showCelebration();}
}
```

Replace with:

```js
function renderHome(){
  view="home";
  setScene("village");
  setHeader();
  const keys=totalKeys();
  let h='<img class="decor-img gs-flicker" src="assets/prop_lantern.png" alt="" style="left:2%;bottom:6%;width:64px;filter:drop-shadow(0 0 22px rgba(255,180,80,.6));">'
    +'<img class="decor-img" src="assets/common_spider_web.png" alt="" style="right:0;top:0;width:110px;opacity:.5;">';
  if(keys>=requiredRooms&&!finalDone()){
    h+='<div class="finale"><div class="em">🤸✨</div><h2>협동 미션에 도전할 수 있어요!</h2><p>강당에 모여 단체줄넘기 20개에 도전해보세요.</p></div>';
  }
  if(keys>=requiredRooms&&finalDone()){
    h+='<div class="finale"><div class="em">🎉🏆✨</div><h2>모든 미션 완료!</h2><p>정말 대단해요! 우리 조가 방탈출에 성공했어요.</p></div>';
  }
  h+='<div class="keys-bar">';
  for(let i=0;i<requiredRooms;i++)h+='<span class="k'+(i<keys?" on":"")+'">🔑</span>';
  h+='<span class="keys-txt">'+keys+' / '+requiredRooms+' 조각 모음 · '+requiredRooms+'개 방 + 강당 미션 완료 시 성공</span></div>';
  const active=activeRoomId();
  h+='<div class="room-grid">';
  ROOMS.forEach(r=>{
    const p=roomProgress(r.id),done=p===8;
    const locked=!done&&active&&active!==r.id;
    let extra="";
    if(locked){
      const activeRoom=ROOMS.find(x=>x.id===active);
      extra='<div class="lock-msg">🔒 '+activeRoom.name+' 먼저 끝내세요</div>';
    }else if(!done){
      const roomQids=QUESTIONS[r.id].map(x=>x.qid);
      const nextQid=roomQids[p];
      if(unlocked[nextQid]){
        extra='<button class="btn btn-green" style="width:100%;margin-top:6px;padding:6px;font-size:10.5px;font-weight:800;" onclick="event.stopPropagation();openUnlocked(\''+nextQid+'\')">🔓 선생님이 열어주셨어요!</button>';
      }else if(helpRequest&&helpRequest.qid===nextQid){
        extra='<div style="margin-top:6px;font-size:10px;color:var(--gs-gold);font-weight:800;">🙋 요청함 · 기다려주세요<br><span style="text-decoration:underline;cursor:pointer;color:var(--gs-lilac);font-weight:600;" onclick="event.stopPropagation();cancelHelp()">요청 취소</span></div>';
      }else{
        extra='<div style="margin-top:6px;font-size:10px;color:var(--gs-lilac);text-decoration:underline;cursor:pointer;" onclick="event.stopPropagation();requestHelp(\''+r.id+'\')">🙋 QR을 못 찾겠어요</div>';
      }
    }
    h+='<div class="room-card'+(done?" done":"")+(locked?" locked":"")+'" onclick="openRoomDetail(\''+r.id+'\')"><div class="room-emoji"><img src="assets/'+ROOM_ICON[r.id]+'" alt=""></div>'
      +'<div class="room-name">'+r.name+"</div>"
      +'<div class="room-prog">'+(done?"✅ 완료!":p+" / 8")+"</div>"
      +'<div class="room-bar"><div class="room-bar-f" style="width:'+(p/8*100)+'%"></div></div>'+extra+'</div>';
  });
  h+="</div>";
  // 강당 미션을 일반 방처럼 항상 표시 (순서 제약 없음)
  const fd=finalDone();
  let finalExtra="";
  if(!fd){
    if(unlocked["R6Q1"]){
      finalExtra='<button class="btn btn-green" style="width:100%;margin-top:6px;padding:6px;font-size:10.5px;font-weight:800;" onclick="event.stopPropagation();openUnlocked(\'R6Q1\')">🔓 선생님이 열어주셨어요!</button>';
    }else if(helpRequest&&helpRequest.qid==="R6Q1"){
      finalExtra='<div style="margin-top:6px;font-size:10px;color:var(--gs-gold);font-weight:800;">🙋 요청함 · 기다려주세요<br><span style="text-decoration:underline;cursor:pointer;color:var(--gs-lilac);font-weight:600;" onclick="event.stopPropagation();cancelHelp()">요청 취소</span></div>';
    }
  }
  h+='<div class="final-card'+(fd?" done":"")+'" onclick="openFinalMission()"><div class="room-emoji"><img src="assets/'+FINAL_ROOM_ICON+'" alt=""></div>'
    +'<div class="room-name">협동 미션 · 강당 단체줄넘기 20개</div>'
    +'<div class="room-prog">'+(fd?"✅ 완료!":"터치해서 도전하기")+'</div>'+finalExtra+'</div>';
  h+='<div class="team-switch" onclick="switchTeam()">다른 조 선택</div>';
  h+='<div style="height:90px"></div>';
  h+='<div class="scan-fab"><img src="assets/button_qr_scan.png" alt="QR 스캔하기" onclick="openScan()"></div>';
  app.innerHTML=h;
  if(pendingCelebration){pendingCelebration=false;showCelebration();}
}
```

- [ ] **Step 2: Manually verify in the browser**

Pick a team and reach the home screen. Expected:
- Village/school-map background with a flickering lantern bottom-left and a spider web top-right.
- Each classroom card shows its illustrated icon (library/computer/english/vr/auditorium) instead of an emoji, and the "협동 미션" card shows the gym icon.
- The floating bottom button is now the "QR 스캔하기" plaque image, and tapping it still calls `openScan()`.
- "다른 조 선택", help-request text, and the unlock button still work exactly as before (check by toggling `helpRequest`/`unlocked` in devtools if you want to see those branches, or just confirm no console errors as you click around).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: reskin home/classroom-select screen with ghost-school theme"
```

---

### Task 4: Room detail screen (`renderRoomDetail`)

**Files:**
- Modify: `index.html` — `renderRoomDetail` function (currently lines 1447–1470)

**Interfaces:**
- Consumes: `setScene`, `teamIconSrc`, `ROOM_ICON`, `roomProgress`, `activeRoomId`, `totalKeys`, `requiredRooms`, `team`, `solvedIds` (all existing).

- [ ] **Step 1: Rewrite `renderRoomDetail`**

Find:

```js
function renderRoomDetail(rid){
  setHeader();
  view="roomDetail";
  currentRoomDetailId=rid;
  const room=ROOMS.find(r=>r.id===rid);
  if(!room){view="home";renderHome();return;}
  const roomQids=QUESTIONS[rid].map(x=>x.qid);
  const p=roomProgress(rid);
  const active=activeRoomId();
  const locked=p===0&&active&&active!==rid;
  const isPopup=!!window.opener;
  let h='<div class="top-back" onclick="'+(isPopup?"window.close()":"goHome()")+'">'+(isPopup?"✕ 창 닫기":"← 홈으로")+'</div>';
  h+='<div class="card" style="text-align:center;"><div class="room-emoji" style="font-size:40px">'+room.emoji+'</div><h2 style="margin:6px 0">'+room.name+'</h2><div class="room-prog">'+p+' / 8 해결</div>';
  if(locked)h+='<div class="grade-warn" style="margin-top:12px">🔒 지금은 <b>'+ROOMS.find(x=>x.id===active).name+'</b>을(를) 먼저 풀어야 이 방 QR이 열려요.</div>';
  h+='<div class="grid8">';
  roomQids.forEach((qid,i)=>{
    const solved=!!solvedIds[qid];
    const isNext=!solved&&i===p&&!locked;
    h+='<div class="cell8'+(solved?" solved":"")+(isNext?" next":"")+'">'+(solved?"✅":(i+1))+'</div>';
  });
  h+='</div></div>';
  h+='<button class="btn btn-lg btn-primary" onclick="openScan()" style="margin-top:6px">📷 QR 스캔하러 가기</button>';
  app.innerHTML=h;
}
```

Replace with:

```js
function renderRoomDetail(rid){
  setHeader();
  setScene("corridor");
  view="roomDetail";
  currentRoomDetailId=rid;
  const room=ROOMS.find(r=>r.id===rid);
  if(!room){view="home";renderHome();return;}
  const roomQids=QUESTIONS[rid].map(x=>x.qid);
  const p=roomProgress(rid);
  const active=activeRoomId();
  const locked=p===0&&active&&active!==rid;
  const isPopup=!!window.opener;
  const keys=totalKeys();
  let h='<div class="room-detail-layout">';
  h+='<div class="side-panel">';
  h+='<img class="team-icon-img" src="'+teamIconSrc(Number(team))+'" alt="'+team+'조">';
  h+='<div class="key-row">';
  for(let i=0;i<requiredRooms;i++)h+='<img class="key-icon'+(i<keys?"":" off")+'" src="assets/common_key.png" alt="">';
  h+='</div>';
  h+='<div class="note-box">'+keys+' / '+requiredRooms+' 조각 모음<br><span class="sub">'+requiredRooms+'개 방 + 강당 미션 완료 시 성공</span></div>';
  h+='<button class="btn btn-lg btn-sub" onclick="'+(isPopup?"window.close()":"goHome()")+'">'+(isPopup?"✕ 창 닫기":"← 이전")+'</button>';
  h+='</div>';
  h+='<div class="parchment-frame"><div class="parchment-frame-inner">';
  h+='<img class="room-icon-lg" src="assets/'+(ROOM_ICON[rid]||FINAL_ROOM_ICON)+'" alt="">';
  h+='<div class="room-title">'+room.name+'</div>';
  h+='<div class="room-subprog">'+p+' / 8 해결</div>';
  if(locked)h+='<div class="grade-warn" style="margin-top:10px">🔒 지금은 <b>'+ROOMS.find(x=>x.id===active).name+'</b>을(를) 먼저 풀어야 이 방 QR이 열려요.</div>';
  h+='<div class="mission-grid">';
  roomQids.forEach((qid,i)=>{
    const solved=!!solvedIds[qid];
    const isNext=!solved&&i===p&&!locked;
    const stateClass=solved?"solved":(isNext?"next gs-twinkle":"locked");
    h+='<div class="mission-icon '+stateClass+'">';
    h+='<img src="assets/mission_'+(i+1)+'.png" alt="'+(i+1)+'">';
    if(solved)h+='<img class="badge-img" src="assets/status_success.png" alt="완료">';
    else if(isNext)h+='<img class="badge-img" src="assets/decor_sparkles.png" alt="">';
    else h+='<img class="badge-img" src="assets/status_locked.png" alt="잠김">';
    h+='</div>';
  });
  h+='</div>';
  h+='<button class="btn btn-lg btn-primary" style="margin-top:16px" onclick="openScan()">📷 QR 스캔하러 가기</button>';
  h+='</div></div>';
  h+='</div>';
  app.innerHTML=h;
}
```

- [ ] **Step 2: Manually verify in the browser**

From the home screen, tap a classroom card (this opens `renderRoomDetail` — if a popup window opens instead, either allow popups or test by calling `renderRoomDetail('R1')` directly in the devtools console after picking a team). Expected:
- Stone-corridor background.
- Left column: team icon, a row of key icons (lit for keys already earned, dim for the rest), the "n / N 조각 모음" note box, and a back button ("← 이전" or "✕ 창 닫기" depending on how it was opened).
- Right column: the parchment frame image with the classroom icon, room name, "p / 8 해결", an 8-icon mission grid (numbered mission icons with a sparkle badge on the next one, a lock badge on future ones, and a checkmark badge on solved ones), and the "📷 QR 스캔하러 가기" button.
- Answer at least one question for this room first (see Task 7 for the question screen) and confirm the corresponding mission icon flips to "solved" with the checkmark badge.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: reskin room-detail/mission-select screen with ghost-school theme"
```

---

### Task 5: Celebration screen (`showCelebration`)

**Files:**
- Modify: `index.html` — `showCelebration` function (currently lines 1039–1049); `runConfetti` (lines 1050–1079) gets one small reduced-motion guard.

**Interfaces:**
- Consumes: `teamIconSrc`, `team`, `requiredRooms`, `totalKeys` (for the key row — always full at this point, but reuse the same markup pattern as Task 4 for consistency), plus new stat sources: total solved count across `QUESTIONS` (`Object.values(QUESTIONS).flat().filter(q=>solvedIds[q.qid]).length`), rooms completed (`ROOMS.filter(r=>roomProgress(r.id)===8).length`).

- [ ] **Step 1: Rewrite `showCelebration` and add the reduced-motion guard to `runConfetti`**

Find:

```js
function showCelebration(){
  const ov=document.createElement("div");
  ov.className="celebrate-ov";
  ov.innerHTML='<canvas class="confetti-cv" id="confettiCv"></canvas>'
    +'<div class="bounce" style="font-size:70px">🏆🔑🎉</div>'
    +'<h1>미션 클리어!</h1>'
    +'<p style="font-size:15px;line-height:1.8;max-width:320px;">황금열쇠 5조각을 모두 모으고<br>협동 미션까지 성공했어요!<br>우리 조 최고예요! 🎊</p>'
    +'<button class="btn btn-lg btn-primary" style="margin-top:22px;max-width:260px" onclick="this.closest(\'.celebrate-ov\').remove()">확인</button>';
  document.getElementById("studentRoot").appendChild(ov);
  runConfetti();
}
function runConfetti(){
  const cv=document.getElementById("confettiCv");
  if(!cv)return;
  cv.width=window.innerWidth;cv.height=window.innerHeight;
```

Replace with:

```js
function showCelebration(){
  const solvedCount=Object.values(QUESTIONS).flat().filter(q=>solvedIds[q.qid]).length;
  const totalQ=Object.values(QUESTIONS).flat().length;
  const roomsDone=ROOMS.filter(r=>roomProgress(r.id)===8).length;
  const ov=document.createElement("div");
  ov.className="celebrate-ov";
  let keys='<div class="key-row">';
  for(let i=0;i<requiredRooms;i++)keys+='<img class="key-icon" src="assets/common_key.png" alt="">';
  keys+='</div>';
  ov.innerHTML='<canvas class="confetti-cv" id="confettiCv"></canvas>'
    +'<div class="celebrate-inner">'
    +'<div class="side-panel"><img class="team-icon-img" src="'+teamIconSrc(Number(team))+'" alt="'+team+'조"><div class="curse-title">저주가<br>풀렸다</div>'+keys+'</div>'
    +'<div><img class="chest-img" src="assets/prop_treasure_chest.png" alt="">'
    +'<div class="result-card"><div style="font-family:\'Nanum Myeongjo\',serif;font-size:22px;font-weight:800;color:var(--gs-ink-brown);text-align:center;">열쇠 '+requiredRooms+'개를 모두 되찾았다</div>'
    +'<div class="result-stats">'
    +'<div class="result-stat"><div class="label">푼 문제</div><div class="value">'+solvedCount+' / '+totalQ+'</div></div>'
    +'<div class="result-stat"><div class="label">연 교실</div><div class="value">'+roomsDone+' 개</div></div>'
    +'<div class="result-stat"><div class="label">단체줄넘기</div><div class="value">성공</div></div>'
    +'</div>'
    +'<div style="margin-top:20px;font-size:14.5px;line-height:1.9;color:var(--gs-ink-brown-2);">유령들이 손을 흔들며 사라졌습니다.<br>학교는 다시 조용해졌어요.</div>'
    +'<button class="btn btn-lg btn-primary" style="margin-top:22px" onclick="this.closest(\'.celebrate-ov\').remove()">확인</button>'
    +'</div></div>'
    +'</div>';
  document.getElementById("studentRoot").appendChild(ov);
  runConfetti();
}
function runConfetti(){
  if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const cv=document.getElementById("confettiCv");
  if(!cv)return;
  cv.width=window.innerWidth;cv.height=window.innerHeight;
```

- [ ] **Step 2: Manually verify in the browser**

Trigger the celebration screen (either play through to solving `R6Q1`, or call `showCelebration()` directly in the devtools console after picking a team). Expected:
- Stone-corridor background behind a two-column overlay: left side shows the team icon, "저주가 풀렸다", and a row of gold key icons; right side shows a treasure chest sitting on top of a parchment result card with the three stats (푼 문제/연 교실/단체줄넘기) and the "확인" button.
- Confetti still animates on top (unless your OS has reduced-motion turned on, in which case it should skip both the CSS drift/flicker/twinkle animations and the confetti).
- "확인" still closes the overlay.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: reskin celebration screen with ghost-school theme"
```

---

### Task 6: QR scan screen (`openScan`)

**Files:**
- Modify: `index.html` — `openScan` function (currently lines 1087–1100)

**Interfaces:**
- Consumes: `setScene`, `currentHelpRoomId` (existing).

- [ ] **Step 1: Rewrite `openScan`**

Find:

```js
function openScan(){
  view="scan";
  const helpRoomId=currentHelpRoomId();
  const helpBtn=helpRoomId?'<button class="btn btn-lg btn-sub" style="margin-top:14px;color:#b45309" onclick="requestHelp(\''+helpRoomId+"');goHome();\">🙋 선생님께 도움 요청하기</button>":"";
  app.innerHTML='<div class="scan-wrap"><div class="top-back" onclick="goHome()">← 홈으로</div>'
    +'<div class="cam-box"><video id="vid" playsinline muted autoplay></video><div class="cam-frame"></div></div>'
    +'<div class="cam-msg" id="camMsg">카메라를 QR 코드에 비춰주세요</div>'
    +'<div class="manual-box"><h4>카메라가 안 되면 카드에 적힌 6자리 코드를 직접 입력하세요</h4>'
    +'<div class="manual-row"><input class="txt-inp" id="manualInp" placeholder="예: A3F9K2" maxlength="6"><button class="btn btn-sub" style="padding:0 16px" onclick="submitManual()">확인</button></div></div>'
    +helpBtn
    +"</div>";
  document.getElementById("manualInp").addEventListener("keydown",e=>{if(e.key==="Enter")submitManual();});
  startCamera();
}
```

Replace with:

```js
function openScan(){
  view="scan";
  setScene("guide");
  const helpRoomId=currentHelpRoomId();
  const helpBtn=helpRoomId?'<button class="btn btn-lg btn-sub" style="margin-top:14px" onclick="requestHelp(\''+helpRoomId+"');goHome();\">🙋 선생님께 도움 요청하기</button>":"";
  app.innerHTML='<div class="scan-wrap"><div class="top-back" onclick="goHome()">← 홈으로</div>'
    +'<img src="assets/button_qr_scan.png" alt="QR 스캔하기" style="width:220px;margin:6px auto 10px;display:block;">'
    +'<div class="cam-box"><video id="vid" playsinline muted autoplay></video><div class="cam-frame"></div></div>'
    +'<div class="cam-msg" id="camMsg">카메라를 QR 코드에 비춰주세요</div>'
    +'<div class="manual-box"><h4>카메라가 안 되면 카드에 적힌 6자리 코드를 직접 입력하세요</h4>'
    +'<div class="manual-row"><input class="txt-inp" id="manualInp" placeholder="예: A3F9K2" maxlength="6"><button class="btn btn-sub" style="padding:0 16px" onclick="submitManual()">확인</button></div></div>'
    +helpBtn
    +"</div>";
  document.getElementById("manualInp").addEventListener("keydown",e=>{if(e.key==="Enter")submitManual();});
  startCamera();
}
```

- [ ] **Step 2: Manually verify in the browser**

From the home screen, tap "📷 QR 스캔하기" (or call `openScan()` directly). Expected:
- Ghost/lantern parchment-guide background.
- The "QR 스캔하기" plaque image as a page heading (not clickable — it's just a label now, the camera starts automatically like before).
- The camera box now has a gold frame and glow (grant camera permission to see the video feed, or just confirm the box renders even if permission is denied — `camMsg` should show the "카메라를 사용할 수 없어요..." fallback text in that case, unchanged from before).
- The manual code entry box still works: type one of the codes from `CODES` (e.g. `DKMFR5` for `R1Q1`) and confirm it navigates to the grade-gate/question screen.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: reskin QR scan screen with ghost-school theme"
```

---

### Task 7: Question flow (`showGradeGate`, `showQuestionScreen`, `showRoomLockedScreen`, `renderCooldown`, `submitAnswer`, `initCanvas`)

**Files:**
- Modify: `index.html` — `showGradeGate` (1195–1219), `showQuestionScreen` (1220–1275), `initCanvas` (1276–1325, one-line color change), `renderCooldown` (1331–1345), `submitAnswer` (1346–1386), `showRoomLockedScreen` (1172–1180)

**Interfaces:**
- Consumes: `setScene`, existing globals (`findQ`, `RosterUtils.computeEffectiveGrade`, `helpStudentForGrade`, `MATH_ROOMS`, `ensureRandomPick`, `randomPicks`, `cooldown`, `normalize`, `saveSubmission`, `saveCloud`, `roomProgress`, `activeRoomId`, `requestHelp`).
- No signature changes to any of these functions — only their returned HTML strings and one canvas color change.

- [ ] **Step 1: Rewrite `showRoomLockedScreen`**

Find:

```js
function showRoomLockedScreen(rid,activeRoom){
  view="question";activeQid=null;
  const room=ROOMS.find(r=>r.id===rid);
  let h='<div class="top-back" onclick="goHome()">← 홈으로</div><div class="card">';
  h+='<div class="center-icon">🔒</div><div class="fb-box fb-lock">'+room.emoji+' '+room.name+'은(는) 아직 시작할 수 없어요!<br>지금은 <b>'+activeRoom.emoji+' '+activeRoom.name+'</b>을(를) 먼저 끝내야 해요.</div>';
  h+='<button class="btn btn-lg btn-primary" style="margin-top:10px" onclick="requestHelp(\''+activeRoom.id+'\');goHome();">🙋 선생님께 도움 요청하기</button>';
  h+='</div><button class="btn btn-lg btn-sub" style="margin-top:12px" onclick="goHome()">홈으로</button>';
  app.innerHTML=h;
}
```

Replace with:

```js
function showRoomLockedScreen(rid,activeRoom){
  view="question";activeQid=null;
  setScene("guide");
  const room=ROOMS.find(r=>r.id===rid);
  let h='<div class="top-back" onclick="goHome()">← 홈으로</div><div class="card">';
  h+='<img class="modal-icon" src="assets/status_locked.png" alt="">';
  h+='<div class="fb-box fb-lock">'+room.name+'은(는) 아직 시작할 수 없어요!<br>지금은 <b>'+activeRoom.name+'</b>을(를) 먼저 끝내야 해요.</div>';
  h+='<button class="btn btn-lg btn-primary" style="margin-top:10px" onclick="requestHelp(\''+activeRoom.id+'\');goHome();">🙋 선생님께 도움 요청하기</button>';
  h+='</div><button class="btn btn-lg btn-sub" style="margin-top:12px" onclick="goHome()">홈으로</button>';
  app.innerHTML=h;
}
```

- [ ] **Step 2: Rewrite `showGradeGate`**

Find:

```js
function showGradeGate(qid,mode){
  view="question";activeQid=qid;
  const q=findQ(qid);
  const rid=qid.slice(0,2);
  const room=ROOMS.find(r=>r.id===rid);
  const eff=RosterUtils.computeEffectiveGrade(q.grade,teamGrades,1,6);
  let warnMsg;
  if(eff===q.grade){
    warnMsg='이 문제는 <b>'+q.grade+'학년</b>이 풀어야 하는 문제입니다.';
  }else{
    warnMsg='이 문제는 원래 <b>'+q.grade+'학년</b> 문제인데, 우리 조에 '+q.grade+'학년 친구가 없어요!<br>그래서 우리 조에서는 <b>'+eff+'학년</b> 친구가 풀 수 있어요.';
  }
  const helpStudent=helpStudentForGrade(eff);
  let h='<div class="top-back" onclick="goHome()">← 홈으로</div>';
  h+='<div class="card">';
  h+='<div class="q-badges"><span class="badge b-id">'+qid+"</span><span class=\"badge b-grade\">"+q.grade+"학년</span><span class=\"badge b-unit\">"+room.emoji+" "+room.name+" · "+q.unit+"</span></div>";
  h+='<div class="center-icon">🙋</div>';
  h+='<div class="grade-warn" style="font-size:15px;text-align:center;line-height:1.6;">'+warnMsg+'</div>';
  if(helpStudent){
    h+='<div class="grade-warn" style="margin-top:8px;background:#EAF2FB;border-color:#C7DCF2;color:var(--navy-g);font-size:14px;text-align:center;line-height:1.6;">🤝 '+escapeHtml(helpStudent.name)+' 친구는 같은 학년이나 한 학년 위 친구가 도와줘도 좋아요. 함께 풀어보세요!</div>';
  }
  h+='<button class="btn btn-lg btn-primary" style="margin-top:14px" onclick="showQuestionScreen(\''+qid+'\',\''+mode+'\')">확인</button>';
  h+="</div>";
  app.innerHTML=h;
}
```

Replace with:

```js
function showGradeGate(qid,mode){
  view="question";activeQid=qid;
  setScene("guide");
  const q=findQ(qid);
  const rid=qid.slice(0,2);
  const room=ROOMS.find(r=>r.id===rid);
  const eff=RosterUtils.computeEffectiveGrade(q.grade,teamGrades,1,6);
  let warnMsg;
  if(eff===q.grade){
    warnMsg='이 문제는 <b>'+q.grade+'학년</b>이 풀어야 하는 문제입니다.';
  }else{
    warnMsg='이 문제는 원래 <b>'+q.grade+'학년</b> 문제인데, 우리 조에 '+q.grade+'학년 친구가 없어요!<br>그래서 우리 조에서는 <b>'+eff+'학년</b> 친구가 풀 수 있어요.';
  }
  const helpStudent=helpStudentForGrade(eff);
  let h='<div class="top-back" onclick="goHome()">← 홈으로</div>';
  h+='<div class="card">';
  h+='<div class="q-badges"><span class="badge b-id">'+qid+"</span><span class=\"badge b-grade\">"+q.grade+"학년</span><span class=\"badge b-unit\">"+room.emoji+" "+room.name+" · "+q.unit+"</span></div>";
  h+='<div class="center-icon">🙋</div>';
  h+='<div class="grade-warn" style="font-size:15px;text-align:center;line-height:1.6;">'+warnMsg+'</div>';
  if(helpStudent){
    h+='<div class="grade-warn" style="margin-top:8px;text-align:center;line-height:1.6;">🤝 '+escapeHtml(helpStudent.name)+' 친구는 같은 학년이나 한 학년 위 친구가 도와줘도 좋아요. 함께 풀어보세요!</div>';
  }
  h+='<button class="btn btn-lg btn-primary" style="margin-top:14px" onclick="showQuestionScreen(\''+qid+'\',\''+mode+'\')">확인</button>';
  h+="</div>";
  app.innerHTML=h;
}
```

- [ ] **Step 3: Rewrite `showQuestionScreen`**

Find:

```js
function showQuestionScreen(qid,mode,requiredQid){
  view="question";activeQid=qid;
  const q=findQ(qid);
  const rid=qid.slice(0,2);
  const room=rid==="R6"?FINAL_ROOM:ROOMS.find(r=>r.id===rid);
  if(mode!=="locked")ensureRandomPick(q);

  let bodyText=q.text;
  let expectedShown="";
  if(q.type==="random"){
    const pick=randomPicks[qid];
    bodyText=q.text+'<br><span style="font-size:20px;font-weight:900;color:var(--navy-g)">"'+(pick?pick.ko:"")+'"</span>';
    expectedShown=pick?pick.en:"";
  }else{
    expectedShown=q.answer;
  }

  let h='<div class="top-back" onclick="goHome()">← 홈으로</div>';
  h+='<div class="card">';
  h+='<div class="q-badges"><span class="badge b-id">'+qid+"</span>"+(q.grade?"<span class=\"badge b-grade\">"+q.grade+"학년</span>":"")+"<span class=\"badge b-unit\">"+room.emoji+" "+room.name+" · "+q.unit+"</span></div>";

  if(mode==="locked"){
    h+='<div class="center-icon">🔒</div><div class="fb-box fb-lock">아직 열 수 없어요!<br>이 방은 순서대로 풀어야 해요.<br>지금 풀어야 할 문제: <b>'+requiredQid+"</b></div>";
    h+='<button class="btn btn-lg btn-primary" style="margin-top:10px" onclick="requestHelp(\''+rid+"');goHome();\">🙋 선생님께 도움 요청하기</button>";
    h+="</div>";
    h+='<button class="btn btn-lg btn-sub" style="margin-top:12px" onclick="goHome()">홈으로</button>';
    app.innerHTML=h;
    return;
  }

  if(q.img)h+='<div class="qimg'+(q.wide?" wide":"")+'">'+q.img+"</div>";
  h+='<div class="q-text">'+bodyText+"</div>";

  if(mode==="review"){
    h+='<div class="fb-box fb-review">✅ 이미 푼 문제예요<br>정답: <b>'+expectedShown+"</b></div>";
    h+="</div>";
    h+='<button class="btn btn-lg btn-sub" style="margin-top:12px" onclick="goHome()">홈으로</button>';
    app.innerHTML=h;
    return;
  }

  // active
  if(MATH_ROOMS.includes(rid)){
    h+='<div style="background:#FDEEEF;border:1px solid #F5C6CB;border-radius:10px;padding:10px 12px;font-size:13px;color:var(--red);font-weight:800;text-align:center;line-height:1.6;">⚠️ 풀이과정을 꼭 남겨주세요!<br>안 적으면 오답 처리되어 다시 풀어야 해요.</div>';
  }
  h+='<div class="ans-row"><input class="txt-inp" id="ansInp" placeholder="정답 입력" autocomplete="off" autocapitalize="off"><button class="btn btn-green" id="submitBtn" style="padding:0 18px" onclick="submitAnswer()">제출</button></div>';
  h+='<div id="fbArea"></div>';
  h+='<div class="scr-hd"><span class="lbl">✏️ 풀이 공간</span><button onclick="clearScratch()">🗑 지우기</button></div>';
  h+='<div class="canvas-wrap" id="canvasWrap"><canvas id="scratchCanvas"></canvas></div>';
  h+="</div>";
  app.innerHTML=h;
  renderCooldown();
  initCanvas();
  const inp=document.getElementById("ansInp");
  if(inp){inp.addEventListener("keydown",e=>{if(e.key==="Enter")submitAnswer();});inp.focus();}
}
```

Replace with:

```js
function showQuestionScreen(qid,mode,requiredQid){
  view="question";activeQid=qid;
  setScene("study");
  const q=findQ(qid);
  const rid=qid.slice(0,2);
  const room=rid==="R6"?FINAL_ROOM:ROOMS.find(r=>r.id===rid);
  if(mode!=="locked")ensureRandomPick(q);

  let bodyText=q.text;
  let expectedShown="";
  if(q.type==="random"){
    const pick=randomPicks[qid];
    bodyText=q.text+'<br><span style="font-size:20px;font-weight:900;color:var(--gs-ink-brown)">"'+(pick?pick.ko:"")+'"</span>';
    expectedShown=pick?pick.en:"";
  }else{
    expectedShown=q.answer;
  }

  let h='<div class="top-back" onclick="goHome()">← 홈으로</div>';
  h+='<div class="parchment-frame"><div class="parchment-frame-inner" style="align-items:stretch;text-align:left;">';
  h+='<div class="q-badges"><span class="badge b-id">'+qid+"</span>"+(q.grade?"<span class=\"badge b-grade\">"+q.grade+"학년</span>":"")+"<span class=\"badge b-unit\">"+room.emoji+" "+room.name+" · "+q.unit+"</span></div>";

  if(mode==="locked"){
    h+='<div class="center-icon">🔒</div><div class="fb-box fb-lock">아직 열 수 없어요!<br>이 방은 순서대로 풀어야 해요.<br>지금 풀어야 할 문제: <b>'+requiredQid+"</b></div>";
    h+='<button class="btn btn-lg btn-primary" style="margin-top:10px" onclick="requestHelp(\''+rid+"');goHome();\">🙋 선생님께 도움 요청하기</button>";
    h+="</div></div>";
    h+='<button class="btn btn-lg btn-sub" style="margin-top:12px" onclick="goHome()">홈으로</button>';
    app.innerHTML=h;
    return;
  }

  if(q.img)h+='<div class="qimg'+(q.wide?" wide":"")+'">'+q.img+"</div>";
  h+='<div class="q-text">'+bodyText+"</div>";

  if(mode==="review"){
    h+='<div class="fb-box fb-review"><img src="assets/status_success.png" alt="">이미 푼 문제예요<br>정답: <b>'+expectedShown+"</b></div>";
    h+="</div></div>";
    h+='<button class="btn btn-lg btn-sub" style="margin-top:12px" onclick="goHome()">홈으로</button>';
    app.innerHTML=h;
    return;
  }

  // active
  if(MATH_ROOMS.includes(rid)){
    h+='<div class="fb-box fb-bad" style="margin-top:0;margin-bottom:14px;">⚠️ 풀이과정을 꼭 남겨주세요!<br>안 적으면 오답 처리되어 다시 풀어야 해요.</div>';
  }
  h+='<div class="ans-row"><input class="txt-inp" id="ansInp" placeholder="정답 입력" autocomplete="off" autocapitalize="off"><button class="btn btn-green" id="submitBtn" style="padding:0 18px" onclick="submitAnswer()">제출</button></div>';
  h+='<div id="fbArea"></div>';
  h+='<div class="scr-hd"><span class="lbl">✏️ 풀이 공간</span><button onclick="clearScratch()">🗑 지우기</button></div>';
  h+='<div class="canvas-wrap" id="canvasWrap"><canvas id="scratchCanvas"></canvas></div>';
  h+="</div></div>";
  app.innerHTML=h;
  renderCooldown();
  initCanvas();
  const inp=document.getElementById("ansInp");
  if(inp){inp.addEventListener("keydown",e=>{if(e.key==="Enter")submitAnswer();});inp.focus();}
}
```

- [ ] **Step 4: Change the scratch-canvas stroke color for the dark slate background**

Find (inside `initCanvas`):

```js
  canvasCtx=canvas.getContext("2d");
  canvasCtx.lineWidth=2.5;canvasCtx.lineCap="round";canvasCtx.lineJoin="round";canvasCtx.strokeStyle="#1E2D3D";
```

Replace with:

```js
  canvasCtx=canvas.getContext("2d");
  canvasCtx.lineWidth=2.5;canvasCtx.lineCap="round";canvasCtx.lineJoin="round";canvasCtx.strokeStyle="#f4ecd8";
```

- [ ] **Step 5: Rewrite `renderCooldown`'s cooldown text (only the innerHTML string changes)**

Find:

```js
  if(c&&c.until>now){
    const remain=Math.ceil((c.until-now)/1000);
    fb.innerHTML='<div class="cooldown-txt">오답! '+remain+'초 후 다시 시도할 수 있어요.</div>';
    if(btn)btn.disabled=true;
    setTimeout(()=>{if(view==="question"&&activeQid===qid)renderCooldown();},500);
  }else{
    if(btn)btn.disabled=false;
  }
```

This block does not need any change — `.cooldown-txt` is already restyled in Task 1's CSS. Skip to Step 6.

- [ ] **Step 6: Rewrite the feedback strings inside `submitAnswer`**

Find:

```js
  if(isCorrect){
    solvedIds[qid]=true;
    delete cooldown[qid];
    saveCloud();
    const rid=qid.slice(0,2);
    if(rid==="R6"){
      pendingCelebration=true;
      fb.innerHTML='<div class="fb-box fb-ok">🎉 협동 미션 성공!</div><button class="btn btn-lg btn-primary" style="margin-top:12px" onclick="goHome()">홈으로</button>';
    }else{
      const roomDone=roomProgress(rid)===8;
      fb.innerHTML='<div class="fb-box fb-ok">🎉 정답입니다!<br>'+(roomDone?"이 방을 모두 클리어했어요! 황금열쇠 조각을 얻었습니다 🔑":"방 안 어딘가에 숨겨진 다음 QR 코드를 찾아보세요!")+'</div><button class="btn btn-lg btn-primary" style="margin-top:12px" onclick="openScan()">📷 다음 QR 스캔하기</button><button class="btn btn-lg btn-sub" style="margin-top:8px" onclick="goHome()">홈으로</button>';
    }
    if(inp)inp.disabled=true;
    const sb=document.getElementById("submitBtn");if(sb)sb.disabled=true;
  }else{
    const attempts=((c&&c.attempts)||0)+1;
    const wait=attempts>=2?60:10;
    cooldown[qid]={until:Date.now()+wait*1000,attempts};
    saveCloud();
    if(answerMatches&&noWorkShown){
      fb.innerHTML='<div class="fb-box fb-bad">❌ 정답이지만 풀이과정이 없어서 오답 처리했어요!<br>풀이과정을 꼭 남기고 다시 풀어주세요.</div>';
    }else{
      fb.innerHTML='<div class="fb-box fb-bad">❌ 정답이 아니에요. 다시 시도해보세요!</div>';
    }
    if(inp){inp.value="";}
    renderCooldown();
  }
```

Replace with:

```js
  if(isCorrect){
    solvedIds[qid]=true;
    delete cooldown[qid];
    saveCloud();
    const rid=qid.slice(0,2);
    if(rid==="R6"){
      pendingCelebration=true;
      fb.innerHTML='<div class="fb-box fb-ok"><img src="assets/status_success.png" alt="">협동 미션 성공!</div><button class="btn btn-lg btn-primary" style="margin-top:12px" onclick="goHome()">홈으로</button>';
    }else{
      const roomDone=roomProgress(rid)===8;
      fb.innerHTML='<div class="fb-box fb-ok"><img src="assets/status_success.png" alt="">정답입니다!<br>'+(roomDone?"이 방을 모두 클리어했어요! 황금열쇠 조각을 얻었습니다 🔑":"방 안 어딘가에 숨겨진 다음 QR 코드를 찾아보세요!")+'</div><button class="btn btn-lg btn-primary" style="margin-top:12px" onclick="openScan()">📷 다음 QR 스캔하기</button><button class="btn btn-lg btn-sub" style="margin-top:8px" onclick="goHome()">홈으로</button>';
    }
    if(inp)inp.disabled=true;
    const sb=document.getElementById("submitBtn");if(sb)sb.disabled=true;
  }else{
    const attempts=((c&&c.attempts)||0)+1;
    const wait=attempts>=2?60:10;
    cooldown[qid]={until:Date.now()+wait*1000,attempts};
    saveCloud();
    if(answerMatches&&noWorkShown){
      fb.innerHTML='<div class="fb-box fb-bad"><img src="assets/status_failure.png" alt="">정답이지만 풀이과정이 없어서 오답 처리했어요!<br>풀이과정을 꼭 남기고 다시 풀어주세요.</div>';
    }else{
      fb.innerHTML='<div class="fb-box fb-bad"><img src="assets/status_failure.png" alt="">정답이 아니에요. 다시 시도해보세요!</div>';
    }
    if(inp){inp.value="";}
    renderCooldown();
  }
```

- [ ] **Step 7: Manually verify in the browser**

Scan/manually-enter a code (e.g. `DKMFR5` for `R1Q1`). Expected:
- Grade-gate screen shows the ghost/lantern guide background behind a parchment card with the warning text and "확인" button.
- Tapping "확인" moves to the question screen: dim study-room background behind the `background_problem_frame.png` parchment panel containing the badges, question image/text, math-warning banner (only for `MATH_ROOMS`), answer input + "제출", and the scratch pad (now with light chalk-colored strokes visible against the dark canvas — draw on it to confirm).
- Submitting a wrong answer shows the red "❌" box with the failure icon and starts the cooldown countdown; submitting the right answer (with scratch work drawn, for math rooms) shows the green "🎉" box with the success icon and the "다음 QR 스캔하기"/"홈으로" buttons.
- Scanning/entering a code for an already-solved question shows the "review" parchment panel with the checkmark icon and the recorded answer.
- Scanning/entering a code that's locked (out of order) shows the lock message with the "도움 요청" button, still on the guide background.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat: reskin question/answer flow with ghost-school theme"
```

---

### Task 8: Modals (`showWrongNoticeModal`, initial guide, required-rooms-changed notice)

**Files:**
- Modify: `index.html` — `showWrongNoticeModal` (1028–1033), `showInitialGuidePopup` (936–949), `showRequiredRoomsChangedNotification` (927–935)

**Interfaces:**
- Produces: `showInfoModal(iconSrc, title, bodyHtml)` — new shared helper, appends a `.modal-ov`/`.modal-box` to `#studentRoot` and removes itself on "확인" click. No return value.
- Consumes: nothing new.

- [ ] **Step 1: Add the shared `showInfoModal` helper and rewrite `showWrongNoticeModal`**

Find:

```js
function showWrongNoticeModal(n){
  const ov=document.createElement("div");
  ov.className="modal-ov";
  ov.innerHTML='<div class="modal-box"><div class="em">🔁</div><h3>다시 풀어주세요!</h3><p>'+escapeHtml(n.roomName||"")+'의 <b>'+escapeHtml(n.qid||"")+'</b> 문제를 선생님이 다시 확인하셨어요.<br>'+escapeHtml(n.msg||"틀렸어요, 다시 풀어볼까요?")+'</p><button class="btn btn-lg btn-primary" onclick="this.closest(\'.modal-ov\').remove()">확인</button></div>';
  document.getElementById("studentRoot").appendChild(ov);
}
```

Replace with:

```js
function showInfoModal(iconSrc,title,bodyHtml){
  const ov=document.createElement("div");
  ov.className="modal-ov";
  ov.innerHTML='<div class="modal-box">'+(iconSrc?'<img class="modal-icon" src="'+iconSrc+'" alt="">':"")
    +'<h3 style="text-align:center;">'+title+'</h3><p>'+bodyHtml+'</p>'
    +'<button class="btn btn-lg btn-primary" onclick="this.closest(\'.modal-ov\').remove()">확인</button></div>';
  document.getElementById("studentRoot").appendChild(ov);
}
function showWrongNoticeModal(n){
  showInfoModal(
    "assets/common_scroll.png",
    "다시 풀어주세요!",
    escapeHtml(n.roomName||"")+'의 <b>'+escapeHtml(n.qid||"")+'</b> 문제를 선생님이 다시 확인하셨어요.<br>'+escapeHtml(n.msg||"틀렸어요, 다시 풀어볼까요?")
  );
}
```

- [ ] **Step 2: Convert `showInitialGuidePopup` from `alert()` to the modal**

Find:

```js
function showInitialGuidePopup(){
  // 처음 시작할 때 안내 팝업
  if(guidePumpShown||appMode!=="student")return;
  guidePumpShown=true;
  const msg=
    "🎉 방탈출 놀이를 시작합니다!\n\n"+
    "📝 미션:\n"+
    "• " + requiredRooms + "개의 방 문제를 풀기\n"+
    "• 강당에서 단체줄넘기 20개 성공\n\n"+
    "✅ 위 미션을 모두 완료하면 성공!\n\n"+
    "⏰ 순서 상관없이 원하는 방부터 시작하세요!\n\n"+
    "화이팅! 🚀";
  alert(msg);
}
```

Replace with:

```js
function showInitialGuidePopup(){
  // 처음 시작할 때 안내 팝업
  if(guidePumpShown||appMode!=="student")return;
  guidePumpShown=true;
  const body=
    "📝 미션:<br>"+
    "• "+requiredRooms+"개의 방 문제를 풀기<br>"+
    "• 강당에서 단체줄넘기 20개 성공<br><br>"+
    "✅ 위 미션을 모두 완료하면 성공!<br><br>"+
    "⏰ 순서 상관없이 원하는 방부터 시작하세요!<br><br>"+
    "화이팅! 🚀";
  showInfoModal("assets/prop_wooden_sign.png","방탈출 놀이를 시작합니다!",body);
}
```

- [ ] **Step 3: Convert `showRequiredRoomsChangedNotification` from `alert()` to the modal**

Find:

```js
function showRequiredRoomsChangedNotification(newRooms){
  // 관리자가 방탈출 설정을 변경했을 때 학생들에게 알림
  if(appMode!=="student"||view!=="home")return;
  alert(
    "📢 선생님이 방탈출 설정을 변경하셨습니다!\n\n"+
    "🎯 " + newRooms + "개의 방 + 강당 미션을 클리어해야 성공합니다.\n\n"+
    "지금부터 목표를 달성하기 위해 도전해보세요! 💪"
  );
}
```

Replace with:

```js
function showRequiredRoomsChangedNotification(newRooms){
  // 관리자가 방탈출 설정을 변경했을 때 학생들에게 알림
  if(appMode!=="student"||view!=="home")return;
  showInfoModal(
    "assets/common_scroll.png",
    "선생님이 설정을 변경하셨어요!",
    "🎯 "+newRooms+"개의 방 + 강당 미션을 클리어해야 성공합니다.<br><br>지금부터 목표를 달성하기 위해 도전해보세요! 💪"
  );
}
```

- [ ] **Step 4: Manually verify in the browser**

- Clear `localStorage`, reload, pick a team: the initial guide should now appear as a parchment modal (with the wooden-sign icon) instead of a native `alert()`, and "확인" dismisses it.
- In the admin dashboard (`?admin` or however admin mode is entered — check `enterAdminMode`/`exitAdminMode` if unsure), change "방 개수"(`requiredRooms`) while a student tab with the same team open on the home screen is visible: the student tab should show the parchment modal instead of a native alert.
- Trigger `showWrongNoticeModal` (from the admin "다시 풀어주세요" action on a submission) and confirm it now shows the scroll icon in a parchment modal.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: replace native alert() popups with themed parchment modals"
```

---

### Task 9: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the existing unit tests**

```bash
cd "C:\Users\박정민\Downloads\escape"
node --test scripts/roster-utils.test.js
```

Expected: all tests still pass (this plan never touched `scripts/roster-utils.js`).

- [ ] **Step 2: Full manual click-through on a tablet-width viewport**

Open `index.html` in a browser with devtools responsive mode set to ~1180×820 (landscape tablet). Walk the whole flow: 조 편성 → 교실 선택 → 미션 선택 → QR 스캔(수동입력) → 학년 확인 → 문제 풀이(오답 → 정답) → 방 완료 → 강당 협동미션 → 저주 해제 축하 화면. Confirm every screen shows its themed background/art, no layout overlaps, and no console errors.

- [ ] **Step 3: Repeat the click-through on a narrow/phone-width viewport**

Set devtools responsive mode to ~375×812 (portrait phone) and repeat the same flow. Confirm nothing overflows horizontally, text stays legible, and the two-column screens (room detail, celebration) stack into a single readable column via the existing `flex-wrap` on `.room-detail-layout`/`.celebrate-inner` (no code change needed here since Task 1/4/5 already used `flex-wrap:wrap`) — if anything overlaps or clips, note it and fix the specific rule before moving on.

- [ ] **Step 4: Confirm `#adminRoot` is untouched**

Enter admin mode (however this app exposes it — check the "⚙ 관리자 모드" accordion on the team-pick screen) and click through the dashboard/roster/questions/QR tabs. Confirm they still look exactly like the original light-blue admin theme with no leftover dark styling bleeding in.

- [ ] **Step 5: Push a summary commit if any fixes were needed in Steps 2–4**

If Steps 2–4 required any small CSS/markup fixes, commit them now with a message describing what was fixed, e.g.:

```bash
git add index.html
git commit -m "fix: address layout issues found in full theme QA pass"
```

If no fixes were needed, this task produces no commit — just report that verification passed.

---

## Post-launch follow-up (added after the final whole-branch review)

The final review of Tasks 1-9 came back "ready to merge with fixes." Two follow-ups were approved by the human after seeing a side-by-side visual comparison of two home-screen options:

- The home/classroom-select screen should be reworked from its single-column mobile stack into the same two-column "stage" layout (wood-sign/guidance panel on the left, a grid of room cards on the right) that the room-detail and celebration screens already use — the human chose this ("B안") over keeping the single column, after reviewing a rendered comparison.
- A batch of Important/Minor findings from the final review should be fixed: the celebration overlay can get stuck un-dismissable on short viewports, decorative sprite images can render on top of card content instead of behind it, the question screen's locked state doesn't use the same lock icon as the room-locked screen, the question-answering parchment frame isn't horizontally centered on wide viewports, the peer-help notice on the grade-gate screen lost its distinguishing purple tint when the old inline color was removed, and the celebration screen's "푼 문제" ratio counts every question in the game (including rooms the team never opened) instead of just the rooms they actually attempted.

### Task 10: Home screen — two-column stage layout

**Files:**
- Modify: `index.html` — `renderHome()` (current function, find via `grep -n "^function renderHome"`), and the `<style>` block (add new rules, remove now-dead `.keys-bar*`/`.scan-fab*`/`.room-grid` rules — home is their only consumer)

**Interfaces:**
- Consumes: `setScene`, `ROOM_ICON`, `FINAL_ROOM_ICON`, `teamIconSrc` is NOT needed here (no team icon on this screen in the new layout — the wood-sign title takes that visual slot instead, matching the design spec's screen 02), all the same globals `renderHome()` already used (`totalKeys`, `requiredRooms`, `activeRoomId`, `roomProgress`, `unlocked`, `helpRequest`, `finalDone`, `pendingCelebration`, `showCelebration`).
- Produces: two new CSS classes other tasks don't need but must not collide with: `.stage`, `.room-grid-3col`, `.scan-btn-img`.

- [ ] **Step 1: Add the new CSS and remove the classes only `renderHome()` used**

In the `<style>` block, find:

```css
#studentRoot .keys-bar{display:flex;align-items:center;justify-content:center;gap:6px;padding:14px;background:rgba(46,32,80,.7);border-radius:12px;margin-bottom:14px;border:1px solid rgba(255,205,130,.35);flex-wrap:wrap;}
#studentRoot .keys-bar .k{font-size:26px;filter:grayscale(1) brightness(.5);opacity:.55;}
#studentRoot .keys-bar .k.on{filter:none;opacity:1;text-shadow:0 0 10px rgba(255,205,120,.9);}
#studentRoot .keys-txt{font-size:12px;color:var(--gs-gold-lt);font-weight:700;margin-left:8px;}

#studentRoot .room-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
```

Replace with:

```css
#studentRoot[data-scene="village"] .wrap{max-width:1040px;}
#studentRoot .stage{display:flex;gap:32px;align-items:flex-start;flex-wrap:wrap;}
#studentRoot .room-grid-3col{flex:1 1 480px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-content:start;}
#studentRoot .scan-btn-img{width:100%;max-width:200px;filter:drop-shadow(0 6px 14px rgba(0,0,0,.6));cursor:pointer;display:block;margin:0 auto;}
@media (max-width:700px){
  #studentRoot .room-grid-3col{grid-template-columns:repeat(2,minmax(0,1fr));}
  #studentRoot .stage{flex-direction:column;align-items:stretch;}
  #studentRoot .side-panel{flex:none;}
}
```

Then find:

```css
#studentRoot .scan-fab{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);width:min(560px,calc(100% - 32px));z-index:40;}
#studentRoot .scan-fab img{width:100%;display:block;filter:drop-shadow(0 8px 22px rgba(0,0,0,.6));cursor:pointer;}
```

Delete both lines (no replacement) — `.scan-fab` was only used by the old floating home-screen button, which this task replaces with an inline button inside the side panel.

- [ ] **Step 2: Rewrite `renderHome()`**

Find the current `renderHome()` function in full (from `function renderHome(){` to its closing `}`) and replace it with:

```js
function renderHome(){
  view="home";
  setScene("village");
  setHeader();
  const keys=totalKeys();
  let h='<img class="decor-img gs-flicker" src="assets/prop_lantern.png" alt="" style="left:2%;bottom:6%;width:64px;filter:drop-shadow(0 0 22px rgba(255,180,80,.6));">'
    +'<img class="decor-img" src="assets/common_spider_web.png" alt="" style="right:0;top:0;width:110px;opacity:.5;">';
  if(keys>=requiredRooms&&!finalDone()){
    h+='<div class="finale"><div class="em">🤸✨</div><h2>협동 미션에 도전할 수 있어요!</h2><p>강당에 모여 단체줄넘기 20개에 도전해보세요.</p></div>';
  }
  if(keys>=requiredRooms&&finalDone()){
    h+='<div class="finale"><div class="em">🎉🏆✨</div><h2>모든 미션 완료!</h2><p>정말 대단해요! 우리 조가 방탈출에 성공했어요.</p></div>';
  }
  h+='<div class="stage"><div class="side-panel">';
  h+='<div class="wood-sign-wrap"><img class="wood-sign-img" src="assets/prop_wooden_sign.png" alt=""><span class="wood-sign-label">방탈출 놀이</span></div>';
  h+='<div class="hero-sub">저주받은<br>지도</div>';
  h+='<div class="key-row">';
  for(let i=0;i<requiredRooms;i++)h+='<img class="key-icon'+(i<keys?"":" off")+'" src="assets/common_key.png" alt="">';
  h+='</div>';
  h+='<div class="note-box">'+keys+' / '+requiredRooms+' 조각 모음<br><span class="sub">'+requiredRooms+'개 방 + 강당 미션 완료 시 성공</span></div>';
  h+='<img class="scan-btn-img" src="assets/button_qr_scan.png" alt="QR 스캔하기" onclick="openScan()">';
  h+='<div class="team-switch" onclick="switchTeam()">다른 조 선택</div>';
  h+='</div>';
  const active=activeRoomId();
  h+='<div class="room-grid-3col">';
  ROOMS.forEach(r=>{
    const p=roomProgress(r.id),done=p===8;
    const locked=!done&&active&&active!==r.id;
    let extra="";
    if(locked){
      const activeRoom=ROOMS.find(x=>x.id===active);
      extra='<div class="lock-msg">🔒 '+activeRoom.name+' 먼저 끝내세요</div>';
    }else if(!done){
      const roomQids=QUESTIONS[r.id].map(x=>x.qid);
      const nextQid=roomQids[p];
      if(unlocked[nextQid]){
        extra='<button class="btn btn-green" style="width:100%;margin-top:6px;padding:6px;font-size:10.5px;font-weight:800;" onclick="event.stopPropagation();openUnlocked(\''+nextQid+'\')">🔓 선생님이 열어주셨어요!</button>';
      }else if(helpRequest&&helpRequest.qid===nextQid){
        extra='<div style="margin-top:6px;font-size:10px;color:var(--gs-gold);font-weight:800;">🙋 요청함 · 기다려주세요<br><span style="text-decoration:underline;cursor:pointer;color:var(--gs-lilac);font-weight:600;" onclick="event.stopPropagation();cancelHelp()">요청 취소</span></div>';
      }else{
        extra='<div style="margin-top:6px;font-size:10px;color:var(--gs-lilac);text-decoration:underline;cursor:pointer;" onclick="event.stopPropagation();requestHelp(\''+r.id+'\')">🙋 QR을 못 찾겠어요</div>';
      }
    }
    h+='<div class="room-card'+(done?" done":"")+(locked?" locked":"")+'" onclick="openRoomDetail(\''+r.id+'\')"><div class="room-emoji"><img src="assets/'+ROOM_ICON[r.id]+'" alt=""></div>'
      +'<div class="room-name">'+r.name+"</div>"
      +'<div class="room-prog">'+(done?"✅ 완료!":p+" / 8")+"</div>"
      +'<div class="room-bar"><div class="room-bar-f" style="width:'+(p/8*100)+'%"></div></div>'+extra+'</div>';
  });
  const fd=finalDone();
  let finalExtra="";
  if(!fd){
    if(unlocked["R6Q1"]){
      finalExtra='<button class="btn btn-green" style="width:100%;margin-top:6px;padding:6px;font-size:10.5px;font-weight:800;" onclick="event.stopPropagation();openUnlocked(\'R6Q1\')">🔓 선생님이 열어주셨어요!</button>';
    }else if(helpRequest&&helpRequest.qid==="R6Q1"){
      finalExtra='<div style="margin-top:6px;font-size:10px;color:var(--gs-gold);font-weight:800;">🙋 요청함 · 기다려주세요<br><span style="text-decoration:underline;cursor:pointer;color:var(--gs-lilac);font-weight:600;" onclick="event.stopPropagation();cancelHelp()">요청 취소</span></div>';
    }
  }
  h+='<div class="final-card'+(fd?" done":"")+'" onclick="openFinalMission()"><div class="room-emoji"><img src="assets/'+FINAL_ROOM_ICON+'" alt=""></div>'
    +'<div class="room-name">협동 미션 · 강당 단체줄넘기 20개</div>'
    +'<div class="room-prog">'+(fd?"✅ 완료!":"터치해서 도전하기")+'</div>'+finalExtra+'</div>';
  h+='</div></div>';
  app.innerHTML=h;
  if(pendingCelebration){pendingCelebration=false;showCelebration();}
}
```

Note what changed vs. the old function: the floating `.scan-fab` button and the bottom `<div style="height:90px"></div>` spacer are gone (the QR button now lives inline in the side panel, so no floating overlay or bottom-padding hack is needed); `team-switch` moved into the side panel; the emoji-chip `.keys-bar` was replaced with the `.key-row`/`.note-box` pattern already used by `renderRoomDetail()`/`showCelebration()` (same classes, no new CSS needed for those two); the 5 room cards plus the final card now sit in `.room-grid-3col` instead of the old 2-column `.room-grid`. All game-state logic (locked/help-request/unlocked-button branches, `pendingCelebration` trigger) is byte-identical to before — only the surrounding layout markup changed.

- [ ] **Step 3: Verify**

- `grep -n "keys-bar\|scan-fab" index.html` — should return nothing (both fully retired).
- `grep -c "room-grid-3col" index.html` — should be ≥2 (one CSS rule, one usage in the new markup; likely 3 counting the media-query override).
- Confirm `ROOM_ICON`, `FINAL_ROOM_ICON` are still only defined once each (this task doesn't touch their definitions, only consumes them).
- `node --test scripts/roster-utils.test.js` — 26/26.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: rework home screen into the two-column stage layout"
```

---

### Task 11: Fix batch from the final whole-branch review

**Files:**
- Modify: `index.html` — the `<style>` block (4 small rule edits) and `showCelebration()`, `showGradeGate()`, `showQuestionScreen()` (one small edit each)

**Interfaces:** No new classes or helpers — every change here is either a CSS property tweak on an existing rule or a one-line JS/markup fix inside an existing function. No signatures change.

- [ ] **Step 1: Fix the celebration overlay getting stuck un-dismissable on short viewports**

Find:

```css
#studentRoot .celebrate-ov{position:fixed;inset:0;z-index:250;display:flex;align-items:center;justify-content:center;padding:24px;background-image:linear-gradient(180deg,rgba(16,10,32,.45),rgba(16,10,32,.85)),url('assets/background_mission_select.png');background-size:cover,cover;background-position:center,center;background-repeat:no-repeat,no-repeat;}
#studentRoot .celebrate-inner{display:flex;gap:32px;flex-wrap:wrap;align-items:center;justify-content:center;max-width:900px;}
```

Replace with:

```css
#studentRoot .celebrate-ov{position:fixed;inset:0;z-index:250;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px;background-image:linear-gradient(180deg,rgba(16,10,32,.45),rgba(16,10,32,.85)),url('assets/background_mission_select.png');background-size:cover,cover;background-position:center,center;background-repeat:no-repeat,no-repeat;}
#studentRoot .celebrate-inner{display:flex;gap:32px;flex-wrap:wrap;align-items:center;justify-content:center;max-width:900px;margin:auto;}
```

(`overflow-y:auto` lets a student scroll to reach the "확인" button when the two-column content is taller than the viewport; `margin:auto` on the inner block keeps it centered when it already fits.)

Also find:

```css
#studentRoot .modal-ov{position:fixed;inset:0;background:rgba(5,3,12,.75);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;}
```

Replace with:

```css
#studentRoot .modal-ov{position:fixed;inset:0;background:rgba(5,3,12,.75);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;}
```

(same cheap hardening for the smaller info modals, in case a very long message ever appears on a very short viewport)

- [ ] **Step 2: Fix decorative sprite images painting above card content instead of behind it**

Find:

```css
#studentRoot .decor-img{position:fixed;z-index:0;pointer-events:none;}
```

Replace with:

```css
#studentRoot .decor-img{position:fixed;z-index:-1;pointer-events:none;}
```

- [ ] **Step 3: Center the question-answering parchment frame on wide viewports**

Find:

```css
#studentRoot .parchment-frame{flex:1 1 380px;max-width:520px;background-image:linear-gradient(180deg,rgba(20,14,32,.15),rgba(20,14,32,.15)),url('assets/background_problem_frame.png');background-size:100% 100%,100% 100%;background-repeat:no-repeat,no-repeat;padding:9% 10% 10%;box-sizing:border-box;}
```

Replace with:

```css
#studentRoot .parchment-frame{flex:1 1 380px;max-width:520px;margin:0 auto;background-image:linear-gradient(180deg,rgba(20,14,32,.15),rgba(20,14,32,.15)),url('assets/background_problem_frame.png');background-size:100% 100%,100% 100%;background-repeat:no-repeat,no-repeat;padding:9% 10% 10%;box-sizing:border-box;}
```

(as a flex item inside `.room-detail-layout` this is harmless; as a plain block child of `.wrap` in `showQuestionScreen()`, `margin:0 auto` is what actually centers it — that's the screen this fix targets.)

- [ ] **Step 4: Make the question screen's locked state use the same lock icon as the room-locked screen**

Find (inside `showQuestionScreen()`):

```js
  if(mode==="locked"){
    h+='<div class="center-icon">🔒</div><div class="fb-box fb-lock">아직 열 수 없어요!<br>이 방은 순서대로 풀어야 해요.<br>지금 풀어야 할 문제: <b>'+requiredQid+"</b></div>";
```

Replace with:

```js
  if(mode==="locked"){
    h+='<div class="fb-box fb-lock"><img src="assets/status_locked.png" alt="">아직 열 수 없어요!<br>이 방은 순서대로 풀어야 해요.<br>지금 풀어야 할 문제: <b>'+requiredQid+"</b></div>";
```

(drops the `.center-icon` 🔒 emoji in favor of the `status_locked.png` icon inside the `fb-box` itself, matching `showRoomLockedScreen()`'s pattern — `.fb-box img` is already styled from Task 1.)

- [ ] **Step 5: Restore the peer-help notice's purple tint on the grade-gate screen**

Find (inside `showGradeGate()`):

```js
  if(helpStudent){
    h+='<div class="grade-warn" style="margin-top:8px;text-align:center;line-height:1.6;">🤝 '+escapeHtml(helpStudent.name)+' 친구는 같은 학년이나 한 학년 위 친구가 도와줘도 좋아요. 함께 풀어보세요!</div>';
  }
```

Replace with:

```js
  if(helpStudent){
    h+='<div class="grade-warn" style="margin-top:8px;text-align:center;line-height:1.6;background:rgba(120,90,200,.14);border-color:rgba(160,120,220,.4);">🤝 '+escapeHtml(helpStudent.name)+' 친구는 같은 학년이나 한 학년 위 친구가 도와줘도 좋아요. 함께 풀어보세요!</div>';
  }
```

- [ ] **Step 6: Scope the celebration screen's "푼 문제" ratio to rooms the team actually attempted**

Find (inside `showCelebration()`):

```js
  const solvedCount=Object.values(QUESTIONS).flat().filter(q=>solvedIds[q.qid]).length;
  const totalQ=Object.values(QUESTIONS).flat().length;
  const roomsDone=ROOMS.filter(r=>roomProgress(r.id)===8).length;
```

Replace with:

```js
  const touchedRoomIds=ROOMS.filter(r=>roomProgress(r.id)>0).map(r=>r.id);
  const solvedCount=touchedRoomIds.reduce((sum,rid)=>sum+roomProgress(rid),0)+(solvedIds["R6Q1"]?1:0);
  const totalQ=touchedRoomIds.reduce((sum,rid)=>sum+QUESTIONS[rid].length,0)+QUESTIONS.R6.length;
  const roomsDone=ROOMS.filter(r=>roomProgress(r.id)===8).length;
```

(previously `totalQ` was always 41 — every question in every room, including the 2+ rooms a team with `requiredRooms=3` never had to open — which made a full, successful clear read as an incomplete-looking "25/41" on the victory screen. Scoping to only the rooms the team has any progress in keeps the ratio honest without changing what counts as "success.")

- [ ] **Step 7: Verify**

- `grep -n "center-icon.*🔒" index.html` — should return nothing (the one locked-state emoji this task removes).
- `node --test scripts/roster-utils.test.js` — 26/26.
- These are CSS/string-literal-only changes with no control-flow changes — confirm by re-reading each diff hunk that only the string/property values changed, not any `if`/`return`/function signature.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "fix: address celebration overflow, decor stacking, locked-icon, centering, and stat-scope issues from final review"
```
