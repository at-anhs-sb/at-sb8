const CLUB_ID = "anime-team-3";
const CLUB_FOUNDED_FALLBACK = new Date("2008-11-13T00:00:00Z").getTime();
const MEMBERS_FALLBACK_TEXT = "10,000+";

const LINKS = [
  { name: "Club Home", url: "https://www.chess.com/club/anime-team-3", ico: "♞" },
  { name: "Daily Matches", url: "https://www.chess.com/clubs/matches/anime-team-3", ico: "⚔" },
  { name: "Club Events", url: "https://www.chess.com/clubs/events/anime-team-3", ico: "★" },
  { name: "Forums", url: "https://www.chess.com/clubs/forum/anime-team-3", ico: "✎" },
];

// Current live roster (Super Admins + Admins) with fallback avatars, in case the
// live player-profile fetch is blocked by the browser's CORS policy.
const ROSTER = [
  {
    user: "crayon",
    role: "Owner",
    super: true,
    avatar: "https://images.chesscomfiles.com/uploads/v1/user/240765061.e9ef2616.48x48o.a6281549872c.jpg"
  },
  {
    user: "DannyBoy_Guling",
    role: "Co-Owner",
    super: true,
    avatar: "https://images.chesscomfiles.com/uploads/v1/user/366282397.3fc7b30d.48x48o.f3de841c4267.jpg"
  },
  {
    user: "Sokatsui_888",
    role: "Super Admin",
    super: true,
    avatar: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg"
  },
  {
    user: "Jared",
    role: "Super Admin",
    super: true,
    avatar: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg"
  },
  {
    user: "Karla",
    role: "Super Admin",
    super: true,
    avatar: "https://images.chesscomfiles.com/uploads/v1/user/307091831.750abcab.48x48o.60242e229690.jpg"
  },
  {
    user: "cello_jello",
    role: "Admin",
    super: false,
    avatar: "https://images.chesscomfiles.com/uploads/v1/user/349443015.24f8fe7c.48x48o.8bd82970adcc.jpg"
  },
  {
    user: "Dig1talNinja",
    role: "Admin",
    super: false,
    avatar: "https://images.chesscomfiles.com/uploads/v1/user/387057865.96255193.48x48o.498fc9044775.jpg"
  },
  {
    user: "babychessme",
    role: "Admin",
    super: false,
    avatar: "https://images.chesscomfiles.com/uploads/v1/user/408048591.09d37640.48x48o.1e69af707044.jpg"
  },
  {
    user: "Iamplayerofchess",
    role: "Admin",
    super: false,
    avatar: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg"
  },
  {
    user: "Tengen",
    role: "Admin",
    super: false,
    avatar: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg"
  }
];

let clubFounded = CLUB_FOUNDED_FALLBACK;
let livePlayers = {}; // username(lower) -> {avatar, title, name, url}
let cardIndex = 0;

let events = [];
let matchesLoaded = false;
let calViewDate = new Date();
calViewDate.setDate(1);

let memberPool = [];
let lastSpotlightUser = null;
let selectedDate = null; // { year, month, day } for calendar day filtering

function fetchWithTimeout(url, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
}

