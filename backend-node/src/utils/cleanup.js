export function zeroAndDropFileRefs(files = {}) {
  const keys = Object.keys(files)
  for (const key of keys) {
    for (const item of files[key] || []) {
      if (item?.buffer && typeof item.buffer.fill === 'function') {
        item.buffer.fill(0)
      }
    }
    files[key] = []
  }
}
