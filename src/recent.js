/** Upload-screen recent cards. Same name twice must not read the same (#86). */

export function recentTitle(fileName) {
  return (fileName || "문서.pdf").replace(/\.pdf$/i, "") || "문서";
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Local time only. Today shows the clock, older days show the date. */
export function recentTimeNote(openedAt, now = Date.now()) {
  const at = new Date(Number(openedAt) || 0);
  if (!Number.isFinite(at.getTime()) || !Number(openedAt)) {
    return "";
  }
  const today = new Date(Number(now) || Date.now());
  const clock = `${pad2(at.getHours())}:${pad2(at.getMinutes())}`;
  if (sameDay(at, today)) {
    return clock;
  }
  return `${at.getMonth() + 1}월 ${at.getDate()}일 ${clock}`;
}

/**
 * Cards keep the plain name when it is unique. Only a repeated name gets the
 * opened time appended, and a repeated time falls back to the page number.
 */
export function recentCardEntries(rows, now = Date.now()) {
  const list = (rows || []).filter((row) => row?.identity);
  const counts = new Map();
  for (const row of list) {
    const title = recentTitle(row.name);
    counts.set(title, (counts.get(title) || 0) + 1);
  }
  const usedNotes = new Map();
  return list.map((row) => {
    const title = recentTitle(row.name);
    if ((counts.get(title) || 0) < 2) {
      return { identity: row.identity, title, note: "" };
    }
    let note = recentTimeNote(row.openedAt, now);
    const key = `${title}::${note}`;
    if (note && usedNotes.has(key)) {
      note = `${note} · ${Math.max(1, Number(row.page) || 1)}쪽`;
    } else if (note) {
      usedNotes.set(key, true);
    }
    return { identity: row.identity, title, note };
  });
}