function relativeTime(unixSeconds) {
  const diff = Math.max(0, Date.now() / 1000 - unixSeconds);
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

async function loadClub() {
  try {
    const res = await fetchWithTimeout(
      `https://api.chess.com/pub/club/${CLUB_ID}`
    );

    if (!res.ok) throw new Error("bad status");

    const data = await res.json();

    if (typeof data.members_count === "number") {
      document.getElementById("memberCount").textContent =
        data.members_count.toLocaleString();
    } else {
      document.getElementById("memberCount").textContent =
        MEMBERS_FALLBACK_TEXT;
    }

    if (data.created) clubFounded = data.created * 1000;

    if (data.icon) {
      document.getElementById("clubIcon").src = data.icon;
    }
  } catch (e) {
    document.getElementById("memberCount").textContent =
      MEMBERS_FALLBACK_TEXT;
  }
}

async function loadNewestMembers() {
  const listEl = document.getElementById("newestList");

  try {
    const res = await fetchWithTimeout(
      `https://api.chess.com/pub/club/${CLUB_ID}/members`
    );

    if (!res.ok) throw new Error("bad status");

    const data = await res.json();

    const all = [
      ...(data.weekly || []),
      ...(data.monthly || []),
      ...(data.all_time || [])
    ];

    const byUser = {};

    all.forEach(m => {
      if (
        !byUser[m.username] ||
        m.joined > byUser[m.username].joined
      ) {
        byUser[m.username] = m;
      }
    });

    memberPool = Object.values(byUser);

    const newest = memberPool
      .slice()
      .sort((a, b) => b.joined - a.joined)
      .slice(0, 3);

    if (!newest.length) {
      throw new Error("no members returned");
    }

    listEl.innerHTML = "";

    for (const m of newest) {
      const row = document.createElement("a");

      row.className = "newest-row";
      row.href = `https://www.chess.com/member/${m.username}`;
      row.target = "_blank";
      row.rel = "noopener";

      row.innerHTML = `
        <img
          src="https://www.chess.com/bundles/web/images/user-image.007dad08.svg"
          alt=""
        >
        <span class="nname">${m.username}</span>
        <span class="njoined">${relativeTime(m.joined)}</span>
      `;

      listEl.appendChild(row);

      fetchWithTimeout(
        `https://api.chess.com/pub/player/${m.username.toLowerCase()}`
      )
        .then(r => r.ok ? r.json() : null)
        .then(p => {
          if (p && p.avatar) {
            row.querySelector("img").src = p.avatar;
          }
        })
        .catch(() => {});
    }
  } catch (e) {
    listEl.innerHTML = `
      <div class="newest-empty">
        Live member list unavailable right now — the Chess.com API is blocking this request.
      </div>
    `;
  }

  pickSpotlight();
}

async function loadPlayers() {
  const results = await Promise.allSettled(
    ROSTER.map(m =>
      fetchWithTimeout(
        `https://api.chess.com/pub/player/${m.user.toLowerCase()}`
      ).then(r => r.ok ? r.json() : null)
    )
  );

  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value) {
      livePlayers[ROSTER[i].user.toLowerCase()] = r.value;
    }
  });

  renderCard();
}

// ---- Matches / Calendar ----

function extractIdFromApiUrl(u) {
  if (!u) return null;
  return u.split("/").pop();
}

async function loadMatches() {
  if (matchesLoaded) return;

  matchesLoaded = true;

  try {
    const res = await fetchWithTimeout(
      `https://api.chess.com/pub/club/${CLUB_ID}/matches`
    );

    if (!res.ok) throw new Error("bad status");

    const data = await res.json();

    const inProgress = (data.in_progress || []).map(m => ({
      ...m,
      status: "In Progress"
    }));

    const registered = (data.registered || []).map(m => ({
      ...m,
      status: "Registered"
    }));

    const candidates = [
      ...inProgress,
      ...registered
    ].slice(0, 10);

    const details = await Promise.allSettled(
      candidates.map(m => {
        const id =
          extractIdFromApiUrl(m["@id"]) ||
          (m.url ? m.url.split("/").pop() : null);

        return id
          ? fetchWithTimeout(
              `https://api.chess.com/pub/match/${id}`
            ).then(r => r.ok ? r.json() : null)
          : Promise.resolve(null);
      })
    );

    events = [];

    details.forEach((r, i) => {
      const c = candidates[i];
      const val = r.status === "fulfilled" ? r.value : null;

      const ts = val && (val.start_time || c.start_time);

      if (!ts) return;

      const id = extractIdFromApiUrl(c["@id"]);

      const isLive =
        c.time_class &&
        c.time_class !== "daily";

      const fallbackUrl = id
        ? `https://www.chess.com/club/matches/${isLive ? "live/" : ""}${id}`
        : "https://www.chess.com/club/matches/anime-team-3";

      events.push({
        date: new Date(ts * 1000),
        name: c.name,
        status: c.status,
        url: (val && val.url) || fallbackUrl
      });
    });

    events.sort((a, b) => a.date - b.date);

  } catch (e) {
    events = [];
  }

  updateMatchBadge();
  renderCalendarGrid();
  renderAgenda();
}

function updateMatchBadge() {
  const badge = document.getElementById("matchBadge");

  const upcoming = events.filter(
    e => e.date.getTime() >= Date.now() - 86400000
  );

  if (upcoming.length) {
    badge.style.display = "inline-block";
    badge.textContent = upcoming.length;
  } else {
    badge.style.display = "none";
  }
}

