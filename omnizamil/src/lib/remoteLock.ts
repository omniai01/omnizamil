let processingBlocked = false;

export function setProcessingBlocked(v: boolean) {
  processingBlocked = v;
}

export function isProcessingBlocked() {
  return processingBlocked;
}
