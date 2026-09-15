/**
 * #441: 기기에 쌓인 양을 사람이 읽는 말로 바꾼다. 문서를 지울 수 있게 됐으니
 * "무엇을 지우면 얼마가 도는지"를 같은 자리에서 보여 줘야 한다.
 */

const UNITS = [
  { at: 1024 ** 3, tail: "GB" },
  { at: 1024 ** 2, tail: "MB" },
  { at: 1024, tail: "KB" },
];

/** 1.2GB·340MB·12KB — 큰 단위는 소수 한 자리까지만. */
export function formatBytes(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) {
    return "0KB";
  }
  for (const unit of UNITS) {
    if (size >= unit.at) {
      const value = size / unit.at;
      const shown = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
      return `${shown}${unit.tail}`;
    }
  }
  return "1KB 미만";
}

export const STORAGE_TIGHT_RATIO = 0.9;

/**
 * 저장 공간 한 줄. 남은 양을 말할 수 없는 브라우저(estimate가 없거나 quota를
 * 안 주는 사파리)에서는 쓴 양만 말한다. 아무것도 모르면 null — 줄을 감춘다.
 */
export function storageNote(estimate) {
  const usage = Number(estimate?.usage);
  const quota = Number(estimate?.quota);
  const hasUsage = Number.isFinite(usage) && usage >= 0;
  const hasQuota = Number.isFinite(quota) && quota > 0;
  if (!hasUsage && !hasQuota) {
    return null;
  }
  if (!hasQuota) {
    return { text: `이 기기에 ${formatBytes(usage)} 씀`, tight: false };
  }
  const left = Math.max(0, quota - (hasUsage ? usage : 0));
  const ratio = hasUsage ? usage / quota : 0;
  const tight = ratio >= STORAGE_TIGHT_RATIO;
  return {
    text: `이 기기에 ${formatBytes(usage)} 씀 · ${formatBytes(left)} 남음`,
    tight,
  };
}

/** 카드에 붙는 문서 크기. 0이거나 모르면 빈 문자열이라 줄이 생기지 않는다. */
export function documentSizeNote(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) {
    return "";
  }
  return formatBytes(size);
}