function renderCalendarGrid() {
  const grid = document.getElementById("calGrid");
  const label = document.getElementById("calMonthLabel");

  const year = calViewDate.getFullYear();
  const month = calViewDate.getMonth();

  label.textContent = calViewDate.toLocaleString(
    "default",
    {
      month: "long",
      year: "numeric"
    }
  );

  grid.innerHTML = "";

  ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].forEach(d => {
    const el = document.createElement("div");

    el.className = "cal-weekday";
    el.textContent = d;

    grid.appendChild(el);
  });

  const firstDay =
    new Date(year, month, 1).getDay();

  const daysInMonth =
    new Date(year, month + 1, 0).getDate();

  const today = new Date();

  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement("div");

    el.className = "cal-day empty";

    grid.appendChild(el);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const el = document.createElement("div");

    el.className = "cal-day";

    const isToday =
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === d;

    if (isToday) {
      el.classList.add("today");
    }

    const dayEvents = events.filter(e =>
      e.date.getFullYear() === year &&
      e.date.getMonth() === month &&
      e.date.getDate() === d
    );

    if (dayEvents.length) {
      el.classList.add("has-event");
    }

    if (
      selectedDate &&
      selectedDate.year === year &&
      selectedDate.month === month &&
      selectedDate.day === d
    ) {
      el.classList.add("selected");
    }

    const numEl = document.createElement("span");

    numEl.className = "day-num";
    numEl.textContent = d;

    el.appendChild(numEl);

    dayEvents.slice(0, 2).forEach(e => {
      const chip = document.createElement("a");

      chip.className = "evt-chip";
      chip.href = e.url;
      chip.target = "_blank";
      chip.rel = "noopener";
      chip.title = e.name;
      chip.textContent = e.name;

      chip.addEventListener("click", ev =>
        ev.stopPropagation()
      );

      el.appendChild(chip);
    });

    if (dayEvents.length > 2) {
      const more = document.createElement("span");

      more.className = "evt-more";
      more.textContent =
        `+${dayEvents.length - 2} more`;

      el.appendChild(more);
    }

    el.addEventListener("click", () => {
      if (
        selectedDate &&
        selectedDate.year === year &&
        selectedDate.month === month &&
        selectedDate.day === d
      ) {
        selectedDate = null;
      } else {
        selectedDate = {
          year,
          month,
          day: d
        };
      }

      renderCalendarGrid();
      renderAgenda();
    });

    grid.appendChild(el);
  }
}

function renderAgenda() {
  const wrap = document.getElementById("agendaList");
  const filterBar = document.getElementById("agendaFilter");
  const filterLabel =
    document.getElementById("agendaFilterLabel");

  let list = events;

  if (selectedDate) {
    list = events.filter(e =>
      e.date.getFullYear() === selectedDate.year &&
      e.date.getMonth() === selectedDate.month &&
      e.date.getDate() === selectedDate.day
    );

    filterBar.classList.remove("hidden");

    const labelDate = new Date(
      selectedDate.year,
      selectedDate.month,
      selectedDate.day
    );

    filterLabel.textContent =
      "Matches on " +
      labelDate.toLocaleDateString(
        undefined,
        {
          month: "short",
          day: "numeric"
        }
      );
  } else {
    filterBar.classList.add("hidden");
  }

  if (!events.length) {
    wrap.innerHTML = `
      <div class="newest-empty">
        No scheduled matches found right now.
      </div>
    `;

    return;
  }

  if (!list.length) {
    wrap.innerHTML = `
      <div class="newest-empty">
        No matches on this day.
      </div>
    `;

    return;
  }

  wrap.innerHTML = "";

  list.slice(0, 8).forEach(e => {
    const a = document.createElement("a");

    a.className = "agenda-item";
    a.href = e.url;
    a.target = "_blank";
    a.rel = "noopener";

    const dateStr =
      e.date.toLocaleDateString(
        undefined,
        {
          month: "short",
          day: "numeric"
        }
      ) +
      " · " +
      e.date.toLocaleTimeString(
        undefined,
        {
          hour: "numeric",
          minute: "2-digit"
        }
      );

    a.innerHTML = `
      <div class="agenda-top">
        <span class="agenda-name">${e.name}</span>
        <span class="agenda-badge">${e.status}</span>
      </div>
      <div class="agenda-date">${dateStr}</div>
    `;

    wrap.appendChild(a);
  });
}

