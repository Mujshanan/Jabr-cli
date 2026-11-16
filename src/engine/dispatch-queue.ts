/**
 * Serializes asynchronous command execution while allowing later commands to run
 * even if an earlier task rejects.
 */
export function createDispatchQueue(): (task: () => Promise<void>) => Promise<void> {
  let tail: Promise<void> = Promise.resolve();

  return (task) => {
    const result = tail.then(task);
    // Keep the internal chain alive; the caller still receives the original rejection.
    tail = result.catch(() => undefined);
    return result;
  };
}
