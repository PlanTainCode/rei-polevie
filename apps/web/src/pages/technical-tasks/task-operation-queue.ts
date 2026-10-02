/** Сохраняем снимки формы и генерируем XML в порядке запросов пользователя. */
export function createTaskOperationQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail.catch(() => undefined).then(operation);
    tail = result;
    return result;
  };
}