// ---- Member spotlight ----

function pickSpotlight() {
  if (!memberPool.length) {
    document.getElementById("spotlightName").textContent =
      "No members found";

    document.getElementById("spotlightMeta").textContent = "";

    return;
  }

  let pick =
    memberPool[
      Math.floor(Math.random() * memberPool.length)
    ];

  if (memberPool.length > 1) {
    while (pick.username === lastSpotlightUser) {
      pick =
        memberPool[
          Math.floor(Math.random() * memberPool.length)
        ];
    }
  }

  lastSpotlightUser = pick.username;

  renderSpotlight(pick);
}

async function renderSpotlight(pick) {
  document.getElementById("spotlightName").textContent =
    pick.username;

  document.getElementById("spotlightMeta").textContent =
    `Joined ${relativeTime(pick.joined)}`;

  document.getElementById("spotlightAvatar").src =
    "https://www.chess.com/bundles/web/images/user-image.007dad08.svg";

  document.getElementById("spotlightLink").href =
    `https://www.chess.com/member/${pick.username}`;

  try {
    const res = await fetchWithTimeout(
      `https://api.chess.com/pub/player/${pick.username.toLowerCase()}`
    );

    if (res.ok) {
      const p = await res.json();

      if (p.avatar) {
        document.getElementById("spotlightAvatar").src =
          p.avatar;
      }

      let bits = [
        `Joined ${relativeTime(pick.joined)}`
      ];

      if (p.title) bits.unshift(p.title);
      if (p.league) bits.push(p.league);

      document.getElementById("spotlightMeta").textContent =
        bits.join(" · ");
    }
  } catch (e) {
    // Keep fallback avatar/meta
  }
}

document.getElementById("shuffleBtn").addEventListener(
  "click",
  ev => {
    ev.currentTarget.classList.remove("spinning");

    void ev.currentTarget.offsetWidth;

    ev.currentTarget.classList.add("spinning");

    pickSpotlight();
  }
);

// ---- Club match record ----

async function loadClubRecord() {
  const figEl =
    document.getElementById("recordFigures");

  try {
    const res = await fetchWithTimeout(
      `https://api.chess.com/pub/club/${CLUB_ID}/matches`
    );

    if (!res.ok) {
      throw new Error("bad status");
    }

    const data = await res.json();

    const finished = data.finished || [];

    if (!finished.length) {
      throw new Error("no finished matches");
    }

    let w = 0;
    let l = 0;
    let d = 0;

    finished.forEach(m => {
      if (m.result === "win") {
        w++;
      } else if (m.result === "lose") {
        l++;
      } else if (m.result) {
        d++;
      }
    });

    const total = w + l + d;

    if (!total) {
      throw new Error("no usable results");
    }

    figEl.innerHTML = `
      <span class="w">${w}W</span> ·
      <span class="l">${l}L</span> ·
      <span class="d">${d}D</span>
    `;

    document.getElementById("segW").style.width =
      (w / total * 100) + "%";

    document.getElementById("segL").style.width =
      (l / total * 100) + "%";

    document.getElementById("segD").style.width =
      (d / total * 100) + "%";

  } catch (e) {
    figEl.textContent = "Unavailable";

    document.getElementById("recordBar").style.display =
      "none";
  }
}

// ---- Member search ----

async function handleMemberSearch() {
  const input =
    document.getElementById("memberSearchInput");

  const btn =
    document.getElementById("memberSearchBtn");

  const feedback =
    document.getElementById("searchFeedback");

  const name = input.value.trim();

  if (!name) return;

  btn.disabled = true;
  btn.textContent = "…";

  feedback.textContent = "";
  feedback.className = "search-feedback";

  try {
    const res = await fetchWithTimeout(
      `https://api.chess.com/pub/player/${encodeURIComponent(
        name.toLowerCase()
      )}`
    );

    if (res.ok) {
      const p = await res.json();

      feedback.textContent =
        `Found ${p.username} — opening profile…`;

      feedback.className =
        "search-feedback ok";

      window.open(
        `https://www.chess.com/member/${p.username}`,
        "_blank",
        "noopener"
      );

      input.value = "";
    } else {
      feedback.textContent =
        `No member named "${name}" found.`;
    }

  } catch (e) {
    feedback.textContent =
      "Couldn't check that name right now — try again in a moment.";
  }

  btn.disabled = false;
  btn.textContent = "Go";
}

