import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Coalesces a burst of values into one delivery per `ms`. `push` is trailing-
 * edge, so a stream of chunks costs one render per interval instead of one per
 * chunk; `flush` forces the value that is queued out immediately, which is what
 * keeps the last chunk of a finished stream from being dropped on the floor.
 */
export function coalesce<T>(ms: number, apply: (value: T) => void) {
  let latest: T;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const deliver = () => {
    timer = null;
    apply(latest);
  };
  return {
    push(value: T) {
      latest = value;
      if (!timer) timer = setTimeout(deliver, ms);
    },
    flush(value?: T) {
      if (arguments.length) latest = value as T;
      if (timer) clearTimeout(timer);
      deliver();
    },
  };
}