document.getElementById(
  "memberSearchBtn"
).addEventListener(
  "click",
  handleMemberSearch
);

document.getElementById(
  "memberSearchInput"
).addEventListener(
  "keydown",
  ev => {
    if (ev.key === "Enter") {
      handleMemberSearch();
    }
  }
);

function tickClubAge() {
  const now = Date.now();

  let diff =
    Math.max(0, now - clubFounded);

  const s =
    Math.floor(diff / 1000) % 60;

  const m =
    Math.floor(diff / 60000) % 60;

  const h =
    Math.floor(diff / 3600000) % 24;

  const totalDays =
    Math.floor(diff / 86400000);

  const years =
    Math.floor(totalDays / 365);

  const days =
    totalDays % 365;

  document.getElementById("clubAge").innerHTML =
    `${years}y ${days}d<br>${h}h ${m}m ${s}s`;
}

function renderLinks() {
  const wrap =
    document.getElementById("linksList");

  wrap.innerHTML = "";

  LINKS.forEach(l => {
    const a = document.createElement("a");

    a.className = "link-btn";
    a.href = l.url;
    a.target = "_blank";
    a.rel = "noopener";

    a.innerHTML = `
      <span class="lname">
        <span class="ico">${l.ico}</span>
        ${l.name}
      </span>
      <span class="arrow">→</span>
    `;

    wrap.appendChild(a);
  });
}

function renderCard() {
  const m = ROSTER[cardIndex];

  const live =
    livePlayers[m.user.toLowerCase()];

  document.getElementById("cardAvatar").src =
    (live && live.avatar)
      ? live.avatar
      : m.avatar;

  document.getElementById("cardName").textContent =
    (live && live.username)
      ? live.username
      : m.user;

  const roleEl =
    document.getElementById("cardRole");

  roleEl.textContent = m.role;

  roleEl.className =
    "role" + (m.super ? " super" : "");

  const metaEl =
    document.getElementById("cardMeta");

  let bits = [];

  if (live && live.title) {
    bits.push(live.title);
  }

  if (live && live.followers) {
    bits.push(
      live.followers.toLocaleString() +
      " followers"
    );
  }

  if (live && live.league) {
    bits.push(live.league);
  }

  metaEl.textContent =
    bits.join(" · ");

  document.getElementById("cardLink").href =
    `https://www.chess.com/member/${m.user}`;

  document.getElementById("cardIndex").textContent =
    `${cardIndex + 1} / ${ROSTER.length}`;
}

async function loadTrendingAnime() {
  const list =
    document.getElementById("animeList");

  if (!list) {
    console.error(
      "animeList element not found"
    );

    return;
  }

  list.innerHTML = `
    <div class="anime-loading">
      Loading trending anime...
    </div>
  `;

  const query = `
    query {
      Page(page: 1, perPage: 8) {
        media(
          type: ANIME
          sort: TRENDING_DESC
        ) {
          title {
            romaji
            english
          }

          coverImage {
            extraLarge
          }

          averageScore
          siteUrl
        }
      }
    }
  `;

  try {
    const res = await fetch(
      "https://graphql.anilist.co",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },

        body: JSON.stringify({
          query: query
        })
      }
    );

    if (!res.ok) {
      throw new Error(
        `AniList HTTP ${res.status}`
      );
    }

    const json = await res.json();

    console.log(
      "AniList response:",
      json
    );

    if (json.errors) {
      console.error(
        "AniList GraphQL errors:",
        json.errors
      );

      throw new Error(
        "AniList returned a GraphQL error"
      );
    }

    const anime =
      json?.data?.Page?.media;

    if (
      !Array.isArray(anime) ||
      anime.length === 0
    ) {
      throw new Error(
        "No trending anime returned"
      );
    }

    list.innerHTML = "";

    anime.slice(0, 6).forEach(
      (item, index) => {

        const title =
          item.title?.english ||
          item.title?.romaji ||
          "Unknown Anime";

        const card =
          document.createElement("a");

        card.className =
          "anime-card";

        card.href =
          item.siteUrl || "#";

        card.target = "_blank";
        card.rel =
          "noopener noreferrer";

        const score =
          item.averageScore
            ? (
                item.averageScore / 10
              ).toFixed(1)
            : "N/A";

        card.innerHTML = `
          <div class="anime-rank">
            #${index + 1}
          </div>

          <img
            class="anime-cover"
            src="${item.coverImage?.extraLarge || ""}"
            alt="${title.replace(/"/g, "&quot;")}"
            loading="lazy"
          >

          <div class="anime-info">

            <div class="anime-title">
              ${title}
            </div>

            <div class="anime-score">
              ⭐ ${score}
            </div>

          </div>
        `;

        list.appendChild(card);
      }
    );

  } catch (err) {

    console.error(
      "Trending anime failed:",
      err
    );

    list.innerHTML = `
      <div class="anime-loading">
        Unable to load trending anime right now.
      </div>
    `;
  }
}

document.getElementById(
  "prevBtn"
).addEventListener(
  "click",
  () => {
    cardIndex =
      (cardIndex - 1 + ROSTER.length) %
      ROSTER.length;

    renderCard();
  }
);

document.getElementById(
  "nextBtn"
).addEventListener(
  "click",
  () => {
    cardIndex =
      (cardIndex + 1) %
      ROSTER.length;

    renderCard();
  }
);

document.getElementById(
  "communityOpenBtn"
).addEventListener(
  "click",
  () => {
    document.getElementById(
      "pageMain"
    ).classList.add("hidden");

    document.getElementById(
      "pageCommunity"
    ).classList.remove("hidden");
  }
);

document.getElementById(
  "communityBackBtn"
).addEventListener(
  "click",
  () => {
    document.getElementById(
      "pageCommunity"
    ).classList.add("hidden");

    document.getElementById(
      "pageMain"
    ).classList.remove("hidden");
  }
);

document.getElementById(
  "calendarOpenBtn"
).addEventListener(
  "click",
  () => {
    document.getElementById(
      "pageMain"
    ).classList.add("hidden");

    document.getElementById(
      "pageCalendar"
    ).classList.remove("hidden");

    loadMatches();
  }
);

document.getElementById(
  "calBackBtn"
).addEventListener(
  "click",
  () => {
    document.getElementById(
      "pageCalendar"
    ).classList.add("hidden");

    document.getElementById(
      "pageMain"
    ).classList.remove("hidden");
  }
);

document.getElementById(
  "calPrevBtn"
).addEventListener(
  "click",
  () => {
    calViewDate.setMonth(
      calViewDate.getMonth() - 1
    );

    selectedDate = null;

    renderCalendarGrid();
    renderAgenda();
  }
);

document.getElementById(
  "calNextBtn"
).addEventListener(
  "click",
  () => {
    calViewDate.setMonth(
      calViewDate.getMonth() + 1
    );

    selectedDate = null;

    renderCalendarGrid();
    renderAgenda();
  }
);

document.getElementById(
  "agendaFilterClear"
).addEventListener(
  "click",
  () => {
    selectedDate = null;

    renderCalendarGrid();
    renderAgenda();
  }
);

let trendingAnimeLoaded = false;

document.getElementById(
  "trendingAnimeOpenBtn"
).addEventListener(
  "click",
  () => {

    console.log(
      "Opening Trending Anime"
    );

    document.getElementById(
      "pageCommunity"
    ).classList.add("hidden");

    document.getElementById(
      "pageTrendingAnime"
    ).classList.remove("hidden");

    if (!trendingAnimeLoaded) {
      trendingAnimeLoaded = true;
      loadTrendingAnime();
    }
  }
);

document.getElementById(
  "trendingAnimeBackBtn"
).addEventListener(
  "click",
  () => {

    console.log(
      "Going back to Community"
    );

    document.getElementById(
      "pageTrendingAnime"
    ).classList.add("hidden");

    document.getElementById(
      "pageCommunity"
    ).classList.remove("hidden");
  }
);

renderLinks();
renderCard();
renderCalendarGrid();

tickClubAge();

setInterval(
  tickClubAge,
  1000
);

loadClub();
loadNewestMembers();
loadPlayers();
loadMatches();
loadClubRecord();
